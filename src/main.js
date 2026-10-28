import './globals.js';
import './styles.css';
import { createClient } from '@supabase/supabase-js';
import { makeDb, makeUser, makeSample, makeAudio, makeSpeech, makeAdmin, makeRole, makeCommunityAdmin, downloads } from './platform.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const root = document.getElementById('root');
/* read before Supabase consumes it, so an expired invitation or sign-in link can be explained */
const ARRIVED_HASH = /access_token|error/.test(window.location.hash) ? window.location.hash : '';
/* Two experiences on one site:
   /share  Community Story Collection Portal (public, no account; talks only to the community Edge Function)
   /app    Internal Impact Management Portal (invited staff, signed in)
   /       Landing page: "Share Your Story" and "Staff Sign In". Signed-in staff go straight to /app. */
const PATH = (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase();
const PORTAL = PATH === '/share' || PATH.startsWith('/share/') ? 'share' : PATH === '/app' || PATH.startsWith('/app/') ? 'app' : 'root';
const toApp = () => { if (PORTAL !== 'app') history.replaceState(null, '', '/app' + window.location.search + window.location.hash); };
const {React, ReactDOM, htm} = window;
const html = htm.bind(React.createElement);
const {useState} = React;

function Brand(){
  return html`<div className="brand login-brand"><img className="brand-logo" src="/abg-logo.png" alt="Arts Bridging the Gap" /><span className="brand-text">Impact Journal</span></div>`;
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* Only shown when this device has no valid sign-in (first visit on a new browser, after logging out,
   or if access was revoked). Passwordless: we email a code and a link; either one signs you in. */
function Login({sb, notice}){
  const [email, setEmail] = useState(() => lsGet('abg-last-email') || '');
  const [stage, setStage] = useState('email');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(notice || '');
  const [wait, setWait] = useState(0);
  const clean = () => email.trim().toLowerCase();
  React.useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait(w => Math.max(0, w - 1)), 1000); return () => clearTimeout(t); }, [wait]);
  async function send(e){
    if (e) e.preventDefault();
    if (!clean()) return;
    setBusy(true); setMsg('');
    const {error} = await sb.auth.signInWithOtp({email: clean(), options: {shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname}});
    setBusy(false);
    if (error) {
      const m = error.message || '';
      if (/signup|not allowed|not found|invalid login/i.test(m)) setMsg("This email hasn't been invited yet. Ask the journal's administrator to invite you.");
      else if (/rate|seconds|too many/i.test(m)) { setMsg('A code was sent very recently. Check your email, or wait a minute and try again.'); if (stage === 'email') setStage('code'); }
      else setMsg("The email couldn't be sent. Check the address and your connection, then try again.");
      return;
    }
    lsSet('abg-last-email', clean());
    setCode(''); setStage('code'); setWait(60);
  }
  async function verify(e){
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setMsg('Enter the code from the email.'); return; }
    setBusy(true); setMsg('');
    let {error} = await sb.auth.verifyOtp({email: clean(), token, type: 'email'});
    if (error) { const again = await sb.auth.verifyOtp({email: clean(), token, type: 'invite'}); if (!again.error) error = null; }
    setBusy(false);
    if (error) setMsg(/rate|too many/i.test(error.message || '') ? 'Too many tries. Wait a few minutes, then try again.' : "That code didn't work. Use the code from the newest email, or send a new one.");
    // success: the app opens automatically
  }
  return html`<main className="login">
    <div className="login-card card">
      <${Brand} />
      ${stage === 'email' ? html`<form className="view" style=${{gap: '12px'}} onSubmit=${send}>
          <h1>Sign in</h1>
          <p className="muted">Enter the email address you were invited with. We'll email you a sign-in code. After that, this device stays signed in.</p>
          <label className="field"><span>Email</span><input id="login-email" className="input" type="email" name="email" autoComplete="email" inputMode="email" value=${email} onChange=${e => setEmail(e.target.value)} required /></label>
          ${msg ? html`<p className="error" role="alert">${msg}</p>` : null}
          <button className="btn btn-primary" type="submit" disabled=${busy}>${busy ? 'Sending…' : 'Email me a sign-in code'}</button>
        </form>`
      : html`<form className="view" style=${{gap: '12px'}} onSubmit=${verify}>
          <h1>Check your email</h1>
          <p>We sent a sign-in code to <strong>${clean()}</strong>. Type it here. If you're reading the email on this device, you can tap the link in it instead.</p>
          <label className="field"><span>Sign-in code</span><input id="login-code" className="input code-input" type="text" name="one-time-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength="10" value=${code} onChange=${e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus=${true} /></label>
          ${msg ? html`<p className="error" role="alert">${msg}</p>` : null}
          <button className="btn btn-primary" type="submit" disabled=${busy}>${busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="login-alt">
            <button type="button" className="btn btn-quiet btn-sm" disabled=${busy || wait > 0} onClick=${() => send()}>${wait > 0 ? 'Send a new code in ' + wait + 's' : 'Send a new code'}</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick=${() => { setStage('email'); setMsg(''); }}>Use a different email</button>
          </div>
        </form>`}
    </div>
  </main>`;
}

function Offline(){
  return html`<main className="login"><div className="login-card card"><${Brand} /><h1>Can't connect</h1>
    <p>The journal couldn't reach the internet. Check your Wi-Fi or data connection, then try again. You don't need to sign in again.</p>
    <button className="btn btn-primary" onClick=${() => window.location.reload()}>Try again</button></div></main>`;
}

/* Long-term sign-in. Supabase keeps the session in this browser and refreshes it automatically.
   A copy of the refresh token also lives in a secure HttpOnly cookie (see functions/api/session.js),
   so the session survives browsers clearing saved site data, such as Safari after a week away. */
