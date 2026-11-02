import './globals.js';
import './styles.css';
import { createClient } from '@supabase/supabase-js';
import { makeDb, makeUser, makeSample, makeAudio, makeSpeech, makeAdmin, makeRole, makeCommunityAdmin, makePortalAccess, downloads } from './platform.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const root = document.getElementById('root');
/* read before Supabase consumes it, so an expired invitation or sign-in link can be explained */
const ARRIVED_HASH = /access_token|error/.test(window.location.hash) ? window.location.hash : '';
/* Two experiences on one site:
   /share  Community Story Collection Portal (public, no account; talks only to the community Edge Function)
   /app    Internal Impact Management Portal (invited staff, signed in)
   /       Landing page: "Share Your Story" and "Staff Sign In". Signed-in staff go straight to /app
           (or back to the Share Your Story page in Preview Mode, if that's the portal they last switched to). */
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
   or if access was revoked). Passwordless and invitation-only, all through Supabase Auth:
   - one email holds a 6-digit code AND a sign-in link; either signs into the same account
   - the code is checked by Supabase (expires after 10 minutes, works once, rate limited); nothing is checked here
   - shouldCreateUser: false, so an email that wasn't invited by an administrator can't get in
   - installed app (home-screen PWA): the code comes first, because a link would open the browser instead */
