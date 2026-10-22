// Supabase Edge Function: speak
// Turns an interview question into natural speech with Google Cloud Text-to-Speech (Chirp 3 HD voices).
// Secrets required (Edge Functions > Secrets): GOOGLE_TTS_API_KEY
// Google's free tier covers 1 million Chirp 3 HD characters a month; interview questions use a tiny fraction of that.
// The function checks the caller's sign-in itself, so it works whether or not "Verify JWT" is on.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...CORS, 'Content-Type': 'application/json'}});

// Works with both legacy keys (SUPABASE_SERVICE_ROLE_KEY) and the newer secret keys (SUPABASE_SECRET_KEYS).
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || '';
  try { const v = JSON.parse(raw); const first = typeof v === 'string' ? v : Object.values(v)[0]; if (first) return String(first); } catch { /* not JSON */ }
  return raw;
}
// Only signed-in journal users may call this function.
async function signedInUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {auth: {persistSession: false}});
  const {data, error} = await sb.auth.getUser(token);
  return error ? null : data.user;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'Use POST'}, 405);
  if (!(await signedInUser(req))) return json({error: 'Not signed in', code: 'session_expired'}, 401);

  const key = (Deno.env.get('GOOGLE_TTS_API_KEY') || '').trim();
  if (!key) return json({error: 'GOOGLE_TTS_API_KEY is not set in Edge Function secrets', code: 'tts_not_configured'}, 500);

  let body: {text?: unknown; voice?: unknown};
  try { body = await req.json(); } catch { return json({error: 'Invalid request body'}, 400); }
  const text = String(body.text ?? '').trim();
  if (!text) return json({error: 'Missing text'}, 400);
  if (text.length > 1200) return json({error: 'Text too long'}, 413);
  const asked = String(body.voice ?? '');
  const voice = /^en-US-Chirp3-HD-[A-Za-z]+$/.test(asked) ? asked : (Deno.env.get('GOOGLE_TTS_VOICE') || 'en-US-Chirp3-HD-Leda');

  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {'X-Goog-Api-Key': key, 'Content-Type': 'application/json'},
    body: JSON.stringify({input: {text}, voice: {languageCode: 'en-US', name: voice}, audioConfig: {audioEncoding: 'MP3', speakingRate: 0.97}}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.audioContent) {
    console.error('Google TTS error', res.status, data);
    return json({error: (data && data.error && data.error.message) || 'Text-to-speech failed', code: res.status === 429 ? 'rate_limited' : 'tts_error'}, res.status === 429 ? 429 : 502);
  }
  return json({audio: data.audioContent, voice});
});