function makeKeeper(sb){
  const H = {'X-ABG-Session': '1'};
  let last = '', timer = null;
  return {
    remember(){
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const {data} = await sb.auth.getSession();
        const rt = data && data.session && data.session.refresh_token;
        if (!rt || rt === last) return;
        try { const r = await fetch('/api/session', {method: 'POST', credentials: 'same-origin', headers: Object.assign({'Content-Type': 'application/json'}, H), body: JSON.stringify({refresh_token: rt})}); if (r.ok) last = rt; } catch (e) { /* tries again on the next refresh */ }
      }, 300);
    },
    async restore(){
      let r;
      try { r = await fetch('/api/session', {method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: H}); } catch (e) { return {offline: true}; }
      if (r.status === 503) return {offline: true};
      if (!r.ok) return {};
      let t; try { t = await r.json(); } catch (e) { return {}; }
      if (!t || !t.access_token || !t.refresh_token) return {};
      const {data, error} = await sb.auth.setSession({access_token: t.access_token, refresh_token: t.refresh_token});
      if (error || !data || !data.session) return {};
      last = t.refresh_token;
      return {session: data.session};
    },
    async forget(){ last = ''; clearTimeout(timer); try { await fetch('/api/session', {method: 'DELETE', credentials: 'same-origin', headers: H}); } catch (e) {} },
  };
}

function Landing(){
  return html`<main className="landing">
    <div className="landing-card">
      <img className="landing-logo" src="/abg-logo.png" alt="Arts Bridging the Gap" />
      <h1>ABG Impact Journal</h1>
      <p className="landing-lede">Stories of how Arts Bridging the Gap makes a difference in students' lives, careers and communities.</p>
      <a className="btn btn-primary btn-lg landing-share" href="/share" id="landing-share">Share Your Story</a>
      <p className="small muted">For students, alumni, staff, parents, volunteers and friends of ABG. No account needed.</p>
      <a className="landing-staff" href="/app" id="landing-staff">Staff Sign In</a>
    </div>
  </main>`;
}
function Setup(){
  return html`<main className="login"><div className="login-card card"><${Brand} /><h1>Setup needed</h1>
    <p>This copy of the app doesn't know which Supabase project to use. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as environment variables in Cloudflare Pages, then redeploy. The README walks through it.</p></div></main>`;
}

async function boot(){
  if (!URL_ || !KEY) { ReactDOM.createRoot(root).render(html`<${Setup} />`); return; }
  // implicit flow: an emailed link works in whichever browser it opens in
  const sb = createClient(URL_, KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit'}});
  const keeper = makeKeeper(sb);
  let mounted = false, userId = null, leaving = false, screen = null;
  const show = el => { if (!screen) screen = ReactDOM.createRoot(root); screen.render(el); };
  const start = user => {
    if (mounted) return;
    mounted = true; userId = user.id;
    if (screen) { screen.unmount(); screen = null; }
    const db = makeDb(sb);
    const caps = {db, user: makeUser(sb, user, db), sample: makeSample(sb, URL_, KEY), downloads};
    if (user.email) lsSet('abg-last-email', user.email);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    window.__platform = {audio: makeAudio(sb, URL_, KEY), speech: makeSpeech(sb, URL_, KEY), email: user.email,
      admin: makeAdmin(sb, URL_, KEY), getRole: makeRole(sb, user.email),
      // logs out this device only; other devices stay signed in
      signOut: async () => { leaving = true; await keeper.forget(); try { await sb.auth.signOut({scope: 'local'}); } catch (e) {} window.location.replace(window.location.pathname); }};
    window.__platform.community = makeCommunityAdmin(sb, URL_, KEY);
    window.claude = {use: async name => caps[name] || null};
    toApp();
    if (/access_token|error_description/.test(window.location.hash)) history.replaceState(null, '', window.location.pathname + window.location.search);
    import('./journal.js').then(() => window.__mountJournal(root));
  };
  // no async auth calls inside this callback (supabase-js can deadlock); defer them instead
  sb.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      keeper.remember();
      if (!mounted) setTimeout(() => start(session.user), 0);
      else if (userId && session.user.id !== userId) setTimeout(() => window.location.reload(), 0);
    } else if (event === 'SIGNED_OUT' && mounted && !leaving) {
      // the session ended while the app was open: restore it silently if possible, otherwise ask to sign in
      setTimeout(async () => { const r = await keeper.restore(); if (!r.session) window.location.reload(); }, 0);
    }
  });

  const {data} = await sb.auth.getSession();
  if (data && data.session) { start(data.session.user); return; }
  const restored = await keeper.restore();
  if (restored.session) { start(restored.session.user); return; }
  if (mounted) return;
  // the root page: visitors without a staff session choose between sharing a story and signing in
  if (PORTAL === 'root' && !ARRIVED_HASH) { show(html`<${Landing} />`); return; }
  toApp();
  if (restored.offline && navigator.onLine === false) { show(html`<${Offline} />`); return; }
  const linkProblem = /error_code=otp_expired|error=access_denied/.test(ARRIVED_HASH)
    ? 'That link has expired or was already used. Enter your email and we will send you a new sign-in code.' : '';
  if (ARRIVED_HASH) history.replaceState(null, '', window.location.pathname + window.location.search);
  show(html`<${Login} sb=${sb} notice=${linkProblem} />`);
}
if (PORTAL === 'share') {
  // the public portal never creates a Supabase client or touches staff sign-in
  import('./community.js').then(m => m.mountCommunity(root, {url: URL_, key: KEY})).catch(() => { root.innerHTML = '<p style="padding:24px;font-family:sans-serif">The page could not load. Check your connection and reload.</p>'; });
} else boot();
