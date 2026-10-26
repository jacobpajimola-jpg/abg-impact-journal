import './globals.js';
import './styles.css';
import { createClient } from '@supabase/supabase-js';
import { makeDb, makeUser, makeSample, makeAudio, makeSpeech, downloads } from './platform.js';
import './journal.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const root = document.getElementById('root');
/* read before Supabase consumes it: arriving from an invite email means this is someone's first visit */
const ARRIVED_FROM = (window.location.hash.match(/type=([a-z_]+)/) || [])[1] || '';
const {React, ReactDOM, htm} = window;
const html = htm.bind(React.createElement);
const {useState} = React;

function Brand(){
  return html`<div className="brand login-brand"><img className="brand-logo" src="/abg-logo.png" alt="Arts Bridging the Gap" /><span className="brand-text">Impact Journal</span></div>`;
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* Two ways in: a password (filled in by the phone or browser's password manager) or a one-time email link.
   People who haven't set a password yet use the link once, then set one. */
function Login({sb}){
  const [email, setEmail] = useState(() => lsGet('abg-last-email') || '');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const clean = () => email.trim().toLowerCase();
  async function signIn(e){
    e.preventDefault();
    if (!clean()) return;
    if (!pw) { setMsg('Enter your password, or use the email link below.'); return; }
    setState('signing'); setMsg('');
    const {error} = await sb.auth.signInWithPassword({email: clean(), password: pw});
    if (error) {
      setState('idle');
      const m = error.message || '';
      if (/invalid login|invalid credentials/i.test(m)) setMsg("That email and password don't match. If you haven't set a password yet, or forgot it, use the email link below.");
      else if (/rate|too many/i.test(m)) setMsg('Too many attempts. Wait a few minutes and try again.');
      else setMsg("Couldn't sign in just now. Check your connection and try again.");
      return;
    }
    lsSet('abg-last-email', clean());
  }
  async function sendLink(){
    if (!clean()) { setMsg('Enter your email first.'); return; }
    setState('sending'); setMsg('');
    const {error} = await sb.auth.signInWithOtp({email: clean(), options: {shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname}});
    if (error) {
      setState('idle');
      const m = error.message || '';
      if (/signup|not allowed|not found|invalid login/i.test(m)) setMsg("This email hasn't been invited yet. Ask the journal's administrator to invite you.");
      else if (/rate|seconds|too many/i.test(m)) setMsg('Too many sign-in emails were sent recently. Wait a few minutes and try again.');
      else setMsg("The sign-in email couldn't be sent. Check the address and try again.");
      return;
    }
    lsSet('abg-last-email', clean());
    setState('sent');
  }
  return html`<main className="login">
    <div className="login-card card">
      <${Brand} />
      <h1>Sign in</h1>
      ${state === 'sent'
        ? html`<p>Check <strong>${clean()}</strong> for a sign-in link. Copy the link and open it in the browser you'll use for the journal (for example Safari or Chrome), not inside your email app. After that you can set a password in Settings, so you won't need emailed links again.</p><button className="btn btn-quiet btn-sm" onClick=${() => setState('idle')}>Back to sign in</button>`
        : html`<form className="view" style=${{gap: '12px'}} onSubmit=${signIn}>
            <p className="muted">ABG Impact Journal is private to invited team members.</p>
            <label className="field"><span>Email</span><input id="login-email" className="input" type="email" name="email" autoComplete="username" value=${email} onChange=${e => setEmail(e.target.value)} required /></label>
            <label className="field"><span>Password</span><span className="pw-wrap"><input id="login-password" className="input" type=${show ? 'text' : 'password'} name="password" autoComplete="current-password" value=${pw} onChange=${e => setPw(e.target.value)} /><button type="button" className="btn btn-quiet btn-sm" onClick=${() => setShow(!show)} aria-label=${show ? 'Hide password' : 'Show password'}>${show ? 'Hide' : 'Show'}</button></span></label>
            ${msg ? html`<p className="error" role="alert">${msg}</p>` : null}
            <button className="btn btn-primary" type="submit" disabled=${state !== 'idle'}>${state === 'signing' ? 'Signing in…' : 'Sign in'}</button>
            <div className="login-alt"><span className="small muted">No password yet, or forgot it?</span><button type="button" className="btn btn-ghost btn-sm" disabled=${state !== 'idle'} onClick=${sendLink}>${state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}</button></div>
          </form>`}
    </div>
  </main>`;
}

function Setup(){
  return html`<main className="login"><div className="login-card card"><${Brand} /><h1>Setup needed</h1>
    <p>This copy of the app doesn't know which Supabase project to use. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as environment variables in Cloudflare Pages, then redeploy. The README walks through it.</p></div></main>`;
}

async function boot(){
  if (!URL_ || !KEY) { ReactDOM.createRoot(root).render(html`<${Setup} />`); return; }
  const sb = createClient(URL_, KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}});
  const {data} = await sb.auth.getSession();
  let mounted = false;
  const start = user => {
    if (mounted) return;
    mounted = true;
    const db = makeDb(sb);
    const caps = {db, user: makeUser(sb, user, db), sample: makeSample(sb, URL_, KEY), downloads};
    const meta = user.user_metadata || {};
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    if (user.email) lsSet('abg-last-email', user.email);
    window.__platform = {audio: makeAudio(sb, URL_, KEY), speech: makeSpeech(sb, URL_, KEY), signOut: async () => { await sb.auth.signOut(); window.location.reload(); }, email: user.email,
      hasPassword: !!meta.has_password, arrivedFrom: ARRIVED_FROM,
      setPassword: async pw => {
        const {error} = await sb.auth.updateUser({password: pw, data: {has_password: true}});
        if (!error) { window.__platform.hasPassword = true; return {}; }
        const m = error.message || '', code = error.code || '';
        if (code === 'same_password' || /different from the old/i.test(m)) { window.__platform.hasPassword = true; return {error: "That's already your password, so you're all set."}; }
        if (code === 'weak_password' || /at least|weak|characters/i.test(m)) return {error: 'Choose a stronger password: at least 8 characters, mixing letters and numbers.'};
        if (code === 'reauthentication_needed' || /reauthenticat/i.test(m)) return {error: 'For security, sign out, sign back in with an email link, then set your password right away.'};
        return {error: "The password couldn't be saved. Check your connection and try again."};
      }};
    window.claude = {use: async name => caps[name] || null};
    if (window.location.hash.includes('access_token')) history.replaceState(null, '', window.location.pathname);
    window.__mountJournal(root);
  };
  if (data && data.session) start(data.session.user);
  else {
    const r = ReactDOM.createRoot(root);
    r.render(html`<${Login} sb=${sb} />`);
    sb.auth.onAuthStateChange((_e, session) => { if (session && !mounted) { r.unmount(); start(session.user); } });
  }
}
boot();