const CODE_LEN = 6;            // Supabase > Authentication > Email > "Email OTP length"
const CODE_MINUTES = 10;       // Supabase > Authentication > Email > "Email OTP expiration" (600 seconds)
const RESEND_SECONDS = 60;     // Supabase only sends a new email to the same address once a minute
const inApp = () => { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } };
function Login({sb, notice}){
  const app = inApp();
  const [email, setEmail] = useState(() => lsGet('abg-last-email') || '');
  const [stage, setStage] = useState('email');          // email | code | link
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(notice || '');
  const [info, setInfo] = useState('');
  /* resend cooldown counts down to a fixed time, so it stays right after the phone sleeps */
  const [until, setUntil] = useState(0);
  const [, setTick] = useState(0);
  const wait = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  const setWait = sec => setUntil(Date.now() + sec * 1000);
  const sentAt = React.useRef(0);
  const codeRef = React.useRef(null);
  const clean = () => email.trim().toLowerCase();
  React.useEffect(() => { if (!wait) return; const t = setTimeout(() => setTick(x => x + 1), 1000); return () => clearTimeout(t); });
  React.useEffect(() => { if (stage === 'code') { try { codeRef.current && codeRef.current.focus(); } catch (e) {} } }, [stage]);
  async function send(e, opts){
    if (e) e.preventDefault();
    const o = opts || {};
    if (!clean() || !/^\S+@\S+\.\S+$/.test(clean())) { setMsg('Enter the email address you were invited with.'); return; }
    if (o.resend && wait > 0) return;
    setBusy(true); setMsg(''); setInfo('');
    const {error} = await sb.auth.signInWithOtp({email: clean(), options: {shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname}});
    setBusy(false);
    if (error) {
      const m = error.message || '';
      if (/signup|not allowed|not found|invalid login|user not found/i.test(m)) setMsg("This email hasn't been invited yet. Ask the journal's administrator to invite you.");
      else if (/rate|seconds|too many|security purposes/i.test(m) || error.status === 429) { setMsg('A code was sent very recently. Check your email, or wait a minute and send a new one.'); if (stage === 'email') { setStage('code'); setWait(RESEND_SECONDS); } }
      else setMsg("The email couldn't be sent. Check the address and your connection, then try again.");
      return;
    }
    lsSet('abg-last-email', clean());
    sentAt.current = Date.now();
    setCode(''); setWait(RESEND_SECONDS);
    if (o.resend) setInfo('A new code is on its way. Use the newest email: earlier codes no longer work.');
    if (stage === 'email') setStage(o.link ? 'link' : 'code');
  }
  async function verify(e, pasted){
    if (e) e.preventDefault();
    const token = String(pasted != null ? pasted : code).replace(/\D/g, '');
    if (token.length < CODE_LEN) { setMsg('Enter the ' + CODE_LEN + '-digit code from the email.'); return; }
    setBusy(true); setMsg(''); setInfo('');
    // "email" covers sign-in codes; "invite" covers the code in an invitation email (first sign-in)
    let {error} = await sb.auth.verifyOtp({email: clean(), token, type: 'email'});
    if (error && !(error.status === 429 || /rate|too many/i.test(error.message || ''))) {
      const again = await sb.auth.verifyOtp({email: clean(), token, type: 'invite'});
      if (!again.error) error = null;
    }
    setBusy(false);
    if (!error) return;     // signed in: the journal opens automatically and stays signed in on this device
    const m = error.message || '';
    if (error.status === 429 || /rate|too many/i.test(m)) setMsg('Too many tries. Wait a few minutes, then try again or send a new code.');
    else if (sentAt.current && Date.now() - sentAt.current > CODE_MINUTES * 60e3) setMsg('This code has expired. Codes last ' + CODE_MINUTES + ' minutes. Send a new code and use it right away.');
    else setMsg("That code didn't work. Check that it matches the newest email: each code works once, and sending a new code replaces the old one.");
    setCode('');
    try { codeRef.current && codeRef.current.focus(); } catch (er) {}
  }
  const changeEmail = () => { setStage('email'); setMsg(''); setInfo(''); setCode(''); };
  const resendBtn = (label) => html`<button type="button" className="btn btn-quiet btn-sm" id="login-resend" disabled=${busy || wait > 0} onClick=${() => send(null, {resend: true})}>${wait > 0 ? (label || 'Resend code') + ' in ' + wait + 's' : (label || 'Resend code')}</button>`;
  return html`<main className="login">
    <div className="login-card card">
      <${Brand} />
      ${stage === 'email' ? html`<form className="view" style=${{gap: '12px'}} onSubmit=${send} noValidate>
          <h1>Sign in</h1>
          <p className="muted">Enter the email address you were invited with. We'll email you a ${CODE_LEN}-digit sign-in code${app ? '. You can sign in without leaving the app.' : ' and a sign-in link. After that, this device stays signed in.'}</p>
          <label className="field"><span>Email</span><input id="login-email" className="input" type="email" name="email" autoComplete="email" inputMode="email" value=${email} onChange=${e => setEmail(e.target.value)} required /></label>
          ${msg ? html`<p className="error" role="alert">${msg}</p>` : null}
          <button className="btn btn-primary" type="submit" disabled=${busy}>${busy ? 'Sending…' : 'Email me a sign-in code'}</button>
        </form>`
      : stage === 'code' ? html`<form className="view" style=${{gap: '12px'}} onSubmit=${verify} noValidate>
          <h1>Check your email</h1>
          <p>We sent a ${CODE_LEN}-digit code to <strong className="login-addr">${clean()}</strong>. Enter it below to sign in.${app ? '' : ' Or tap the link in the same email.'}</p>
          <label className="field"><span>Sign-in code</span>
            <input id="login-code" ref=${codeRef} className="input code-input" type="text" name="one-time-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*"
              maxLength="8" placeholder=${'•'.repeat(CODE_LEN)} aria-describedby="login-code-hint" value=${code}
              onChange=${e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onPaste=${e => { const t = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, ''); if (t.length >= CODE_LEN && t.length <= 8) { e.preventDefault(); setCode(t); verify(null, t); } }} /></label>
          <p className="tiny muted" id="login-code-hint">The code expires after ${CODE_MINUTES} minutes and works once.</p>
          ${info ? html`<p className="notice small" role="status">${info}</p>` : null}
          ${msg ? html`<p className="error" role="alert">${msg}</p>` : null}
          <button className="btn btn-primary" type="submit" id="login-verify" disabled=${busy || !code}>${busy ? 'Signing in…' : 'Verify & Sign In'}</button>
          <div className="login-alt">
            ${resendBtn()}
            <button type="button" className="btn btn-quiet btn-sm" id="login-use-link" onClick=${() => { setStage('link'); setMsg(''); setInfo(''); }}>Use Email Link Instead</button>
            <button type="button" className="btn btn-quiet btn-sm" id="login-change" onClick=${changeEmail}>Change email</button>
          </div>
        </form>`
      : html`<div className="view" style=${{gap: '12px'}}>
          <h1>Use the email link</h1>
          <p>Open the email we sent to <strong className="login-addr">${clean()}</strong> and tap <strong>sign in</strong>. ${app ? '' : 'Open it on this device and in this browser: the journal opens signed in.'}</p>
          ${app ? html`<p className="notice small" id="login-app-note">You're using the installed app. The link opens your web browser, so you'd be signed in there instead of here. To sign in to this app, use the code.</p>` : null}
          <p className="tiny muted">The link expires after ${CODE_MINUTES} minutes and works once. The same email also has a ${CODE_LEN}-digit code.</p>
          ${info ? html`<p className="notice small" role="status">${info}</p>` : null}
          ${msg ? html`<p className="error" role="alert">${msg}</p>` : null}
          <button type="button" className="btn btn-primary" id="login-use-code" onClick=${() => { setStage('code'); setMsg(''); setInfo(''); }}>Enter the code instead</button>
          <div className="login-alt">${resendBtn('Resend email')}<button type="button" className="btn btn-quiet btn-sm" id="login-change" onClick=${changeEmail}>Change email</button></div>
        </div>`}
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
    // Portal Access: reopen the portal an authorized consultant last switched to (the portal re-checks on the server)
    if (PORTAL === 'root' && !ARRIVED_HASH && lsGet('abg-portal') === 'community') { mounted = true; window.location.replace('/share#preview'); return; }
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
    window.__platform.canPreviewPortal = makePortalAccess(sb);
    window.__platform.openCommunityPreview = () => { lsSet('abg-portal', 'community'); window.location.assign('/share#preview'); };
    lsSet('abg-portal', 'staff');
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
  // the public portal doesn't sign anyone in. Only when an authorized consultant switched here from Settings
  // (Preview Mode) does it read their existing staff sign-in, to prove to the server who is testing.
  let staffSb = null;
  const staffToken = async () => {
    if (!URL_ || !KEY) return null;
    if (!staffSb) staffSb = createClient(URL_, KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit'}});
    try {
      const {data} = await staffSb.auth.getSession();
      if (data && data.session) return data.session.access_token;
      const r = await makeKeeper(staffSb).restore();
      return r.session ? r.session.access_token : null;
    } catch (e) { return null; }
  };
  const leavePortal = () => lsSet('abg-portal', 'staff');
  import('./community.js').then(m => m.mountCommunity(root, {url: URL_, key: KEY, staffToken, leavePortal, wantsPreview: () => lsGet('abg-portal') === 'community'})).catch(() => { root.innerHTML = '<p style="padding:24px;font-family:sans-serif">The page could not load. Check your connection and reload.</p>'; });
} else boot();
