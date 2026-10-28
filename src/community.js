/* ABG Impact Journal: Community Story Collection Portal (/share).
   A separate, welcoming experience for students, alumni, staff, parents, volunteers and friends of ABG.
   It never signs anyone in and talks only to the "community" Edge Function, which checks a private link
   token for every request. Nothing here can read the journal, other submissions or staff tools. */
import './community.css';
import { RELATIONSHIPS, SUBJECTS, communityStoryType } from './core/shared.js';

const {React, ReactDOM, htm} = window;
const html = htm.bind(React.createElement);
const {useState, useEffect, useRef} = React;

const ssGet = k => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ssDel = k => { try { sessionStorage.removeItem(k); } catch (e) {} };
const DRAFT = 'abg-share-draft';

function makeApi(url, key){
  return async (action, payload) => {
    let res;
    try { res = await fetch(url + '/functions/v1/community', {method: 'POST', headers: {'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key}, body: JSON.stringify(Object.assign({action}, payload || {}))}); }
    catch (e) { throw {message: "We couldn't connect. Check your internet connection and try again. Your answers are saved."}; }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw {message: (data && data.error) || 'Something went wrong. Please try again.', code: data && data.code, status: res.status};
    return data;
  };
}
const ICON = {
  student: '<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/>',
  alumni: '<circle cx="12" cy="8" r="4"/><path d="M5 21c1-4 3.5-6 7-6s6 2 7 6"/><path d="M16 4l2-2M8 4L6 2"/>',
  staff: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12.5h18"/>',
  parent: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="10" r="2.3"/><path d="M2.5 20c.6-3.6 2.8-6 5.5-6s4.9 2.4 5.5 6M13.5 20c.4-2.6 1.8-4.4 3.5-4.4s3.1 1.8 3.5 4.4"/>',
  volunteer: '<path d="M12 21s-7-4.5-9-9.5C1.7 8 4 5 7 5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3 0 5.3 3 4 6.5-2 5-9 9.5-9 9.5z"/>',
  friend: '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>',
  self: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.5 4.2-7 8-7s6.8 2.5 8 7"/>',
  witnessed: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  chat: '<path d="M4 5h16v11H8l-4 4V5z"/><path d="M8 9.5h8M8 12.5h5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};
const Icon = ({name, size}) => html`<svg width=${size || 22} height=${size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML=${{__html: ICON[name] || ''}}></svg>`;
const REL_ICON = {current_student: 'student', alumni: 'alumni', staff: 'staff', parent: 'parent', volunteer: 'volunteer', friend: 'friend'};
const STEPS = ['Connection', 'Whose story', 'About you', 'Interview style', 'Interview', 'Review'];

function Art(){
  return html`<svg className="sh-art" viewBox="0 0 320 200" aria-hidden="true" focusable="false">
    <path d="M30 120c10-60 80-95 140-80s110 60 120 110c-60 25-200 30-260-30z" fill="var(--sh-blob-1)"/>
    <circle cx="250" cy="55" r="34" fill="var(--sh-blob-2)"/>
    <path d="M70 150c30-40 70-55 110-45 25 7 45 25 60 45" fill="none" stroke="var(--sh-accent)" stroke-width="7" stroke-linecap="round"/>
    <circle cx="96" cy="78" r="13" fill="#F4C542"/><circle cx="138" cy="62" r="11" fill="#EC6FB5"/><circle cx="178" cy="70" r="12" fill="#2B9FE0"/><circle cx="214" cy="92" r="10" fill="#F59A3C"/>
  </svg>`;
}
function Header({onBack, step}){
  return html`<header className="sh-top">
    ${onBack ? html`<button type="button" className="sh-icon" onClick=${onBack} aria-label="Back"><${Icon} name="back" /></button>` : html`<span className="sh-icon-spacer"></span>`}
    <a className="sh-brand" href="/share" aria-label="Share Your Story home"><img src="/abg-logo.png" alt="Arts Bridging the Gap" /></a>
    <span className="sh-icon-spacer"></span>
    ${step != null ? html`<div className="sh-progress" role="progressbar" aria-valuemin="1" aria-valuemax=${STEPS.length} aria-valuenow=${step + 1} aria-label=${'Step ' + (step + 1) + ' of ' + STEPS.length + ': ' + STEPS[step]}>
      <div className="sh-progress-bar"><span style=${{width: Math.round(100 * (step + 1) / STEPS.length) + '%'}}></span></div>
      <p className="sh-progress-text">Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}</p>
    </div>` : null}
  </header>`;
}
const Choice = ({id, icon, label, sub, on, onClick}) => html`<button type="button" id=${id} className=${'sh-choice' + (on ? ' on' : '')} aria-pressed=${!!on} onClick=${onClick}>
  ${icon ? html`<span className="sh-choice-ic"><${Icon} name=${icon} /></span>` : null}<span className="sh-choice-text"><strong>${label}</strong>${sub ? html`<small>${sub}</small>` : null}</span>
  <span className="sh-choice-check">${on ? html`<${Icon} name="check" size=${18} />` : null}</span>
</button>`;
const Seg = ({value, onChange, options, label, idp}) => html`<div className="sh-seg" role="group" aria-label=${label}>${options.map(o => html`<button type="button" key=${o[0]} id=${idp ? idp + '-' + o[0] : undefined} aria-pressed=${value === o[0]} onClick=${() => onChange(value === o[0] ? '' : o[0])}>${o[1]}</button>`)}</div>`;
const Field = ({label, hint, children}) => html`<label className="sh-field"><span>${label}</span>${children}${hint ? html`<small>${hint}</small>` : null}</label>`;

function pickMime(){
  const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  try { for (const m of c) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
  return '';
}
const blobToB64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(blob); });
const speech = (() => {
  const ss = window.speechSynthesis; const ok = !!(ss && window.SpeechSynthesisUtterance);
  return {ok, say(t){ if (!ok || !t) return; try { ss.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = 0.95; ss.speak(u); } catch (e) {} }, stop(){ if (ok) { try { ss.cancel(); } catch (e) {} } }};
})();

/* voice answer: record, stop, transcribe on the server (the audio is never stored), then edit the text */
function Recorder({api, token, onText, disabled}){
  const [state, setState] = useState('idle');
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const rec = useRef(null), chunks = useRef([]), stream = useRef(null), timer = useRef(null);
  useEffect(() => () => { clearInterval(timer.current); try { if (rec.current && rec.current.state !== 'inactive') rec.current.stop(); } catch (e) {} if (stream.current) stream.current.getTracks().forEach(t => t.stop()); }, []);
  async function start(){
    setErr('');
    if (!navigator.mediaDevices || !window.MediaRecorder) { setErr("This browser can't record audio. Please type your answer instead."); return; }
    try { stream.current = await navigator.mediaDevices.getUserMedia({audio: true}); }
    catch (e) { setErr('We need permission to use your microphone. Allow it in your browser settings, or type your answer instead.'); return; }
    const mime = pickMime();
    const r = new MediaRecorder(stream.current, mime ? {mimeType: mime} : undefined);
    chunks.current = [];
    r.ondataavailable = e => { if (e.data && e.data.size) chunks.current.push(e.data); };
    r.onstop = async () => {
      clearInterval(timer.current);
      if (stream.current) { stream.current.getTracks().forEach(t => t.stop()); stream.current = null; }
      const blob = new Blob(chunks.current, {type: r.mimeType || mime || 'audio/webm'});
      chunks.current = [];
      if (!blob.size) { setState('idle'); return; }
      setState('busy');
      try { const out = await api('transcribe', {token, audio: await blobToB64(blob), mime: blob.type}); onText(out.text || ''); setState('idle'); }
      catch (e) { setErr(e.message || "We couldn't turn that into text. Please try again or type your answer."); setState('idle'); }
    };
    r.start(1000); rec.current = r; setSecs(0); setState('rec');
    timer.current = setInterval(() => setSecs(s => { if (s + 1 >= 300) { try { r.stop(); } catch (e) {} } return s + 1; }), 1000);
  }
  const stop = () => { try { rec.current && rec.current.stop(); } catch (e) {} };
  return html`<div className="sh-rec">
    ${state === 'rec' ? html`<button type="button" className="sh-rec-btn on" id="sh-stop" onClick=${stop}><${Icon} name="stop" size=${26} /><span>Stop · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</span></button>`
      : state === 'busy' ? html`<button type="button" className="sh-rec-btn" disabled=${true}><span className="sh-dots"><i></i><i></i><i></i></span><span>Turning your words into text…</span></button>`
      : html`<button type="button" className="sh-rec-btn" id="sh-record" disabled=${disabled} onClick=${start}><${Icon} name="mic" size=${26} /><span>Tap to record your answer</span></button>`}
    ${err ? html`<p className="sh-error" role="alert">${err}</p>` : null}
  </div>`;
}

function Welcome({go, invite, onStatus}){
  return html`<main className="sh-page sh-welcome">
    <${Header} />
    <section className="sh-hero">
      <${Art} />
      <p className="sh-eyebrow">Arts Bridging the Gap</p>
      <h1>Share Your Story</h1>
      <p className="sh-lede">Your story matters. Help us understand how ABG has made a difference in your life, education, career, or community.</p>
      ${invite && invite.valid ? html`<p className="sh-note sh-invite"><${Icon} name="check" size=${18} /> <span>${invite.firstName ? 'Hi ' + invite.firstName + '! ' : ''}You have a personal invitation from ABG.</span></p>` : null}
      ${invite && !invite.valid ? html`<p className="sh-note sh-warn" role="alert">This invitation link has expired or was already used. You can still share your story, or ask ABG for a new link.</p>` : null}
      <button type="button" className="sh-btn sh-btn-primary sh-btn-lg" id="sh-start" onClick=${go}>Get Started</button>
      <p className="sh-small">A short, guided conversation. Speak or type, about 10 minutes. No account needed.</p>
    </section>
    <section className="sh-how" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      <ol className="sh-how-list">
        <li><strong>Tell us how you know ABG.</strong> A student, alum, staff member, parent, volunteer or friend.</li>
        <li><strong>Talk or type.</strong> A friendly interviewer asks a few questions, one at a time. Skip anything you like.</li>
        <li><strong>Check your story.</strong> You see what we wrote down and fix anything before you send it.</li>
        <li><strong>ABG reviews it.</strong> Staff read every story. You choose whether it can ever be shared publicly.</li>
      </ol>
      <details className="sh-faq"><summary>How will my story be used?</summary><p>ABG staff read your story and may use what you share, without private details, to understand and report on the difference its programs make, for example to funders and schools. Your story is only shared publicly if you say yes. Please don't include last names, addresses or other private details.</p></details>
      <details className="sh-faq"><summary>What if I'm under 18?</summary><p>We need permission from your parent or guardian first. Ask ABG staff for a personal link: they will check with your parent or guardian. A parent or guardian can also share what they've seen.</p></details>
      <details className="sh-faq"><summary>Can I change or remove my story later?</summary><p>Yes. After you send it, you get a private link. Use it to check your story's status, answer ABG's questions, make corrections or ask us to remove it.</p></details>
      <p className="sh-small"><button type="button" className="sh-link" onClick=${onStatus}>Already shared a story? Open it with your private link</button></p>
    </section>
  </main>`;
}

function Intake({st, set, step, setStep, invite, api, onStarted}){
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const i = st.intake;
  const up = patch => set(Object.assign({}, st, {intake: Object.assign({}, st.intake, patch)}));
  const guardianOk = invite && invite.valid && invite.guardianConsent;
  const minorBlocked = i.adult === false && !guardianOk;
  const back = () => { setErr(''); if (step === 0) set(Object.assign({}, st, {screen: 'welcome'})); else setStep(step - 1); };
  async function begin(){
    setErr('');
    if (!st.privacy) { setErr('Please read and agree to how ABG will use your story.'); return; }
    if (i.method === 'voice' && !st.recording) { setErr('Please agree to the voice recording terms, or choose a written interview.'); return; }
    setBusy(true);
    try {
      const r = await api('start', {intake: i, invite: invite && invite.valid ? invite.token : undefined, privacyAccepted: true, recordingConsent: i.method === 'voice' && !!st.recording});
      onStarted(r);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  let body, canNext = true;
  if (step === 0) {
    canNext = !!i.relationship && i.adult != null && !minorBlocked && !(i.adult === false && !i.guardianAck);
    body = html`<h1 className="sh-q">How are you connected to ABG?</h1>
      <div className="sh-choices">${RELATIONSHIPS.map(r => html`<${Choice} key=${r.id} id=${'rel-' + r.id} icon=${REL_ICON[r.id]} label=${r.label} on=${i.relationship === r.id} onClick=${() => up({relationship: r.id, perspective: i.perspective || (r.id === 'parent' ? 'witnessed' : ''), subject: r.id === 'parent' ? 'student' : i.subject})} />`)}</div>
      <div className="sh-block"><p className="sh-label" id="age-l">Are you 18 or older?</p>
        <${Seg} label="Are you 18 or older?" idp="age" value=${i.adult === true ? 'yes' : i.adult === false ? 'no' : ''} onChange=${v => up({adult: v === 'yes' ? true : v === 'no' ? false : null, guardianAck: false})} options=${[['yes', 'Yes, 18 or older'], ['no', 'No, under 18']]} /></div>
      ${minorBlocked ? html`<div className="sh-note sh-warn" role="alert" id="sh-guardian">
        <strong>We need your parent or guardian's permission first.</strong>
        <p>Thank you for wanting to share! Because you're under 18, please ask ABG staff for a personal link. They'll check with your parent or guardian before you share. Your parent or guardian can also share what they've seen using this page.</p>
      </div>` : null}
      ${i.adult === false && guardianOk ? html`<div className="sh-note sh-ok"><p>ABG has your parent or guardian's permission for you to share your story.</p>
        <label className="sh-check"><input type="checkbox" id="sh-guardian-ack" checked=${!!i.guardianAck} onChange=${e => up({guardianAck: e.target.checked})} /> My parent or guardian knows I'm sharing my story.</label></div>` : null}`;
  } else if (step === 1) {
    const w = i.perspective === 'witnessed';
    canNext = !!i.perspective && (!w || !!i.subject);
    body = html`<h1 className="sh-q">Whose experience would you like to share?</h1>
      <div className="sh-choices">
        <${Choice} id="per-self" icon="self" label="My own experience" sub="What ABG has meant for you" on=${i.perspective === 'self'} onClick=${() => up({perspective: 'self'})} />
        <${Choice} id="per-witnessed" icon="witnessed" label="An experience I personally witnessed" sub="Something you saw happen for someone else" on=${w} onClick=${() => up({perspective: 'witnessed', subject: i.subject || 'student'})} />
      </div>
      ${w ? html`<div className="sh-card">
        <p className="sh-label">Who is it about?</p>
        <${Seg} label="Who is it about?" idp="subj" value=${i.subject} onChange=${v => up({subject: v || 'student'})} options=${SUBJECTS.map(s => [s.id, s.label])} />
        ${i.subject !== 'general' ? html`
          <${Field} label="Their first name or initial (optional)" hint="Please don't include last names or anything else that could identify them."><input id="sh-subject-name" className="sh-input" autoComplete="off" maxLength="40" value=${i.subjectFirstName || ''} onChange=${e => up({subjectFirstName: e.target.value})} /><//>
          ${i.subject === 'student' ? html`<p className="sh-label">Are they under 18?</p><${Seg} label="Are they under 18?" idp="subminor" value=${i.subjectMinor || ''} onChange=${v => up({subjectMinor: v})} options=${[['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']]} />` : null}
          <p className="sh-label">Do they know you're sharing this?</p><${Seg} label="Do they know you're sharing this?" idp="aware" value=${i.subjectAware || ''} onChange=${v => up({subjectAware: v})} options=${[['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']]} />
          <p className="sh-small">ABG won't share anything that identifies them publicly without their permission (or a parent's, for someone under 18).</p>` : null}
      </div>` : null}`;
  } else if (step === 2) {
    const staffSelf = i.relationship === 'staff' && i.perspective === 'self';
    body = html`<h1 className="sh-q">A little about you</h1>
      <p className="sh-sub">Everything here is optional. Share only what you're comfortable with.</p>
      <${Field} label="Your first name"><input id="sh-first" className="sh-input" autoComplete="given-name" maxLength="40" value=${i.firstName || ''} onChange=${e => up({firstName: e.target.value})} /><//>
      <${Field} label="ABG programs you've been part of" hint="For example: school mural program, after-school studio, fashion program"><input id="sh-programs" className="sh-input" maxLength="160" value=${i.programs || ''} onChange=${e => up({programs: e.target.value})} /><//>
      <${Field} label="About when were you involved?" hint="For example: 2018 to 2021, or since last fall"><input id="sh-years" className="sh-input" maxLength="60" value=${i.yearsInvolved || ''} onChange=${e => up({yearsInvolved: e.target.value})} /><//>
      ${i.relationship === 'alumni' || i.relationship === 'staff' || i.relationship === 'current_student' ? html`<${Field} label=${i.relationship === 'current_student' ? 'Your grade or school (optional)' : 'What you do now: school, college or work (optional)'}><input id="sh-bg" className="sh-input" maxLength="300" value=${i.background || ''} onChange=${e => up({background: e.target.value})} /><//>` : null}
      ${staffSelf ? html`<div className="sh-card">
        <${Field} label="Your role at ABG"><input id="sh-role" className="sh-input" maxLength="80" value=${i.staffRole || ''} onChange=${e => up({staffRole: e.target.value})} /><//>
        <p className="sh-label">Do you work with ABG now?</p><${Seg} label="Do you work with ABG now?" idp="sstatus" value=${i.staffStatus || ''} onChange=${v => up({staffStatus: v})} options=${[['current', 'Yes, currently'], ['former', 'Not anymore']]} />
        <p className="sh-label" id="sh-former-l">Were you previously an ABG student or program participant?</p>
        <${Seg} label="Were you previously an ABG student or program participant?" idp="former" value=${i.formerStudent || ''} onChange=${v => up({formerStudent: v})} options=${[['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']]} />
        ${i.formerStudent === 'yes' ? html`<div className="sh-two">
          <${Field} label="Year you first participated"><input id="sh-first-year" className="sh-input" inputMode="numeric" maxLength="4" value=${i.firstParticipatedYear || ''} onChange=${e => up({firstParticipatedYear: e.target.value.replace(/\D/g, '').slice(0, 4)})} /><//>
          <${Field} label="Year you began working for ABG"><input id="sh-transition" className="sh-input" inputMode="numeric" maxLength="4" value=${i.transitionYear || ''} onChange=${e => up({transitionYear: e.target.value.replace(/\D/g, '').slice(0, 4)})} /><//>
        </div><${Field} label="Program(s) you took part in as a student"><input id="sh-student-programs" className="sh-input" maxLength="160" value=${i.studentPrograms || ''} onChange=${e => up({studentPrograms: e.target.value})} /><//>` : null}
      </div>` : null}`;
  } else {
    body = html`<h1 className="sh-q">How would you like to share?</h1>
      <div className="sh-choices">
        <${Choice} id="method-voice" icon="mic" label="Talk" sub="Answer out loud. Your words are turned into text." on=${i.method === 'voice'} onClick=${() => up({method: 'voice'})} />
        <${Choice} id="method-written" icon="chat" label="Type" sub="A chat-style conversation. Answer in your own words." on=${i.method === 'written'} onClick=${() => up({method: 'written'})} />
      </div>
      <div className="sh-card sh-consent">
        <p className="sh-label"><${Icon} name="lock" size=${16} /> Before you start</p>
        <ul className="sh-bullets">
          <li>ABG staff will read your story. It may be used, without private details, in ABG's internal impact reports.</li>
          <li>You'll choose separately whether it can ever be shared publicly.</li>
          <li>Skip any question. "I don't know" is a fine answer.</li>
          <li>Please don't include last names, addresses or other private details.</li>
          <li>You can ask us to correct or remove your story later.</li>
        </ul>
        <label className="sh-check"><input type="checkbox" id="sh-privacy" checked=${!!st.privacy} onChange=${e => set(Object.assign({}, st, {privacy: e.target.checked}))} /> I understand and agree.</label>
        ${i.method === 'voice' ? html`<label className="sh-check"><input type="checkbox" id="sh-recording" checked=${!!st.recording} onChange=${e => set(Object.assign({}, st, {recording: e.target.checked}))} /> I agree to use my microphone. My recording is turned into text right away and then deleted; only the text is kept.</label>` : null}
      </div>`;
    canNext = !!i.method && !!st.privacy && (i.method !== 'voice' || !!st.recording);
  }
  return html`<main className="sh-page">
    <${Header} onBack=${back} step=${step} />
    <section className="sh-body">${body}
      ${err ? html`<p className="sh-error" role="alert">${err}</p>` : null}
    </section>
    <footer className="sh-foot">
      ${step < 3 ? html`<button type="button" className="sh-btn sh-btn-primary sh-btn-block" id="sh-next" disabled=${!canNext} onClick=${() => setStep(step + 1)}>Continue</button>`
        : html`<button type="button" className="sh-btn sh-btn-primary sh-btn-block" id="sh-begin" disabled=${!canNext || busy} onClick=${begin}>${busy ? 'Starting…' : 'Start the interview'}</button>`}
    </footer>
  </main>`;
}

function Interview({st, set, api}){
  const [answer, setAnswer] = useState(st.answerDraft || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [voiceOn, setVoiceOn] = useState(st.intake.method === 'voice');
  const voice = st.intake.method === 'voice';
  const endRef = useRef(null);
  const cur = st.current;
  useEffect(() => { set(Object.assign({}, st, {answerDraft: answer})); }, [answer]);
  useEffect(() => { if (cur && voiceOn && voice) { const t = setTimeout(() => speech.say(cur.q), 250); return () => { clearTimeout(t); speech.stop(); }; } }, [cur && cur.q, voiceOn]);
  useEffect(() => { try { endRef.current && endRef.current.scrollIntoView({block: 'end'}); } catch (e) {} }, [st.turns.length, busy]);
  async function send(opts){
    const o = opts || {};
    if (!o.skip && !o.finish && !answer.trim()) return;
    setErr(''); setBusy(true); speech.stop();
    try {
      const r = await api('ask', {token: st.token, answer: o.skip ? '' : answer.trim(), skip: !!o.skip, finish: !!o.finish, voice});
      const turns = (answer.trim() || o.skip) ? st.turns.concat([{q: cur.q, a: o.skip ? '' : answer.trim(), skipped: !!o.skip}]) : st.turns;
      setAnswer('');
      if (r.done) { set(Object.assign({}, st, {turns, current: null, answerDraft: '', screen: 'writing'})); return; }
      set(Object.assign({}, st, {turns, current: {q: r.question, kind: r.kind}, asked: r.asked || 0, answerDraft: ''}));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  const answered = st.turns.filter(t => !t.skipped).length;
  return html`<main className="sh-page sh-chat">
    <${Header} step=${4} />
    <section className="sh-body">
      <div className="sh-thread" aria-live="polite">
        ${st.turns.map((t, k) => html`<div key=${k} className="sh-turn"><p className="sh-bubble sh-q-bubble">${t.q}</p><p className=${'sh-bubble sh-a-bubble' + (t.skipped ? ' skipped' : '')}>${t.skipped ? 'Skipped' : t.a}</p></div>`)}
        ${cur ? html`<div className="sh-turn"><p className="sh-bubble sh-q-bubble sh-current" id="sh-question">${cur.q}</p></div>` : null}
        ${busy ? html`<p className="sh-bubble sh-q-bubble sh-typing"><span className="sh-dots"><i></i><i></i><i></i></span></p>` : null}
        <div ref=${endRef}></div>
      </div>
    </section>
    <footer className="sh-foot sh-compose">
      ${voice && speech.ok ? html`<button type="button" className="sh-link sh-voice-toggle" aria-pressed=${voiceOn} onClick=${() => { setVoiceOn(!voiceOn); speech.stop(); }}><${Icon} name="volume" size=${16} /> ${voiceOn ? 'Questions read aloud: on' : 'Read questions aloud'}</button>` : null}
      ${voice && cur ? html`<${Recorder} api=${api} token=${st.token} disabled=${busy} onText=${t => setAnswer(a => (a ? a + ' ' : '') + t)} />` : null}
      ${cur ? html`<label className="sh-sr" htmlFor="sh-answer">Your answer</label><textarea id="sh-answer" className="sh-input sh-answer" rows=${voice ? 3 : 4} placeholder=${voice ? 'Your words appear here. You can fix them before sending.' : 'Type your answer…'} value=${answer} onChange=${e => setAnswer(e.target.value)} disabled=${busy}></textarea>` : null}
      ${err ? html`<p className="sh-error" role="alert">${err}</p>` : null}
      <div className="sh-row">
        ${cur && cur.kind !== 'opening' ? html`<button type="button" className="sh-btn sh-btn-ghost" id="sh-skip" disabled=${busy} onClick=${() => send({skip: true})}>Skip</button>` : null}
        ${answered > 0 ? html`<button type="button" className="sh-btn sh-btn-ghost" id="sh-finish" disabled=${busy} onClick=${() => send({finish: true})}>I'm done</button>` : null}
        ${cur ? html`<button type="button" className="sh-btn sh-btn-primary" id="sh-send" disabled=${busy || !answer.trim()} onClick=${() => send()}>${cur.kind === 'closing' ? 'Finish' : 'Send'}</button>` : null}
      </div>
      <p className="sh-small">${cur && cur.kind === 'opening' ? 'Take your time. Follow-up questions come after this one.' : 'Question ' + (st.turns.length + 1) + ' · you can skip any question.'}</p>
    </footer>
  </main>`;
}

function Writing({st, set, api}){
  const [err, setErr] = useState('');
  const run = async () => { setErr(''); try { const v = await api('finish', {token: st.token}); set(Object.assign({}, st, {screen: 'review', view: v, edits: {story: v.story || '', removed: [], note: ''}, publication: v.publicationOptions.includes('anonymous') ? '' : ''})); } catch (e) { setErr(e.message); } };
  useEffect(() => { run(); }, []);
  return html`<main className="sh-page"><${Header} step=${5} /><section className="sh-body sh-center">
    ${err ? html`<p className="sh-error" role="alert">${err}</p><button type="button" className="sh-btn sh-btn-primary" onClick=${run}>Try again</button>` : html`<span className="sh-dots big"><i></i><i></i><i></i></span><h1 className="sh-q">Writing up your story…</h1><p className="sh-sub">This takes a few seconds. Next, you'll check it before anything is sent.</p>`}
  </section></main>`;
}

const PUB = {public_name: ['ABG may share my story publicly, with my first name', 'For example in newsletters, on social media or for funders'], anonymous: ['ABG may share it publicly without names', 'Shared only with names and identifying details removed'], internal: ['Keep it within ABG', 'Used only inside ABG and in reports that never quote or identify it']};
function Review({st, set, api, onSubmitted}){
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const v = st.view || {}; const ed = st.edits || {story: '', removed: [], note: ''};
  const upd = patch => set(Object.assign({}, st, {edits: Object.assign({}, ed, patch)}));
  const toggle = n => upd({removed: ed.removed.includes(n) ? ed.removed.filter(x => x !== n) : ed.removed.concat([n])});
  async function submit(){
    if (!st.publication) { setErr('Choose how ABG may use your story.'); return; }
    setErr(''); setBusy(true);
    try { const r = await api('submit', {token: st.token, edits: ed, publication: st.publication}); onSubmitted(r); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  return html`<main className="sh-page">
    <${Header} step=${5} />
    <section className="sh-body">
      <h1 className="sh-q">Review your story</h1>
      <p className="sh-sub">Here's what we wrote down from your answers. Fix anything that isn't right. Nothing is sent until you press Send to ABG.</p>
      ${v.analysisFailed ? html`<p className="sh-note">We couldn't write a summary right now. That's OK: ABG staff will read your answers directly. You can still add a note below.</p>` : html`
        <${Field} label="Your story"><textarea id="sh-story" className="sh-input" rows="10" value=${ed.story} onChange=${e => upd({story: e.target.value})}></textarea><//>
        ${(v.outcomes || []).length ? html`<div className="sh-card"><p className="sh-label">What we heard</p><p className="sh-small">Untick anything that isn't right.</p>
          <ul className="sh-outcomes">${v.outcomes.map(o => html`<li key=${o.i}><label className="sh-check"><input type="checkbox" className="sh-outcome" checked=${!ed.removed.includes(o.i)} onChange=${() => toggle(o.i)} /> ${o.statement}</label></li>`)}</ul></div>` : null}`}
      <${Field} label="Anything to add or correct? (optional)"><textarea id="sh-note" className="sh-input" rows="3" value=${ed.note} onChange=${e => upd({note: e.target.value})}></textarea><//>
      <div className="sh-card"><p className="sh-label" id="pub-l">May ABG share your story publicly?</p>
        <div className="sh-choices compact" role="radiogroup" aria-labelledby="pub-l">${(v.publicationOptions || ['internal']).map(p => html`<${Choice} key=${p} id=${'pub-' + p} label=${PUB[p][0]} sub=${PUB[p][1]} on=${st.publication === p} onClick=${() => set(Object.assign({}, st, {publication: p}))} />`)}</div>
        ${!(v.publicationOptions || []).includes('public_name') ? html`<p className="sh-small">Stories by people under 18, and stories about someone else, are only ever shared without names.</p>` : null}
      </div>
      ${err ? html`<p className="sh-error" role="alert">${err}</p>` : null}
    </section>
    <footer className="sh-foot"><button type="button" className="sh-btn sh-btn-primary sh-btn-block" id="sh-submit" disabled=${busy} onClick=${submit}>${busy ? 'Sending…' : 'Send to ABG'}</button></footer>
  </main>`;
}

function Done({token, onView}){
  const link = location.origin + '/share#s=' + token;
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {} };
  return html`<main className="sh-page"><${Header} /><section className="sh-body sh-center sh-done">
    <span className="sh-done-mark"><${Icon} name="check" size=${40} /></span>
    <h1>Thank you for sharing your story!</h1>
    <p className="sh-lede">Your story has been submitted to ABG for review. Thank you for helping us understand the difference our programs make.</p>
    <div className="sh-card sh-left">
      <p className="sh-label"><${Icon} name="lock" size=${16} /> Your private link</p>
      <p className="sh-small">Save this link to check your story's status, answer any questions from ABG, make corrections or ask us to remove it. Anyone with the link can see your story, so keep it private. We can't recover it if it's lost.</p>
      <div className="sh-linkbox"><input id="sh-private-link" className="sh-input" readOnly=${true} value=${link} onFocus=${e => e.target.select()} /><button type="button" className="sh-btn sh-btn-ghost" onClick=${copy}><${Icon} name="copy" size=${18} /> ${copied ? 'Copied' : 'Copy'}</button></div>
    </div>
    <button type="button" className="sh-btn sh-btn-primary" id="sh-view" onClick=${onView}>View my story</button>
  </section></main>`;
}

function OpenLink({onOpen, onBack}){
  const [v, setV] = useState('');
  const tok = (() => { const m = v.match(/[#&?]s=([A-Za-z0-9_-]{30,})/); return m ? m[1] : (/^[A-Za-z0-9_-]{30,}$/.test(v.trim()) ? v.trim() : ''); })();
  return html`<main className="sh-page"><${Header} onBack=${onBack} /><section className="sh-body">
    <h1 className="sh-q">Open your story</h1><p className="sh-sub">Paste the private link you saved after sharing your story.</p>
    <${Field} label="Private link"><input id="sh-open-link" className="sh-input" value=${v} onChange=${e => setV(e.target.value)} placeholder="https://…/share#s=…" /><//>
    ${v && !tok ? html`<p className="sh-error">That doesn't look like a complete private link.</p>` : null}
  </section><footer className="sh-foot"><button type="button" className="sh-btn sh-btn-primary sh-btn-block" disabled=${!tok} onClick=${() => onOpen(tok)}>Open my story</button></footer></main>`;
}

function Status({token, api}){
  const [v, setV] = useState(null);
  const [err, setErr] = useState('');
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);
  const [story, setStory] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = async () => { setErr(''); try { const r = await api('status', {token}); setV(r); setStory(r.story || ''); } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, [token]);
  const act = async (action, payload, done) => { setBusy(true); setErr(''); try { const r = await api(action, Object.assign({token}, payload)); setV(r); setStory(r.story || ''); if (done) setMsg(done); } catch (e) { setErr(e.message); } setBusy(false); };
  if (!v) return html`<main className="sh-page"><${Header} /><section className="sh-body sh-center">${err ? html`<p className="sh-error" role="alert">${err}</p>` : html`<span className="sh-dots big"><i></i><i></i><i></i></span>`}</section></main>`;
  const tone = {pending_review: 'wait', needs_clarification: 'ask', approved: 'ok', rejected: 'muted', removal_requested: 'muted', in_progress: 'wait'}[v.status];
  return html`<main className="sh-page"><${Header} /><section className="sh-body">
    <p className="sh-eyebrow">Your story</p>
    <h1 className="sh-q">${v.title || 'Your story'}</h1>
    <p className=${'sh-status tone-' + tone} id="sh-status">${v.statusText}</p>
    ${msg ? html`<p className="sh-note sh-ok" role="status">${msg}</p>` : null}
    ${v.status === 'in_progress' ? html`<p className="sh-note">This story wasn't sent yet. Open the page on the device where you started it to finish.</p>` : null}
    ${v.question ? html`<div className="sh-card sh-ask"><p className="sh-label">ABG's question</p><p id="sh-abg-question">${v.question}</p>
      <${Field} label="Your answer"><textarea id="sh-reply" className="sh-input" rows="3" value=${reply} onChange=${e => setReply(e.target.value)}></textarea><//>
      <button type="button" className="sh-btn sh-btn-primary" id="sh-send-reply" disabled=${busy || !reply.trim()} onClick=${() => act('reply', {text: reply}, 'Thanks! Your answer was sent to ABG.').then(() => setReply(''))}>Send answer</button></div>` : null}
    <div className="sh-card">
      <div className="sh-row-between"><p className="sh-label">Your story</p>${v.canEdit && !editing ? html`<button type="button" className="sh-link" id="sh-edit" onClick=${() => setEditing(true)}>Make a correction</button>` : null}</div>
      ${editing ? html`<textarea id="sh-edit-story" className="sh-input" rows="10" value=${story} onChange=${e => setStory(e.target.value)}></textarea>
        <div className="sh-row"><button type="button" className="sh-btn sh-btn-ghost" onClick=${() => { setEditing(false); setStory(v.story || ''); }}>Cancel</button><button type="button" className="sh-btn sh-btn-primary" id="sh-save-edit" disabled=${busy} onClick=${() => act('update', {edits: {story}}, 'Your correction was saved.').then(() => setEditing(false))}>Save correction</button></div>`
        : html`<p className="sh-story">${v.story || 'Your answers were sent to ABG.'}</p>`}
      ${(v.outcomes || []).filter(o => !o.removed).length ? html`<p className="sh-label">What we heard</p><ul className="sh-bullets">${v.outcomes.filter(o => !o.removed).map(o => html`<li key=${o.i}>${o.statement}</li>`)}</ul>` : null}
      <p className="sh-small">Sharing: ${PUB[v.publication] ? PUB[v.publication][0] : ''}</p>
    </div>
    ${v.status !== 'removal_requested' ? html`<div className="sh-card">
      ${confirmRemove ? html`<p>Remove your story? ABG will stop using it and delete it.</p><div className="sh-row"><button type="button" className="sh-btn sh-btn-ghost" onClick=${() => setConfirmRemove(false)}>Keep it</button><button type="button" className="sh-btn sh-btn-danger" id="sh-confirm-remove" disabled=${busy} onClick=${() => act('remove', {}, 'Your removal request was sent. ABG will delete your story.').then(() => setConfirmRemove(false))}>Yes, remove it</button></div>`
        : html`<button type="button" className="sh-link" id="sh-remove" onClick=${() => setConfirmRemove(true)}>Ask ABG to remove my story</button>`}
    </div>` : null}
    ${err ? html`<p className="sh-error" role="alert">${err}</p>` : null}
    <p className="sh-small"><a href="/share" className="sh-link">Share another story</a></p>
  </section></main>`;
}

function App({api, hash}){
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const statusToken = params.get('s');
  // an invitation survives a refresh in this tab, but the link itself is removed from the address bar
  const inviteToken = params.get('i') || (ssGet('abg-share-invite') || {}).t || null;
  const saved = ssGet(DRAFT);
  const [st, setSt] = useState(() => saved || {screen: 'welcome', step: 0, intake: {method: ''}, privacy: false, recording: false, token: null, turns: [], current: null});
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState(statusToken || null);
  const set = n => { setSt(n); if (n.screen === 'done') { ssDel(DRAFT); ssDel('abg-share-invite'); } else ssSet(DRAFT, n); };
  useEffect(() => {
    if (!inviteToken) return;
    api('invite', {invite: inviteToken}).then(r => {
      const inv = Object.assign({token: inviteToken}, r); setInvite(inv);
      if (r.valid && !saved) setSt(s => Object.assign({}, s, {intake: Object.assign({}, s.intake, {relationship: r.relationship || s.intake.relationship, firstName: r.firstName || s.intake.firstName})}));
    }, () => setInvite({valid: false}));
  }, []);
  useEffect(() => { try { window.scrollTo(0, 0); } catch (e) {} }, [st.screen, st.step, status]);
  if (status) return html`<${Status} token=${status} api=${api} />`;
  if (st.screen === 'open') return html`<${OpenLink} onBack=${() => set(Object.assign({}, st, {screen: 'welcome'}))} onOpen=${t => { history.replaceState(null, '', '/share#s=' + t); setStatus(t); }} />`;
  if (st.screen === 'welcome') return html`<${Welcome} invite=${invite} go=${() => set(Object.assign({}, st, {screen: 'intake', step: 0}))} onStatus=${() => set(Object.assign({}, st, {screen: 'open'}))} />`;
  if (st.screen === 'intake') return html`<${Intake} st=${st} set=${set} step=${st.step || 0} setStep=${n => set(Object.assign({}, st, {step: n}))} invite=${invite} api=${api}
    onStarted=${r => set(Object.assign({}, st, {screen: 'interview', token: r.token, type: r.type || communityStoryType(st.intake), current: {q: r.question, kind: r.kind}, turns: []}))} />`;
  if (st.screen === 'interview') return html`<${Interview} st=${st} set=${set} api=${api} />`;
  if (st.screen === 'writing') return html`<${Writing} st=${st} set=${set} api=${api} />`;
  if (st.screen === 'review') return html`<${Review} st=${st} set=${set} api=${api} onSubmitted=${() => set(Object.assign({}, st, {screen: 'done'}))} />`;
  if (st.screen === 'done') return html`<${Done} token=${st.token} onView=${() => { history.replaceState(null, '', '/share#s=' + st.token); setStatus(st.token); }} />`;
  return null;
}

export function mountCommunity(el, cfg){
  document.title = 'Share Your Story · Arts Bridging the Gap';
  document.body.classList.add('share-portal');
  const api = makeApi(cfg.url, cfg.key);
  if (!cfg.url || !cfg.key) { el.innerHTML = '<p style="padding:24px">This page is not set up yet.</p>'; return; }
  const hash = window.location.hash || '';
  // private tokens live in the URL fragment, which browsers never send to servers; keep the invite out of history
  if (/[#&]i=/.test(hash)) {
    // a personal invitation starts a new story in this tab
    const t = new URLSearchParams(hash.replace(/^#/, '')).get('i');
    if (t) { ssSet('abg-share-invite', {t}); ssDel(DRAFT); }
    history.replaceState(null, '', '/share');
  }
  ReactDOM.createRoot(el).render(html`<${App} api=${api} hash=${hash} />`);
}
