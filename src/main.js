import './globals.js';
import './styles.css';
import { createClient } from '@supabase/supabase-js';
import { makeDb, makeUser, makeSample, makeAudio, makeSpeech, downloads } from './platform.js';
import './journal.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const root = document.getElementById('root');
const {React, ReactDOM, htm} = window;
const html = htm.bind(React.createElement);
const {useState} = React;

function Brand(){
  return html`<div className="brand"><svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path className="bm-1" d="M16 3c6.5 0 12.5 4.6 12.5 11.4 0 7.6-6.4 14.6-13.6 14.6C8.4 29 3.5 23.7 3.5 17.2 3.5 9.7 9 3 16 3z"/><circle className="bm-2" cx="21.5" cy="11" r="3.4"/><circle className="bm-3" cx="11.5" cy="20" r="2.3"/></svg><span className="brand-text"><strong>ABG</strong> Impact Journal</span></div>`;
}

function Login({sb}){
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  async function send(e){
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending'); setMsg('');
    const {error} = await sb.auth.signInWithOtp({email: email.trim(), options: {shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname}});
    if (error) {
      setState('idle');
      const m = error.message || '';
      if (/signup|not allowed|not found|invalid login/i.test(m)) setMsg("This email hasn't been invited yet. Ask the journal's administrator to invite you.");
      else if (/rate|seconds|too many/i.test(m)) setMsg('Too many sign-in emails were sent recently. Wait a few minutes and try again.');
      else setMsg("The sign-in email couldn't be sent. Check the address and try again.");
      return;
    }
    setState('sent');
  }
  return html`<main className="login">
    <div className="login-card card">
      <${Brand} />
      <h1>Sign in</h1>
      ${state === 'sent'
        ? html`<p>Check <strong>${email}</strong> for a sign-in link from Supabase. Open it on this device. You can close this tab.</p><button className="btn btn-quiet btn-sm" onClick=${() => setState('idle')}>Use a different email</button>`
        : html`<form className="view" style=${{gap: '12px'}} onSubmit=${send}>
            <p className="muted">ABG Impact Journal is private. Enter the email address you were invited with, and we'll send you a sign-in link. No password needed.</p>
            <label className="field"><span>Email</span><input id="login-email" className="input" type="email" autoComplete="email" value=${email} onChange=${e => setEmail(e.target.value)} required /></label>
            ${msg ? html`<p className="error" role="alert">${msg}</p>` : null}
            <button className="btn btn-primary" type="submit" disabled=${state === 'sending'}>${state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}</button>
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
    window.__platform = {audio: makeAudio(sb, URL_, KEY), speech: makeSpeech(sb, URL_, KEY), signOut: async () => { await sb.auth.signOut(); window.location.reload(); }, email: user.email};
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
