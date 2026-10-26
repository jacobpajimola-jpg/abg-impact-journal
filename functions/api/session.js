// Cloudflare Pages Function: /api/session
// Keeps team members signed in for the long term.
//
// Browsers can clear a website's saved data (Safari does after about 7 days without a visit), which
// would sign people out. So the long-lived Supabase refresh token is also kept in a first-party,
// HttpOnly, Secure cookie that page scripts cannot read. When the app opens without a saved session,
// it asks this endpoint to restore one: the function exchanges the cookie's refresh token with
// Supabase for a fresh session and stores the rotated token back in the cookie.
//
//   POST   /api/session  {refresh_token}  remember the current session's refresh token
//   GET    /api/session                   restore a session from the cookie (401 if there is none)
//   DELETE /api/session                   forget it (log out on this device)
//
// Uses the Pages environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (already set for the build).
// Requests must come from this site (same Origin) and carry the X-ABG-Session header, so other sites can't use it.

const COOKIE = 'abg_session';
const MAX_AGE = 60 * 60 * 24 * 400; // 400 days, the longest browsers allow; renewed on every visit

const json = (body, status, cookie) => {
  const headers = new Headers({'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), {status: status || 200, headers});
};
const setCookie = token => `${COOKIE}=${encodeURIComponent(token)}; Path=/api/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
const clearCookie = () => `${COOKIE}=; Path=/api/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
function readCookie(request){
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]*)'));
  return m && m[1] ? decodeURIComponent(m[1]) : '';
}
function allowed(request){
  if (request.headers.get('X-ABG-Session') !== '1') return false;
  const origin = request.headers.get('Origin');
  // same-origin GET requests may omit Origin; when present it must be this site
  return !origin || origin === new URL(request.url).origin;
}
function config(env){
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '');
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key ? {url, key} : null;
}
const plausible = t => typeof t === 'string' && t.length >= 8 && t.length <= 2048 && /^[A-Za-z0-9._~+/=-]+$/.test(t);

export async function onRequest(context){
  const {request, env} = context;
  if (!allowed(request)) return json({error: 'Forbidden'}, 403);
  const method = request.method;

  if (method === 'DELETE') return json({ok: true}, 200, clearCookie());

  if (method === 'POST') {
    let body; try { body = await request.json(); } catch (e) { return json({error: 'Invalid body'}, 400); }
    if (!plausible(body && body.refresh_token)) return json({error: 'Invalid token'}, 400);
    return json({ok: true}, 200, setCookie(body.refresh_token));
  }

  if (method === 'GET') {
    const token = readCookie(request);
    if (!plausible(token)) return json({error: 'No saved session', code: 'none'}, 401);
    const cfg = config(env);
    if (!cfg) return json({error: 'Session restore is not configured', code: 'not_configured'}, 501);
    let res, data;
    try {
      res = await fetch(cfg.url + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: {apikey: cfg.key, 'Content-Type': 'application/json'},
        body: JSON.stringify({refresh_token: token}),
      });
      data = await res.json().catch(() => null);
    } catch (e) {
      return json({error: 'Could not reach the sign-in service', code: 'unavailable'}, 503);
    }
    if (res.ok && data && data.access_token && data.refresh_token) {
      return json({access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, expires_at: data.expires_at, token_type: data.token_type}, 200, setCookie(data.refresh_token));
    }
    if (res.status === 429 || res.status >= 500) return json({error: 'The sign-in service is busy', code: 'unavailable'}, 503);
    // revoked, expired or already used: the person signs in again with an email code
    return json({error: 'Saved session is no longer valid', code: 'expired'}, 401, clearCookie());
  }

  return json({error: 'Method not allowed'}, 405);
}
