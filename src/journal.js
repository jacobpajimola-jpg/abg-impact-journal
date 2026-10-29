import { DEMO_STORIES, DEMO_VERSION } from './demoData.js';
import qrcode from 'qrcode-generator';
import { PALETTE_ART, PALETTE_ART_VIEWBOX } from './ui/art.js';
import { CATEGORIES, THEMES, AUDIENCES, DOMAIN_GROUPS, DOMAINS, STAFF_DOMAINS, OBSERVERS, LINK_TYPES, METRIC_FIELDS, METRIC_STATUS, STORY_TYPES, STAFF_STATUS, EMPLOYMENT_TYPES, FORMER_STUDENT, STAFF_FIELDS, STAFF_STAGES, JOURNEY_STAGES, ABG_CONTEXT, INTERVIEW_STAGES, LISTEN_FOR, STAFF_LISTEN_FOR, ANALYSIS_SHAPE, STAFF_ANALYSIS_SHAPE, RELATIONSHIPS, SUBJECTS, communityAnalysisPrompt, communityContextText } from './core/shared.js';
(function(){
'use strict';
if (window.__journalLoaded) return; window.__journalLoaded = true;
if (!window.React || !window.ReactDOM || !window.htm) {
  var bp = document.querySelector('.boot p');
  if (bp) bp.textContent = "The journal couldn't load. Check your connection and reload the page.";
  return;
}
const { useState, useEffect, useMemo, useRef, useCallback, useContext, createContext } = React;
const html = htm.bind(React.createElement);

/* ================= vocabulary ================= */
const FORMATS = [
  {id:'donor_story', label:'Donor impact story', aud:'donors', guide:'150 to 220 words'},
  {id:'school_case', label:'School partnership case study', aud:'schools', guide:'four short labeled parts (Context, What ABG provided, What changed, Why it matters for schools), 180 to 250 words in total'},
  {id:'corporate', label:'Corporate sponsorship highlight', aud:'corporate', guide:'100 to 150 words'},
  {id:'community_story', label:'Community impact story', aud:'community', guide:'120 to 180 words'},
  {id:'grant', label:'Grant application narrative', aud:'donors', guide:'two or three paragraphs, 250 to 350 words, formal and evidence-led, keeping verified figures clearly separate from reported observations'},
  {id:'newsletter', label:'Newsletter feature', aud:null, guide:'a headline on the first line, then 200 to 300 words'},
  {id:'social', label:'Social media caption', aud:null, guide:'under 280 characters, at most two hashtags'},
];
const STATUSES = [
  {id:'draft', label:'Draft', tone:'neutral'},
  {id:'internal', label:'Internal use only', tone:'blue'},
  {id:'needs_verification', label:'Needs verification', tone:'warn'},
  {id:'approved', label:'Approved for external use', tone:'good'},
];
const EVIDENCE_STATUS = [
  {id:'verified', label:'Verified', tone:'good'},
  {id:'reported', label:'Reported', tone:'blue'},
  {id:'estimate', label:'Estimate', tone:'warn'},
  {id:'qualitative', label:'Anecdotal', tone:'teal'},
  {id:'unverified', label:'Unverified', tone:'bad'},
  {id:'future', label:'Not yet documented', tone:'outline'},
];
const GENDERS = [{id:'male', label:'Male'}, {id:'female', label:'Female'}, {id:'other', label:'Other'}];
function studentInfoText(si){ if (!si) return ''; return [si.gender ? 'gender: ' + labelOf(GENDERS, si.gender) : '', si.school ? 'school: ' + si.school : '', si.demographics ? 'other details: ' + si.demographics : ''].filter(Boolean).join('; '); }
/* impact domains: the five core metrics first, then other stakeholder-relevant outcomes */
/* milestones counted on the dashboard; each is checked per student from evidence and the metrics card */
const MILESTONES = [
  {id:'graduated', label:'Graduated high school'},
  {id:'higher_ed', label:'Went on to college or further education'},
  {id:'first_gen', label:'First in their family to attend college'},
  {id:'career', label:'Career, job, or internship'},
  {id:'school_engagement', label:'Improved school attendance, grades, or engagement'},
  {id:'risk_reduced', label:'Reduced risky behavior', sensitive:true},
  {id:'continued_abg', label:'Continued participating in ABG'},
  {id:'leadership_abg', label:'Took on a leadership role at ABG'},
  {id:'returned', label:'Returned to ABG to mentor, volunteer, or teach'},
  {id:'arts', label:'Kept pursuing art or creative interests'},
];
const DIRECTIONS = [{id:'achieved', label:'Achieved'}, {id:'improved', label:'Improved'}, {id:'same', label:'No change'}, {id:'declined', label:'Declined'}, {id:'mixed', label:'Mixed'}, {id:'unclear', label:'Not stated'}];
const LEVELS = [{id:1, label:'Level 1: general impression'}, {id:2, label:'Level 2: specific observed change'}, {id:3, label:'Level 3: counted, or confirmed by another adult'}];
const EVIDENCE_LABELS = [
  {id:'verified', label:'Documented / verified', tone:'good'},
  {id:'teacher', label:'Teacher/parent-reported', tone:'teal'},
  {id:'student', label:'Student-reported', tone:'teal'},
  {id:'staff', label:'Staff-reported', tone:'blue'},
  {id:'estimate', label:'Estimated', tone:'warn'},
  {id:'unverified', label:'Unverified', tone:'bad'},
  {id:'expected', label:'Expected, not yet documented', tone:'outline'},
];
/* four evidence types used in reporting. Derived from status and observer, so older records classify too.
   Kyle's confident account never makes something "verified": only a staff member checking documentation does. */
const EVIDENCE_CLASSES = [
  {id:'verified', label:'Independently verified', short:'Verified', tone:'good', color:'#2F8F5B', desc:'Supported by checked records or independent documentation'},
  {id:'observed', label:'Staff-observed', short:'Staff-observed', tone:'blue', color:'#3D7FC1', desc:'An authorized ABG staff member saw it personally'},
  {id:'self', label:'Self-reported', short:'Self-reported', tone:'teal', color:'#2EB8A0', desc:'The person describing their own experience'},
  {id:'community', label:'Community-observed', short:'Community-observed', tone:'purple', color:'#A653C9', desc:'A parent, teacher, volunteer or supporter describing what they witnessed or were told'},
  {id:'unconfirmed', label:'Unconfirmed or inferred', short:'Unconfirmed', tone:'warn', color:'#E3A33B', desc:'Secondhand, uncertain or inferred'},
];
const CLASS_RANK = {verified: 5, observed: 4, self: 3, community: 2, unconfirmed: 1};
const SELF_OBSERVERS = ['student', 'self'];
const COMMUNITY_OBSERVERS = ['teacher', 'parent', 'school_staff', 'volunteer', 'community', 'other'];
function evidenceClass(e){
  if (!e) return 'unconfirmed';
  if (e.status === 'future') return 'planned';
  if (e.status === 'verified') return 'verified';
  if (e.status === 'unverified' || e.inferred) return 'unconfirmed';
  if (e.observer === 'abg_staff' || e.observer === 'records') return 'observed';
  if (SELF_OBSERVERS.includes(e.observer)) return 'self';
  if (COMMUNITY_OBSERVERS.includes(e.observer)) return 'community';
  return 'unconfirmed';
}
/* changing the evidence type in review keeps status and observer consistent with it */
function classPatch(e, cls){
  const plain = e.kind === 'numeric' ? 'reported' : 'qualitative';
  const unsure = ['verified', 'unverified'].includes(e.status);
  if (cls === 'verified') return {status: 'verified', inferred: false};
  if (cls === 'unconfirmed') return {status: 'unverified'};
  if (cls === 'observed') return {observer: 'abg_staff', inferred: false, status: unsure ? plain : e.status};
  if (cls === 'self') return {observer: SELF_OBSERVERS.includes(e.observer) ? e.observer : 'self', inferred: false, status: unsure ? plain : e.status};
  return {observer: COMMUNITY_OBSERVERS.includes(e.observer) ? e.observer : 'other', inferred: false, status: unsure ? plain : e.status};
}
function classLabel(e){
  const c = evidenceClass(e);
  if (c === 'planned') return 'Expected, not yet happened';
  if (c === 'community' && e.observer && !['other', 'community'].includes(e.observer)) return 'Community-observed: ' + ({teacher: 'teacher', parent: 'parent or family', school_staff: 'school staff', volunteer: 'volunteer'}[e.observer] || 'someone else');
  return (byId(EVIDENCE_CLASSES, c) || {}).label || '';
}
function evidenceLabelId(e){
  if (!e) return 'staff';
  if (e.status === 'verified') return 'verified';
  if (e.status === 'estimate') return 'estimate';
  if (e.status === 'unverified') return 'unverified';
  if (e.status === 'future') return 'expected';
  if (e.observer === 'student') return 'student';
  return ['teacher', 'parent', 'school_staff'].includes(e.observer) ? 'teacher' : 'staff';
}
/* older evidence has no domain; infer one from its wording */
function domainOf(e){
  if (e && byId(DOMAINS, e.domain)) return e.domain;
  const t = norm([e && e.metric, e && e.statement].join(' '));
  if (/gang|risky|drug|arrest|probation|juvenile|street|trouble with the law/.test(t)) return 'risk';
  if (/graduat|diploma/.test(t)) return 'graduation';
  if (/college|university|degree|enrolled in|vocational|trade school|community college|first in (his|her|their) family/.test(t)) return 'higher_ed';
  if (/\bjob\b|employ|intern|career|works as|working as|hired/.test(t)) return 'career';
  if (/returned|came back to|volunteer|instructor|mentors? younger|teaching at abg/.test(t)) return 'returned';
  if (/still (paint|draw|make|making|creat)|art school|creative/.test(t)) return 'arts_continued';
  if (/attend|absen|tardy|missed school|days missed/.test(t)) return 'attendance';
  if (/grade|gpa|homework|assignment|academ|test score|reading level|report card/.test(t)) return 'academics';
  if (/confiden|leader|led |lead |speak|present|shy|self esteem|voice/.test(t)) return 'confidence';
  if (/session|workshop|weeks|months|years|returned|continued|retention|enrolled|program/.test(t)) return 'participation';
  if (/participat|engag|motivat|classroom|interest in school/.test(t)) return 'engagement';
  if (/access|first time|never had|no art|otherwise/.test(t)) return 'access';
  if (/belong|lonel|isolat|anxi|well being|emotional|resilien|cope|coping|stress/.test(t)) return 'wellbeing';
  if (/community (event|project|service|garden|clean)|neighborhood (event|project)|volunteer(ed|s)? (in|at|for) (the|a|her|his|their) (community|neighborhood)/.test(t)) return 'community_involvement';
  if (/friend|peer|teamwork|collaborat/.test(t)) return 'social';
  if (/behavior|behaviour|discipline|suspension|referral/.test(t)) return 'behavior';
  if (/college|career|university|design school/.test(t)) return 'pathways';
  if (/skill|technique|drawing|painting|artistic/.test(t)) return 'artistic';
  return 'other';
}
/* a number from a before/after value such as "80%", "3.2 GPA" or "about 12 days" */
function parseMeasure(v, e){
  const t = asStr(v); const m = t.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const ctx = norm([t, e && e.unit, e && e.metric, e && e.statement].join(' '));
  const unit = /%|percent/.test(t + ' ' + asStr(e && e.unit)) ? '%' : /gpa/.test(ctx) ? 'GPA' : /days?/.test(ctx) ? 'days' : /sessions?|workshops?/.test(ctx) ? 'sessions' : norm(e && e.unit) || 'number';
  return {n: +m[0], unit};
}
function letterGrade(v){ const m = asStr(v).toUpperCase().match(/^(?:GRADE\s*)?([A-F])([+-]?)$/); return m ? m[1] + m[2] : ''; }
function hasComparison(e){ return !!(asStr(e.before) && asStr(e.after)); }
/* who observed or reported a piece of evidence */
const QUOTE_KINDS = [
  {id:'exact', label:'Exact words'},
  {id:'remembered', label:'Remembered'},
  {id:'paraphrase', label:'Paraphrased'},
];
const PHASES = [
  {id:'circumstances', label:'Initial circumstances'},
  {id:'involvement', label:'ABG involvement'},
  {id:'immediate', label:'Immediate outcomes'},
  {id:'short_term', label:'Short-term developments'},
  {id:'long_term', label:'Long-term outcomes'},
  {id:'future', label:'Future follow-up'},
];
const STRUCTURE = [
  {id:'character', label:'Character', hint:'Who is the story about?'},
  {id:'circumstances', label:'Initial circumstances', hint:'What was happening before ABG became involved?'},
  {id:'involvement', label:"ABG's involvement", hint:'What program, activity, or support did ABG provide?'},
  {id:'events', label:'Sequence of events', hint:'What happened during the experience?'},
  {id:'outcomes', label:'Observed outcomes', hint:'What changed or developed?'},
  {id:'longTerm', label:'Long-term significance', hint:'Did it lead to continued participation or other developments?'},
];
const PRIVACY = [
  {id:'minor', label:'Involves a minor'},
  {id:'identifying', label:'Contains identifying information'},
  {id:'permission', label:'Publication permission documented'},
  {id:'external', label:'Can be used externally'},
  {id:'redact', label:'Identifying details need removal'},
  {id:'sensitive', label:'Includes sensitive experiences (e.g. gang involvement)'},
  {id:'sensitiveConsent', label:'Consent documented to share sensitive experiences externally'},
];
const MATERIAL_TYPES = [
  {id:'photo', label:'Photos'},
  {id:'artwork', label:'Student artwork'},
  {id:'video', label:'Video'},
  {id:'testimonial', label:'Teacher or family feedback'},
  {id:'record', label:'Attendance or program records'},
  {id:'survey', label:'Survey or evaluation'},
  {id:'other', label:'Other'},
];
const PROMPTS = [
  "Tell us about a moment at ABG that stood out to you. It could be a program, a mural, a partnership, or something that happened today or years ago.",
  "Is there a story from ABG's past you want to preserve?",
  "Did something meaningful happen during a recent program?",
  "Is there a mural, project, or partnership whose story should be on record?",
];
const UPDATE_PROMPT = "What has happened since? Share any new developments, even small ones.";
const OPENING_Q = name => "Can you walk me through the full story of " + name + ", starting with their background, where they came from, the challenges they faced, how they became involved with ABG, and what their experience has looked like since?";
const CLOSING_Q = name => "Is there anything else about " + name + "'s experience that you think people should understand about the impact of ABG?";
const UPDATE_OPENING_Q = name => "What has happened with " + name + " since you last recorded their story? Share any new developments, even small ones.";
const STAFF_OPENING_Q = name => "Can you tell me about " + (name || 'this staff member') + ", how they first became involved with ABG, and how the organization has impacted their life?";
const STAFF_CLOSING_Q = name => "Is there anything else about " + name + "'s experience that shows what working with ABG has meant for them, or for the students and community ABG serves?";
const STAFF_UPDATE_OPENING_Q = name => "What has changed for " + name + " since you last recorded their story? New roles, skills, training, jobs or anything else, even small things.";
const METRIC_SUGGESTIONS = ['Students served','Schools reached','Workshops completed','Murals or projects completed','Volunteer hours','Volunteers','Families attending events','Program sessions held'];
/* the standard metrics card: the same measurable fields on every student story */

/* ================= staff impact stories =================
   Two primary story types: Student Impact and Staff Impact. "Former ABG student" is a background attribute of a
   staff story (staffInfo.formerStudent), never a third type. Stories saved before staff stories existed have no
   storyType and keep reading as student (or general) stories, so nothing older changes. */
/* the staff impact card: the same employment and development fields on every staff story, so they add up across
   people. Every value carries how sure it is (verified, reported, estimate) and, when Claude found it, the passage
   it came from. A blank field is "not documented", never "no". */
/* the student-to-staff journey: only stages the interview supports are kept */
const STAFF_STAKEHOLDERS = [['donors', 'Donor communications', 'What difference is ABG making in people\'s lives?'], ['grants', 'Grant applications', 'What outcomes justify continued funding?'], ['schools', 'School partnerships', 'What does ABG bring to the schools it works with?'], ['community', 'Community impact reporting', 'How does ABG create opportunity in the community?'], ['consulting', 'Consulting deliverables', 'What does this add to the consulting team\'s analysis?']];
function blankStaffInfo(){ return {status: '', role: '', startYear: '', employmentType: '', formerStudent: '', firstParticipatedYear: '', programs: '', transitionYear: ''}; }
function cleanYear(v){ const m = asStr(v).match(/(19|20)\d{2}/); return m ? m[0] : ''; }
function cleanStaffInfo(raw){
  const r = raw && typeof raw === 'object' ? raw : {};
  const fs = pickEnum(r.formerStudent, FORMER_STUDENT, '');
  return {status: pickEnum(r.status, STAFF_STATUS, ''), role: asStr(r.role), startYear: cleanYear(r.startYear), employmentType: pickEnum(r.employmentType, EMPLOYMENT_TYPES, ''), formerStudent: fs,
    firstParticipatedYear: fs === 'yes' ? cleanYear(r.firstParticipatedYear) : '', programs: fs === 'yes' ? asStr(r.programs) : '', transitionYear: fs === 'yes' ? cleanYear(r.transitionYear) : ''};
}
function isStaffStory(s){ return !!(s && s.storyType === 'staff'); }
function isFormerStudent(s){ return isStaffStory(s) && (s.staffInfo || {}).formerStudent === 'yes'; }
function staffInfoText(si){
  if (!si) return '';
  const i = cleanStaffInfo(si);
  return [i.status ? labelOf(STAFF_STATUS, i.status).toLowerCase() : '', i.role ? 'role at ABG: ' + i.role : '', i.startYear ? 'started working with ABG around ' + i.startYear : '',
    i.employmentType && i.employmentType !== 'unknown' ? 'employment type: ' + labelOf(EMPLOYMENT_TYPES, i.employmentType).toLowerCase() : '',
    i.formerStudent === 'yes' ? 'previously an ABG student or program participant' + (i.firstParticipatedYear ? ' (first participated around ' + i.firstParticipatedYear + ')' : '') + (i.programs ? ' in ' + i.programs : '') + (i.transitionYear ? '; began working for ABG around ' + i.transitionYear : '') : '',
    i.formerStudent === 'no' ? 'was not an ABG student before working there' : '',
    i.formerStudent === 'unknown' || !i.formerStudent ? 'not known whether they were an ABG student before' : ''].filter(Boolean).join('; ');
}
/* values Kyle typed on the intake form go on the card as reported values */
function intakeCard(si){
  const i = cleanStaffInfo(si); const out = {};
  const put = (id, value) => { if (value) out[id] = {value, status: 'reported', source: 'intake'}; };
  put('staffStatus', i.status === 'current' ? 'Current staff' : i.status === 'former' ? 'Former staff' : '');
  put('role', i.role);
  put('startYear', i.startYear || i.transitionYear);
  put('employmentType', i.employmentType && i.employmentType !== 'unknown' ? labelOf(EMPLOYMENT_TYPES, i.employmentType) : '');
  return out;
}
function staffVal(s, id){ const m = ((s && s.staffCard) || {})[id]; const v = m && asStr(m.value); return v ? {value: v, status: pickEnum(m.status, METRIC_STATUS, 'reported'), excerpt: asStr(m.excerpt), source: m.source || ''} : null; }
function staffKnown(s){ return STAFF_FIELDS.filter(f => staffVal(s, f.id)).length; }

/* ================= utilities ================= */
const byId = (list, id) => list.find(x => x.id === id);
const labelOf = (list, id) => (byId(list, id) || {}).label || id || '';
const uniq = arr => Array.from(new Set(arr.filter(x => x != null && x !== '')));
function uid(p){ return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function nowISO(){ return new Date().toISOString(); }
function todayLocal(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso){ if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return String(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
function fmtDay(day){ if (!day) return ''; const p = String(day).split('-'); if (p.length !== 3) return day; return MONTHS[(+p[1]) - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
function isoLabel(iso){ const p = String(iso || '').split('-'); if (!p[0]) return ''; if (p.length === 1) return p[0]; if (p.length === 2) return (MONTHS[(+p[1]) - 1] || '') + ' ' + p[0]; return fmtDay(iso); }
function fmtEventDate(ed){ if (!ed) return ''; if (ed.text) return ed.text; if (ed.iso) return isoLabel(ed.iso); return ''; }
function norm(s){ return String(s || '').toLowerCase().replace(/[‘’“”]/g, "'").replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function foundIn(excerpt, text){ const e = norm(excerpt); if (!e || e.length < 3) return false; return norm(text).includes(e); }
function trunc(s, n){ s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function words(s){ const m = String(s || '').trim().match(/\S+/g); return m ? m.length : 0; }
function mmss(sec){ return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function toNum(v){ if (v === '' || v == null) return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : null; }
function fmtNum(v){ const n = toNum(v); return n == null ? '' : n.toLocaleString(); }
function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k){ try { localStorage.removeItem(k); } catch (e) {} }
/* Unfinished interviews (Capture a Story). Each interview is its own session with an id. While it runs, it is
   kept on this device ("state") so a closed tab or a trip to another page never loses words; "Save draft" also
   stores a snapshot ("snap"). Capture a Story never reopens one by itself: it offers Resume Draft or Start New Story.
   Start New Story throws away unsaved changes (after asking) but keeps a saved draft as it was saved. */
const IV_DRAFTS = 'abg-iv-drafts';
function ivDrafts(){
  let l = [];
  try { l = JSON.parse(lsGet(IV_DRAFTS) || '[]') || []; } catch (e) { l = []; }
  /* the old single auto-restored interview becomes an ordinary draft */
  try { const old = JSON.parse(lsGet('abg-interview:new') || 'null'); if (old && (asStr(old.first) || (old.turns || []).length)) { l.unshift({id: uid('iv'), at: old.at || Date.now(), state: old}); lsSet(IV_DRAFTS, JSON.stringify(l)); } lsDel('abg-interview:new'); } catch (e) {}
  return Array.isArray(l) ? l.filter(d => d && d.id && d.state) : [];
}
function ivWrite(l){ lsSet(IV_DRAFTS, JSON.stringify(l.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12))); }
function ivPut(id, patch){ const l = ivDrafts(); const i = l.findIndex(d => d.id === id); if (i >= 0) l[i] = Object.assign({}, l[i], patch); else l.push(Object.assign({id}, patch)); ivWrite(l); }
function ivDel(id){ ivWrite(ivDrafts().filter(d => d.id !== id)); }
/* drafts are referred to as "ivd:<id>"; older flows (story updates, the student list) keep their own keys */
function clearDraft(ref){ if (!ref) return; if (String(ref).startsWith('ivd:')) ivDel(String(ref).slice(4)); else lsDel(ref); }
/* leaving without saving: back to the last saved draft if there is one, otherwise gone */
function discardDraft(ref){
  if (!ref) return;
  if (!String(ref).startsWith('ivd:')) { lsDel(ref); return; }
  const id = String(ref).slice(4), d = ivDrafts().find(x => x.id === id);
  if (d && d.snap) ivPut(id, {state: d.snap, at: d.snapAt || d.at}); else ivDel(id);
}
function ivSig(o){ const x = o || {}; return JSON.stringify([x.step, x.kind, x.first, x.pick, x.note, x.when, x.gender, x.school, x.demo, x.si, x.turns, x.answer, x.phase, (x.clips || []).length]); }
function asStr(v){ return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v)); }
function asArr(v){ return Array.isArray(v) ? v : []; }
function pickEnum(v, list, dflt){ return list.some(x => x.id === v) ? v : dflt; }
function yn(v){ return v === true || v === 'yes' ? 'yes' : (v === false || v === 'no' ? 'no' : 'unknown'); }
function cleanIso(v){ const s = asStr(v); return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(s) ? s : ''; }
function matchOption(f, v){
  let k = norm(v); if (k === 'true') k = 'yes'; if (k === 'false') k = 'no';
  if (!k) return '';
  return f.options.find(o => norm(o) === k) || f.options.find(o => norm(o).startsWith(k + ' ')) || f.options.find(o => k.startsWith(norm(o) + ' ') && norm(o).length > 3) || '';
}
/* cleans one metrics-card map; aiOnly drops "verified", which only ABG staff may set */
function cleanMetrics(raw, aiOnly, fields){
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  (fields || METRIC_FIELDS).forEach(f => {
    let x = r[f.id]; if (x == null) return;
    if (typeof x !== 'object') x = {value: x};
    let v = asStr(x.value).replace(/^(null|unknown)$/i, '');
    if (!v) return;
    let status = pickEnum(x.status, METRIC_STATUS, 'reported');
    if (aiOnly && status === 'verified') status = 'reported';
    if (f.type === 'number') { const mm = v.replace(/,/g, '').match(/-?\d+(\.\d+)?/); const n = mm ? toNum(mm[0]) : null; if (aiOnly && n == null) return; if (n != null && (aiOnly || /^\s*(about|around|roughly|approx\.?|~)?\s*-?[\d.,]+\s*\+?\s*[a-z]*\s*$/i.test(v))) v = String(n); }
    if (f.type === 'choice') { const o = matchOption(f, v); if (!o) return; v = o; }
    const m = {value: v, status: status};
    if (asStr(x.excerpt) && !/^null$/i.test(asStr(x.excerpt))) m.excerpt = asStr(x.excerpt);
    if (x.source === 'intake') m.source = 'intake';
    if (x._new) m._new = true;
    out[f.id] = m;
  });
  return out;
}
function metricVal(s, id){ const m = ((s && s.metrics) || {})[id]; const v = m && asStr(m.value); return v ? {value: v, status: pickEnum(m.status, METRIC_STATUS, 'reported')} : null; }
function metricsKnown(s){ return METRIC_FIELDS.filter(f => metricVal(s, f.id)).length; }
function comparisonText(e){ if (!e || (!asStr(e.before) && !asStr(e.after))) return ''; return 'Before: ' + (asStr(e.before) || 'unknown') + ' → After: ' + (asStr(e.after) || 'unknown') + (asStr(e.timeframe) ? ' (' + e.timeframe + ')' : ''); }
function isMeasurable(e){ return e.kind === 'numeric' && e.status !== 'future'; }
function isQualitative(e){ return e.kind !== 'numeric' && e.status !== 'future'; }
const STATUS_LEGEND = 'Reported means Kyle saw it or someone told him. Estimate means approximate. Anecdotal means an impression. Verified is only for items ABG later confirms against school or program records.';
function isStudentStory(s){ return !!(s && s.storyType !== 'staff' && (s.studentId || asStr(s.alias))); }
function storyTypeOf(s){ return isStaffStory(s) ? 'staff' : isStudentStory(s) ? 'student' : 'general'; }
function storyTypeLabel(s){ const t = storyTypeOf(s); return t === 'general' ? 'General story' : labelOf(STORY_TYPES, t); }

/* ================= community sources =================
   A story is either an internal interview (Kyle or other ABG staff; no "source" field, so every older story)
   or a community submission approved by an administrator (source "community"). The contributor (who told it)
   is kept separate from the participant (who it's about): a parent's observation is about their child. */
const SUB_STATUS = [
  {id:'pending_review', label:'Pending review', tone:'warn'},
  {id:'needs_clarification', label:'Needs clarification', tone:'blue'},
  {id:'approved', label:'Approved for internal reporting', tone:'good'},
  {id:'rejected', label:'Rejected / excluded', tone:'neutral'},
  {id:'removal_requested', label:'Removal requested', tone:'bad'},
];
const PUBLICATION = {public_name: 'May be shared publicly with their first name', anonymous: 'May be shared publicly without names', internal: 'Keep within ABG (no public sharing)'};
const SOURCE_KINDS = [
  {id:'internal', label:'Staff interview', group:'staff'},
  {id:'student_self', label:'Student self-report', group:'self'},
  {id:'alumni_self', label:'Alumni self-report', group:'self'},
  {id:'staff_self', label:'Staff self-report', group:'self'},
  {id:'parent_obs', label:'Parent observation', group:'community'},
  {id:'volunteer_obs', label:'Volunteer observation', group:'community'},
  {id:'community_obs', label:'Community observation', group:'community'},
  {id:'community_self', label:'Community member', group:'community'},
];
function isCommunity(s){ return !!(s && s.source === 'community'); }
/* Preview Mode test stories (made by an authorized consultant testing the Share Your Story page) never count anywhere */
function isTest(s){ return !!(s && s.test); }
/* a community story the contributor asked ABG to remove */
function isWithdrawn(s){ return isCommunity(s) && (s.review || {}).status !== 'approved'; }
/* community stories count in reporting only while approved (a contributor's removal request withdraws them at once) */
function reportable(s){ return !isTest(s) && (!isCommunity(s) || ((s.review || {}).status === 'approved')); }
function sourceKind(s){
  if (!isCommunity(s)) return 'internal';
  const c = s.contributor || {};
  if (c.perspective === 'self') return c.relationship === 'staff' ? 'staff_self' : c.relationship === 'alumni' ? 'alumni_self' : c.relationship === 'current_student' ? 'student_self' : 'community_self';
  return c.relationship === 'parent' ? 'parent_obs' : c.relationship === 'volunteer' ? 'volunteer_obs' : 'community_obs';
}
function sourceLabel(s){ return labelOf(SOURCE_KINDS, sourceKind(s)); }
function relationshipOf(s){ return isCommunity(s) ? ((s.contributor || {}).relationship || '') : 'internal'; }
const CONTRIBUTOR_TYPES = [{id:'internal', label:'ABG staff interview'}].concat(RELATIONSHIPS.map(r => ({id: r.id, label: r.label})));
function contributorText(s){ const c = s.contributor || {}; return (labelOf(RELATIONSHIPS, c.relationship) || 'Community member') + (c.firstName ? ' (' + c.firstName + ')' : '') + ', ' + (c.perspective === 'self' ? 'own experience' : 'something they witnessed'); }
function subTranscript(sub){ return (sub.turns || []).map(t => 'Q: ' + t.q + '\nA: ' + (t.status === 'skipped' ? '(skipped)' : t.a)).join('\n\n'); }
function subName(sub){ const i = sub.intake || {}; return i.perspective === 'witnessed' ? (i.subjectFirstName || '') : (i.firstName || ''); }
function subTitle(sub){ const a = sub.analysis || {}; return asStr(a.title) || ('Story from a ' + (labelOf(RELATIONSHIPS, sub.relationship) || 'community member').toLowerCase()); }
/* who saw it: the contributor's own experience is self-reported; what they witnessed is community-observed */
function communityObserver(intake){ const i = intake || {}; return i.perspective === 'witnessed' ? ({parent: 'parent', volunteer: 'volunteer', friend: 'community'}[i.relationship] || 'other') : 'self'; }
/* a review draft from a community submission, built with the same normalize / draft steps as Kyle's interviews */
function draftFromSubmission(sub, me, typeOverride){
  const raw = clone(sub.analysis || {});
  const ed = sub.contributor_edits || {};
  if (Array.isArray(raw.evidence) && Array.isArray(ed.removed)) raw.evidence = raw.evidence.filter((e, i) => !ed.removed.includes(i));
  if (typeof ed.story === 'string' && ed.story.trim()) raw.story = ed.story;
  const type = typeOverride || sub.story_type || 'student';
  const kind = type === 'staff' ? 'staff' : 'student';
  const items = [{id: 'sub-' + sub.id, text: subTranscript(sub), recordedAt: sub.submitted_at || sub.created_at}];
  const a = normalizeAnalysis(raw, {items, kind, storyIds: new Set()});
  const i = sub.intake || {};
  const staffInfo = kind === 'staff' && i.perspective === 'self' ? {status: i.staffStatus || '', role: i.staffRole || '', formerStudent: i.formerStudent || '', firstParticipatedYear: i.firstParticipatedYear || '', programs: i.studentPrograms || '', transitionYear: i.transitionYear || ''} : null;
  const d = newStoryFromAnalysis(a, {me, kind, studentName: type === 'general' ? '' : subName(sub), staffInfo});
  if (type === 'general') { d.alias = ''; delete d.storyType; d.staffCard = undefined; }
  if (!a.title) d.title = subTitle(sub);
  const obs = communityObserver(i);
  /* nobody at ABG has checked a community account yet: it is never staff-observed or verified on arrival */
  d.evidence = (d.evidence || []).map(e => Object.assign({}, e, {observer: ['abg_staff', 'records', ''].includes(e.observer || '') ? obs : e.observer, status: e.status === 'verified' ? 'reported' : e.status}));
  d.privacy = Object.assign({}, d.privacy, {minor: sub.is_minor ? 'yes' : d.privacy.minor});
  if (!d.program && i.programs) d.program = i.programs;
  d.entryCount = 1;
  return d;
}
function fmtMetric(f, v){
  if (f.type !== 'number') return v;
  const n = toNum(v); if (n == null) return v;
  return fmtNum(n) + (f.unit ? ' ' + (n === 1 ? f.unit.replace(/s$/, '') : f.unit) : '');
}
function titleFromText(t){ const w = String(t || '').trim().split(/\s+/).slice(0, 8).join(' '); return w ? w + '…' : 'Untitled story'; }

/* first name for the greeting: "Jacob Pajimola", "jacob.pajimola", "kyle_smith" or "sarah.johnson@email.com" all give the first name */
function firstNameOf(raw){
  let t = asStr(raw); if (!t) return '';
  if (t.includes('@')) t = t.split('@')[0];
  const part = t.split(/[\s._\-+]+/).map(x => x.replace(/[^\p{L}'’]/gu, '')).find(x => x.length > 1) || '';
  return part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '';
}
/* story helpers */
function evidenceCounts(s){ const c = {}; (s.evidence || []).forEach(e => { c[e.status] = (c[e.status] || 0) + 1; }); return c; }
function hasMeasurable(s){ return (s.evidence || []).some(e => e.kind === 'numeric'); }
function hasVerifiedNumeric(s){ return (s.evidence || []).some(e => e.kind === 'numeric' && e.status === 'verified'); }
function openQuestions(s){ return (s.followUps || []).filter(f => f.kind === 'question' && f.status === 'open'); }
function openTasks(s){ return (s.followUps || []).filter(f => f.kind === 'task' && f.status === 'open'); }
function needsInfo(s){ return s.status === 'needs_verification' || openQuestions(s).length > 0 || (s.evidence || []).some(e => e.status === 'unverified'); }
function isOngoing(s){ return (s.entryCount || 1) > 1; }
function storyYear(s){ const iso = s.eventDate && s.eventDate.iso; if (iso) return +iso.slice(0, 4); return s.createdAt ? +s.createdAt.slice(0, 4) : null; }
function storyYears(s){ return [s.eventDate && s.eventDate.iso].concat((s.milestones || []).filter(m => m.phase !== 'future').map(m => m.date && m.date.iso)).filter(Boolean).map(x => +String(x).slice(0, 4)).filter(n => n > 1900); }
function yearSpan(s){ const ys = storyYears(s); return ys.length < 2 ? 0 : Math.max.apply(null, ys) - Math.min.apply(null, ys); }
function yearRange(s){ const ys = storyYears(s); if (!ys.length) return ''; const a = Math.min.apply(null, ys), b = Math.max.apply(null, ys); return a === b ? String(a) : a + '–' + b; }
function allTasks(stories){ const out = []; stories.forEach(s => (s.followUps || []).forEach(t => { if (t.kind === 'task') out.push({t, s}); })); return out; }
function byDue(a, b){ const da = a.t.due || '9999', db = b.t.due || '9999'; return da.localeCompare(db); }
function countDue(stories){ const today = todayLocal(); return allTasks(stories).filter(x => x.t.status === 'open' && x.t.due && x.t.due <= today).length; }
const PHASE_ORDER = {circumstances:0, involvement:1, immediate:2, short_term:3, long_term:4, future:5};
function sortMilestones(ms){
  return ms.map((m, i) => ({m, i})).sort((a, b) => {
    const fa = a.m.phase === 'future' ? 1 : 0, fb = b.m.phase === 'future' ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const ia = a.m.date && a.m.date.iso, ib = b.m.date && b.m.date.iso;
    if (ia && ib && ia !== ib) return ia.localeCompare(ib);
    const pa = PHASE_ORDER[a.m.phase] || 0, pb = PHASE_ORDER[b.m.phase] || 0;
    if (pa !== pb) return pa - pb;
    return a.i - b.i;
  }).map(x => x.m);
}
function blankStory(me){
  const t = nowISO();
  return { id: uid('s'), title: '', summary: '', story: '', alias: '', studentId: null, publicName: '', overview: {ageOrGrade: '', background: '', involvementDate: ''},
    missingMetrics: [], metrics: {}, materials: [], stakeholderWhy: '', stakeholderValue: {}, period: 'recent', eventDate: {text: '', iso: '', approximate: false}, program: '', community: '',
    categories: [], themes: [], audiences: [], takeaways: [], structure: {}, evidence: [], quotes: [], milestones: [], followUps: [], links: [], drafts: [],
    status: 'draft', privacy: {minor: 'unknown', identifying: 'unknown', permission: 'unknown', external: 'unknown', redact: 'unknown'},
    entryCount: 1, createdAt: t, updatedAt: t, createdBy: (me && me.id) || null, updatedBy: (me && me.id) || null, analysis: {state: 'none'} };
}

/* error copy */
function aiErrorMessage(e){
  const c = e && e.code;
  switch (c) {
    case 'not_granted': return "Claude isn't allowed for this app yet. Allow it when asked, or save the entry now and analyze it later.";
    case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed': return "Claude isn't available for this account. You can still save the entry and analyze it later.";
    case 'rate_limited': return "Claude is busy or you've reached a usage limit. Wait a few minutes, then try again.";
    case 'config_error': return "Claude rejected the app's API key or settings, so this isn't a connection problem. Check the Claude API key and workspace in Supabase (Edge Functions, then Secrets), then try again. Your words are safe.";
    case 'session_expired': return "Your sign-in needs refreshing. Reload the page, then try again. Your words are safe.";
    case 'prompt_too_large': return "This entry is too long to analyze in one go. Split it into two entries.";
    case 'invalid_json': return "Claude's answer came back in an unexpected shape. Try again.";
    case 'refused': return "Claude declined to analyze this text. Check the entry and try again.";
    case 'empty_completion': return "Claude didn't return anything. Try again.";
    default: return "The analysis didn't finish because of a connection problem. Your words are safe. Try again.";
  }
}
function dbErrorMessage(e){
  const c = e && e.code;
  if (c === 'quota_exceeded') return "The journal is full. Delete old drafts to make room.";
  if (c === 'resource_exhausted') return "Too many changes at once. Wait a moment and try again.";
  if (c === 'revoked') return "Your access to this journal changed. Reload to continue.";
  if (c === 'invalid_argument') return "That change couldn't be saved.";
  return "Couldn't reach the journal. Check your connection and try again.";
}

/* ================= AI prompts ================= */

/* the five interview stages: Kyle tells the story first, then focused follow-ups fill the evidence gaps */
/* outcome areas the interviewer listens for (mapped to impact domains in the analysis) */
const INTERVIEW_NOTES_SHAPE = {facts: [], outcomes: [], askedAbout: [], stage: 1};
function interviewPrompt({name, turns, mode, story, asked, target, memo, info, notes, avoid}){
  const convo = turns.map(t => 'Q (' + t.kind + '): ' + t.q + '\nA: ' + (t.status === 'skipped' ? '[Kyle skipped this question]' : t.a)).join('\n\n');
  const existing = story ? {summary: story.summary, timeline: (story.milestones || []).map(m => (fmtEventDate(m.date) || 'undated') + ': ' + m.label + (m.phase === 'future' ? ' (planned, not yet happened)' : '')), missingData: (story.missingMetrics || []).map(m => m.metric),
    evidenceOnFile: (story.evidence || []).slice(0, 12).map(e => labelOf(DOMAINS, domainOf(e)) + ': ' + e.statement + (hasComparison(e) ? ' (' + e.before + ' to ' + e.after + ')' : '') + ' [' + labelOf(EVIDENCE_CLASSES, evidenceClass(e)) + ']'),
    openQuestions: (story.followUps || []).filter(f => f.status === 'open').map(f => f.question)} : null;
  return `${ABG_CONTEXT}

You are interviewing Kyle about a student named ${name}. The goal is a story that keeps ${name}'s humanity AND credible evidence of the meaningful changes behind it, for donors, grant providers and school administrators.
${mode === 'update' ? 'This is an UPDATE interview about a story already in the journal. Focus on what is new since it was recorded: progress on earlier outcomes, planned milestones that happened (or didn\'t), and anything new. Existing record: ' + JSON.stringify(existing) : ''}
${memo ? "Kyle's one-line note about " + name + ' from his student list: "' + memo + '". A starting point, not confirmed detail.' : ''}
${studentInfoText(info) ? 'Already entered about ' + name + ' (never ask for these): ' + studentInfoText(info) + '.' : ''}

WHO YOU'RE TALKING TO
Kyle is ABG's Program Director. He knows students personally, often over years. He does NOT have school records: no attendance percentages, GPAs or transcripts. Talk to him like a colleague who knows the student, not an analyst.
- Never ask for records, documents, exact percentages or GPAs, and never ask him to verify something.
- Not every outcome is a number. "She graduated and is at UCLA" is a strong outcome as it stands. If he mentions a number naturally, keep it.

THE FIVE STAGES (Kyle has already told the story in his own words; your follow-ups move through what is still missing)
1. Student background and ABG involvement (who, where they started, which ABG program, when).
2. The most meaningful changes Kyle saw.
3. Specific supporting evidence and measurable outcomes for those changes.
4. ABG's contribution: what about ABG may have helped (a person, a project, a role), in Kyle's words.
5. Current progress, lasting impact, and what to follow up on later.
Skip any stage Kyle's story already covered. Stages are a guide, not a script.

OUTCOMES TO LISTEN FOR (only ones this story points to; never run through a checklist)
${LISTEN_FOR.join(', ')}.

FOR EACH MEANINGFUL OUTCOME, the evidence slots are:
- initial: what it was like before
- change: what changed
- when: roughly when it changed
- howKnown: how Kyle knows (he saw it himself, or the student, a parent or a teacher told him)
- abgRole: how ABG may have contributed, in Kyle's words
Track these in notes.outcomes. Ask about the most important EMPTY slot of the most meaningful outcome. Never ask about a slot that's filled or that Kyle said he doesn't know.

YOUR JOB EACH TURN
1. Update the notes from the whole conversation (previous notes are below).
2. Choose the single most valuable next question: the one that most improves the story or its evidence. Prefer missing evidence over more of the same.

FOLLOW-UP EXAMPLES
- "Her grades started improving." -> "Did she eventually graduate high school?"
- "He's more confident now." -> "What did you see him do that showed that?"
- "She started showing up every day." -> "How do you know? Did you see it, or did a teacher tell you?"
- "He's doing great now." -> "What is he doing today?"
- "The mural changed her." -> "What about the mural do you think made the difference?"

SENSITIVE TOPICS
Ask about gang involvement, family circumstances, mental health, the justice system or other sensitive experiences ONLY if Kyle brings them up first, and then only what's needed. Never assume risky behavior from a student's background, school or neighborhood. Never ask for a diagnosis.

RULES
- Never invent or assume statistics, diagnoses, outcomes or causes. Ask "Did their grades change?", not "How much did they improve?". Don't assume ABG caused a change.
- Never repeat a question or ask about anything in notes.facts or notes.askedAbout, even partly answered. "I don't know" or a skip closes the topic.
- Never ask for a last name or identifying details.
- One question, ideally under 12 words, never more than 18. Plain and natural. No preamble, no praise, no double questions, no "tell me more" or "could you elaborate".
${avoid ? '- Your last suggestion repeated an earlier question ("' + avoid + '"). Choose a different gap.' : ''}

Follow-up questions asked so far: ${asked}. Aim for about ${target} (usually 4 to 6). Set "enough" to true only when the most meaningful outcomes have their key slots filled or Kyle doesn't know the rest.

PREVIOUS NOTES (empty at the start):
${JSON.stringify(notes || INTERVIEW_NOTES_SHAPE)}

CONVERSATION SO FAR:
${convo}

Reply with only JSON:
{"notes": {"facts": ["short facts already captured, under 10 words each"], "outcomes": [{"outcome": "short name", "area": "one of the outcome areas above", "initial": "or null", "change": "or null", "when": "or null", "howKnown": "or null", "abgRole": "or null"}], "askedAbout": ["topics already asked about, including skipped or don't know"], "stage": 1},
 "stage": "1 to 5: the stage your question belongs to",
 "question": "the next question", "target": "which outcome and slot it fills", "why": "a few words on what this adds", "enough": false}`;
}
/* Staff Impact interview: Kyle tells the staff member's story, then follow-ups move through employment,
   professional development, personal and community impact and long-term outcomes. A former ABG student's
   transition from participant to staff is woven into the same interview, never a separate one. */
function staffInterviewPrompt({name, turns, mode, story, asked, target, info, notes, avoid}){
  const convo = turns.map(t => 'Q (' + t.kind + '): ' + t.q + '\nA: ' + (t.status === 'skipped' ? '[Kyle skipped this question]' : t.a)).join('\n\n');
  const si = cleanStaffInfo(info || (story && story.staffInfo) || {});
  const existing = story ? {summary: story.summary, timeline: (story.milestones || []).map(m => (fmtEventDate(m.date) || 'undated') + ': ' + m.label + (m.phase === 'future' ? ' (planned, not yet happened)' : '')),
    staffCard: Object.fromEntries(STAFF_FIELDS.filter(f => staffVal(story, f.id)).map(f => [f.label, staffVal(story, f.id).value])),
    evidenceOnFile: (story.evidence || []).slice(0, 12).map(e => labelOf(DOMAINS, domainOf(e)) + ': ' + e.statement + ' [' + labelOf(EVIDENCE_CLASSES, evidenceClass(e)) + ']'),
    openQuestions: (story.followUps || []).filter(f => f.status === 'open').map(f => f.question)} : null;
  const formerBlock = si.formerStudent === 'yes' ? `
${name.toUpperCase()} WAS AN ABG STUDENT BEFORE WORKING THERE
Weave the transition from participant to staff member into the same interview (never a separate interview). Gaps worth filling, only where Kyle hasn't covered them:
- what their experience was like when they first participated, and how they benefited from ABG's arts programs
- artistic, personal or professional skills they developed as a student
- how they moved from student to staff member, and the first position they received
- whether ABG gave them their first paid job (ask; never assume it was paid)
- how their responsibilities have changed, and whether they now mentor or teach students
- how their relationship with ABG has changed over time
Never assume they received paid employment, gained a skill or became a mentor unless Kyle says so.`
    : si.formerStudent === 'no' ? `\n${name} was not an ABG student before working there. Don't ask about earlier participation.`
    : `\nIt isn't known whether ${name} was an ABG student before working there. If it would matter and the conversation hasn't said, you may ask once, briefly ("Was ${name} ever in an ABG program before working there?"). Never assume they were.`;
  return `${ABG_CONTEXT}

You are interviewing Kyle about ${name}, someone who works or has worked with ABG. This is a STAFF IMPACT story: how ABG has affected this person's employment, professional development, career opportunities, personal growth and community involvement. Two goals matter equally: a story that keeps ${name}'s humanity, AND credible, specific outcomes for donors, grant providers, school partners and ABG's consulting team.
${mode === 'update' ? 'This is an UPDATE interview about a staff story already in the journal. Focus on what is new since it was recorded: role changes, new skills or training, new jobs, and planned developments that happened (or didn\'t). Existing record: ' + JSON.stringify(existing) : ''}
${staffInfoText(si) ? 'Already entered on the intake form (never ask for these again): ' + staffInfoText(si) + '.' : ''}
${formerBlock}

WHO YOU'RE TALKING TO
Kyle is ABG's Program Director. He knows ${name} personally. He does NOT need employment records, pay stubs or HR files, and you never ask for them or ask him to verify anything. His firsthand observations are valuable as they are; the journal labels them as observations, not verified statistics.

THE FIVE PHASES (Kyle has already told the story in his own words; your follow-ups move through what is still missing, skipping anything covered)
1. Background and first involvement: how they got involved, what they were doing before, what brought them to ABG, barriers to employment or professional growth they faced, opportunities ABG gave that they might not otherwise have had.
2. Employment opportunities: whether ABG provided a PAID position (distinguish paid work from volunteering, stipends and internships), whether it was their first job, responsibilities, how long they have worked with ABG, whether the role grew, whether ABG helped them get other work, and what the job has meant for them.
3. Professional development: professional or artistic skills, training or mentorship, leadership, confidence and independence, transferable skills, career goals, further education.
4. Personal and community impact: how the work has affected them personally, their sense of purpose, their contribution to the students ABG serves, whether they have become a mentor, instructor or community leader.
5. Long-term outcomes: whether they are still with ABG, advancement, other career opportunities, whether they continue in the arts, education or nonprofit work, lasting skills and relationships.

OUTCOMES TO LISTEN FOR (only ones this story points to; never run through a checklist)
${STAFF_LISTEN_FOR.join(', ')}.

FOR EACH MEANINGFUL OUTCOME, the evidence slots are: initial (what it was like before), change (what changed, with a specific example), when (roughly when), howKnown (Kyle saw it, or ${name} or someone else told him), abgRole (how ABG may have contributed, in Kyle's words). Track them in notes.outcomes. Ask about the most important EMPTY slot of the most meaningful outcome. Never ask about a filled slot or one Kyle said he doesn't know.

FOLLOW-UP EXAMPLES
- "We brought him on staff." -> "Was that a paid position?"
- "She's grown so much." -> "What does she do now that she didn't before?"
- "He's been with us a long time." -> "Roughly what year did he start working with ABG?"
- "She leads the younger kids now." -> "What does she do with them?"
- "It changed his life." -> "What was different for him after he started working here?"

RULES
- Conversational, never a questionnaire. Practical and efficient: the most valuable question each turn.
- Never lead toward a positive outcome. Ask "Was that a paid position?", not "How much did that job help?". Don't assume ABG caused a change.
- Ask for specific examples and approximate dates when they would make an outcome credible.
- Never ask about salary, finances, family circumstances, immigration, health or other sensitive details. If Kyle raises one, don't probe it.
- Never repeat a question or ask about anything in notes.facts or notes.askedAbout, even partly answered. "I don't know" or a skip closes the topic.
- Never ask for a last name or identifying details.
- One question, ideally under 12 words, never more than 18. Plain and natural. No preamble, no praise, no double questions, no "tell me more".
${avoid ? '- Your last suggestion repeated an earlier question ("' + avoid + '"). Choose a different gap.' : ''}

Follow-up questions asked so far: ${asked}. Aim for about ${target} (usually 4 to 6). Set "enough" to true only when the most meaningful outcomes have their key slots filled or Kyle doesn't know the rest.

PREVIOUS NOTES (empty at the start):
${JSON.stringify(notes || INTERVIEW_NOTES_SHAPE)}

CONVERSATION SO FAR:
${convo}

Reply with only JSON:
{"notes": {"facts": ["short facts already captured, under 10 words each"], "outcomes": [{"outcome": "short name", "area": "one of the outcome areas above", "initial": "or null", "change": "or null", "when": "or null", "howKnown": "or null", "abgRole": "or null"}], "askedAbout": ["topics already asked about, including skipped or don't know"], "stage": 1},
 "stage": "1 to 5: the phase your question belongs to",
 "question": "the next question", "target": "which outcome and slot it fills", "why": "a few words on what this adds", "enough": false}`;
}
/* rough word-overlap check so the interviewer doesn't repeat itself */
function questionOverlap(a, b){
  const stop = new Set('the a an and or of to in on did do does was were is are they their them he she his her it that this with for about how what any you your have has had after before abg'.split(' '));
  const w = t => new Set(norm(t).split(' ').filter(x => x.length > 2 && !stop.has(x)));
  const A = w(a), B = w(b); if (!A.size || !B.size) return 0;
  let n = 0; A.forEach(x => { if (B.has(x)) n++; });
  return n / Math.min(A.size, B.size);
}


function analysisPrompt({mode, story, items, others, whenHint, studentName, memo, studentInfo}){
  const entriesText = items.map((it, i) => '--- Entry ' + (i + 1) + ' (recorded ' + (fmtDate(it.recordedAt) || 'today') + ') ---\n' + it.text).join('\n\n');
  const existing = story ? {
    title: story.title, story: story.story || story.summary, student: story.alias || null, overview: story.overview || {}, when: fmtEventDate(story.eventDate) || null,
    program: story.program || null, community: story.community || null,
    timeline: (story.milestones || []).map(m => ({when: fmtEventDate(m.date) || null, what: m.label, phase: m.phase})),
    evidence: (story.evidence || []).map(e => e.statement), missingMetrics: (story.missingMetrics || []).map(m => m.metric),
    metricsCard: Object.fromEntries(METRIC_FIELDS.filter(f => metricVal(story, f.id)).map(f => [f.id, metricVal(story, f.id)])),
    questionsAlreadyAsked: (story.followUps || []).filter(f => f.kind === 'question').map(f => f.question),
  } : null;
  return [
    ABG_CONTEXT + " Kyle (or another ABG adult) narrated the journal " + (items.length > 1 ? 'entries' : 'entry') + " below, usually by voice dictation, often as interview answers (Q/A), so expect missing punctuation and small transcription slips. Turn it into a structured Student Impact Report. Today is " + todayLocal() + ".",
    studentName ? "The student's first name is " + studentName + ". Use only the first name." : '',
    mode === 'update' ? "This is an UPDATE to a story already in the journal. Treat the existing record as true context and keep its facts.\nEXISTING RECORD:\n" + JSON.stringify(existing) : '',
    whenHint ? "Kyle says the experience happened: " + whenHint : '',
    memo ? "Kyle's one-line note from his student list (context only, not a source for evidence excerpts): " + memo : '',
    studentInfoText(studentInfo) ? "Student details Kyle entered on the form (treat as given; don't repeat demographics in the story unless they matter to it): " + studentInfoText(studentInfo) : '',
    `RULES
- Story first, evidence second, stakeholder value third. Preserve the student's humanity; the story is about a person, not a checklist of positive outcomes. Cover, where the interview does: background, initial challenges, how they became involved with ABG, a meaningful experience, the progress Kyle observed, and where they are now.
- The evidence list is the Structured Impact Record: one item per outcome. For each, fill the outcome description (statement), initial condition (before), current condition (after), supporting observation, evidence source (observer and basis), timeframe, the ABG program or activity, ABG's possible contribution, and any open question. Use null for anything the interview doesn't say. Never fill a field by guessing.
- Evidence types: a staff member's own observation (observer abg_staff); something the student, a parent, teacher or other person reported (that observer); unconfirmed or inferred (status "unverified", or "inferred": true when the outcome is your reading rather than Kyle's words). Never mark anything verified just because Kyle said it confidently.
- Outcome domains to use: attendance, academics, engagement, graduation, higher_ed, confidence (confidence and creativity), wellbeing (emotional well-being and sense of belonging), social (positive relationships), community_involvement, leadership_abg and mentorship (leadership and mentoring), career and pathways (career aspirations and opportunities), arts_continued, participation, and risk (only if Kyle raises it).
- Never invent statistics, diagnoses, outcomes or causal relationships.
- Use only what the entries${mode === 'update' ? ' and existing record' : ''} say. Never invent names, numbers, dates, outcomes, percentages, survey results or quotes. Use null or an empty list when information isn't there.
- Never add a last name or other identifying details.
- Describe outcomes as observed or reported. Don't say ABG caused an outcome unless Kyle says so. Don't infer attendance changes from participation.
- Setbacks, challenges and unmet needs are valid evidence. Don't spin them positive.
- Don't treat a reported change (more confidence, for example) as a measured increase.
- Every evidence item needs "excerpt": a short passage copied word for word from the entries that supports it, and "basis": who observed or reported it.
- Evidence status: "reported" for numbers or facts Kyle states plainly; "estimate" for approximate numbers ("about", "around", "maybe"); "qualitative" for non-numeric observations; "unverified" for secondhand or uncertain claims; "future" for hoped-for or expected outcomes. Never use "verified": only ABG staff verify evidence, against records.
- Capture meaningful milestones as evidence items even without numbers: high school graduation, college or vocational enrollment (and field of study), first in the family to attend college, a job, internship or career, returning to ABG as a mentor, volunteer or instructor, continuing with art, leadership roles at ABG. Use direction "achieved" and put specifics in "after" (e.g. after: "Studying graphic design at a community college").
- Reduced involvement in gangs or other risky behavior goes in domain "risk" (direction "improved" if it decreased). Record only what Kyle said, attribute it ("according to what he shared with Kyle"), never add detail, and set "containsSensitive" true whenever the entries mention gang involvement, the justice system, substance use or similar sensitive experiences.
- Distinguish sources in every item: Kyle's own observation (observer abg_staff) versus what the student, family or a teacher told him (observer student, parent or teacher; basis says so).
- Every evidence item needs "metric", "domain", "direction" and "level". Level 1 is Kyle's general impression ("more confident"); level 2 is a specific change he observed ("went from silent to leading a group"); level 3 is something he counted himself (sessions, months, murals) or a change another adult told him about. Kyle has no school records: his observations are "reported" with observer abg_staff; something a teacher, parent or school staff member told him is "reported" with that observer; something the student said is observer student. Never mark anything verified.
- Capture before-and-after comparisons whenever Kyle gives them, including non-numeric ones (before: "no leadership role", after: "led a four-student mural group").
- Never imply ABG caused an outcome just because it happened during participation.
- Measurable outcomes are "numeric" evidence: specific numbers, counts, rates, durations and before-and-after comparisons. Put the number in "value" only when Kyle states it. Fill "before", "after" and "timeframe" only with what Kyle said.
- Qualitative evidence: observations and testimonials from the student, parents, teachers, school staff or ABG staff. Set "observer" to who saw or said it.
- Never present an anecdote or estimate as a proven outcome. Status separates them: documented data is only ever marked verified later by ABG staff; plain statements are "reported"; approximate numbers are "estimate"; observations are "qualitative".
- metricsCard: the standard metrics card, filled in the same way for every student story. Fields: ${METRIC_FIELDS.map(f => f.id + ' (' + f.label + (f.type === 'number' ? ', a number only' : f.type === 'choice' ? ', one of: ' + f.options.join(' / ') : ', short text') + ')').join('; ')}. Include a field only when the entries actually say it, and leave the rest out (they show as unknown). Status "reported" when Kyle states it plainly, "estimate" when approximate ("about", "maybe", "I think"). Never "verified". Don't infer attendance from participation, or graduation from age. If the entries aren't about one student, use an empty object.
- missingMetrics: information that would make the story more credible for stakeholders but isn't available yet (records ABG could request from a school, a teacher or parent statement, program sign-in counts...). Only ones relevant to this story. Never suggest Kyle obtain school records himself.
- Quotes: "exact" for words that appear word for word in the entries and were clearly said, including Kyle's own quotable statements (speaker "Narrator"); "remembered" when Kyle recalls what someone said; "paraphrase" for statements put in other words. Copy exact and remembered quotes exactly as they appear. Never create a quote.
- Milestones fill the student's timeline. Use phase "future" only for possible developments worth checking on, with confirmed false. Never present anticipated impact as accomplished.`,
    mode === 'update' ? `FOR THIS UPDATE: "story" and "summary" are the full updated versions combining the existing record with the new information. "takeaways" and "stakeholders" cover the whole story. "missingMetrics" is the complete current list. "metricsCard" contains only fields the new entries state or change. "evidence", "quotes", "milestones", "materials" and "recommendedFollowUps" contain ONLY new items from the new entries. In "structure", give updated text only for parts the new entries change and null for the rest. "eventDate" is when the new development happened.` : '',
    `ID LISTS
categories: ${CATEGORIES.map(c => c.id + ' (' + c.label + ')').join(', ')}
themes: ${THEMES.map(t => t.id + ' (' + t.label + ')').join(', ')}
audiences: ${AUDIENCES.map(a => a.id + ' (' + a.label + ': values ' + a.emphasis.split('.')[0] + ')').join('; ')}
link types: ${LINK_TYPES.filter(l => l.id !== 'same_person').map(l => l.id).join(', ')}`,
    others.length ? "OTHER STORIES ALREADY IN THE JOURNAL. Suggest a link only when the entries likely concern the same student, school, mural, program, community or partnership; when unsure, leave it out. Two students can share a first name, so a matching name alone is not enough.\n" + JSON.stringify(others) : "There are no other stories in the journal yet, so possibleLinks must be an empty list.",
    "ENTRIES\n" + entriesText,
    "Reply with only JSON in exactly this shape:\n" + ANALYSIS_SHAPE,
  ].filter(Boolean).join('\n\n');
}

function staffAnalysisPrompt({mode, story, items, others, whenHint, name, staffInfo}){
  const entriesText = items.map((it, i) => '--- Entry ' + (i + 1) + ' (recorded ' + (fmtDate(it.recordedAt) || 'today') + ') ---\n' + it.text).join('\n\n');
  const si = cleanStaffInfo(staffInfo || (story && story.staffInfo) || {});
  const existing = story ? {
    title: story.title, story: story.story || story.summary, person: story.alias || null, overview: story.overview || {}, when: fmtEventDate(story.eventDate) || null, program: story.program || null,
    timeline: (story.milestones || []).map(m => ({when: fmtEventDate(m.date) || null, what: m.label, phase: m.phase})), evidence: (story.evidence || []).map(e => e.statement),
    staffCard: Object.fromEntries(STAFF_FIELDS.filter(f => staffVal(story, f.id)).map(f => [f.id, staffVal(story, f.id).value])), journey: (story.journey || []).map(j => j.stage + ': ' + j.text),
    missingMetrics: (story.missingMetrics || []).map(m => m.metric), questionsAlreadyAsked: (story.followUps || []).filter(f => f.kind === 'question').map(f => f.question),
  } : null;
  return [
    ABG_CONTEXT + " Kyle (or another ABG adult) narrated the journal " + (items.length > 1 ? 'entries' : 'entry') + " below, usually by voice dictation and often as interview answers (Q/A), so expect missing punctuation and small transcription slips. They describe someone who works or worked with ABG. Turn them into a structured Staff Impact Report. Today is " + todayLocal() + ".",
    name ? "The person's first name is " + name + ". Use only the first name." : '',
    staffInfoText(si) ? "Details Kyle entered on the intake form (treat as given): " + staffInfoText(si) + "." : '',
    si.formerStudent === 'yes' ? "This person was an ABG student before working there. Build the journey from the stages the interview supports (student participation, skill development, employment opportunity, professional growth, community contribution) and write journeySummary. Leave out any stage the interview doesn't support: never assume they were paid, gained a skill or became a mentor." : "This person is not recorded as a former ABG student" + (si.formerStudent === 'no' ? '' : " (it's unknown)") + ". Don't describe them as one unless the entries say so. Use the journey list only for stages after they joined ABG (skills, employment, growth, community), or leave it empty; journeySummary is null unless the entries say they were an ABG student.",
    mode === 'update' ? "This is an UPDATE to a staff story already in the journal. Treat the existing record as true context and keep its facts.\nEXISTING RECORD:\n" + JSON.stringify(existing) : '',
    whenHint ? "Kyle says this happened: " + whenHint : '',
    `RULES
- Meaningful storytelling and credible measurement matter equally. The story is about a person, not a list of positive outcomes.
- Employment outcomes: distinguish PAID employment from volunteering, stipends and internships. If the interview doesn't say whether something was paid, don't call it a job or paid position: set "paid" to "unknown" and add a missing-data item. A person and a position are different things: one person can hold several positions.
- Durations, start years, numbers of positions and other quantities: record them only when Kyle states them, with status "estimate" when approximate ("about", "around", "I think"). Never compute or guess a duration.
- Outcome domains for staff stories: employment (paid work at ABG), first_job, role_growth (promotion or expanded responsibilities), pro_skills, training (training or mentorship received), staff_leadership, mentoring_students (mentors or teaches ABG students), community_contribution, further_ed, next_employment (later or additional employment, inside or outside ABG), stability (personal growth, stability, confidence or sense of purpose). Use student domains (e.g. confidence, artistic) only for things that happened while they were an ABG student.
- staffCard: the staff impact card, the same fields on every staff story. Fields: ${STAFF_FIELDS.map(f => f.id + ' (' + f.label + (f.type === 'number' ? ', a number only' : f.type === 'choice' ? ', one of: ' + f.options.join(' / ') : ', short text') + ')').join('; ')}. Include a field only when the entries actually say it; leave the rest out (an unknown is never "No" or zero). Status "reported" when Kyle states it plainly, "estimate" when approximate. Never "verified". Every value needs "excerpt".
- Evidence types: Kyle's own observation (observer abg_staff); something the person or someone else told him (observer student for the staff member themselves, or other); unconfirmed or inferred (status "unverified", or "inferred": true). Never mark anything verified.
- Evidence status: "reported" for facts Kyle states plainly; "estimate" for approximate numbers; "qualitative" for non-numeric observations; "unverified" for secondhand or uncertain claims; "future" for hoped-for outcomes. Never "verified".
- Every evidence item needs "metric", "domain", "direction", "level", "excerpt" (copied word for word from the entries) and "basis".
- Never invent names, numbers, dates, job titles, pay, outcomes or quotes. Use null or an empty list when information isn't there. Don't record salary or other financial details even if mentioned.
- Never add a last name or other identifying details.
- Describe outcomes as observed or reported. Don't say ABG caused an outcome unless Kyle says so.
- Setbacks and challenges are valid evidence. Don't spin them positive.
- Quotes: "exact" for words that appear word for word in the entries and were clearly said (Kyle's own quotable statements use speaker "Narrator"); "remembered" when Kyle recalls what someone said; "paraphrase" for statements put in other words. Never create a quote.
- Milestones fill the person's timeline (first involvement, hired, promoted, began mentoring, left for another job...). Use phase "future" only for possible developments worth checking, with confirmed false.
- Set "containsSensitive" true whenever the entries mention the justice system, substance use, immigration, health or similar sensitive experiences, and keep those details out of the story.`,
    mode === 'update' ? `FOR THIS UPDATE: "story", "summary", "takeaways", "stakeholders", "journey" and "journeySummary" are the full updated versions combining the existing record with the new information. "missingMetrics" is the complete current list. "staffCard" contains only fields the new entries state or change. "evidence", "quotes", "milestones", "materials" and "recommendedFollowUps" contain ONLY new items from the new entries. In "structure", give updated text only for parts the new entries change and null for the rest.` : '',
    `ID LISTS
categories: ${CATEGORIES.map(c => c.id + ' (' + c.label + ')').join(', ')}
themes: ${THEMES.map(t => t.id + ' (' + t.label + ')').join(', ')}
audiences: ${AUDIENCES.map(a => a.id + ' (' + a.label + ')').join('; ')}
link types: ${LINK_TYPES.filter(l => l.id !== 'same_person').map(l => l.id).join(', ')}`,
    others.length ? "OTHER STORIES ALREADY IN THE JOURNAL. Suggest a link only when the entries likely concern the same program, school, mural, community or partnership. Never suggest a link because a first name matches: two people can share a first name, and linking a person's student and staff stories is done only by ABG staff who have confirmed it.\n" + JSON.stringify(others) : "There are no other stories in the journal yet, so possibleLinks must be an empty list.",
    "ENTRIES\n" + entriesText,
    "Reply with only JSON in exactly this shape:\n" + STAFF_ANALYSIS_SHAPE,
  ].filter(Boolean).join('\n\n');
}
function normalizeJourney(raw, locate){
  const seen = new Set();
  return asArr(raw).map(j => {
    j = j || {};
    const stage = pickEnum(j.stage, JOURNEY_STAGES, ''); const text = asStr(j.text).replace(/^null$/i, '');
    if (!stage || !text || seen.has(stage)) return null;
    seen.add(stage);
    const excerpt = asStr(j.excerpt).replace(/^null$/i, ''); const loc = excerpt ? locate(excerpt) : {found: false};
    return {stage, text, excerpt, found: !!loc.found};
  }).filter(Boolean).sort((a, b) => JOURNEY_STAGES.findIndex(x => x.id === a.stage) - JOURNEY_STAGES.findIndex(x => x.id === b.stage));
}
function normalizeAnalysis(raw, ctx){
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const items = ctx.items;
  const lastId = items.length ? items[items.length - 1].id : null;
  const nul = s => asStr(s).replace(/^null$/i, '');
  const locate = excerpt => {
    for (const it of items) { if (foundIn(excerpt, it.text) || (it.alt && foundIn(excerpt, it.alt))) return {entryId: it.id, found: true}; }
    return {entryId: lastId, found: false};
  };
  const structure = {};
  STRUCTURE.forEach(f => { structure[f.id] = nul(r.structure && r.structure[f.id]); });
  const evidence = asArr(r.evidence).slice(0, 30).map(e => {
    e = e || {};
    const excerpt = asStr(e.excerpt);
    const loc = locate(excerpt);
    let status = pickEnum(e.status, EVIDENCE_STATUS, 'qualitative'); if (status === 'verified') status = 'reported';
    const value = toNum(e.value);
    const before = nul(e.before), after = nul(e.after);
    const lvl = parseInt(asStr(e.level), 10);
    return { id: uid('ev'), category: pickEnum(e.category, CATEGORIES, 'engagement'), kind: (value != null || /^numeric/.test(asStr(e.kind)) || (before && after)) ? 'numeric' : 'qualitative',
      metric: nul(e.metric), domain: pickEnum(e.domain, DOMAINS, ''), direction: pickEnum(asStr(e.direction).split(/\s/)[0], DIRECTIONS, 'unclear'), level: [1, 2, 3].includes(lvl) ? lvl : (before && after ? 2 : 1),
      statement: asStr(e.statement), value: value, unit: nul(e.unit), before: before, after: after, timeframe: nul(e.timeframe), observer: pickEnum(e.observer, OBSERVERS, ''),
      status: status, basis: nul(e.basis), observation: nul(e.observation), activity: nul(e.activity), contribution: nul(e.contribution), openQuestion: nul(e.openQuestion), inferred: e.inferred === true || e.inferred === 'true',
      paid: ['yes', 'no'].includes(asStr(e.paid).toLowerCase()) ? asStr(e.paid).toLowerCase() : '',
      source: {entryId: loc.entryId, excerpt: excerpt, found: loc.found, note: ''}, observed: '' };
  }).filter(e => e.statement);
  const quotes = asArr(r.quotes).slice(0, 12).map(q => {
    q = q || {};
    const text = asStr(q.text).replace(/^["“]|["”]$/g, '');
    const loc = locate(text);
    return {id: uid('q'), text: text, speaker: nul(q.speaker), kind: pickEnum(q.kind, QUOTE_KINDS, 'paraphrase'), entryId: loc.entryId, found: loc.found, approved: false};
  }).filter(q => q.text);
  const milestones = asArr(r.milestones).slice(0, 14).map(m => {
    m = m || {};
    const phase = pickEnum(m.phase, PHASES, 'involvement');
    return { id: uid('m'), date: {text: nul(m.date && m.date.text), iso: cleanIso(m.date && m.date.iso)}, label: asStr(m.label), phase: phase, confirmed: phase === 'future' ? false : m.confirmed !== false, entryId: lastId };
  }).filter(m => m.label);
  const followUps = asArr(r.followUpQuestions).map(nul).filter(Boolean).slice(0, 2)
    .map(q => ({id: uid('f'), kind: 'question', question: q, due: '', status: 'open', answer: '', entryId: null}))
    .concat(asArr(r.recommendedFollowUps).map(nul).filter(Boolean).slice(0, 5)
    .map(q => ({id: uid('f'), kind: 'task', question: q, due: '', status: 'open', answer: '', entryId: null, suggested: true})));
  const missingMetrics = asArr(r.missingMetrics).slice(0, 10).map(m => ({id: uid('mm'), metric: nul(m && m.metric), why: nul(m && m.why), howToGet: nul(m && m.howToGet)})).filter(m => m.metric);
  const materials = asArr(r.materials).slice(0, 10).map(m => ({id: uid('mat'), type: pickEnum(m && m.type, MATERIAL_TYPES, 'other'), description: nul(m && m.description)})).filter(m => m.description);
  /* "same person" links are never suggested by Claude: only a person who confirmed it can link student and staff stories */
  const links = asArr(r.possibleLinks).filter(l => l && ctx.storyIds.has(l.storyId) && l.type !== 'same_person').slice(0, 4)
    .map(l => ({storyId: l.storyId, type: pickEnum(l.type, LINK_TYPES, 'same_program'), reason: asStr(l.reason), decision: null}));
  const ed = r.eventDate && typeof r.eventDate === 'object' ? r.eventDate : {};
  const ov = r.overview && typeof r.overview === 'object' ? r.overview : {};
  const st = r.stakeholders && typeof r.stakeholders === 'object' ? r.stakeholders : {};
  return {
    title: nul(r.title), summary: nul(r.summary), story: nul(r.story), entrySummary: nul(r.entrySummary), alias: nul(r.alias), isMinor: yn(r.isMinor),
    overview: {ageOrGrade: nul(ov.ageOrGrade), background: nul(ov.background), involvementDate: nul(ov.involvementDate)},
    period: r.period === 'past' ? 'past' : 'recent',
    eventDate: {text: nul(ed.text), iso: cleanIso(ed.iso), approximate: !!ed.approximate},
    program: nul(r.program), community: nul(r.community),
    takeaways: asArr(r.takeaways).map(asStr).filter(Boolean).slice(0, 5),
    structure: structure,
    categories: uniq(asArr(r.categories).filter(id => byId(CATEGORIES, id))),
    themes: uniq(asArr(r.themes).filter(id => byId(THEMES, id))),
    audiences: uniq(asArr(st.primary).concat(asArr(r.audiences)).filter(id => byId(AUDIENCES, id))),
    stakeholderWhy: nul(st.why),
    stakeholderValue: Object.assign({schools: nul(st.schools), donors: nul(st.donors), grants: nul(st.grants)}, ctx.kind === 'staff' ? {community: nul(st.community), consulting: nul(st.consulting)} : {}),
    evidence, quotes, milestones, followUps, missingMetrics, materials, links,
    metrics: ctx.kind === 'staff' ? {} : cleanMetrics(r.metricsCard, true),
    staffCard: ctx.kind === 'staff' ? cleanMetrics(r.staffCard, true, STAFF_FIELDS) : {},
    journey: ctx.kind === 'staff' ? normalizeJourney(r.journey, locate) : [],
    journeySummary: ctx.kind === 'staff' ? nul(r.journeySummary) : '',
    containsIdentifying: r.containsIdentifying === true,
    containsSensitive: r.containsSensitive === true || evidence.some(e => e.domain === 'risk'),
  };
}

async function runAnalysis({sample, mode, story, stories, items, whenHint, studentName, memo, studentInfo, staffInfo, kind, signal}){
  const k = kind || (isStaffStory(story) ? 'staff' : 'student');
  const others = stories.filter(s => (!story || s.id !== story.id) && (!s.demo || (story && story.demo)))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 80)
    .map(s => ({id: s.id, type: storyTypeLabel(s), title: s.title || null, person: s.alias || null, program: s.program || null, community: s.community || null, summary: trunc(s.summary, 220) || null}));
  const name = studentName || (story && story.alias) || '';
  const prompt = k === 'staff' ? staffAnalysisPrompt({mode, story, items, others, whenHint, name, staffInfo})
    : analysisPrompt({mode, story, items, others, whenHint, memo: asStr(memo), studentInfo, studentName: name});
  let raw;
  try { raw = await sample.json(prompt, {modelTier: 'default', signal}); }
  catch (e) {
    if (!e || e.code !== 'invalid_json') throw e;
    /* one automatic retry, with a firmer reminder about the format */
    raw = await sample.json(prompt + '\n\nYour previous reply could not be read as JSON. Reply with only the JSON object, starting with { and ending with }. Keep "story" under 350 words.', {modelTier: 'default', signal});
  }
  return normalizeAnalysis(raw, {items, kind: k, storyIds: new Set(others.map(o => o.id))});
}

function searchPrompt(q, stories){
  const index = stories.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 250).map(s => ({
    id: s.id, type: storyTypeLabel(s), formerAbgStudent: isFormerStudent(s) || undefined, role: isStaffStory(s) ? ((staffVal(s, 'role') || {}).value || (s.staffInfo || {}).role || null) : undefined, title: s.title, person: s.alias || null, summary: trunc(s.summary, 220), program: s.program || null, community: s.community || null,
    when: fmtEventDate(s.eventDate) || null, themes: (s.themes || []).map(t => labelOf(THEMES, t)), usefulFor: (s.audiences || []).map(a => labelOf(AUDIENCES, a)),
    status: labelOf(STATUSES, s.status), evidence: (s.evidence || []).slice(0, 5).map(e => trunc(e.statement, 110) + ' [' + e.status + ']'),
  }));
  return `Find the stories in this Arts Bridging the Gap journal index that best match the request below. Stories are either Student Impact stories (about a student), Staff Impact stories (about someone who works or worked with ABG; "formerAbgStudent" marks staff who were ABG students first) or general stories. Match on meaning, not only keywords, but only on what the stories actually record: don't treat a story as showing an outcome (improved attendance, for example) unless its summary or evidence says so. If the request is about material for an outside audience (donors, schools, partners), prefer stories with status "Approved for external use" and mention the status in the reason.

Request: ${q}

Reply with only JSON: {"results": [{"id": "story id from the index", "why": "one short sentence on why it matches"}]}. Best match first, at most 12 results, only ids from the index, and an empty list if nothing matches.

Index:
${JSON.stringify(index)}`;
}

/* sensitive experiences (gang involvement, risky behavior) stay out of external material unless consent is documented */
function needsSensitiveCare(s){ const p = s.privacy || {}; const has = p.sensitive === 'yes' || (s.evidence || []).some(e => domainOf(e) === 'risk'); return has && p.sensitiveConsent !== 'yes'; }
function externalEvidence(s){ return (s.evidence || []).filter(e => e.status !== 'unverified' && !(needsSensitiveCare(s) && domainOf(e) === 'risk')); }
function needsRedaction(s){ const p = s.privacy || {}; return p.redact === 'yes' || (p.identifying === 'yes' && p.permission !== 'yes'); }
/* the name allowed in external material: the first name only with documented permission, else the public alias, else none */
function scrubName(text, alias, repl){ const t = String(text == null ? '' : text); const a = asStr(alias); if (!a) return t; try { return t.replace(new RegExp('(?<![\\p{L}])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'giu'), repl); } catch (e) { return t.split(a).join(repl); } }
function externalName(s){ const p = s.privacy || {}; if (p.permission === 'yes' && p.redact !== 'yes' && s.alias) return s.alias; return asStr(s.publicName) || ''; }

function adaptPrompt(s, audId, fmtId){
  const a = byId(AUDIENCES, audId), f = byId(FORMATS, fmtId);
  const name = externalName(s);
  const staff = isStaffStory(s);
  const who = staff ? 'staff member' : 'student';
  const record = {
    title: s.title, impactStory: s.story || s.summary, storyType: storyTypeLabel(s), [staff ? 'staffMember' : 'student']: name || 'a ' + who + ' (do not use any name)', ageOrGrade: staff ? undefined : ((s.overview || {}).ageOrGrade || null),
    role: staff ? ((staffVal(s, 'role') || {}).value || null) : undefined, formerAbgStudent: staff ? isFormerStudent(s) : undefined, studentToStaffJourney: staff && s.journeySummary ? s.journeySummary : undefined,
    employmentFacts: staff ? STAFF_FIELDS.filter(f => staffVal(s, f.id)).map(f => f.label + ': ' + staffVal(s, f.id).value + ' (' + labelOf(METRIC_STATUS, staffVal(s, f.id).status).toLowerCase() + ')') : undefined,
    when: fmtEventDate(s.eventDate) || null, program: s.program || null, community: needsRedaction(s) ? null : (s.community || null), takeaways: s.takeaways || [],
    evidence: externalEvidence(s).map(e => ({type: e.kind === 'numeric' ? 'measurable outcome' : 'qualitative', statement: e.statement, number: toNum(e.value), unit: e.unit || null, before: e.before || null, after: e.after || null, period: e.timeframe || null, status: labelOf(EVIDENCE_STATUS, e.status), observedBy: e.observer ? labelOf(OBSERVERS, e.observer) : null, basis: e.basis || null})),
    quotesYouMayUse: (s.quotes || []).filter(q => q.approved).map(q => ({text: q.text, speaker: q.speaker === s.alias && !name ? 'the ' + who : (q.speaker === s.alias ? name : q.speaker), kind: q.kind})),
    timeline: sortMilestones(s.milestones || []).map(m => ({when: fmtEventDate(m.date) || null, what: m.label, status: m.phase === 'future' ? 'pending, not yet documented' : (m.confirmed ? 'confirmed' : 'unconfirmed')})),
    whyItMatters: s.stakeholderWhy || null,
  };
  const realName = s.alias && norm(s.alias) !== norm(name) ? s.alias : '';
  return `Write a ${f.label.toLowerCase()} for ${a.label.toLowerCase()} from the approved story record below. ${ABG_CONTEXT}

Emphasize: ${a.emphasis}.
Length and shape: ${f.guide}.

Rules:
- Keep every fact consistent with the record. Change only framing, emphasis and presentation.
- Don't add numbers, outcomes, names, places, dates or quotes that aren't in the record.
- Present numbers honestly: say "about" for estimates, and present reported figures as reported by ABG staff rather than as verified results.
- Never produce return-on-investment, cost-per-outcome or other financial figures; the record has no cost data.
- Use quotes only from quotesYouMayUse, word for word. Present remembered quotes as recalled by ABG staff.
- Describe outcomes as observed or reported. Don't claim ABG caused them unless the record says so.
- Pending timeline items are not accomplishments. Mention them only as next steps, if at all.
${staff ? '- This is a Staff Impact story about someone who works or worked with ABG. Call paid work a job or position only where the record says it was paid, and present durations and roles as reported by ABG staff, not as verified employment records.\n' : ''}- ${needsSensitiveCare(s) ? 'Do not mention gang involvement, the justice system, substance use or other sensitive or stigmatizing experiences, even if the story text does; consent to share them is not documented. ' : ''}${name ? 'Refer to the ' + who + ' only as ' + name + '.' : 'Do not name the ' + who + '; say "a ' + who + '" or similar.'}${realName ? ' The record may mention the name ' + realName + ' elsewhere; never use it.' : ''} Leave out identifying details.
- Plain text, no Markdown symbols. Warm, specific and professional. Avoid clichés such as "transformative journey".

Record:
${realName ? scrubName(JSON.stringify(record), realName, name || 'the ' + who) : JSON.stringify(record)}`;
}

function reportPrompt(stories, metrics){
  const approved = stories.filter(s => s.status === 'approved');
  const S = approved.map((s, i) => {
    const name = externalName(s);
    const obj = {
      ref: 'S' + (i + 1), storyType: storyTypeLabel(s), source: isCommunity(s) ? 'Community submission: ' + sourceLabel(s) : 'ABG staff interview', title: s.title, [isStaffStory(s) ? 'staffMember' : 'student']: name || (isStaffStory(s) ? 'a staff member (no name)' : 'a student (no name)'), when: fmtEventDate(s.eventDate) || null, program: s.program || null,
      formerAbgStudent: isStaffStory(s) ? isFormerStudent(s) : undefined, studentToStaffJourney: isStaffStory(s) && s.journeySummary ? s.journeySummary : undefined,
      employmentFacts: isStaffStory(s) ? STAFF_FIELDS.filter(f => staffVal(s, f.id)).map(f => f.label + ': ' + staffVal(s, f.id).value + ' (' + staffVal(s, f.id).status + ')') : undefined,
      community: needsRedaction(s) ? null : (s.community || null), impactStory: trunc(s.story || s.summary, 1800), takeaways: s.takeaways || [],
      themes: (s.themes || []).map(t => labelOf(THEMES, t)), audiences: (s.audiences || []).map(a => labelOf(AUDIENCES, a)), whyItMatters: s.stakeholderWhy || null,
      sensitiveDetailsAllowed: !needsSensitiveCare(s),
      evidence: externalEvidence(s).map(e => ({type: e.kind === 'numeric' ? 'measurable outcome' : 'qualitative', statement: e.statement, number: toNum(e.value), unit: e.unit || null, before: e.before || null, after: e.after || null, period: e.timeframe || null, status: e.status, observedBy: e.observer ? labelOf(OBSERVERS, e.observer) : null, basis: e.basis || null})),
      missingMetrics: (s.missingMetrics || []).map(m => m.metric),
      approvedQuotes: (s.quotes || []).filter(q => q.approved).map(q => ({text: q.text, speaker: q.speaker === s.alias ? (name || 'the student') : q.speaker, kind: q.kind})),
      timeline: sortMilestones(s.milestones || []).map(m => ({when: fmtEventDate(m.date) || null, what: m.label, phase: labelOf(PHASES, m.phase), status: m.phase === 'future' ? 'pending' : 'documented'})),
      spansYears: yearRange(s) || null,
    };
    let json = JSON.stringify(obj);
    if (s.alias && s.alias !== name) json = scrubName(json, s.alias, name || (isStaffStory(s) ? 'the staff member' : 'the student'));
    return json;
  });
  const staffN = stories.filter(isStaffStory).length;
  const staffSummary = staffN ? staffImpactStats(stories).summary : null;
  const M = metrics.map((m, i) => ({ref: 'M' + (i + 1), label: m.label, value: m.value, unit: m.unit || null, period: m.period || null, source: m.source || null}));
  const themeCounts = THEMES.map(t => ({theme: t.label, storiesMentioning: stories.filter(s => (s.themes || []).includes(t.id)).length})).filter(x => x.storiesMentioning > 0);
  const audienceCounts = AUDIENCES.map(a => ({audience: a.label, approvedStoriesRelevant: approved.filter(s => (s.audiences || []).includes(a.id)).length}));
  const profiles = studentProfiles(stories);
  const cardSummary = outcomeLines(profiles).filter(l => l.n > 0 && l.f.type !== 'text').map(l => ({field: l.f.label, finding: l.text, studentsWithAValue: l.n, studentsDocumented: l.N, verified: l.counts.verified, reported: l.counts.reported, estimated: l.counts.estimate}));
  const byCategory = categoryStats(stories).filter(c => c.n > 0).map(c => ({category: c.d.label, studentsWithData: c.n, reportedImprovement: c.improved, verifiedImprovement: c.improvedVerified, measurableBeforeAfterImprovement: c.measurable,
    averages: c.averages.filter(a => a.n >= 2).map(a => ({unit: a.unit, students: a.n, before: a.before, after: a.after, change: a.change, verified: a.verified})), storiesWithVerifiedEvidence: c.verifiedStories,
    retainedOrReturned: c.d.id === 'participation' ? c.retained : undefined}));
  const totals = {storiesRecorded: stories.length, historicalStories: stories.filter(s => s.period === 'past').length, recentStories: stories.filter(s => s.period !== 'past').length, storiesWithUpdates: stories.filter(isOngoing).length, approvedForExternalUse: approved.length};
  const gaps = {
    storiesNeedingInformation: stories.filter(needsInfo).length,
    openRecommendedFollowUps: stories.reduce((n, s) => n + openTasks(s).length, 0),
    unverifiedEvidenceItems: stories.reduce((n, s) => n + (s.evidence || []).filter(e => e.status === 'unverified').length, 0),
    mostCommonMissingMetrics: Object.entries(stories.reduce((m, s) => { (s.missingMetrics || []).forEach(x => { const k = trunc(x.metric, 80); m[k] = (m[k] || 0) + 1; }); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0] + ' (' + e[1] + ' stories)'),
    storiesAwaitingApproval: stories.filter(s => s.status === 'draft' || s.status === 'needs_verification').length,
  };
  return `Draft an impact report in Markdown. ${ABG_CONTEXT} The report will feed fundraising materials, grant applications, partnership packets, newsletters and annual impact summaries.

Use these sections, in order:
1. Overview of documented stories
2. Major recurring impact themes
3. Selected approved student narratives
4. Verified numerical evidence
5. Long-term student outcomes
${staffN ? '6. Staff and employment impact (from the staff summary below; include the student-to-staff pathway if it has any former students)\n7. Relevance to stakeholder groups\n8. Missing data and recommended follow-ups' : '6. Relevance to stakeholder groups\n7. Missing data and recommended follow-ups'}

Rules:
- Use only the data below. Don't invent numbers, outcomes, names or quotes. No return-on-investment or cost figures.
- Theme counts are numbers of stories that mention a theme. Never present them as percentages of students or outcome rates.
- Section 4 may contain only the verified program metrics (cite [M1], [M2]...) and story evidence whose status is "verified". If there is none, say so plainly.
- Elsewhere, label numbers by status ("reported", "estimated"). Leave out unverified evidence.
- Keep storytelling clearly separate from validated numbers.
- Never add together numbers from different stories; several stories can describe the same student or program.
- Describe outcomes as observed or reported, not as caused by ABG unless a story says so. Pending timeline items are not accomplishments.
- Community submissions are the contributor's own account (self-reported) or what they witnessed (community-observed). Present them that way, never as staff observations or verified records.
- Refer to students only by the name given in each story's "student" field, and staff members only by the name in "staffMember".
- Staff figures count unique staff members documented in this journal, not all ABG employees, and documented opportunities, not every job ABG has created. A person and a position are different: never present the number of people as the number of jobs. Unknown values are not zero.
- For stories with sensitiveDetailsAllowed false, never mention gang involvement, the justice system, substance use or other stigmatizing experiences, even if the impact story text does.
- Milestone counts describe students documented in this journal, which were selectively collected. Report them as counts ("4 of the 12 students documented"), never as rates for all ABG students.
- Student metrics card summaries describe only the students documented in this journal, drawn from all stories (approved or not) with no names. Always say how many students a finding rests on (e.g. "4 of the 6 students documented") and whether the values are verified, reported or estimated. Never present them as rates for all ABG students. Use them in sections 1, 5 and 7; in section 4 only if every value behind a finding is verified.
- Cite stories as [S1], [S2] after each claim drawn from them. Use only approvedQuotes, word for word, with the speaker.
- 700 to 1,000 words. Start with "# ABG Impact Report" and a one-line note that this is a draft for review.

Totals: ${JSON.stringify(totals)}
Theme counts (all stories): ${JSON.stringify(themeCounts)}
Approved stories relevant to each audience: ${JSON.stringify(audienceCounts)}
Documentation gaps (all stories): ${JSON.stringify(gaps)}
Verified program metrics: ${JSON.stringify(M)}
Student metrics card summaries: ${JSON.stringify(cardSummary)}
Milestones (students documented in this journal, not ABG-wide rates): ${JSON.stringify(milestoneStats(stories).rows.filter(r => r.n).map(r => ({milestone: r.mi.label, students: r.n, of: milestoneStats(stories).N, kyleObserved: r.observed, reportedToKyle: r.reported})))}
Impact by category (one count per student; percentages must use studentsWithData as the denominator; say "of the N students with data"): ${JSON.stringify(byCategory)}
${staffSummary ? 'Staff and employment summary (unique staff members documented in this journal; counts, not rates): ' + JSON.stringify(staffSummary) + '\n' : ''}Approved stories: [${S.join(',')}]`;
}

/* ================= draft building ================= */
function newStoryFromAnalysis(a, opts){
  const s = blankStory(opts.me);
  Object.assign(s, {
    title: a.title || 'Untitled story', summary: a.summary, story: a.story, alias: opts.studentName || a.alias, studentId: opts.studentId || null,
    overview: a.overview, period: a.period,
    eventDate: {text: a.eventDate.text || opts.whenHint || '', iso: a.eventDate.iso, approximate: !!(opts.approx || a.eventDate.approximate)},
    program: a.program, community: a.community, categories: a.categories, themes: a.themes, audiences: a.audiences, stakeholderWhy: a.stakeholderWhy, stakeholderValue: a.stakeholderValue || {},
    takeaways: a.takeaways, structure: a.structure, evidence: a.evidence, missingMetrics: a.missingMetrics, quotes: a.quotes, milestones: a.milestones,
    materials: a.materials, followUps: a.followUps, metrics: a.metrics || {}, analysis: {state: 'done', at: nowISO()},
  });
  if (opts.kind === 'staff') {
    s.storyType = 'staff'; s.studentId = null; s.staffId = opts.staffId || null;
    s.staffInfo = cleanStaffInfo(opts.staffInfo);
    /* values typed on the intake form win over Claude's reading of the same field */
    s.staffCard = Object.assign({}, a.staffCard || {}, intakeCard(s.staffInfo));
    s.journey = a.journey || []; s.journeySummary = a.journeySummary || '';
    s.overview = {ageOrGrade: '', background: a.overview.background, involvementDate: a.overview.involvementDate};
  } else {
    const si = opts.studentInfo || {};
    s.overview = Object.assign({}, s.overview, {gender: si.gender || '', demographics: si.demographics || ''});
    if (si.school) s.community = si.school;
  }
  s._suggest = a.links;
  s.privacy = {minor: a.isMinor, identifying: a.containsIdentifying ? 'yes' : 'unknown', permission: 'unknown', external: 'unknown', redact: a.containsIdentifying ? 'yes' : 'unknown', sensitive: a.containsSensitive ? 'yes' : 'unknown', sensitiveConsent: 'unknown'};
  return s;
}
function mergeUpdate(base, a){
  const d = Object.assign(blankStory({}), clone(base));
  d._suggest = a.links.filter(l => !(d.links || []).some(x => x.storyId === l.storyId));
  if (a.summary) d.summary = a.summary;
  if (a.story) d.story = a.story;
  if (a.takeaways.length) d.takeaways = a.takeaways;
  if (a.stakeholderWhy) d.stakeholderWhy = a.stakeholderWhy;
  d.stakeholderValue = Object.assign({}, d.stakeholderValue || {}); ['schools', 'donors', 'grants', 'community', 'consulting'].forEach(k => { if (a.stakeholderValue && a.stakeholderValue[k]) d.stakeholderValue[k] = a.stakeholderValue[k]; });
  d.overview = Object.assign({ageOrGrade: '', background: '', involvementDate: ''}, d.overview || {});
  ['ageOrGrade', 'background', 'involvementDate'].forEach(k => { if (!d.overview[k] && a.overview[k]) d.overview[k] = a.overview[k]; });
  d.structure = d.structure || {};
  STRUCTURE.forEach(f => { if (a.structure[f.id]) d.structure[f.id] = a.structure[f.id]; });
  d.categories = uniq((d.categories || []).concat(a.categories));
  d.themes = uniq((d.themes || []).concat(a.themes));
  d.audiences = uniq((d.audiences || []).concat(a.audiences));
  if (!d.alias && a.alias) d.alias = a.alias;
  if (!d.program && a.program) d.program = a.program;
  if (!d.community && a.community) d.community = a.community;
  d.privacy = Object.assign({minor: 'unknown', identifying: 'unknown', permission: 'unknown', external: 'unknown', redact: 'unknown'}, d.privacy || {});
  if (a.isMinor !== 'unknown' && d.privacy.minor === 'unknown') d.privacy.minor = a.isMinor;
  if (a.containsIdentifying && d.privacy.identifying !== 'yes') d.privacy.identifying = 'yes';
  if (a.containsSensitive) d.privacy.sensitive = 'yes';
  const mark = x => Object.assign({}, x, {_new: true});
  if (a.missingMetrics.length) d.missingMetrics = a.missingMetrics.map(mark);
  d.evidence = (d.evidence || []).concat(a.evidence.map(mark));
  d.quotes = (d.quotes || []).concat(a.quotes.map(mark));
  d.milestones = (d.milestones || []).concat(a.milestones.map(mark));
  d.materials = (d.materials || []).concat(a.materials.map(mark));
  const seen = new Set((d.followUps || []).map(f => norm(f.question)));
  d.followUps = (d.followUps || []).concat(a.followUps.filter(f => !seen.has(norm(f.question))).map(mark));
  d.metrics = Object.assign({}, d.metrics || {});
  Object.keys(a.metrics || {}).forEach(k => { const cur = d.metrics[k]; if (cur && cur.status === 'verified' && asStr(cur.value)) return; if (cur && norm(cur.value) === norm(a.metrics[k].value)) return; d.metrics[k] = Object.assign({}, a.metrics[k], {_new: true}); });
  if (isStaffStory(d)) {
    d.staffCard = Object.assign({}, d.staffCard || {});
    Object.keys(a.staffCard || {}).forEach(k => { const cur = d.staffCard[k]; if (cur && cur.status === 'verified' && asStr(cur.value)) return; if (cur && norm(cur.value) === norm(a.staffCard[k].value)) return; d.staffCard[k] = Object.assign({}, a.staffCard[k], {_new: true}); });
    if ((a.journey || []).length) d.journey = a.journey;
    if (a.journeySummary) d.journeySummary = a.journeySummary;
  }
  if (d.status === 'approved') { d.status = 'needs_verification'; d._wasApproved = true; }
  d.analysis = {state: 'done', at: nowISO()};
  return d;
}
function buildReviewDraft(p){
  const {mode, base, analysis, whenHint, approx, me, followupId, answered, entry, studentId, studentName, studentInfo, kind, staffId, staffInfo} = p;
  if (mode === 'edit') return base ? Object.assign(blankStory({}), clone(base)) : null;
  if (mode === 'update') {
    if (!base) return null;
    const d = mergeUpdate(base, analysis);
    if (answered) d.followUps = d.followUps.map(f => { const x = answered.find(y => y.id === f.id); return x ? Object.assign({}, f, {status: x.status, answer: x.answer || '', entryId: x.status === 'answered' && entry ? entry.id : null}) : f; });
    if (followupId) d.followUps = d.followUps.map(f => f.id === followupId ? Object.assign({}, f, {status: 'done', answer: analysis.entrySummary || '', entryId: entry ? entry.id : null}) : f);
    return d;
  }
  const k = kind || (isStaffStory(base) ? 'staff' : 'student');
  const d = newStoryFromAnalysis(analysis, {whenHint, approx, me, studentId: k === 'staff' ? null : studentId, studentName, studentInfo, kind: k, staffId: staffId || (base && base.staffId) || null, staffInfo: staffInfo || (base && base.staffInfo) || null});
  if (base) Object.assign(d, {id: base.id, createdAt: base.createdAt, createdBy: base.createdBy, entryCount: base.entryCount || 1, status: base.status || 'draft', drafts: base.drafts || [], links: base.links || [], studentId: k === 'staff' ? null : (base.studentId || null), alias: base.alias || d.alias, publicName: base.publicName || ''});
  return d;
}
function finalizeStory(d, me){
  const s = clone(d);
  const newLinks = (s._suggest || []).filter(l => l.decision === 'link').map(l => ({storyId: l.storyId, type: l.type, reason: l.reason, confirmed: true}));
  delete s._suggest; delete s._wasApproved;
  ['evidence', 'quotes', 'milestones', 'followUps', 'missingMetrics', 'materials'].forEach(k => { s[k] = (s[k] || []).map(x => { const y = Object.assign({}, x); delete y._new; return y; }); });
  s.evidence = s.evidence.map(e => { const v = toNum(e.value); return Object.assign({}, e, {value: v, kind: v != null ? 'numeric' : (e.kind || 'qualitative')}); });
  s.milestones = s.milestones.map(m => Object.assign({}, m, {date: {text: (m.date && m.date.text) || '', iso: cleanIso(m.date && m.date.iso)}}));
  s.followUps = s.followUps.filter(f => asStr(f.question));
  /* planned outcomes are tracked as follow-up reminders, never counted as results */
  const haveQ = new Set(s.followUps.map(f => norm(f.question)));
  s.evidence.filter(e => e.status === 'future' && asStr(e.statement)).forEach(e => { const q = 'Check on: ' + asStr(e.statement); if (!haveQ.has(norm(q))) { haveQ.add(norm(q)); s.followUps.push({id: uid('f'), kind: 'task', question: q, due: '', status: 'open', answer: '', entryId: null, suggested: true}); } });
  s.missingMetrics = s.missingMetrics.filter(m => asStr(m.metric));
  s.materials = s.materials.filter(m => asStr(m.description));
  s.takeaways = (s.takeaways || []).map(t => asStr(t)).filter(Boolean);
  s.metrics = cleanMetrics(s.metrics, false); Object.keys(s.metrics).forEach(k => { delete s.metrics[k]._new; });
  if (isStaffStory(s)) {
    s.staffInfo = cleanStaffInfo(s.staffInfo);
    s.staffCard = cleanMetrics(s.staffCard, false, STAFF_FIELDS); Object.keys(s.staffCard).forEach(k => { delete s.staffCard[k]._new; });
    s.journey = asArr(s.journey).filter(j => j && byId(JOURNEY_STAGES, j.stage) && asStr(j.text)).map(j => ({stage: j.stage, text: asStr(j.text), excerpt: asStr(j.excerpt), found: !!j.found}));
    s.journeySummary = asStr(s.journeySummary);
    s.studentId = null;
  }
  s.eventDate = Object.assign({text: '', iso: '', approximate: false}, s.eventDate || {});
  s.eventDate.iso = cleanIso(s.eventDate.iso);
  s.alias = asStr(s.alias); s.publicName = asStr(s.publicName);
  const links = s.links || [];
  newLinks.forEach(l => { if (!links.some(x => x.storyId === l.storyId && x.type === l.type)) links.push(l); });
  s.links = links;
  s.title = asStr(s.title) || 'Untitled story';
  s.updatedAt = nowISO(); s.updatedBy = (me && me.id) || null;
  return {story: s, newLinks};
}

/* ================= export helpers ================= */
function csvCell(v){
  if (v == null) return '';
  let s = Array.isArray(v) ? v.join('; ') : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCSV(cols, rows){ return '﻿' + [cols.map(c => csvCell(c[0])).join(',')].concat(rows.map(r => cols.map(c => csvCell(c[1](r))).join(','))).join('\r\n'); }
const lbls = (list, ids) => (ids || []).map(id => labelOf(list, id)).join('; ');
function storiesCSV(stories){
  return toCSV([
    ['Story ID', s => s.id], ['Story type', s => storyTypeLabel(s)], ['Source', s => isCommunity(s) ? 'Community submission' : 'Internal interview'], ['Source type', s => sourceLabel(s)],
    ['Contributor relationship', s => isCommunity(s) ? labelOf(RELATIONSHIPS, (s.contributor || {}).relationship) : 'ABG staff'], ['Review status', s => isCommunity(s) ? (!isWithdrawn(s) ? 'Approved for internal reporting' : 'Withdrawn') : labelOf(STATUSES, s.status)], ['Student record ID', s => s.studentId], ['Staff record ID', s => s.staffId], ['First name', s => s.alias], ['Public alias', s => s.publicName], ['Title', s => s.title], ['Status', s => labelOf(STATUSES, s.status)], ['Type', s => s.period === 'past' ? 'Historical' : 'Recent'],
    ['Staff role', s => isStaffStory(s) ? ((staffVal(s, 'role') || {}).value || (s.staffInfo || {}).role || '') : ''], ['Current or former staff', s => isStaffStory(s) ? labelOf(STAFF_STATUS, (s.staffInfo || {}).status) : ''], ['Former ABG student', s => isStaffStory(s) ? (labelOf(FORMER_STUDENT, (s.staffInfo || {}).formerStudent) || 'Unknown') : ''],
    ['When it happened', s => fmtEventDate(s.eventDate)], ['Sort date', s => s.eventDate && s.eventDate.iso], ['Approximate date', s => s.eventDate && s.eventDate.approximate ? 'Yes' : 'No'],
    ['Gender', s => (s.overview || {}).gender ? labelOf(GENDERS, s.overview.gender) : ''], ['Age or grade', s => (s.overview || {}).ageOrGrade], ['Other details', s => (s.overview || {}).demographics], ['Program', s => s.program], ['Metrics known', s => isStudentStory(s) ? metricsKnown(s) + ' of ' + METRIC_FIELDS.length : isStaffStory(s) ? staffKnown(s) + ' of ' + STAFF_FIELDS.length + ' (staff card)' : ''], ['School or community', s => s.community], ['Summary', s => s.summary], ['Impact story', s => s.story],
    ['Key takeaways', s => (s.takeaways || []).join(' | ')], ['Impact categories', s => lbls(CATEGORIES, s.categories)], ['Themes', s => lbls(THEMES, s.themes)], ['Useful for', s => lbls(AUDIENCES, s.audiences)], ['Why it matters to them', s => s.stakeholderWhy],
    ['Journal entries', s => s.entryCount || 1], ['Evidence items', s => (s.evidence || []).length], ['Verified evidence', s => evidenceCounts(s).verified || 0], ['Missing metrics', s => (s.missingMetrics || []).map(m => m.metric).join(' | ')],
    ['Open follow-ups', s => openQuestions(s).length + openTasks(s).length],
    ['Involves a minor', s => (s.privacy || {}).minor], ['Contains identifying info', s => (s.privacy || {}).identifying], ['Permission documented', s => (s.privacy || {}).permission],
    ['Can be used externally', s => (s.privacy || {}).external], ['Details need removal', s => (s.privacy || {}).redact],
    ['Recorded', s => s.createdAt], ['Last updated', s => s.updatedAt],
  ], stories);
}
/* the outcome category an outcome record counts toward */
function outcomeCategoryOf(e){ const d = domainOf(e); return ACTIVE_OUTCOMES.find(o => o.domains.includes(d)) || null; }
function outcomeCategoryLabel(e){ const o = outcomeCategoryOf(e); return o ? o.label : labelOf(DOMAINS, domainOf(e)); }
/* the staff part of a structured impact record: every field present, null when not documented */
function staffRecord(s, n){
  const si = cleanStaffInfo(s.staffInfo);
  return {firstName: n(s.alias), staffRecordId: n(s.staffId), currentOrFormer: si.status ? labelOf(STAFF_STATUS, si.status) : null, roleAtIntake: n(si.role), startYearAtIntake: n(si.startYear),
    employmentType: si.employmentType && si.employmentType !== 'unknown' ? labelOf(EMPLOYMENT_TYPES, si.employmentType) : null,
    formerAbgStudent: si.formerStudent === 'yes' ? true : si.formerStudent === 'no' ? false : null, firstParticipatedYear: n(si.firstParticipatedYear), programsAsStudent: n(si.programs), transitionYear: n(si.transitionYear),
    linkedStudentStoryIds: (s.links || []).filter(l => l.type === 'same_person').map(l => l.storyId),
    staffCard: Object.fromEntries(STAFF_FIELDS.map(f => { const v = staffVal(s, f.id); return [f.id, v ? {label: f.label, value: f.type === 'number' ? toNum(v.value) : v.value, certainty: labelOf(METRIC_STATUS, v.status), supportingStatement: n(v.excerpt), source: v.source === 'intake' ? 'Intake form' : 'Interview'} : null]; })),
    studentToStaffJourney: (s.journey || []).length ? (s.journey || []).map(j => ({stage: labelOf(JOURNEY_STAGES, j.stage), description: n(j.text), supportingStatement: n(j.excerpt)})) : null,
    journeySummary: n(s.journeySummary)};
}
/* one row per documented staff member (several stories about one person are combined, never double-counted) */
function staffCSV(stories){
  const ps = staffProfiles(stories);
  const cols = [['Staff code', p => p.code], ['First name', p => p.name], ['Stories', p => p.stories.length], ['Former ABG student', p => labelOf(FORMER_STUDENT, p.info.formerStudent) || 'Unknown'], ['First participated', p => p.info.firstParticipatedYear], ['Programs as a student', p => p.info.programs], ['Began working for ABG', p => p.info.transitionYear]]
    .concat([].concat.apply([], STAFF_FIELDS.map(f => [[f.label, p => p.card[f.id] ? p.card[f.id].value : 'Not documented'], [f.short + ': how sure', p => p.card[f.id] ? labelOf(METRIC_STATUS, p.card[f.id].status) : '']])))
    .concat([['Linked to a Student Impact story', p => p.linked.length ? 'Yes' : 'No'], ['Approved for external use', p => p.stories.some(x => x.status === 'approved') ? 'Yes' : 'No'], ['Summary', p => p.latest.summary]]);
  return toCSV(cols, ps);
}
/* Structured Impact Records: one per story, every field present, null when not known */
function impactRecords(stories){
  const n = v => { const t = v == null ? '' : String(v).trim(); return t ? t : null; };
  return stories.map(s => ({
    storyId: s.id, demo: !!s.demo, storyType: storyTypeLabel(s), student: isStaffStory(s) ? null : n(s.alias), studentRecordId: n(s.studentId), title: n(s.title), status: labelOf(STATUSES, s.status),
    approvedForExternalUse: s.status === 'approved',
    participantId: isStaffStory(s) ? (s.staffId ? 'staff:' + s.staffId : 'story:' + s.id) : isStudentStory(s) ? (s.studentId ? 'student:' + s.studentId : 'story:' + s.id) : null,
    source: isCommunity(s) ? 'Community submission' : 'Internal interview', sourceType: sourceLabel(s),
    contributor: isCommunity(s) ? {submissionId: n(s.submissionId), relationship: labelOf(RELATIONSHIPS, (s.contributor || {}).relationship) || null, perspective: (s.contributor || {}).perspective === 'self' ? 'Firsthand (own experience)' : 'Observed (witnessed)', firstName: n((s.contributor || {}).firstName)} : {submissionId: null, relationship: 'ABG staff', perspective: 'Staff interview', firstName: null},
    reviewStatus: isCommunity(s) ? (!isWithdrawn(s) ? 'Approved for internal reporting' : 'Withdrawn by contributor') : labelOf(STATUSES, s.status),
    lastReviewedBy: n((s.review || {}).by), lastReviewedDate: n((s.review || {}).at),
    publicationConsent: isCommunity(s) ? (PUBLICATION[(s.publication || {}).choice] || null) : null,
    linkedAccounts: (s.links || []).filter(l => l.type === 'same_person').map(l => ({storyId: l.storyId, comparison: l.comparison ? labelOf(COMPARISON, l.comparison) : null})),
    staff: isStaffStory(s) ? staffRecord(s, n) : null,
    program: n(s.program), schoolOrCommunity: n(s.community), when: n(fmtEventDate(s.eventDate)), recorded: n(s.createdAt), lastUpdated: n(s.updatedAt),
    outcomes: (s.evidence || []).map(e => ({
      outcomeCategory: e.status === 'future' ? null : outcomeCategoryLabel(e), impactArea: labelOf(DOMAINS, domainOf(e)), outcomeDescription: n(e.statement), change: e.direction ? labelOf(DIRECTIONS, e.direction) : null,
      initialCondition: n(e.before), currentCondition: n(e.after), supportingObservation: n(e.observation) || n(e.source && e.source.excerpt),
      evidenceSource: n([e.observer ? labelOf(OBSERVERS, e.observer) : '', e.basis].filter(Boolean).join(': ')), evidenceType: classLabel(e), verificationStatus: labelOf(EVIDENCE_STATUS, e.status),
      value: e.value == null || e.value === '' ? null : toNum(e.value), unit: n(e.unit), timeframe: n(e.timeframe), abgProgramOrActivity: n(e.activity) || n(s.program),
      abgPossibleContribution: n(e.contribution), outstandingQuestions: n(e.openQuestion),
    })),
    missingData: (s.missingMetrics || []).map(m => m.metric),
    openFollowUps: (s.followUps || []).filter(f => f.status === 'open').map(f => f.question),
  }));
}
function evidenceCSV(stories){
  const rows = [];
  stories.forEach(s => { (s.evidence || []).forEach(e => rows.push({s, e})); (s.missingMetrics || []).forEach(m => rows.push({s, e: {id: m.id, category: '', kind: '', statement: m.metric, value: null, unit: '', status: 'missing', basis: m.howToGet ? 'Where to find it: ' + m.howToGet : '', source: {note: m.why}}})); });
  return toCSV([
    ['Story ID', r => r.s.id], ['Story title', r => r.s.title], ['Story status', r => labelOf(STATUSES, r.s.status)], ['Evidence ID', r => r.e.id], ['Category', r => r.e.category ? labelOf(CATEGORIES, r.e.category) : ''],
    ['Type', r => r.e.status === 'missing' ? 'Data gap' : r.e.status === 'future' ? 'Expected, not documented' : (r.e.kind === 'numeric' ? 'Measurable outcome' : 'Qualitative evidence')], ['Statement', r => r.e.statement], ['Value', r => r.e.value], ['Unit', r => r.e.unit],
    ['Metric', r => r.e.metric], ['Impact area', r => r.e.status === 'missing' ? '' : labelOf(DOMAINS, domainOf(r.e))], ['Change', r => r.e.direction ? labelOf(DIRECTIONS, r.e.direction) : ''], ['Evidence level', r => r.e.level || ''],
    ['Outcome category', r => r.e.status === 'missing' ? '' : outcomeCategoryLabel(r.e)], ['Initial condition', r => r.e.before], ['Current condition', r => r.e.after], ['Timeframe', r => r.e.timeframe], ['Supporting observation', r => r.e.observation], ['ABG program or activity', r => r.e.activity], ["ABG's possible contribution", r => r.e.contribution], ['Still unknown', r => r.e.openQuestion],
    ['Observed by', r => r.e.observer ? labelOf(OBSERVERS, r.e.observer) : ''], ['Evidence type', r => r.e.status === 'missing' ? 'Missing data' : classLabel(r.e)],
    ['Verification status', r => r.e.status === 'missing' ? 'Not available' : labelOf(EVIDENCE_STATUS, r.e.status)], ['Source', r => r.e.basis], ['Source entry ID', r => r.e.source && r.e.source.entryId], ['Source passage', r => r.e.source && r.e.source.excerpt],
    ['Passage found in transcript', r => r.e.source && r.e.source.excerpt ? (r.e.source.found ? 'Yes' : 'No') : ''], ['Note', r => r.e.source && r.e.source.note],
  ], rows);
}
function timelineCSV(stories){
  const rows = []; stories.forEach(s => sortMilestones(s.milestones || []).forEach(m => rows.push({s, m})));
  return toCSV([
    ['Story ID', r => r.s.id], ['Student first name', r => r.s.alias], ['Story title', r => r.s.title], ['Milestone ID', r => r.m.id], ['When', r => fmtEventDate(r.m.date)], ['Sort date', r => r.m.date && r.m.date.iso],
    ['Stage', r => labelOf(PHASES, r.m.phase)], ['What happened', r => r.m.label], ['Status', r => r.m.phase === 'future' ? 'Pending' : (r.m.confirmed ? 'Confirmed' : 'Unconfirmed')], ['Source entry ID', r => r.m.entryId],
  ], rows);
}
function followupsCSV(stories){
  const rows = []; stories.forEach(s => (s.followUps || []).forEach(f => rows.push({s, f})));
  return toCSV([
    ['Story ID', r => r.s.id], ['Story title', r => r.s.title], ['Follow-up ID', r => r.f.id], ['Type', r => r.f.kind === 'task' ? 'Recommended follow-up' : 'Question'],
    ['Follow-up', r => r.f.question], ['Follow-up date', r => r.f.due], ['Status', r => r.f.status], ['Answer', r => r.f.answer], ['Answer entry ID', r => r.f.entryId],
  ], rows);
}
function quotesCSV(stories){
  const rows = []; stories.filter(s => s.status === 'approved').forEach(s => (s.quotes || []).filter(q => q.approved).forEach(q => rows.push({s, q})));
  return toCSV([
    ['Story ID', r => r.s.id], ['Story title', r => r.s.title], ['Quote', r => r.q.text], ['Speaker', r => r.q.speaker === r.s.alias ? (externalName(r.s) || 'A student') : r.q.speaker],
    ['Kind', r => labelOf(QUOTE_KINDS, r.q.kind)], ['Source entry ID', r => r.q.entryId],
  ], rows);
}
function metricsCSV(metrics, stories){
  return toCSV([
    ['Metric', m => m.label], ['Value', m => m.value], ['Unit', m => m.unit], ['Period', m => m.period], ['Source', m => m.source], ['Notes', m => m.notes],
    ['Related story', m => { const s = stories.find(x => x.id === m.storyId); return s ? s.title : ''; }], ['Entered', m => m.createdAt],
  ], metrics);
}
/* ---------- student metrics roll-up ---------- */
const MS_RANK = {verified: 3, reported: 2, estimate: 1};
/* one profile per student (stories grouped by student record), with the best-supported value for each card field */
function studentProfiles(stories){
  const groups = new Map();
  stories.filter(isStudentStory).forEach(s => { const k = s.studentId || ('story:' + s.id); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
  const out = [];
  groups.forEach((list, key) => {
    const ss = list.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const latest = ss.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    const metrics = {};
    METRIC_FIELDS.forEach(f => {
      let best = null;
      ss.forEach(s => { const m = metricVal(s, f.id); if (!m) return; const r = MS_RANK[m.status] || 0; if (!best || r > best.r || (r === best.r && (s.updatedAt || '') > (best.at || ''))) best = {value: m.value, status: m.status, storyId: s.id, r, at: s.updatedAt || ''}; });
      if (best) metrics[f.id] = {value: best.value, status: best.status, storyId: best.storyId};
    });
    out.push({key, studentId: list[0].studentId || null, name: asStr(latest.alias), stories: ss, latest, metrics, first: ss[0].createdAt || ''});
  });
  return out.sort((a, b) => a.first.localeCompare(b.first) || a.key.localeCompare(b.key));
}
/* ---------- staff counting rules ----------
   Staff members are deduplicated by staff record (a story without one counts once on its own). Several stories
   about one person are combined: each staff-card field keeps the most certain value on file. A blank field is
   "not documented" and is never counted as "no" or zero. An outcome counts when the staff card states it (any
   certainty) or an outcome record in that area shows achievement or a positive change and isn't unconfirmed.
   People and positions are counted separately: one person can hold several positions. */
function staffKey(s){ return s.staffId || ('story:' + s.id); }
function staffProfiles(stories){
  const groups = new Map();
  stories.filter(isStaffStory).forEach(s => { const k = staffKey(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
  const out = [];
  groups.forEach((list, key) => {
    const ss = list.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const byNew = ss.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const latest = byNew[0];
    const card = {};
    STAFF_FIELDS.forEach(f => {
      let best = null;
      ss.forEach(s => { const m = staffVal(s, f.id); if (!m) return; const r = MS_RANK[m.status] || 0; if (!best || r > best.r || (r === best.r && (s.updatedAt || '') > (best.at || ''))) best = {value: m.value, status: m.status, excerpt: m.excerpt, storyId: s.id, r, at: s.updatedAt || ''}; });
      if (best) card[f.id] = {value: best.value, status: best.status, excerpt: best.excerpt, storyId: best.storyId};
    });
    const infos = byNew.map(s => cleanStaffInfo(s.staffInfo));
    const pick = k => (infos.find(i => i[k]) || {})[k] || '';
    const fsv = infos.some(i => i.formerStudent === 'yes') ? 'yes' : infos.some(i => i.formerStudent === 'no') ? 'no' : 'unknown';
    const info = {status: pick('status'), role: pick('role'), startYear: pick('startYear'), employmentType: pick('employmentType'), formerStudent: fsv,
      firstParticipatedYear: fsv === 'yes' ? pick('firstParticipatedYear') : '', programs: fsv === 'yes' ? pick('programs') : '', transitionYear: fsv === 'yes' ? pick('transitionYear') : ''};
    const linked = uniq([].concat.apply([], ss.map(s => (s.links || []).filter(l => l.type === 'same_person').map(l => l.storyId))));
    out.push({key, staffId: list[0].staffId || null, name: asStr(latest.alias), stories: ss, latest, card, info, linked, first: ss[0].createdAt || ''});
  });
  out.sort((a, b) => a.first.localeCompare(b.first) || a.key.localeCompare(b.key));
  out.forEach((p, i) => { p.code = 'Staff ' + String(i + 1).padStart(2, '0'); });
  return out;
}
const cardIs = (p, id, test) => { const c = p.card[id]; return c && test(c.value) ? [{field: id, c}] : []; };
const STAFF_SIGNALS = [
  {id: 'paid', label: 'Paid opportunity documented', desc: 'Paid employment, a paid stipend or a paid internship, as stated in the interview or on the staff card.', card: p => cardIs(p, 'opportunityType', v => /^Paid/.test(v)), domains: ['employment', 'first_job'], needPaid: true},
  {id: 'firstJob', label: 'ABG was their first paid job', card: p => cardIs(p, 'firstJob', v => v === 'Yes'), domains: ['first_job'], needPaid: true},
  {id: 'current', label: 'Currently working with ABG', desc: 'Staff card says current staff (retention).', card: p => cardIs(p, 'staffStatus', v => v === 'Current staff'), domains: []},
  {id: 'advanced', label: 'Promoted or given expanded responsibilities', card: p => cardIs(p, 'roleGrowth', v => v === 'Promoted' || v === 'Responsibilities expanded'), domains: ['role_growth']},
  {id: 'otherJob', label: 'Went on to other or additional employment', card: p => cardIs(p, 'otherEmployment', v => !!v), domains: ['next_employment']},
  {id: 'skills', label: 'Professional or artistic skill development', card: p => cardIs(p, 'skills', v => !!v), domains: ['pro_skills']},
  {id: 'training', label: 'Training or mentorship received', card: p => cardIs(p, 'trainingReceived', v => v === 'Yes').concat(cardIs(p, 'mentored', v => v === 'Yes')), domains: ['training']},
  {id: 'leadership', label: 'Leadership responsibilities', card: p => cardIs(p, 'leadership', v => v === 'Yes'), domains: ['staff_leadership']},
  {id: 'furtherEd', label: 'Further education or certifications', card: p => cardIs(p, 'furtherEducation', v => !!v), domains: ['further_ed']},
  {id: 'inField', label: 'Working in the arts, education or nonprofit field', card: p => cardIs(p, 'inField', v => v === 'Yes'), domains: []},
  {id: 'mentoring', label: 'Mentors or teaches ABG students', card: p => cardIs(p, 'mentorsStudents', v => /^Yes/.test(v)), domains: ['mentoring_students']},
  {id: 'community', label: 'Contributes to arts education and the community', card: () => [], domains: ['community_contribution', 'mentoring_students']},
  {id: 'personal', label: 'Personal growth, stability or sense of purpose', card: () => [], domains: ['stability']},
];
function staffSignal(p, sig){
  const items = [];
  sig.card(p).forEach(x => { const f = byId(STAFF_FIELDS, x.field); items.push({s: p.stories.find(s => s.id === x.c.storyId) || p.latest, line: {text: f.short + ': ' + fmtMetric(f, x.c.value), tag: 'Staff card · ' + labelOf(METRIC_STATUS, x.c.status)}, cls: x.c.status === 'verified' ? 'verified' : 'observed'}); });
  p.stories.forEach(s => (s.evidence || []).forEach(e => {
    if (e.status === 'future' || !sig.domains.includes(domainOf(e)) || !POSITIVE(e.direction) || evidenceClass(e) === 'unconfirmed') return;
    if (sig.needPaid && e.paid !== 'yes') return;
    items.push({s, line: insLine(e), cls: evidenceClass(e)});
  }));
  return {hit: items.length > 0, items, verified: items.some(x => x.cls === 'verified')};
}
function staffImpactStats(stories){
  const profiles = staffProfiles(stories);
  const N = profiles.length;
  const sig = {};
  STAFF_SIGNALS.forEach(g => { sig[g.id] = profiles.map(p => ({p, r: staffSignal(p, g)})).filter(x => x.r.hit); });
  const has = (id, p) => sig[id].some(x => x.p === p);
  const durations = profiles.map(p => ({p, n: p.card.yearsWithAbg ? toNum(p.card.yearsWithAbg.value) : null})).filter(x => x.n != null);
  const positions = profiles.map(p => ({p, n: p.card.positionsHeld ? toNum(p.card.positionsHeld.value) : null})).filter(x => x.n != null);
  const avg = list => list.length ? round1(list.reduce((t, x) => t + x.n, 0) / list.length) : null;
  const former = profiles.filter(p => p.info.formerStudent === 'yes');
  const unknownBg = profiles.filter(p => p.info.formerStudent === 'unknown');
  const thisYear = new Date().getFullYear();
  const span = p => { const y = toNum(p.info.firstParticipatedYear); return y && p.card.staffStatus && p.card.staffStatus.value === 'Current staff' ? thisYear - y : null; };
  const longTerm = former.filter(p => (span(p) || 0) >= 5);
  const formerPaid = former.filter(p => has('paid', p));
  const formerMentor = former.filter(p => has('mentoring', p));
  const formerPro = former.filter(p => ['advanced', 'otherJob', 'inField', 'leadership', 'furtherEd'].some(id => has(id, p)));
  const formerMentorOrPro = former.filter(p => formerMentor.includes(p) || formerPro.includes(p));
  const count = id => sig[id].length;
  const summary = {staffDocumented: N, note: 'Unique staff members documented in this journal; not all ABG employees and not every job ABG has created. Unknown values are not counted.',
    paidOpportunitiesDocumented: count('paid'), positionsDocumented: positions.length ? {total: positions.reduce((t, x) => t + x.n, 0), staffWithAKnownCount: positions.length} : null,
    employmentDurationYears: durations.length ? {staffWithAKnownDuration: durations.length, average: avg(durations), shortest: Math.min.apply(null, durations.map(x => x.n)), longest: Math.max.apply(null, durations.map(x => x.n))} : null,
    firstPaidJobAtAbg: count('firstJob'), currentlyWithAbg: count('current'), promotedOrExpandedResponsibilities: count('advanced'), laterOrAdditionalEmployment: count('otherJob'),
    skillDevelopment: count('skills'), trainingOrMentorship: count('training'), leadership: count('leadership'), furtherEducation: count('furtherEd'), inArtsEducationOrNonprofitField: count('inField'), mentorsOrTeachesStudents: count('mentoring'),
    formerAbgStudentsWhoBecameStaff: former.length, formerStudentsWithPaidOpportunity: formerPaid.length, formerStudentsMentoringOrTeaching: formerMentor.length, formerStudentsWithLaterProfessionalOutcomes: formerPro.length, staffWithUnknownStudentBackground: unknownBg.length};
  return {profiles, N, sig, durations, positions, avgYears: avg(durations), former, unknownBg, longTerm, span, formerPaid, formerMentor, formerPro, formerMentorOrPro, summary};
}
function statusCounts(vals){ const c = {verified: 0, reported: 0, estimate: 0}; vals.forEach(v => { c[v.status] = (c[v.status] || 0) + 1; }); return c; }
function round1(n){ return Math.round(n * 10) / 10; }
/* one sourced line per card field: what the documented students show, and how many it rests on */
function outcomeLines(profiles){
  const N = profiles.length;
  return METRIC_FIELDS.map(f => {
    const vals = profiles.filter(p => p.metrics[f.id]).map(p => Object.assign({p}, p.metrics[f.id]));
    const line = {f, N, vals, n: vals.length, counts: statusCounts(vals), text: '', parts: []};
    if (!vals.length) return line;
    if (f.type === 'number') {
      const nums = vals.map(v => toNum(v.value)).filter(x => x != null);
      if (!nums.length) { line.text = 'Recorded for ' + vals.length + ', but not as numbers.'; return line; }
      const avg = round1(nums.reduce((a, b) => a + b, 0) / nums.length), lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
      line.text = 'Average ' + fmtMetric(f, String(avg)) + ' per student' + (lo !== hi ? ' (range ' + fmtNum(lo) + ' to ' + fmtNum(hi) + ')' : '') + '.';
      line.parts = [['Average', fmtNum(avg)], ['Lowest', fmtNum(lo)], ['Highest', fmtNum(hi)]];
    } else if (f.type === 'choice') {
      const cnt = f.options.map(o => [o, vals.filter(v => v.value === o).length]);
      line.parts = cnt;
      line.text = cnt.filter(c => c[1] > 0).map(c => c[0] + ': ' + c[1]).join(' · ') + ' (of ' + vals.length + ' with a known answer)';
    } else {
      const m = new Map(); vals.forEach(v => { const k = norm(v.value); if (!m.has(k)) m.set(k, [v.value, 0]); m.get(k)[1]++; });
      const top = Array.from(m.values()).sort((a, b) => b[1] - a[1]);
      line.text = top.slice(0, 3).map(t => trunc(t[0], 40) + (t[1] > 1 ? ' (' + t[1] + ')' : '')).join(' · ') + (top.length > 3 ? ' · and ' + (top.length - 3) + ' more' : '');
    }
    return line;
  });
}
function basisText(line){
  const c = line.counts;
  const st = [c.verified ? c.verified + ' verified' : '', c.reported ? c.reported + ' reported' : '', c.estimate ? c.estimate + ' estimated' : ''].filter(Boolean).join(', ');
  return 'Based on ' + line.n + ' of ' + line.N + ' documented student' + (line.N === 1 ? '' : 's') + (st ? ' · ' + st : '');
}
/* ---------- milestones per student ---------- */
function studentMilestones(p){
  const ev = [].concat.apply([], p.stories.map(s => (s.evidence || []).filter(e => e.status !== 'future')));
  const m = p.metrics;
  const yes = k => m[k] && m[k].value === 'Yes';
  const txt = k => (m[k] && m[k].value) || '';
  const has = (dom, okDir) => ev.filter(e => domainOf(e) === dom && (!okDir || okDir.includes(e.direction || 'unclear')));
  const pos = ['achieved', 'improved', 'unclear', 'mixed'];
  const out = {};
  const put = (id, list, card) => { if (list.length || card) out[id] = {observed: list.some(e => e.observer === 'abg_staff' || !e.observer), reported: list.some(e => e.observer && e.observer !== 'abg_staff'), card: !!card && !list.length}; };
  put('graduated', has('graduation', pos), yes('graduated'));
  put('higher_ed', has('higher_ed', pos), /college|university|degree|vocational|trade|community college/i.test(txt('nextStep') + ' ' + txt('currentStatus')));
  put('first_gen', ev.filter(e => /first (person )?in (his|her|their) family/i.test(e.statement + ' ' + (e.metric || '') + ' ' + (e.after || ''))), yes('firstGenCollege'));
  put('career', has('career', pos), /job|work|employ|intern|career|designer|artist at/i.test(txt('currentStatus')));
  put('school_engagement', ev.filter(e => ['attendance', 'academics', 'engagement'].includes(domainOf(e)) && e.direction === 'improved'), ['grades', 'schoolAttendance'].some(k => txt(k) === 'Improved'));
  put('risk_reduced', has('risk', ['improved']), false);
  put('continued_abg', ev.filter(e => domainOf(e) === 'participation' && /continu|still|stayed|kept coming|returned for|multiple programs|several programs/i.test(e.statement + ' ' + (e.after || ''))), yes('stillParticipating'));
  put('leadership_abg', has('leadership_abg', pos), false);
  put('returned', has('returned', pos), yes('returnedToAbg'));
  put('arts', has('arts_continued', pos), yes('continuedArt'));
  return out;
}
function milestoneStats(stories){
  const profiles = studentProfiles(stories);
  const per = profiles.map(p => ({p, ms: studentMilestones(p)}));
  return {N: profiles.length, rows: MILESTONES.map(mi => { const hits = per.filter(x => x.ms[mi.id]); return {mi, n: hits.length, observed: hits.filter(x => x.ms[mi.id].observed).length, reported: hits.filter(x => x.ms[mi.id].reported).length, card: hits.filter(x => x.ms[mi.id].card).length, stories: uniq([].concat.apply([], hits.map(x => x.p.stories.map(s => s.id)))).length}; })};
}
/* ---------- impact by category (one entry per student, never per story) ---------- */
const CARD_FOR_DOMAIN = {attendance: 'schoolAttendance', academics: 'grades'};
function categoryStats(stories){
  const profiles = studentProfiles(stories);
  return DOMAINS.filter(d => ['attendance', 'academics', 'engagement', 'confidence', 'social', 'risk', 'participation'].includes(d.id)).map(d => {
    const per = profiles.map(p => {
      const ev = [].concat.apply([], p.stories.map(s => (s.evidence || []).map(e => ({e, s})))).filter(x => x.e.status !== 'future' && domainOf(x.e) === d.id);
      const card = CARD_FOR_DOMAIN[d.id] ? p.metrics[CARD_FOR_DOMAIN[d.id]] : null;
      const partFields = ['yearsWithAbg', 'sessionsAttended', 'stillParticipating', 'returnedToAbg'];
      if (!ev.length && !card && !(d.id === 'participation' && partFields.some(k => p.metrics[k]))) return null;
      const improvedEv = ev.filter(x => x.e.direction === 'improved');
      const improved = improvedEv.length > 0 || (card && card.value === 'Improved');
      const improvedVerified = improvedEv.some(x => x.e.status === 'verified') || (card && card.value === 'Improved' && card.status === 'verified');
      const measurable = improvedEv.some(x => hasComparison(x.e) && ((parseMeasure(x.e.before, x.e) && parseMeasure(x.e.after, x.e)) || (letterGrade(x.e.before) && letterGrade(x.e.after))));
      const comps = {};
      ev.filter(x => hasComparison(x.e)).forEach(x => {
        const b = parseMeasure(x.e.before, x.e), a = parseMeasure(x.e.after, x.e);
        if (!b || !a || b.unit !== a.unit) return;
        const rank = x.e.status === 'verified' ? 0 : x.e.status === 'estimate' ? 2 : 1;
        if (!comps[b.unit] || rank < comps[b.unit].rank) comps[b.unit] = {b: b.n, a: a.n, rank, verified: x.e.status === 'verified'};
      });
      const m = p.metrics;
      return {p, improved, improvedVerified, measurable, comps, verifiedStories: ev.filter(x => x.e.status === 'verified').map(x => x.s.id),
        retained: ['stillParticipating', 'returnedToAbg'].some(k => m[k] && m[k].value === 'Yes'),
        years: m.yearsWithAbg ? toNum(m.yearsWithAbg.value) : null, sessions: m.sessionsAttended ? toNum(m.sessionsAttended.value) : null};
    }).filter(Boolean);
    const units = {};
    per.forEach(x => Object.keys(x.comps).forEach(u => { (units[u] = units[u] || []).push(x.comps[u]); }));
    const averages = Object.keys(units).map(u => { const L = units[u]; const b = L.reduce((t, c) => t + c.b, 0) / L.length, a = L.reduce((t, c) => t + c.a, 0) / L.length; return {unit: u, n: L.length, before: round1(b), after: round1(a), change: round1(a - b), verified: L.filter(c => c.verified).length}; });
    return {d, n: per.length, improved: per.filter(x => x.improved).length, improvedVerified: per.filter(x => x.improvedVerified).length, measurable: per.filter(x => x.measurable).length,
      averages, verifiedStories: uniq([].concat.apply([], per.map(x => x.verifiedStories))).length,
      retained: per.filter(x => x.retained).length, years: per.map(x => x.years).filter(v => v != null), sessions: per.map(x => x.sessions).filter(v => v != null)};
  });
}
function pct(a, b){ return b ? Math.round(100 * a / b) + '%' : ''; }
function unitLabel(u){ return u === '%' ? 'percent' : u; }
function avgLine(av){ return (av.unit === '%' ? av.before + '% → ' + av.after + '%' : av.before + ' → ' + av.after + ' ' + unitLabel(av.unit)) + ' (' + (av.change >= 0 ? '+' : '') + av.change + (av.unit === '%' ? ' points' : '') + ')'; }
/* names removed: every known student first name becomes that student's code, or "another student" */
function teamCSV(stories, students){
  const profiles = studentProfiles(stories);
  const codeOf = new Map(); profiles.forEach((p, i) => codeOf.set(p.key, 'Student ' + String(i + 1).padStart(2, '0')));
  const nameMap = new Map();
  profiles.forEach(p => uniq(p.stories.map(s => asStr(s.alias))).forEach(n => { if (n) nameMap.set(norm(n), {name: n, code: codeOf.get(p.key)}); }));
  (students || []).forEach(st => { const n = asStr(st.firstName); if (n && !nameMap.has(norm(n))) nameMap.set(norm(n), {name: n, code: 'another student'}); });
  const names = Array.from(nameMap.values()).sort((a, b) => b.name.length - a.name.length);
  const scrub = (t, own) => { let x = String(t || ''); if (own) own.forEach(n => { x = scrubName(x, n, own.code); }); names.forEach(n => { x = scrubName(x, n.name, n.code); }); return x; };
  const rows = profiles.map(p => {
    const own = uniq(p.stories.map(s => asStr(s.alias))); own.code = codeOf.get(p.key);
    const sc = t => scrub(t, own);
    const all = k => uniq([].concat.apply([], p.stories.map(s => s[k] || [])));
    const ev = [].concat.apply([], p.stories.map(s => s.evidence || []));
    const best = ['approved', 'internal', 'needs_verification', 'draft'].find(st => p.stories.some(s => s.status === st)) || 'draft';
    const minor = p.stories.some(s => (s.privacy || {}).minor === 'yes') ? 'yes' : p.stories.some(s => (s.privacy || {}).minor === 'no') ? 'no' : 'unknown';
    return {p, code: own.code, sc, all, ev, best, minor};
  });
  const cols = [
    ['Student code', r => r.code], ['Stories', r => r.p.stories.length], ['Story titles', r => r.p.stories.map(s => r.sc(s.title)).join(' | ')],
    ['Type', r => uniq(r.p.stories.map(s => s.period === 'past' ? 'Historical' : 'Recent')).join(' and ')],
    ['When', r => uniq(r.p.stories.map(s => fmtEventDate(s.eventDate))).join('; ')],
    ['Gender', r => uniq(r.p.stories.map(s => (s.overview || {}).gender ? labelOf(GENDERS, s.overview.gender) : '')).join('; ')], ['Other details', r => r.sc(uniq(r.p.stories.map(s => (s.overview || {}).demographics)).join('; '))],
    ['ABG program', r => uniq(r.p.stories.map(s => s.program)).join('; ')], ['School or community', r => uniq(r.p.stories.map(s => s.community)).join('; ')],
    ['Metrics known', r => Object.keys(r.p.metrics).length + ' of ' + METRIC_FIELDS.length],
  ];
  METRIC_FIELDS.forEach(f => {
    cols.push([f.short || f.label, r => r.p.metrics[f.id] ? r.sc(r.p.metrics[f.id].value) : 'Unknown']);
    cols.push([(f.short || f.label) + ' (status)', r => r.p.metrics[f.id] ? labelOf(METRIC_STATUS, r.p.metrics[f.id].status) : '']);
  });
  MILESTONES.forEach(mi => cols.push([mi.label, r => { const x = studentMilestones(r.p)[mi.id]; return x ? 'Yes (' + [x.observed ? 'Kyle observed' : '', x.reported ? 'reported to Kyle' : '', x.card ? 'metrics card' : ''].filter(Boolean).join(', ') + ')' : ''; }]));
  DOMAINS.filter(d => d.change || d.milestone).forEach(d => {
    /* sensitive outcomes: direction and source only, never the details */
    cols.push([d.label + ' outcome', r => r.sc(r.ev.filter(e => e.status !== 'future' && domainOf(e) === d.id).map(e => d.sensitive ? (labelOf(DIRECTIONS, e.direction || 'unclear') + ' [' + classLabel(e) + ']') : ((e.metric || e.statement) + (hasComparison(e) ? ': ' + e.before + ' to ' + e.after : (e.after ? ': ' + e.after : '')) + (e.direction && e.direction !== 'unclear' ? ' (' + labelOf(DIRECTIONS, e.direction).toLowerCase() + ')' : '') + ' [' + classLabel(e) + ']')).join(' | '))]);
  });
  cols.push(
    ['Themes', r => lbls(THEMES, r.all('themes'))], ['Impact categories', r => lbls(CATEGORIES, r.all('categories'))], ['Useful for', r => lbls(AUDIENCES, r.all('audiences'))],
    ['Evidence items', r => r.ev.length], ['Verified evidence', r => r.ev.filter(e => e.status === 'verified').length], ['Estimated or unverified evidence', r => r.ev.filter(e => e.status === 'estimate' || e.status === 'unverified').length],
    ['Missing metrics', r => r.sc(uniq([].concat.apply([], r.p.stories.map(s => (s.missingMetrics || []).map(m => m.metric)))).join(' | '))],
    ['Approval status', r => labelOf(STATUSES, r.best)], ['Involves a minor', r => r.minor],
    ['Summary', r => r.sc(r.p.latest.summary)], ['Key takeaways', r => r.sc((r.p.latest.takeaways || []).join(' | '))],
    ['Last updated', r => (r.p.latest.updatedAt || '').slice(0, 10)],
  );
  return toCSV(cols, rows);
}
/* external collection: first names only where permission is documented, otherwise the public alias or "a student" */
function approvedMarkdown(stories, audience){
  const list = stories.filter(s => s.status === 'approved' && (!audience || (s.audiences || []).includes(audience)));
  const out = ['# ABG approved stories' + (audience ? ' for ' + labelOf(AUDIENCES, audience).toLowerCase() : ''), '', 'Exported ' + fmtDay(todayLocal()) + '. Every story here is approved for external use. Students appear by first name only where publication permission is documented; otherwise by alias. Check numbers against their sources before publishing.', ''];
  if (!list.length) out.push('No approved stories match yet.');
  list.forEach(s => {
    const name = externalName(s);
    const swap = t => (s.alias && s.alias !== name) ? scrubName(t, s.alias, name || 'the student') : String(t || '');
    out.push('## ' + swap(s.title), '');
    const meta = [name ? 'Student: ' + name : '', fmtEventDate(s.eventDate), s.program, needsRedaction(s) ? '' : s.community].filter(Boolean).join(' · ');
    if (meta) out.push('*' + meta + '*', '');
    if (needsRedaction(s)) out.push('_Identifying details must be removed before use._', '');
    if (s.story || s.summary) out.push('**Student story**', '', swap(s.story || s.summary), '');
    if ((s.takeaways || []).length) { out.push('**Key impact takeaways**'); s.takeaways.forEach(t => out.push('- ' + swap(t))); out.push(''); }
    const live = externalEvidence(s).filter(e => e.status !== 'future');
    if (needsSensitiveCare(s)) out.push('_Includes sensitive experiences without documented consent. Remove those details from the story text before use._', '');
    const cmp = live.filter(hasComparison);
    if (cmp.length) {
      out.push('**Measurable outcomes**', '', '| Metric | Before ABG | After ABG | Evidence |', '|---|---|---|---|');
      cmp.forEach(e => out.push('| ' + [swap(e.metric || e.statement), swap(e.before), swap(e.after), classLabel(e)].map(x => String(x || '').replace(/\|/g, '/')).join(' | ') + ' |'));
      out.push('');
    }
    const rest = live.filter(e => !hasComparison(e));
    if (rest.length) { out.push('**Supporting evidence**'); rest.forEach(e => out.push(evLine(e, swap) + ' [' + classLabel(e) + ']')); out.push(''); }
    const q = (s.quotes || []).filter(x => x.approved);
    if (q.length) { out.push('**Approved quotes**'); q.forEach(x => out.push('> "' + swap(x.text) + '" (' + (x.speaker === s.alias ? (name || 'a student') : (x.speaker || 'unknown speaker')) + ', ' + labelOf(QUOTE_KINDS, x.kind).toLowerCase() + ')')); out.push(''); }
    if ((s.missingMetrics || []).length) { out.push('**Missing data**'); s.missingMetrics.forEach(m => out.push('- ' + swap(m.metric))); out.push(''); }
    const sv = s.stakeholderValue || {};
    const svl = [['schools', 'Schools'], ['donors', 'Donors'], ['grants', 'Grant providers']].filter(([k]) => sv[k]);
    if (svl.length || s.stakeholderWhy) { out.push('**Stakeholder value**'); svl.forEach(([k, l]) => out.push('- ' + l + ': ' + swap(sv[k]))); if (s.stakeholderWhy) out.push('', swap(s.stakeholderWhy)); out.push(''); }
    const dr = (s.drafts || []).filter(x => x.approved && (!audience || x.audience === audience));
    if (dr.length) { out.push('**Approved audience versions**'); dr.forEach(x => out.push('', '*' + labelOf(FORMATS, x.format) + ', ' + labelOf(AUDIENCES, x.audience) + '*', '', x.text)); out.push(''); }
  });
  return out.join('\n');
}
function evLine(e, swap){
  const sw = swap || (t => String(t || ''));
  const num = e.value != null && e.value !== '' ? fmtNum(e.value) + (e.unit ? ' ' + e.unit : '') + ': ' : '';
  const cmp = comparisonText(e);
  const who = [e.observer ? labelOf(OBSERVERS, e.observer) : '', e.basis ? sw(e.basis) : ''].filter(Boolean).join('; ');
  return '- ' + num + sw(e.statement) + (cmp ? ' (' + sw(cmp) + ')' : '') + (who ? ' (source: ' + who + ')' : '');
}
function storyMarkdown(s, entries){
  const ov = s.overview || {};
  const staff = isStaffStory(s);
  const out = ['# ' + s.title, '', 'INTERNAL ' + (staff ? 'STAFF' : 'STUDENT') + ' IMPACT REPORT. Contains full transcripts. Status: ' + labelOf(STATUSES, s.status) + '.', ''];
  if (isCommunity(s)) out.push('**Source:** community submission (' + contributorText(s) + '). ' + (!isWithdrawn(s) ? 'Approved for internal reporting' : 'Withdrawn by the contributor') + ((s.review || {}).by ? ' by ' + s.review.by : '') + '. Public sharing: ' + (PUBLICATION[(s.publication || {}).choice] || 'not recorded') + '.', '');
  if (staff) {
    const si = cleanStaffInfo(s.staffInfo);
    out.push('## Staff overview');
    [['Staff member', s.alias], ['Story type', 'Staff Impact' + (si.formerStudent === 'yes' ? ' (former ABG student)' : '')], ['Current or former', labelOf(STAFF_STATUS, si.status)], ['Role at ABG', si.role], ['Started working with ABG', si.startYear], ['Employment type', si.employmentType ? labelOf(EMPLOYMENT_TYPES, si.employmentType) : ''],
      ['Former ABG student', labelOf(FORMER_STUDENT, si.formerStudent) || 'Unknown'], ['First participated', si.firstParticipatedYear], ['Programs as a student', si.programs], ['Began working for ABG', si.transitionYear], ['Background', ov.background], ['ABG program', s.program]]
      .filter(r => r[1]).forEach(r => out.push('- **' + r[0] + ':** ' + r[1]));
    out.push('', '**Staff impact card** (blank fields are not documented, not "no")');
    STAFF_FIELDS.forEach(f => { const m = staffVal(s, f.id); out.push('- ' + f.label + ': ' + (m ? fmtMetric(f, m.value) + ' [' + labelOf(METRIC_STATUS, m.status) + ']' + (m.excerpt ? ' (passage: "' + m.excerpt + '")' : '') : 'Not documented')); });
    if ((s.journey || []).length || s.journeySummary) { out.push('', '**Student-to-staff journey**'); (s.journey || []).forEach(j => out.push('- ' + labelOf(JOURNEY_STAGES, j.stage) + ': ' + j.text)); if (s.journeySummary) out.push('', s.journeySummary); }
  } else {
    out.push('## Student overview');
    [['Student', s.alias], ['Gender', ov.gender ? labelOf(GENDERS, ov.gender) : ''], ['Age or grade', ov.ageOrGrade], ['School or community', s.community], ['Other details', ov.demographics], ['Background', ov.background], ['ABG program', s.program], ['When involved', ov.involvementDate || fmtEventDate(s.eventDate)]]
      .filter(r => r[1]).forEach(r => out.push('- **' + r[0] + ':** ' + r[1]));
  }
  out.push('');
  const withPassage = e => evLine(e) + (e.source && e.source.excerpt ? ' (passage: "' + e.source.excerpt + '")' : (e.source && e.source.note ? ' (record: ' + e.source.note + ')' : ''));
  const live = (s.evidence || []).filter(e => e.status !== 'future'), fut = (s.evidence || []).filter(e => e.status === 'future');
  const cmp = live.filter(hasComparison), rest = live.filter(e => !hasComparison(e));
  out.push(staff ? '## A. Impact narrative' : '## A. Student success story', '', s.story || s.summary || 'Not written yet.', '');
  if ((s.takeaways || []).length) { out.push('**Key impact takeaways**'); s.takeaways.forEach(t => out.push('- ' + t)); out.push(''); }
  out.push('## B. Measurable outcomes', '');
  const msi = storyMilestoneItems(s);
  if (msi.length) { out.push('**Key milestones**'); msi.forEach(x => out.push('- ' + x.label + (x.detail ? ': ' + x.detail : '') + ' [' + (x.e ? classLabel(x.e) : labelOf(METRIC_STATUS, x.status)) + ']')); out.push(''); }
  if (cmp.length) { out.push('| Metric | Before ABG | After ABG | Evidence |', '|---|---|---|---|'); cmp.forEach(e => out.push('| ' + [e.metric || e.statement, e.before, e.after, classLabel(e)].map(x => String(x || '').replace(/\|/g, '/')).join(' | ') + ' |')); out.push(''); }
  else out.push('No before-and-after comparisons recorded yet.', '');
  if (isStudentStory(s)) { out.push('**Student metrics card**'); METRIC_FIELDS.forEach(f => { const m = metricVal(s, f.id); out.push('- ' + f.label + ': ' + (m ? fmtMetric(f, m.value) + ' [' + labelOf(METRIC_STATUS, m.status) + ']' : 'Unknown')); }); out.push(''); }
  out.push('## C. Supporting evidence', '');
  live.forEach(e => out.push(withPassage(e) + ' [' + classLabel(e) + '; ' + labelOf(DOMAINS, domainOf(e)) + (e.level ? '; level ' + e.level : '') + ']'));
  if (live.length) out.push('');
  if ((s.quotes || []).length) { out.push('**Quotes**'); s.quotes.forEach(q => out.push('> "' + q.text + '" (' + (q.speaker || 'unknown') + ', ' + labelOf(QUOTE_KINDS, q.kind).toLowerCase() + (q.approved ? ', approved' : '') + ')')); out.push(''); }
  if ((s.materials || []).length) { out.push('**Photos, records and other materials**'); s.materials.forEach(m => out.push('- ' + labelOf(MATERIAL_TYPES, m.type) + ': ' + m.description)); out.push(''); }
  if (!live.length && !(s.quotes || []).length && !(s.materials || []).length) out.push('None recorded yet.', '');
  out.push('## D. Missing data', '');
  (s.missingMetrics || []).forEach(m => out.push('- ' + m.metric + (m.why ? ': ' + m.why : '') + (m.howToGet ? ' (where to find it: ' + m.howToGet + ')' : '')));
  fut.forEach(e => out.push('- Expected, not yet documented: ' + e.statement));
  (s.followUps || []).forEach(f => out.push('- Follow-up: ' + f.question + ' [' + f.status + ']' + (f.answer ? ': ' + f.answer : '')));
  out.push('');
  out.push('## E. Stakeholder value', '');
  const sv = s.stakeholderValue || {};
  (staff ? STAFF_STAKEHOLDERS : [['schools', 'School administrators'], ['donors', 'Donors'], ['grants', 'Grant providers']]).forEach(([k, l]) => { if (sv[k]) out.push('- **' + l + ':** ' + sv[k]); });
  out.push('', s.stakeholderWhy || '', '');
  if ((s.audiences || []).length) out.push('**Most useful for:** ' + s.audiences.map(a => labelOf(AUDIENCES, a)).join(', '), '');
  if ((s.milestones || []).length) { out.push('## Student impact timeline'); sortMilestones(s.milestones).forEach(m => out.push('- ' + labelOf(PHASES, m.phase) + ' · ' + (fmtEventDate(m.date) || 'Date unknown') + ': ' + m.label + (m.phase === 'future' ? ' (pending)' : ''))); out.push(''); }
  (entries || []).forEach((e, i) => {
    out.push('## ' + (i === 0 ? 'Original interview' : 'Story update') + ' (recorded ' + fmtDate(e.recordedAt) + ')', '');
    if (e.transcriptEdited) out.push('**Corrected transcript**', '', e.transcriptEdited, '', '**Original transcript**', '');
    out.push(e.transcript || '', '');
  });
  return out.join('\n');
}
function slug(s){ return norm(s).replace(/\s+/g, '-').slice(0, 50) || 'story'; }
async function saveFile(caps, showToast, filename, data){
  if (!caps.downloads) { showToast("Downloads aren't available here."); return false; }
  try { await caps.downloads.save({filename, data}); showToast('Saved ' + filename); return true; }
  catch (e) {
    const c = e && e.code;
    if (c === 'declined') return false;
    if (c === 'rate_limited') showToast('Another download is waiting for your OK.');
    else showToast("That file couldn't be saved here.");
    return false;
  }
}

/* ================= platform hints ================= */
const UA = navigator.userAgent || '';
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const DICTATION_TIP = IS_MOBILE
  ? "Tap the microphone on your keyboard and start talking. Your phone types as you speak."
  : /Macintosh/.test(UA) ? "Choose Edit > Start Dictation (or use your dictation shortcut) and start talking. Your Mac types as you speak."
  : /Windows/.test(UA) ? "Press Windows + H to start voice typing, then talk. Windows types as you speak."
  : "Use your device's dictation (the microphone on your keyboard) and start talking.";
const NATURAL_VOICES = [
  {id: 'hannah', label: 'Hannah (female)'},
  {id: 'diana', label: 'Diana (female)'},
  {id: 'autumn', label: 'Autumn (female)'},
  {id: 'troy', label: 'Troy (male)'},
  {id: 'austin', label: 'Austin (male)'},
  {id: 'daniel', label: 'Daniel (male)'},
];
const naturalVoiceName = () => { const v = lsGet('abg-voice-name'); return byId(NATURAL_VOICES, v) ? v : NATURAL_VOICES[0].id; };
/* a tenth of a second of silence, used to unlock audio on phones */
const SILENT_WAV = (() => { try { const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer); const w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  let s = ''; b.forEach(x => { s += String.fromCharCode(x); }); return 'data:audio/wav;base64,' + btoa(s); } catch (e) { return ''; } })();
/* reads interview questions aloud: Google's natural voice when it's set up, otherwise the device's own voice */
const VOICE = (() => {
  const ss = window.speechSynthesis;
  const supported = !!(ss && window.SpeechSynthesisUtterance);
  let voice = null, unlocked = false;
  const NATURAL = /(premium|enhanced|natural|neural|siri)/i;
  const GOOD = /^(Ava|Samantha|Allison|Susan|Zoe|Evan|Nathan|Tom|Karen|Moira|Daniel|Serena|Google US English|Google UK English Female|Microsoft (Aria|Jenny|Guy|Ana|Michelle|Emma|Brian|Ava|Andrew))/i;
  const NOVELTY = /(compact|eloquence|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|rocko|shelley|flo\b|reed|sandy|eddy|fred|junior|ralph|kathy)/i;
  function pick(){
    let vs = []; try { vs = ss.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang)); } catch (e) {}
    if (!vs.length) return null;
    const score = v => (NATURAL.test(v.name) ? 4 : 0) + (GOOD.test(v.name) ? 2 : 0) + (/en[-_]US/i.test(v.lang) ? 1 : 0) - (NOVELTY.test(v.name) ? 10 : 0);
    return vs.slice().sort((a, b) => score(b) - score(a))[0];
  }
  function chunks(t){
    const out = [];
    String(t).split(/(?<=[.?!])\s+/).forEach(sn => {
      if (sn.length <= 180) { if (sn.trim()) out.push(sn); return; }
      let cur = '';
      sn.split(/(?<=,)\s+/).forEach(p => { if (cur && (cur + ' ' + p).length > 180) { out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p; });
      if (cur) out.push(cur);
    });
    return out;
  }
  function stopDevice(){ if (supported) { try { ss.cancel(); } catch (e) {} } }
  function sayDevice(text){
    if (!supported || !text) return;
    stopDevice();
    if (!voice) voice = pick();
    chunks(text).forEach(c => { try { const u = new SpeechSynthesisUtterance(c); if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US'; u.rate = 0.95; ss.speak(u); } catch (e) {} });
  }
  /* natural voice (Google, through the speak function), played on one shared audio element */
  let audio = null; try { audio = new Audio(); audio.preload = 'auto'; } catch (e) {}
  const canNatural = () => !!(audio && window.__platform && window.__platform.speech);
  const cache = new Map();
  let seq = 0, naturalState = 'unknown', limitedUntil = 0;
  const settings = () => ({engine: lsGet('abg-voice-engine') === 'device' ? 'device' : 'natural', name: naturalVoiceName()});
  function stop(){ seq++; stopDevice(); if (audio) { audio.onended = null; try { audio.pause(); } catch (e) {} } }
  /* plays the clips one after another; resolves once the first one starts */
  function playClips(urls, my){
    let i = 1;
    audio.onended = () => { if (my !== seq || i >= urls.length) { audio.onended = null; return; } audio.src = urls[i++]; const p = audio.play(); if (p && p.catch) p.catch(() => {}); };
    audio.src = urls[0];
    return audio.play();
  }
  /* returns which voice was used: 'natural', 'device', 'blocked' (the browser wants a tap first) or 'none' */
  async function say(text){
    if (!text) return 'none';
    stop(); const my = seq;
    const pref = settings();
    if (pref.engine === 'natural' && canNatural() && naturalState !== 'off' && Date.now() >= limitedUntil) {
      try {
        const k = pref.name + '|' + text;
        let urls = cache.get(k);
        if (!urls) {
          urls = await window.__platform.speech.synth(text, pref.name);
          cache.set(k, urls);
          if (cache.size > 40) { const old = cache.keys().next().value; (cache.get(old) || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} }); cache.delete(old); }
        }
        if (my !== seq) return 'none';
        naturalState = 'ok';
        await playClips(urls, my);
        return 'natural';
      } catch (e) {
        if (my !== seq) return 'none';
        if (e && e.name === 'NotAllowedError') return 'blocked';
        if (e && e.code === 'tts_not_configured') naturalState = 'off';
        /* Groq's free plan has a daily limit; rest the natural voice for a while instead of retrying every question */
        if (e && e.code === 'rate_limited') { limitedUntil = Date.now() + 30 * 60 * 1000; naturalState = 'limited'; }
      }
    }
    if (my !== seq || !supported) return 'none';
    sayDevice(text);
    return 'device';
  }
  /* phones only allow speech after a tap, so the first tap anywhere unlocks both voices */
  function unlock(){
    if (unlocked) return; unlocked = true;
    if (supported) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; ss.speak(u); } catch (e) {} }
    if (audio) { try { audio.src = SILENT_WAV; const p = audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  }
  if (supported) {
    voice = pick();
    try { ss.addEventListener('voiceschanged', () => { voice = pick(); }); } catch (e) {}
  }
  try { document.addEventListener('pointerdown', unlock, {capture: true, once: true}); document.addEventListener('keydown', unlock, {capture: true, once: true}); } catch (e) {}
  return {get supported(){ return supported || canNatural(); }, deviceSupported: supported, naturalAvailable: canNatural, naturalState: () => naturalState, say, stop};
})();
const REDUCED = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

/* ================= icons ================= */
const ICONS = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5V5.5"/><path d="M8 7h8"/>',
  chart: '<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-6"/><path d="M21 20H3"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/>',
  gear: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/>',
  doc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  openbook: '<path d="M3 5.5c3.2-1.6 6.2-1.4 9 .8v13.2c-2.8-2.2-5.8-2.4-9-.8z"/><path d="M21 5.5c-3.2-1.6-6.2-1.4-9 .8v13.2c2.8-2.2 5.8-2.4 9-.8z"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 9v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bars: '<path d="M6 20v-6M12 20V9M18 20V4" stroke-width="3.4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  inbox: '<path d="M3 13l2.5-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v3h-3"/>',
  scale: '<path d="M12 3v18M5 7h14M7 21h10"/><path d="M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7zM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12.5h18M10.5 12.5v2h3v-2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.9.2 5 2.6 5 5.8"/>',
};
function Icon({name, size}){ const s = size || 20; return html`<svg className="ic" width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML=${{__html: ICONS[name] || ''}}></svg>`; }

/* ================= context ================= */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* ================= small components ================= */
function Pill({tone, dot, children}){ return html`<span className=${'pill tone-' + (tone || 'neutral')}>${dot ? html`<span className="dot"></span>` : null}${children}</span>`; }
function StatusPill({status}){ const s = byId(STATUSES, status) || STATUSES[0]; return html`<${Pill} tone=${s.tone} dot=${true}>${s.label}<//>`; }
function EvPill({status}){ const s = byId(EVIDENCE_STATUS, status) || EVIDENCE_STATUS[3]; return html`<${Pill} tone=${s.tone}>${s.label}<//>`; }
/* milestones for one story: milestone evidence, plus metrics-card answers that are milestones */
function storyMilestoneItems(story){
  const out = [];
  (story.evidence || []).forEach(e => { if (e.status === 'future') return; const d = byId(DOMAINS, domainOf(e)); if (d && d.milestone && (e.direction === 'achieved' || e.direction === 'improved' || e.direction === 'unclear' || !e.direction)) out.push({key: e.id, label: e.metric || d.label, detail: e.after || (e.metric ? '' : e.statement), e}); });
  const covered = new Set(out.map(x => domainOf(x.e)));
  const card = (k, dom, label, val) => { const m = metricVal(story, k); if (m && (val ? val(m.value) : m.value === 'Yes') && !covered.has(dom)) out.push({key: 'card-' + k, label, detail: val ? m.value : '', status: m.status}); };
  card('graduated', 'graduation', 'Graduated high school');
  card('firstGenCollege', 'higher_ed_fg', 'First in their family to attend college');
  card('nextStep', 'higher_ed', 'College, training or creative work', v => !!v);
  card('returnedToAbg', 'returned', 'Returned to ABG');
  card('continuedArt', 'arts_continued', 'Kept making art');
  card('stillParticipating', 'participation', 'Still participating in ABG');
  return out;
}
function EvLabel({e}){ const c = evidenceClass(e); const tone = c === 'planned' ? 'outline' : (byId(EVIDENCE_CLASSES, c) || {}).tone || 'neutral'; return html`<${Pill} tone=${tone}>${classLabel(e)}<//>`; }
function OutcomeTable({rows}){
  if (!rows.length) return null;
  return html`<div className="otable" role="table" aria-label="Before and after outcomes">
    <div className="otr oth" role="row"><span role="columnheader">Metric</span><span role="columnheader">Before ABG</span><span role="columnheader">After ABG</span><span role="columnheader">Evidence</span></div>
    ${rows.map(e => html`<div className="otr" role="row" key=${e.id}>
      <span role="cell" className="ot-metric"><strong>${e.metric || trunc(e.statement, 70)}</strong><small className="muted">${labelOf(DOMAINS, domainOf(e))}${e.timeframe ? ' · ' + e.timeframe : ''}</small></span>
      <span role="cell" className="ot-val" data-label="Before ABG">${e.before || '—'}</span>
      <span role="cell" className="ot-val" data-label="After ABG">${e.after || '—'}</span>
      <span role="cell" data-label="Evidence"><${EvLabel} e=${e} /></span>
    </div>`)}
  </div>`;
}
function MetricPill({status}){ const s = byId(METRIC_STATUS, status) || METRIC_STATUS[1]; return html`<${Pill} tone=${s.tone}>${s.label}<//>`; }
function Field({label, hint, children}){ return html`<label className="field"><span>${label}</span>${children}${hint ? html`<small className="hint">${hint}</small>` : null}</label>`; }
function Sec({title, count, open, children, refEl, id}){
  return html`<details className="sec" open=${!!open} ref=${refEl} id=${id}>
    <summary><span>${title}${count != null ? html`<span className="count">${count}</span>` : null}</span><${Icon} name="chev" size=${18} /></summary>
    <div className="sec-body">${children}</div>
  </details>`;
}
function YesNo({label, value, onChange, disabled}){
  const opts = [['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']];
  return html`<div className="yn-row"><span className="yn-label">${label}</span>
    <div className="seg" role="group" aria-label=${label}>${opts.map(o => html`<button type="button" key=${o[0]} className="seg-btn" aria-pressed=${(value || 'unknown') === o[0]} disabled=${disabled} onClick=${() => onChange(o[0])}>${o[1]}</button>`)}</div>
  </div>`;
}
function ChipGroup({options, value, onChange, label}){
  const set = new Set(value || []);
  return html`<div className="chips" role="group" aria-label=${label}>${options.map(o => html`<button type="button" key=${o.id} className="chip" aria-pressed=${set.has(o.id)} onClick=${() => { const n = new Set(set); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); onChange(options.map(x => x.id).filter(id => n.has(id))); }}>${o.short || o.label}</button>`)}</div>`;
}
function SheetHead({title, close}){ return html`<div className="sheet-head"><h2>${title}</h2><button className="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button></div>`; }
function CopyButton({text, label}){
  const [done, setDone] = useState(false);
  function ok(){ setDone(true); setTimeout(() => setDone(false), 1800); }
  function copy(){
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { if (document.execCommand('copy')) ok(); } catch (e) {} ta.remove(); };
    try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (e) { fallback(); }
  }
  return html`<button type="button" className="btn btn-ghost btn-sm" onClick=${copy}><${Icon} name=${done ? 'check' : 'copy'} size=${16} /> ${done ? 'Copied' : (label || 'Copy')}</button>`;
}
function Brand({small}){
  return html`<span className=${'brand' + (small ? ' brand-sm' : '')}><img className="brand-logo" src="/abg-logo.png" alt="Arts Bridging the Gap" /><span className="brand-text sr-only">ABG Impact Journal</span></span>`;
}
function TranscriptText({text, highlight}){
  if (highlight) {
    const i = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (i >= 0) return html`<p className="transcript">${text.slice(0, i)}<mark>${text.slice(i, i + highlight.length)}</mark>${text.slice(i + highlight.length)}</p>`;
  }
  return html`<p className="transcript">${text}</p>`;
}
function useNames(ids){
  const {caps} = useApp();
  const [names, setNames] = useState({});
  const key = uniq(ids).sort().join(',');
  useEffect(() => {
    let alive = true;
    if (!caps.user || !key) return;
    caps.user.profiles(key.split(',')).then(ps => { if (!alive) return; const m = {}; Object.keys(ps || {}).forEach(id => { m[id] = (ps[id] && ps[id].name) || ''; }); setNames(m); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return names;
}

/* ================= navigation chrome ================= */
const NAV = [
  {id: 'home', label: 'Overview', icon: 'home'},
  {id: 'interview', label: 'Capture a Story', icon: 'edit'},
  {id: 'library', label: 'Story Library', icon: 'doc'},
  {id: 'insights', label: 'Impact Insights', icon: 'chart'},
  {id: 'submissions', label: 'Community Submissions', icon: 'inbox'},
  {id: 'compare', label: 'Source Comparison', icon: 'scale'},
  {id: 'invite', label: 'Invite Contributors', icon: 'share'},
  {id: 'guide', label: 'Interview Guide', icon: 'compass'},
];
const STORIES_ROUTES = ['library', 'story', 'backlog', 'followups'];
function isCurrent(route, id){ if (id === 'library') return STORIES_ROUTES.includes(route.name); if (id === 'insights') return route.name === 'insights' || route.name === 'reports'; if (id === 'submissions') return route.name === 'submissions' || route.name === 'submission'; return route.name === id; }
function initialsOf(name){ const p = asStr(name).split(/[\s._-]+/).filter(Boolean); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
function Sidebar(){
  const {route, nav, readOnly, stories, caps, openSheet, subs} = useApp();
  const due = countDue(stories);
  const pending = subs.filter(x => !x.is_test && (x.status === 'pending_review' || x.status === 'removal_requested')).length;
  const me = caps.me || {};
  const shown = asStr(me.name) || firstNameOf(window.__platform && window.__platform.email) || 'Signed in';
  return html`<aside className="sidebar">
    <button className="side-logo" onClick=${() => nav('home')} aria-label="Overview"><${Brand} /></button>
    <nav className="side-nav" aria-label="Main">
      ${NAV.filter(n => !(readOnly && n.id === 'interview')).map(n => html`<button key=${n.id} className="side-link" aria-current=${isCurrent(route, n.id) ? 'page' : undefined} onClick=${() => nav(n.id)}><${Icon} name=${n.icon} /><span>${n.label}</span>${n.id === 'library' && due > 0 ? html`<span className="badge" title=${due + ' follow-ups due'}>${due}</span>` : null}${n.id === 'submissions' && pending > 0 ? html`<span className="badge" title=${pending + ' waiting for review'}>${pending}</span>` : null}</button>`)}
    </nav>
    <div className="side-bottom">
      <button className="side-link" aria-current=${route.name === 'settings' ? 'page' : undefined} onClick=${() => nav('settings')}><${Icon} name="gear" /><span>Settings</span></button>
      <div className="side-user"><${Avatar} name=${shown} photo=${me.photo} /><span className="side-user-text"><strong>${shown}</strong><small>${me.role || (window.__platform && window.__platform.email) || ''}</small></span></div>
      ${window.__platform ? html`<button className="side-link side-small" onClick=${() => confirmLogout(openSheet)}><${Icon} name="logout" size=${18} /><span>Log out</span></button>` : null}
    </div>
  </aside>`;
}
function Avatar({name, photo, big}){
  const cls = 'avatar ' + (big ? 'avatar-xl tone-peach' : 'tone-teal');
  return photo ? html`<img className=${cls + ' avatar-img'} src=${photo} alt="" />` : html`<span className=${cls} aria-hidden="true">${initialsOf(name) || '?'}</span>`;
}
function TopBar(){
  const {nav} = useApp();
  return html`<header className="topbar">
    <button className="icon-btn topbar-logo" onClick=${() => nav('home')} aria-label="Overview"><${Brand} small=${true} /></button>
    <button className="btn btn-quiet btn-sm topbar-guide" onClick=${() => nav('guide')}><${Icon} name="compass" size=${18} /> Guide</button>
  </header>`;
}
function TabBar(){
  const {route, nav, stories, readOnly} = useApp();
  const due = countDue(stories);
  const tab = (id, label, icon) => html`<button key=${id} className="tab" aria-current=${isCurrent(route, id) ? 'page' : undefined} onClick=${() => nav(id)}><${Icon} name=${icon} size=${22} /><span>${label}</span>${id === 'library' && due > 0 ? html`<span className="badge">${due}</span>` : null}</button>`;
  return html`<nav className="tabbar" aria-label="Main">
    ${tab('home', 'Overview', 'home')}
    ${tab('library', 'Library', 'doc')}
    <button className="tab tab-rec" onClick=${() => nav('interview')} disabled=${readOnly} aria-label="Capture a Story"><span className="tab-blob"><${Icon} name="plus" size=${26} /></span><span>Capture</span></button>
    ${tab('insights', 'Insights', 'chart')}
    ${tab('settings', 'Settings', 'gear')}
  </nav>`;
}
/* segmented tabs used to combine pages */
function PageTabs({tabs, value, onChange, label}){
  return html`<div className="page-tabs" role="tablist" aria-label=${label}>${tabs.map(t => html`<button key=${t.id} type="button" role="tab" aria-selected=${value === t.id} className="page-tab" onClick=${() => onChange(t.id)}>${t.label}${t.badge ? html`<span className="count">${t.badge}</span>` : null}</button>`)}</div>`;
}
function StoriesView({tab: initial}){
  const {stories, backlog} = useApp();
  const [tab, setTab] = useState(initial || 'stories');
  const due = countDue(stories);
  const waiting = backlog.filter(b => b.status === 'waiting').length;
  return html`<div className="view">
    <header className="page-head"><h1>Story Library</h1></header>
    <${PageTabs} label="Stories" value=${tab} onChange=${setTab} tabs=${[
      {id: 'stories', label: 'All stories', badge: stories.length || null},
      {id: 'list', label: 'Student list', badge: waiting || null},
      {id: 'followups', label: 'Follow-ups', badge: due || null},
    ]} />
    ${tab === 'list' ? html`<${BacklogView} embedded=${true} />` : tab === 'followups' ? html`<${FollowupsView} embedded=${true} />` : html`<${LibraryView} embedded=${true} />`}
  </div>`;
}
/* ---------- Impact Insights overview ---------- */
/* outcome categories used in Impact Insights, reports and story tags (renamable, recolorable and extendable in Settings) */
const INSIGHT_OUTCOMES = [
  {id:'academic', label:'Academic improvement', short:'Academic Improvement', domains:['academics'], color:'#A653C9', tone:'purple'},
  {id:'attendance', label:'Attendance and engagement', short:'Attendance & Engagement', domains:['attendance', 'engagement'], color:'#2B9FE0', tone:'blue'},
  {id:'confidence', label:'Confidence and creativity', short:'Confidence & Creativity', domains:['confidence', 'artistic', 'arts_continued'], color:'#2ED3B4', tone:'teal'},
  {id:'belonging', label:'Belonging and emotional development', short:'Belonging', domains:['wellbeing', 'social'], color:'#EC6FB5', tone:'purple'},
  {id:'leadership', label:'Leadership and community involvement', short:'Leadership & Community', domains:['leadership_abg', 'returned', 'mentorship', 'community_involvement', 'activities'], color:'#F26B6B', tone:'coral'},
  {id:'graduation', label:'Graduation and higher education', short:'Graduation & Higher Ed', domains:['graduation', 'higher_ed'], color:'#F59A3C', tone:'orange'},
  {id:'career', label:'Career aspirations and opportunities', short:'Career', domains:['career', 'pathways', 'aspirations'], color:'#5C6BC0', tone:'blue'},
];
/* outcome categories: the defaults above, adjusted in Settings (renamed, recolored, hidden) plus custom ones */
const OUTCOME_DESC = {academic: 'Better grades, passing classes or academic growth', attendance: 'More consistent attendance, motivation and participation in school', confidence: 'More confidence, self-expression, creative skill or continued art-making', belonging: 'Stronger relationships, a sense of belonging, or emotional growth and resilience', leadership: 'Leadership or mentoring roles, returning to ABG, or community involvement', graduation: 'Graduated high school, or enrolled in college or further education', career: 'Career interests, internships, jobs or creative work'};
INSIGHT_OUTCOMES.forEach(o => { o.desc = OUTCOME_DESC[o.id] || ''; });
const SWATCHES = ['#1F7A6D', '#2ED3B4', '#8B3F98', '#A653C9', '#2B9FE0', '#5C6BC0', '#F26B6B', '#EC6FB5', '#F59A3C', '#F4C542', '#8D6E63', '#607D8B'];
let ACTIVE_OUTCOMES = INSIGHT_OUTCOMES;
function mergeOutcomes(saved){
  const over = new Map(asArr(saved).filter(o => o && o.id).map(o => [o.id, o]));
  const out = [];
  INSIGHT_OUTCOMES.forEach(b => {
    const o = over.get(b.id);
    if (!o) { out.push(b); return; }
    if (o.hidden) return;
    const label = asStr(o.label) || b.label, color = o.color || b.color;
    out.push(Object.assign({}, b, {label, short: label !== b.label ? label : b.short, desc: o.desc != null ? String(o.desc) : b.desc, color, tone: color !== b.color ? '' : b.tone}));
  });
  over.forEach(o => { if (o.custom && !o.hidden && asStr(o.label)) out.push({id: o.id, label: asStr(o.label), short: asStr(o.label), desc: asStr(o.desc), color: o.color || '#607D8B', tone: '', domains: [], words: asArr(o.words).map(asStr).filter(Boolean), custom: true}); });
  return out;
}
/* tag colors: the built-in tone, or a tint of the chosen color */
function outcomePill(o){ return o.tone ? {className: 'pill tone-' + o.tone, style: undefined} : {className: 'pill pill-custom', style: {'--pc': o.color}}; }
function programColor(settings, name, i){ const info = ((settings && settings.programInfo) || {})[name]; return (info && info.color) || ['#2ED3B4', '#A653C9', '#2B9FE0', '#F59A3C', '#F4C542', '#5C6BC0'][i % 6]; }
const GRADE_BUCKETS = [{id:'elem', label:'Elementary (K–5)'}, {id:'middle', label:'Middle school (6–8)'}, {id:'high', label:'High school (9–12)'}, {id:'post', label:'College or older'}, {id:'none', label:'Not specified'}];
const RANGES = [{id:'30d', label:'Last 30 days', days:30}, {id:'3m', label:'Last 3 months', days:92}, {id:'12m', label:'Last 12 months', days:366}, {id:'all', label:'All time', days:0}];
function gradeBucket(s){
  const ov = s.overview || {}; const t = norm([ov.ageOrGrade, ov.demographics].join(' '));
  const words = {kindergarten: 0, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12};
  let g = null; const m = t.match(/\b(\d{1,2})(st|nd|rd|th)?\s*grade|grade\s*(\d{1,2})/);
  if (m) g = +(m[1] || m[3]); else { for (const k in words) if (new RegExp('\\b' + k + '\\b').test(t)) { g = words[k]; break; } }
  if (g == null) {
    if (/high school|freshman|sophomore|junior|senior/.test(t)) return 'high';
    if (/middle school/.test(t)) return 'middle';
    if (/elementary/.test(t)) return 'elem';
    if (/college|university|adult|alum/.test(t)) return 'post';
    const a = t.match(/age\s*(\d{1,2})|(\d{1,2})\s*(years? old|yo)/); if (a) { const n = +(a[1] || a[2]); return n <= 10 ? 'elem' : n <= 13 ? 'middle' : n <= 18 ? 'high' : 'post'; }
    return 'none';
  }
  return g <= 5 ? 'elem' : g <= 8 ? 'middle' : g <= 12 ? 'high' : 'post';
}
/* outcomes a story mentions: positive or unclear evidence in a matching area, plus metrics-card answers */
function storyArt(id){
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pal = ['#2ED3B4', '#A653C9', '#F26B6B', '#2B9FE0', '#F59A3C', '#F4C542', '#EC6FB5', '#5C6BC0'];
  const pick = k => pal[(h >>> (k * 3)) % pal.length];
  const r = k => 20 + ((h >>> k) % 60);
  return html`<svg className="fs-art" viewBox="0 0 100 120" aria-hidden="true" focusable="false">
    <defs><linearGradient id=${'g' + h} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color=${pick(0)} /><stop offset="1" stop-color=${pick(1)} /></linearGradient></defs>
    <rect width="100" height="120" fill=${'url(#g' + h + ')'} />
    <circle cx=${r(2)} cy=${r(5) + 20} r="26" fill=${pick(2)} opacity=".75" />
    <circle cx=${r(7) + 20} cy=${r(9)} r="20" fill=${pick(3)} opacity=".7" />
    <path d=${'M0 ' + (70 + (h % 30)) + ' C30 ' + (40 + (h % 40)) + ' 60 ' + (110 - (h % 30)) + ' 100 ' + (60 + (h % 20)) + ' L100 120 L0 120z'} fill=${pick(4)} opacity=".8" />
    <path d=${'M10 ' + (30 + (h % 50)) + ' q30 -20 80 10'} stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7" />
  </svg>`;
}
function Donut({rows, total}){
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const sum = rows.reduce((t, r) => t + r.n, 0) || 1;
  return html`<svg className="donut" viewBox="0 0 140 140" role="img" aria-label=${'Students by program, ' + total + ' students'}>
    <circle cx="70" cy="70" r=${R} fill="none" stroke="var(--surface-2)" stroke-width="24" />
    ${rows.map(r => { const len = C * r.n / sum; const gap = rows.length > 1 ? Math.min(3, len / 3) : 0; const el = html`<circle key=${r.label} cx="70" cy="70" r=${R} fill="none" stroke=${r.color} stroke-width="24" stroke-dasharray=${Math.max(0, len - gap) + ' ' + (C - Math.max(0, len - gap))} stroke-dashoffset=${-off} transform="rotate(-90 70 70)" />`; off += len; return el; })}
    <text x="70" y="70" textAnchor="middle" className="donut-n">${total}</text>
    <text x="70" y="88" textAnchor="middle" className="donut-l">${total === 1 ? 'Student' : 'Students'}</text>
  </svg>`;
}
/* ---------- Impact Insights: shared counting rules ----------
   Students are deduplicated by student record (a story without one counts once under its first name).
   An outcome record counts toward an area when it shows achievement, improvement, a mixed change or an
   unspecified positive change. No-change and declines are shown separately; planned outcomes never count.
   For each student and area, the strongest evidence type on file is used. */
const POSITIVE = d => !['declined', 'same'].includes(d || 'unclear');
function evidenceText(e){ return ' ' + norm([e.metric, e.statement, e.after, e.basis, e.observation].join(' ')) + ' '; }
function evidenceCategories(e){
  if (!e || e.status === 'future') return [];
  const d = domainOf(e);
  return ACTIVE_OUTCOMES.filter(o => o.domains.includes(d) || (o.custom && (o.words || []).some(w => { const k = norm(w); return k && evidenceText(e).includes(' ' + k); }))).map(o => o.id);
}
/* metrics-card answers that point to an area (Kyle's answer, with its source not recorded) */
function cardCategories(s){
  const v = id => { const m = metricVal(s, id); return m ? m.value : ''; };
  const out = [];
  const add = (cat, field, val) => out.push({cat, field, val, status: (metricVal(s, field) || {}).status});
  if (v('grades') === 'Improved') add('academic', 'grades', 'Grades improved');
  if (v('schoolAttendance') === 'Improved') add('attendance', 'schoolAttendance', 'School attendance improved');
  if (v('graduated') === 'Yes') add('graduation', 'graduated', 'Graduated high school');
  if (v('firstGenCollege') === 'Yes') add('graduation', 'firstGenCollege', 'First in their family to attend college');
  if (/college|university|degree|vocational|trade/i.test(v('nextStep'))) add('graduation', 'nextStep', v('nextStep'));
  if (v('returnedToAbg') === 'Yes') add('leadership', 'returnedToAbg', 'Came back to ABG');
  if (v('continuedArt') === 'Yes') add('confidence', 'continuedArt', 'Kept making art');
  if (/\bjob\b|employ|intern|career/i.test(v('currentStatus'))) add('career', 'currentStatus', v('currentStatus'));
  return out;
}
function storyOutcomes(s){
  const set = new Set();
  (s.evidence || []).forEach(e => { if (POSITIVE(e.direction)) evidenceCategories(e).forEach(id => set.add(id)); });
  cardCategories(s).forEach(c => set.add(c.cat));
  const customs = ACTIVE_OUTCOMES.filter(o => o.custom && o.words && o.words.length);
  if (customs.length) { const t = ' ' + norm((s.takeaways || []).join(' ')) + ' '; customs.forEach(o => { if (o.words.some(w => { const k = norm(w); return k && t.includes(' ' + k); })) set.add(o.id); }); }
  const live = new Set(ACTIVE_OUTCOMES.map(o => o.id));
  return new Set(Array.from(set).filter(id => live.has(id)));
}
const bestClass = list => list.reduce((b, c) => (CLASS_RANK[c] || 0) > (CLASS_RANK[b] || 0) ? c : b, 'unconfirmed');
function isComplete(e){ return !!(asStr(e.before) && asStr(e.after) && evidenceClass(e) !== 'unconfirmed'); }
function insightIndex(list){
  const profiles = studentProfiles(list);
  const students = profiles.map(p => {
    const cats = {};
    const get = id => cats[id] || (cats[id] = {pos: [], neg: [], card: []});
    p.stories.forEach(s => {
      (s.evidence || []).forEach(e => evidenceCategories(e).forEach(id => (POSITIVE(e.direction) ? get(id).pos : get(id).neg).push({s, e})));
      cardCategories(s).forEach(c => get(c.cat).card.push({s, c}));
    });
    Object.values(cats).forEach(c => { c.counted = c.pos.length > 0 || c.card.length > 0; c.cls = c.pos.length ? bestClass(c.pos.map(x => evidenceClass(x.e))) : (c.card.some(x => x.c.status === 'verified') ? 'verified' : 'unconfirmed'); });
    return {p, cats, any: Object.values(cats).some(c => c.counted), ms: studentMilestones(p)};
  });
  const records = [];
  list.forEach(s => (s.evidence || []).forEach(e => records.push({s, e})));
  const current = records.filter(r => r.e.status !== 'future');
  return {profiles, students, N: profiles.length, records: current, planned: records.filter(r => r.e.status === 'future')};
}
/* the stories behind any figure */
function BehindSheet({title, rule, rows, close}){
  const {nav} = useApp();
  return html`<div className="view behind" style=${{gap: '12px'}}>
    <${SheetHead} title=${title} close=${close} />
    ${rule ? html`<p className="small muted">${rule}</p>` : null}
    ${rows.length === 0 ? html`<p className="empty-note">No stories in this view.</p>` : rows.map(r => html`<div className="behind-row" key=${r.story.id}>
      <button className="behind-head" onClick=${() => { close(); nav('story', {id: r.story.id}); }}>
        <span><span className="behind-name"><strong>${r.story.alias || 'General story'}</strong>${r.story.demo ? html`<${DemoPill} />` : null}</span><small className="muted">${r.story.title}</small></span><${Icon} name="chev" size=${18} />
      </button>
      ${(r.lines || []).length ? html`<ul className="behind-lines">${r.lines.map((l, i) => html`<li key=${i}><span>${l.text}</span>${l.e ? html`<${EvLabel} e=${l.e} />` : l.tag ? html`<${Pill} tone="outline">${l.tag}<//>` : null}</li>`)}</ul>` : null}
    </div>`)}
  </div>`;
}
function groupRows(items){
  const m = new Map();
  items.forEach(x => { if (!m.has(x.s.id)) m.set(x.s.id, {story: x.s, lines: []}); if (x.line) m.get(x.s.id).lines.push(x.line); });
  return Array.from(m.values());
}
const insLine = e => ({text: e.statement + (hasComparison(e) ? ' (' + e.before + ' → ' + e.after + ')' : ''), e});

function InsightsOverview({list, filterBar, period}){
  const {nav, storiesLoaded, settings, openSheet} = useApp();
  const ix = useMemo(() => insightIndex(list), [list, settings.outcomes]);
  const N = ix.N;
  const show = (title, rule, rows) => openSheet(close => html`<${BehindSheet} title=${title} rule=${rule} rows=${rows} close=${close} />`);
  const of = (n, d) => d ? n + ' of ' + d : '0';
  const pct = (n, d) => d ? Math.round(100 * n / d) + '%' : '–';
  const studentStories = st => st.p.stories;
  /* overview */
  const withOutcomes = ix.students.filter(st => st.any);
  const complete = ix.records.filter(r => isComplete(r.e));
  const byProgram = {};
  ix.profiles.forEach(p => { const k = asStr(p.latest.program) || 'Other / Not specified'; (byProgram[k] = byProgram[k] || []).push(p); });
  const progRows = Object.entries(byProgram).filter(([k]) => k !== 'Other / Not specified').sort((a, b) => b[1].length - a[1].length);
  const donut = progRows.slice(0, 4).map(([label, ps], i) => ({label, n: ps.length, ps, color: programColor(settings, label, i)}));
  const otherPs = [].concat.apply([], progRows.slice(4).map(r => r[1])).concat(byProgram['Other / Not specified'] || []);
  if (otherPs.length) donut.push({label: 'Other / Not specified', n: otherPs.length, ps: otherPs, color: '#B9B2A6'});
  const EDU = [
    {id: 'graduated', label: 'Graduated high school'}, {id: 'higher_ed', label: 'Went on to college or further education'}, {id: 'first_gen', label: 'First in their family to attend college'},
    {id: 'school_engagement', label: 'Improved attendance, grades or engagement'}, {id: 'career', label: 'Career, job or internship'},
  ];
  const stillInSchool = ix.students.filter(st => (st.p.metrics.graduated || {}).value === 'Not yet (still in school)');
  /* outcome analysis */
  const outcomeRows = ACTIVE_OUTCOMES.map(o => {
    const hit = ix.students.filter(st => st.cats[o.id] && st.cats[o.id].counted);
    const neg = ix.students.filter(st => st.cats[o.id] && !st.cats[o.id].counted && st.cats[o.id].neg.length);
    const byCls = {}; hit.forEach(st => { const c = st.cats[o.id].cls; byCls[c] = (byCls[c] || 0) + 1; });
    return {o, hit, neg, byCls};
  });
  const openOutcome = r => show(r.o.label, 'Students counted: ' + of(r.hit.length, N) + ' documented in this view. A student counts once, using their strongest evidence. ' + (r.neg.length ? r.neg.length + ' more had no change or a decline in this area (listed last).' : ''),
    groupRows([].concat.apply([], r.hit.map(st => st.cats[r.o.id].pos.map(x => ({s: x.s, line: insLine(x.e)})).concat(st.cats[r.o.id].card.map(x => ({s: x.s, line: {text: (byId(METRIC_FIELDS, x.c.field) || {}).short + ': ' + x.c.val, tag: 'Metrics card'}})))))
      .concat([].concat.apply([], r.neg.map(st => st.cats[r.o.id].neg.map(x => ({s: x.s, line: insLine(x.e)})))))));
  /* evidence quality */
  const clsCount = {}; ix.records.forEach(r => { const c = evidenceClass(r.e); clsCount[c] = (clsCount[c] || 0) + 1; });
  const R = ix.records.length;
  const missing = list.filter(s => (s.evidence || []).some(e => e.status !== 'future' && !isComplete(e)) || (s.missingMetrics || []).length);
  const follow = list.filter(s => s.status === 'needs_verification' || (s.followUps || []).some(f => f.status === 'open') || (s.evidence || []).some(e => asStr(e.openQuestion)));
  const stat = (icon, tone, value, label, sub, onClick) => html`<button className="stat-card ins-stat" onClick=${onClick}><span className=${'stat-ic tone-' + tone}><${Icon} name=${icon} size=${26} /></span><span className="stat-text"><b className="tnum">${storiesLoaded ? value : '–'}</b><span className="stat-label">${label}</span><small className="muted">${sub}</small></span></button>`;
  const featured = list.slice().sort((a, b) => ((b.status === 'approved') - (a.status === 'approved')) || (outcomeCount(b) - outcomeCount(a)) || (b.createdAt || '').localeCompare(a.createdAt || '')).filter(isStudentStory).slice(0, 3);

  return html`<div className="view ins-body">
    ${filterBar}
    <p className="tiny muted ins-hint">Every number below is counted from the stories in this view. Select any number to see the stories behind it.</p>

    <section className="ins-section" aria-labelledby="h-overview">
      <h2 id="h-overview" className="ins-h">Impact overview</h2>
      <div className="ins-stats">
        ${stat('users', 'teal', N, 'Students documented', 'Unique students, ' + period, () => show('Students documented', N + ' unique students in this view, one per student record.', ix.profiles.map(p => ({story: p.latest, lines: p.stories.length > 1 ? [{text: p.stories.length + ' stories about this student'}] : []}))))}
        ${stat('check', 'purple', of(withOutcomes.length, N), 'Students with documented outcomes', pct(withOutcomes.length, N) + ' of students documented', () => show('Students with documented outcomes', 'At least one counted outcome in any area (no-change, declines and planned outcomes are not counted).', withOutcomes.map(st => ({story: st.p.latest, lines: Object.keys(st.cats).filter(k => st.cats[k].counted).map(k => ({text: labelOf(ACTIVE_OUTCOMES, k), tag: (byId(EVIDENCE_CLASSES, st.cats[k].cls) || {}).short}))}))))}
        ${stat('openbook', 'orange', list.length, 'Stories captured', R + ' outcome records', () => show('Stories captured', list.length + ' stories recorded ' + period + '.', list.map(s => ({story: s, lines: []}))))}
        ${stat('bars', 'blue', pct(complete.length, R), 'Evidence completeness', of(complete.length, R) + ' outcome records complete', () => show('Evidence completeness', 'An outcome record is complete when it has an initial condition, a current condition, and a known source (staff-observed, reported or verified).', groupRows(ix.records.filter(r => !isComplete(r.e)).map(r => ({s: r.s, line: {text: 'Missing ' + [!asStr(r.e.before) ? 'initial condition' : '', !asStr(r.e.after) ? 'current condition' : '', evidenceClass(r.e) === 'unconfirmed' ? 'source' : ''].filter(Boolean).join(', ') + ': ' + r.e.statement}})))))}
      </div>
      <div className="ins-charts">
        <section className="card ins-card">
          <div><h3>Student participation by program</h3><p className="small muted">Unique students, by the program in their latest story</p></div>
          ${N === 0 ? html`<p className="empty-note">No students in this view yet.</p>` : html`<div className="donut-wrap">
            <${Donut} rows=${donut} total=${N} />
            <ul className="donut-legend">${donut.map(r => html`<li key=${r.label}><button className="legend-btn" onClick=${() => show(r.label, r.n + ' of ' + N + ' students, by the program in their latest story.', r.ps.map(p => ({story: p.latest, lines: []})))}><span className="dot-sw" style=${{background: r.color}}></span><span className="dl-label">${r.label}</span><span className="dl-n tnum">${r.n} <span className="muted">(${pct(r.n, N)})</span></span></button></li>`)}</ul>
          </div>`}
        </section>
        <section className="card ins-card">
          <div><h3>Educational milestones</h3><p className="small muted">Students who reached each milestone, of ${N} documented</p></div>
          <ul className="ms-list">${EDU.map(m => { const hit = ix.students.filter(st => st.ms[m.id]); return html`<li key=${m.id}><button className="ms-btn" onClick=${() => show(m.label, of(hit.length, N) + ' students documented.', hit.map(st => ({story: st.p.latest, lines: []})))}><span>${m.label}</span><b className="tnum">${hit.length}</b></button></li>`; })}
            <li><button className="ms-btn" onClick=${() => show('Still in school', 'Metrics card: graduated high school "Not yet (still in school)".', stillInSchool.map(st => ({story: st.p.latest, lines: []})))}><span>Still in school</span><b className="tnum">${stillInSchool.length}</b></button></li>
          </ul>
        </section>
      </div>
    </section>

    <section className="ins-section" aria-labelledby="h-outcomes">
      <h2 id="h-outcomes" className="ins-h">Outcome analysis</h2>
      <section className="card ins-card">
        <div><h3>Students with documented outcomes, by area</h3><p className="small muted">Each bar is students, out of ${N} documented. Colors show the strongest evidence for each student.</p></div>
        ${N === 0 ? html`<p className="empty-note">No students in this view yet.</p>` : html`<div className="oa-list">${outcomeRows.map(r => html`<button className="oa-row" key=${r.o.id} onClick=${() => openOutcome(r)}>
          <span className="oa-label"><span className="dot-sw" style=${{background: r.o.color}}></span>${r.o.label}</span>
          <span className="oa-track" aria-hidden="true">${EVIDENCE_CLASSES.map(c => r.byCls[c.id] ? html`<span key=${c.id} className="oa-seg" style=${{width: (100 * r.byCls[c.id] / N) + '%', background: c.color}}></span>` : null)}</span>
          <span className="oa-n tnum"><span><b>${r.hit.length}</b> of ${N}</span>${r.neg.length ? html`<small className="muted">${r.neg.length} no change</small>` : null}</span>
        </button>`)}</div>
        <div className="cls-legend small">${EVIDENCE_CLASSES.map(c => html`<span key=${c.id}><span className="dot-sw" style=${{background: c.color}}></span>${c.label}</span>`)}</div>`}
      </section>
    </section>

    <section className="ins-section" aria-labelledby="h-quality">
      <h2 id="h-quality" className="ins-h">Evidence quality</h2>
      <div className="ins-charts">
        <section className="card ins-card">
          <div><h3>Outcome records by evidence type</h3><p className="small muted">${R} outcome records. ${ix.planned.length ? ix.planned.length + ' planned outcomes are tracked separately and never counted.' : ''}</p></div>
          ${R ? html`<div className="cls-bar" aria-hidden="true">${EVIDENCE_CLASSES.map(c => clsCount[c.id] ? html`<span key=${c.id} style=${{width: (100 * clsCount[c.id] / R) + '%', background: c.color}}></span>` : null)}</div>` : null}
          <ul className="cls-list">${EVIDENCE_CLASSES.map(c => html`<li key=${c.id}><button className="ms-btn" onClick=${() => show(c.label, (clsCount[c.id] || 0) + ' of ' + R + ' outcome records.', groupRows(ix.records.filter(r => evidenceClass(r.e) === c.id).map(r => ({s: r.s, line: insLine(r.e)}))))}><span><span className="dot-sw" style=${{background: c.color}}></span>${c.label}</span><b className="tnum">${clsCount[c.id] || 0}<small className="muted"> ${pct(clsCount[c.id] || 0, R)}</small></b></button></li>`)}</ul>
        </section>
        <section className="card ins-card">
          <div><h3>Records needing attention</h3><p className="small muted">Stories in this view</p></div>
          <ul className="cls-list">
            <li><button className="ms-btn" onClick=${() => show('Records with missing evidence', 'Stories with an outcome missing its initial condition, current condition or source, or with data gaps listed.', missing.map(s => ({story: s, lines: (s.evidence || []).filter(e => e.status !== 'future' && !isComplete(e)).map(e => ({text: e.statement, e})).concat((s.missingMetrics || []).map(m => ({text: 'Data gap: ' + m.metric})))})))}><span>Records with missing evidence</span><b className="tnum">${of(missing.length, list.length)}</b></button></li>
            <li><button className="ms-btn" onClick=${() => show('Records requiring follow-up', 'Stories marked needs verification, with open questions or reminders, or with an outcome that has an open question.', follow.map(s => ({story: s, lines: (s.followUps || []).filter(f => f.status === 'open').map(f => ({text: f.question + (f.due ? ' (due ' + fmtDay(f.due) + ')' : ''), tag: f.kind === 'task' ? 'Reminder' : 'Question'})).concat((s.evidence || []).filter(e => asStr(e.openQuestion)).map(e => ({text: e.openQuestion, tag: 'Still unknown'})))})))}><span>Records requiring follow-up</span><b className="tnum">${of(follow.length, list.length)}</b></button></li>
          </ul>
        </section>
      </div>
    </section>

    <section className="card ins-card">
      <div className="sec-head"><div><h2>Stories behind the numbers</h2><p className="small muted">Featured student stories from this view. Approved stories come first.</p></div><button className="btn btn-quiet btn-sm view-all" onClick=${() => nav('library')}>View all stories <span aria-hidden="true">→</span></button></div>
      ${featured.length === 0 ? html`<p className="empty-note">No student stories in this view yet.</p>` : html`<div className="fs-grid">${featured.map(st => { const ov = st.overview || {}; const tags = ACTIVE_OUTCOMES.filter(o => storyOutcomes(st).has(o.id)).slice(0, 2); return html`<button className="fs-card" key=${st.id} onClick=${() => nav('story', {id: st.id})}>
        ${storyArt(st.id)}
        <span className="fs-main"><strong>${st.alias || st.title}${st.demo ? html` <${DemoPill} />` : null}</strong><small className="muted">${[st.program, ov.ageOrGrade || ov.demographics].filter(Boolean).join(' · ')}</small><span className="fs-sum">${st.summary || st.title}</span></span>
        ${tags.length ? html`<span className="fs-tags">${tags.map(o => { const pp = outcomePill(o); return html`<span className=${pp.className} style=${pp.style} key=${o.id}>${o.short}</span>`; })}</span>` : null}
      </button>`; })}</div>`}
    </section>

    <${StaffImpactSection} list=${list} period=${period} />
    <${CommunityPerspectivesSection} list=${list} period=${period} />
    <${SourceComparisonSection} list=${list} />

    <details className="sec ins-rules"><summary><span>How these numbers are counted</span><${Icon} name="chev" size=${18} /></summary><div className="sec-body small">
      <p><strong>Reporting period:</strong> stories first recorded ${period} (community stories by the date they were submitted). Filters narrow it further.</p>
      <p><strong>Eligible records:</strong> internal interviews, and community stories only after an administrator approves them. Pending, rejected and withdrawn community submissions are never counted.</p>
      <p><strong>Students:</strong> each student is counted once, by student record. A story without a student record counts once under its first name. General stories (not about one student) count as stories but not students. Staff Impact stories are counted in their own section, never as students.</p>
      <p><strong>Denominators:</strong> student figures are out of the ${N} students documented in this view; evidence figures are out of the ${R} outcome records in this view.</p>
      <p><strong>Outcomes:</strong> a student counts once per area when at least one outcome record shows achievement, improvement, or a mixed or unspecified positive change, or when their metrics card says so (source not recorded, so it counts as unconfirmed). No-change and declines are shown separately. Planned or hoped-for outcomes are never counted.</p>
      <p><strong>Evidence types:</strong> independently verified (only when staff checked a record or independent document), staff-observed (an authorized ABG staff member saw it), self-reported (the person describing their own experience), community-observed (a parent, teacher, volunteer or supporter describing what they witnessed or were told), or unconfirmed or inferred. A confident account from staff is never treated as verified on its own, and agreement between several accounts is not verification either.</p>
      <p><strong>Not a representative sample:</strong> these are the students ABG staff chose to record. The figures describe them, not all ABG students, and are not rates for ABG as a whole.</p>
    </div></details>
  </div>`;
}
/* ---------- Staff & Employment Impact ---------- */
function StaffImpactSection({list, period}){
  const {nav, storiesLoaded, openSheet, readOnly} = useApp();
  const st = useMemo(() => staffImpactStats(list), [list]);
  const N = st.N;
  const show = (title, rule, rows) => openSheet(close => html`<${BehindSheet} title=${title} rule=${rule} rows=${rows} close=${close} />`);
  const of = (n, d) => d ? n + ' of ' + d : '0';
  const sigRows = id => st.sig[id].map(x => ({story: x.p.latest, lines: x.r.items.map(i => i.line)}));
  const sig = id => byId(STAFF_SIGNALS, id);
  const openSig = (id, denom, subset) => { const rows = st.sig[id].filter(x => !subset || subset.includes(x.p)); show(sig(id).label, of(rows.length, denom) + ' staff members documented' + (subset ? ' who were ABG students first' : '') + '. ' + (sig(id).desc || '') + ' Counted from the staff card or outcome records that are not unconfirmed.', rows.map(x => ({story: x.p.latest, lines: x.r.items.map(i => i.line)}))); };
  const verifiedN = id => st.sig[id].filter(x => x.r.verified).length;
  const stat = (icon, tone, value, label, sub, onClick, id) => html`<button className="stat-card ins-stat" id=${id} onClick=${onClick}><span className=${'stat-ic tone-' + tone}><${Icon} name=${icon} size=${26} /></span><span className="stat-text"><b className="tnum">${storiesLoaded ? value : '–'}</b><span className="stat-label">${label}</span><small className="muted">${sub}</small></span></button>`;
  const peopleRows = ps => ps.map(p => ({story: p.latest, lines: p.stories.length > 1 ? [{text: p.stories.length + ' stories, counted once'}] : []}));
  if (N === 0) return html`<section className="ins-section staff-ins" aria-labelledby="h-staff">
    <h2 id="h-staff" className="ins-h">Staff & Employment Impact</h2>
    <section className="card ins-card staff-empty">
      <div><h3>No Staff Impact stories ${period === 'at any time' ? 'yet' : 'in this view'}</h3><p className="small muted">Staff Impact stories record how ABG creates jobs, builds professional skills and supports careers, including for people who first came to ABG as students. Their employment and development outcomes will be counted here, one person at a time.</p></div>
      ${!readOnly ? html`<div><button className="btn btn-purple btn-sm" onClick=${() => nav('interview', {kind: 'staff'})}><${Icon} name="plus" size=${16} /> Capture a Staff Impact Story</button></div>` : null}
    </section>
  </section>`;
  const durTxt = st.durations.length ? st.avgYears + ' yrs' : 'Not documented';
  const durSub = st.durations.length ? 'Average for ' + of(st.durations.length, N) + ' staff with a known duration' + (st.durations.length > 1 ? ' (' + Math.min.apply(null, st.durations.map(x => x.n)) + ' to ' + Math.max.apply(null, st.durations.map(x => x.n)) + ' years)' : '') : 'No durations stated yet';
  const devRows = [['skills', 'Professional or artistic skill development'], ['training', 'Training or mentorship received'], ['leadership', 'Leadership responsibilities'], ['advanced', 'Promotions or expanded responsibilities'], ['furtherEd', 'Further education or certifications']];
  const empRows = [['firstJob', 'ABG was their first paid job'], ['current', 'Currently working with ABG'], ['otherJob', 'Went on to other or additional employment'], ['inField', 'Working in the arts, education or nonprofit field'], ['mentoring', 'Mentor or teach ABG students'], ['community', 'Contribute to arts education and the community']];
  const posTotal = st.positions.reduce((t, x) => t + x.n, 0);
  const F = st.former.length;
  const featured = list.filter(isStaffStory).slice().sort((a, b) => ((b.status === 'approved') - (a.status === 'approved')) || ((isFormerStudent(b) ? 1 : 0) - (isFormerStudent(a) ? 1 : 0)) || (outcomeCount(b) - outcomeCount(a)) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const seen = new Set(); const highlights = featured.filter(s => { const k = staffKey(s); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
  const pstage = (label, n, sub, rows, title, rule, tone) => html`<li className=${'pw-stage tone-' + tone}><button className="pw-btn" onClick=${() => show(title, rule, rows)}><span className="pw-n tnum">${n}</span><span className="pw-label">${label}</span><small className="muted">${sub}</small></button></li>`;
  return html`<section className="ins-section staff-ins" aria-labelledby="h-staff">
    <h2 id="h-staff" className="ins-h">Staff & Employment Impact</h2>
    <p className="tiny muted ins-hint">Counts describe the ${N} staff member${N === 1 ? '' : 's'} documented in this journal (${period}), not all ABG employees or every job ABG has created. Each person counts once, however many stories they have. Details that aren't documented are never counted as "no".</p>

    <h3 className="ins-sub">Employment overview</h3>
    <div className="ins-stats">
      ${stat('briefcase', 'purple', N, 'Staff members documented', 'Unique people with a Staff Impact story', () => show('Staff members documented', N + ' unique staff members in this view, one per staff record.', peopleRows(st.profiles)), 'si-staff')}
      ${stat('check', 'teal', of(st.sig.paid.length, N), 'Paid opportunities documented', (verifiedN('paid') ? verifiedN('paid') + ' verified by records; ' : '') + 'the rest as reported in interviews' + (st.positions.length ? '. ' + posTotal + ' position' + (posTotal === 1 ? '' : 's') + ' held, where known (' + st.positions.length + ' people)' : ''), () => openSig('paid', N), 'si-paid')}
      ${stat('calendar', 'blue', durTxt, 'Employment duration', durSub, () => show('Employment duration', 'Years working with ABG, from the staff card. Only people with a stated duration are included; nobody is counted as zero.', st.durations.map(x => ({story: x.p.latest, lines: [{text: x.n + ' year' + (x.n === 1 ? '' : 's') + ' working with ABG', tag: 'Staff card · ' + labelOf(METRIC_STATUS, x.p.card.yearsWithAbg.status)}]}))), 'si-dur')}
      ${stat('bars', 'orange', of(st.sig.advanced.length, N), 'Career advancement', 'Promoted or given expanded responsibilities', () => openSig('advanced', N), 'si-adv')}
    </div>

    <div className="ins-charts">
      <section className="card ins-card">
        <div><h3>Professional development</h3><p className="small muted">Staff members with each outcome, of ${N} documented</p></div>
        <ul className="ms-list">${devRows.map(([id, label]) => html`<li key=${id}><button className="ms-btn" onClick=${() => openSig(id, N)}><span>${label}</span><b className="tnum">${st.sig[id].length}<small className="muted"> of ${N}</small></b></button></li>`)}</ul>
      </section>
      <section className="card ins-card">
        <div><h3>Employment and community</h3><p className="small muted">Retention, first jobs, later careers and contributions to students</p></div>
        <ul className="ms-list">${empRows.map(([id, label]) => html`<li key=${id}><button className="ms-btn" onClick=${() => openSig(id, N)}><span>${label}</span><b className="tnum">${st.sig[id].length}<small className="muted"> of ${N}</small></b></button></li>`)}</ul>
      </section>
    </div>

    <section className="card ins-card pathway-card">
      <div><h3>Student-to-Staff pathways</h3><p className="small muted">Former ABG students who became staff. ${F ? 'Each stage counts only what is documented; not everyone completes every stage.' : ''}</p></div>
      ${F === 0 ? html`<p className="empty-note">No staff members in this view are recorded as former ABG students.${st.unknownBg.length ? ' ' + st.unknownBg.length + ' staff member' + (st.unknownBg.length === 1 ? "'s" : "s'") + ' student background is unknown; update their stories if you learn it.' : ''}</p>` : html`
        <ol className="pathway" aria-label="Student to staff to mentor or professional">
          ${pstage('Student', F, 'Former ABG students documented', peopleRows(st.former), 'Former ABG students who became staff', F + ' staff members are recorded as former ABG students or program participants.', 'teal')}
          ${pstage('Staff', F, st.formerPaid.length + ' with a paid opportunity documented', st.formerPaid.map(p => ({story: p.latest, lines: (st.sig.paid.find(x => x.p === p) || {r: {items: []}}).r.items.map(i => i.line)})), 'Paid transitions into ABG employment', of(st.formerPaid.length, F) + ' former students have a paid opportunity documented. The others may have been paid; it just is not documented.', 'purple')}
          ${pstage('Mentor / Professional', st.formerMentorOrPro.length, st.formerMentor.length + ' mentor or teach students', st.formerMentorOrPro.map(p => ({story: p.latest, lines: ['mentoring', 'advanced', 'otherJob', 'inField', 'leadership', 'furtherEd'].map(id => st.sig[id].find(x => x.p === p)).filter(Boolean).map(x => x.r.items[0].line)})), 'Mentors and professionals', of(st.formerMentorOrPro.length, F) + ' former students mentor or teach students, advanced at ABG, took on leadership, pursued further education or other work, or work in the arts, education or nonprofit field.', 'orange')}
        </ol>
        <ul className="cls-list pw-facts">
          <li><button className="ms-btn" onClick=${() => openSig('mentoring', F, st.former)}><span>Former students serving as mentors or instructors</span><b className="tnum">${of(st.formerMentor.length, F)}</b></button></li>
          <li><button className="ms-btn" onClick=${() => show('Long-term involvement', 'Current staff whose first participation as a student was at least 5 years ago (from the intake form).', st.longTerm.map(p => ({story: p.latest, lines: [{text: 'First participated around ' + p.info.firstParticipatedYear + '; with ABG about ' + st.span(p) + ' years'}]})))}><span>Involved with ABG for 5+ years since first participating</span><b className="tnum">${of(st.longTerm.length, F)}</b></button></li>
          <li><button className="ms-btn" onClick=${() => show('Linked to a Student Impact story', 'Staff stories linked to the same person’s Student Impact story by someone who confirmed it.', st.former.filter(p => p.linked.length).map(p => ({story: p.latest, lines: []})))}><span>Linked to their Student Impact story</span><b className="tnum">${of(st.former.filter(p => p.linked.length).length, F)}</b></button></li>
        </ul>`}
    </section>

    <section className="card ins-card">
      <div className="sec-head"><div><h3>Staff success stories</h3><p className="small muted">Highlights from this view, approved stories first. One per person.</p></div><button className="btn btn-quiet btn-sm view-all" onClick=${() => nav('library')}>View all stories <span aria-hidden="true">→</span></button></div>
      <div className="fs-grid">${highlights.map(s => { const p = st.profiles.find(x => x.key === staffKey(s)); const tags = p ? STAFF_SIGNALS.filter(g => st.sig[g.id].some(x => x.p === p)).slice(0, 3) : []; return html`<button className="fs-card" key=${s.id} onClick=${() => nav('story', {id: s.id})}>
        ${storyArt(s.id)}
        <span className="fs-main"><strong>${s.alias || s.title}${s.demo ? html` <${DemoPill} />` : null}</strong><small className="muted">${[(staffVal(s, 'role') || {}).value || (s.staffInfo || {}).role, isFormerStudent(s) ? 'Student → Staff' : ''].filter(Boolean).join(' · ')}</small><span className="fs-sum">${s.summary || s.title}</span></span>
        ${tags.length ? html`<span className="fs-tags">${tags.map(g => html`<span className="pill tone-purple" key=${g.id}>${g.label}</span>`)}</span>` : null}
      </button>`; })}</div>
    </section>

    <details className="sec ins-rules"><summary><span>How staff numbers are counted</span><${Icon} name="chev" size=${18} /></summary><div className="sec-body small">
      <p><strong>People, not positions:</strong> each staff member counts once, by staff record, however many stories they have. Positions held are counted separately and only where a number was stated.</p>
      <p><strong>Documented, not total:</strong> these are the staff members ABG chose to record. The figures are not ABG's total number of employees or every job ABG has created.</p>
      <p><strong>Paid opportunities:</strong> counted only when the staff card says paid employment or a paid stipend or internship, or an outcome record says the role was paid. Volunteer roles are not counted as paid.</p>
      <p><strong>Unknowns:</strong> a detail that isn't documented is left out of the count. It is never treated as "no" or zero.</p>
      <p><strong>Evidence:</strong> a staff-card value counts at its stated certainty (verified, reported or estimate). Outcome records count when they show achievement or a positive change and are not unconfirmed or inferred. Kyle's firsthand observations are reported, not verified employment records.</p>
      <p><strong>Former students:</strong> from the "previously an ABG student" answer on each staff story. "Unknown" is never counted as yes.</p>
    </div></details>
  </section>`;
}
function DashboardView({tab: initial}){
  const {stories, nav} = useApp();
  const demoN = stories.filter(x => x.demo).length;
  const [tab, setTab] = useState(initial || 'overview');
  const [range, setRange] = useState(() => lsGet('abg-ins-range') || '12m');
  const BLANK = {type: '', source: '', contributor: '', evidence: '', verified: '', program: '', grade: '', school: '', outcome: ''};
  const [f, setF] = useState(BLANK);
  const setFilter = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
  useEffect(() => { lsSet('abg-ins-range', range); }, [range]);
  if (tab === 'reports') return html`<div className="view">
    <div className="ins-top"><div><p className="eyebrow">Impact Insights</p><h1>Reports and exports</h1></div><button className="btn btn-ghost btn-sm" onClick=${() => setTab('overview')}><${Icon} name="back" size=${16} /> Back to insights</button></div>
    <${ReportsView} embedded=${true} />
  </div>`;
  const days = (byId(RANGES, range) || {}).days || 0;
  const since = days ? new Date(Date.now() - days * 864e5).toISOString() : '';
  const period = since ? 'from ' + fmtDate(since) + ' to today' : 'at any time';
  /* only eligible records: internal interviews, and community stories an administrator approved */
  const inRange = stories.filter(reportable).filter(s => !since || (s.createdAt || '') >= since);
  const hasClass = (s, c) => (s.evidence || []).some(e => e.status !== 'future' && evidenceClass(e) === c);
  const list = inRange.filter(s => (!f.type || storyTypeOf(s) === f.type) && (!f.source || (f.source === 'community') === isCommunity(s)) && (!f.contributor || relationshipOf(s) === f.contributor)
    && (!f.evidence || hasClass(s, f.evidence)) && (!f.verified || (f.verified === 'yes') === hasClass(s, 'verified')) && (!f.program || s.program === f.program) && (!f.school || s.community === f.school) && (!f.grade || gradeBucket(s) === f.grade) && (!f.outcome || storyOutcomes(s).has(f.outcome)));
  const programs = uniq(stories.map(s => asStr(s.program))).sort();
  const schools = uniq(stories.map(s => asStr(s.community))).sort();
  const active = Object.values(f).some(Boolean);
  const sel = (k, label, opts) => html`<label className="ins-filter"><span className="sr-only">${label}</span><select className="select" aria-label=${label} value=${f[k]} onChange=${e => setFilter(k, e.target.value)}><option value="">${label}</option>${opts.map(o => html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`)}</select></label>`;
  return html`<div className="view insights2">
    <div className="ins-top">
      <header className="ins-hello"><p className="eyebrow">Impact Insights</p><h1>Stories that show what's possible.</h1><p className="lede">Explore student and staff outcomes in your journal, how well each one is supported, and the stories behind every number.</p></header>
      <div className="ins-controls">
        <label className="range-pick"><${Icon} name="calendar" size=${18} /><select aria-label="Date range" value=${range} onChange=${e => setRange(e.target.value)}>${RANGES.map(r => html`<option key=${r.id} value=${r.id}>${r.label}</option>`)}</select></label>
        <button className="btn btn-ghost btn-sm" onClick=${() => setTab('reports')}><${Icon} name="file" size=${16} /> Reports and exports</button>
      </div>
    </div>
    ${demoN > 0 ? html`<p className="notice small demo-note"><${DemoPill} /> <span>Includes ${demoN} fictional demo stor${demoN === 1 ? 'y' : 'ies'} so you can see how Insights work. They're left out of reports and exports. <button className="link-btn" onClick=${() => nav('settings')}>Manage demo stories</button></span></p>` : null}
    <${InsightsOverview} list=${list} period=${period} filterBar=${html`<div className="filter-bar">
      <span className="filter-label">Filter by:</span>
      ${sel('type', 'Story type', [['student', 'Student Impact'], ['staff', 'Staff Impact']])}
      ${sel('source', 'Source', [['internal', 'Internal interviews'], ['community', 'Community submissions']])}
      ${sel('contributor', 'Contributor type', CONTRIBUTOR_TYPES.map(c => [c.id, c.label]))}
      ${sel('evidence', 'Evidence type', EVIDENCE_CLASSES.map(c => [c.id, c.label]))}
      ${sel('verified', 'Verification', [['yes', 'Has independently verified outcomes'], ['no', 'No verified outcomes yet']])}
      ${sel('program', 'Program', programs.map(p => [p, p]))}
      ${sel('grade', 'Grade level', GRADE_BUCKETS.map(g => [g.id, g.label]))}
      ${sel('school', 'School', schools.map(p => [p, p]))}
      ${sel('outcome', 'Outcome', ACTIVE_OUTCOMES.map(o => [o.id, o.label]))}
      ${active ? html`<button className="btn btn-quiet btn-sm" onClick=${() => setF(BLANK)}>Clear</button>` : null}
    </div>`} />
    <details className="sec ins-more"><summary><span>More evidence details: milestones, metrics card, themes<span className="count">All stories</span></span><${Icon} name="chev" size=${18} /></summary>
      <div className="sec-body"><${InsightsView} embedded=${true} /></div>
    </details>
  </div>`;
}

/* ================= story card ================= */
function StoryCard({story, why}){
  const {nav} = useApp();
  const ec = evidenceCounts(story);
  const updates = Math.max(0, (story.entryCount || 1) - 1);
  const ev = fmtEventDate(story.eventDate);
  const role = isStaffStory(story) ? ((staffVal(story, 'role') || {}).value || (story.staffInfo || {}).role || '') : '';
  const meta = [role, ev ? ev + (story.eventDate && story.eventDate.approximate ? ' (approx.)' : '') : '', story.program].filter(Boolean).join(' · ');
  const auds = (story.audiences || []).slice(0, 3).map(a => (byId(AUDIENCES, a) || {}).short || a);
  const keyOutcomes = isStaffStory(story) ? STAFF_SIGNALS.filter(g => ['paid', 'advanced', 'mentoring', 'otherJob', 'leadership', 'skills'].includes(g.id)).filter(g => staffSignal({card: Object.fromEntries(STAFF_FIELDS.filter(f => staffVal(story, f.id)).map(f => [f.id, Object.assign({storyId: story.id}, staffVal(story, f.id))])), stories: [story], latest: story}, g).hit).slice(0, 3) : [];
  const open = () => nav('story', {id: story.id});
  return html`<div className="card story-card" role="button" tabIndex="0" onClick=${open} onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
    <div className="sc-top">
      ${story.demo ? html`<${DemoPill} />` : null}
      <${TypePill} story=${story} />
      ${isTest(story) ? html`<${TestPill} />` : null}
      ${isCommunity(story) ? html`<${Pill} tone=${!isWithdrawn(story) ? 'purple' : 'bad'}>${!isWithdrawn(story) ? 'Community · ' + sourceLabel(story) : 'Withdrawn by contributor'}<//>` : null}
      <${StatusPill} status=${story.status} />
      ${story.period === 'past' ? html`<${Pill} tone="orange">Historical<//>` : null}
      ${updates > 0 ? html`<${Pill} tone="blue">${updates} update${updates > 1 ? 's' : ''}<//>` : null}
    </div>
    ${story.alias ? html`<p className="eyebrow">${story.alias}</p>` : null}
    <h3>${story.title || 'Untitled story'}</h3>
    ${meta ? html`<p className="small muted">${meta}</p>` : null}
    ${story.summary ? html`<p className="clamp">${story.summary}</p>` : html`<p className="small muted">Not analyzed yet.</p>`}
    ${why ? html`<p className="why small"><${Icon} name="spark" size=${16} /> <span>${why}</span></p>` : null}
    ${keyOutcomes.length ? html`<div className="chips">${keyOutcomes.map(g => html`<span className="chip static small chip-staff" key=${g.id}>${g.label}</span>`)}</div>`
      : (story.themes || []).length > 0 ? html`<div className="chips">${story.themes.slice(0, 3).map(t => html`<span className="chip static small" key=${t}>${labelOf(THEMES, t)}</span>`)}</div>` : null}
    ${auds.length ? html`<p className="small muted">Useful for ${auds.join(', ')}</p>` : null}
    <div className="sc-foot small muted tnum">
      <span>Updated ${fmtDate(story.updatedAt || story.createdAt)}</span>
      <span>${(story.evidence || []).length} evidence${ec.verified ? ' · ' + ec.verified + ' verified' : ''}</span>
      ${(story.materials || []).length ? html`<span>${story.materials.length} supporting material${story.materials.length > 1 ? 's' : ''}</span>` : null}
    </div>
  </div>`;
}

/* ================= home ================= */
function PaletteArt(){
  return html`<svg className="hero-art" viewBox=${PALETTE_ART_VIEWBOX} aria-hidden="true" focusable="false" dangerouslySetInnerHTML=${{__html: PALETTE_ART}}></svg>`;
}
const ROW_TONES = ['teal', 'purple', 'orange'];
function outcomeCount(s){ return (s.evidence || []).filter(e => e.status !== 'future').length; }
function RecentStoryRow({story, i}){
  const {nav} = useApp();
  const tone = ROW_TONES[i % ROW_TONES.length];
  const ov = story.overview || {};
  const name = story.alias || story.title || 'Untitled story';
  const meta = (isStaffStory(story) ? ['Staff Impact', (staffVal(story, 'role') || {}).value || (story.staffInfo || {}).role, isFormerStudent(story) ? 'former ABG student' : ''] : [story.program, ov.ageOrGrade || ov.demographics]).filter(Boolean).join(' · ');
  const n = outcomeCount(story);
  const open = () => nav('story', {id: story.id});
  return html`<div className="recent-row" role="button" tabIndex="0" onClick=${open} onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
    <span className=${'avatar avatar-lg tone-' + tone}>${initialsOf(name).slice(0, 1)}</span>
    <span className="recent-main"><strong>${name}${story.demo ? html` <${DemoPill} />` : null}</strong>${meta ? html`<small className="muted">${meta}</small>` : null}<span className="recent-sum">${story.summary || story.title || 'Not analyzed yet.'}</span></span>
    <span className="recent-side"><small className="muted">${fmtDate(story.createdAt)}</small>${n ? html`<span className=${'pill tone-' + tone}>${n} outcome${n === 1 ? '' : 's'}</span>` : null}</span>
    <${Icon} name="chev" size=${18} />
  </div>`;
}
function HomeView(){
  const {caps, stories: allStoriesShown, storiesLoaded, nav, readOnly, subs, subsState, isAdmin} = useApp();
  const stories = allStoriesShown.filter(reportable);
  const pending = subs.filter(x => x.status === 'pending_review' && !x.is_test).length;
  const first = firstNameOf(caps.me && caps.me.name) || firstNameOf(window.__platform && window.__platform.email) || firstNameOf(caps.me && caps.me.email);
  const recent = stories.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
  const studentsN = studentProfiles(stories).length;
  const staffN = staffProfiles(stories).length;
  const outcomesN = stories.reduce((t, s) => t + outcomeCount(s), 0);
  const stat = (icon, tone, label, value, sub, to) => html`<button className="stat-card" onClick=${() => nav(to)}><span className=${'stat-ic tone-' + tone}><${Icon} name=${icon} size=${26} /></span><span className="stat-text"><span className="stat-label">${label}</span><b className="tnum">${storiesLoaded ? value : '–'}</b><small className="muted">${sub}</small></span></button>`;
  return html`<div className="view home">
    <header className="hello">
      <p className="eyebrow">Impact Journal</p>
      <h1>${first ? 'Welcome back, ' + first : 'Welcome back'} <span className="wave" aria-hidden="true">👋</span></h1>
      <p className="lede">Every student has a story worth telling. Capture meaningful moments, reflect on student progress, and help show the impact of ABG's work.</p>
    </header>
    ${readOnly ? html`<p className="notice small"><strong>View-only access.</strong> Ask for Editor access to add stories.</p>` : null}
    <section className="hero-card" aria-label="Capture a story">
      <div className="hero-copy">
        <p className="hero-eyebrow">Rooted in story. Driven by love.</p>
        <h2 className="hero-title">Let's capture a story.</h2>
        <p className="hero-text">Share a student's or staff member's experience. We'll guide you through the details and outcomes that matter.</p>
        <div className="hero-actions"><button className="btn btn-purple btn-lg" disabled=${readOnly} onClick=${() => nav('interview')}><${Icon} name="plus" size=${20} /> Capture a New Story</button>
        <button className="btn btn-quiet" onClick=${() => nav('guide')}><${Icon} name="compass" size=${18} /> Interview Guide</button></div>
      </div>
      <${PaletteArt} />
    </section>
    ${stories.some(x => x.demo) ? html`<p className="notice small demo-note"><${DemoPill} /> <span>Stories marked Demo are fictional examples showing how a recorded story becomes impact evidence. <button className="link-btn" onClick=${() => nav('insights')}>See them in Impact Insights</button> or <button className="link-btn" onClick=${() => nav('settings')}>manage demo stories</button>.</span></p>` : null}
    <div className="stat-row">
      ${stat('openbook', 'purple', 'Stories captured', stories.length, 'Journal entries', 'library')}
      ${stat('users', 'teal', 'Students featured', studentsN, 'Unique students', 'library')}
      ${staffN ? stat('briefcase', 'blue', 'Staff featured', staffN, 'Unique staff members', 'insights') : null}
      ${stat('bars', 'orange', 'Outcomes recorded', outcomesN, 'Reported outcomes', 'insights')}
    </div>
    ${subsState !== 'none' ? html`<section className="card home-community">
      <div className="hc-text"><h2>Community stories</h2>
        <p className="small muted">${subsState === 'missing' ? 'The Share Your Story page is not set up on the server yet.' : pending ? pending + ' submission' + (pending === 1 ? '' : 's') + ' waiting for review.' : 'Invite students, alumni, staff, parents and volunteers to share their own stories.'}</p></div>
      <div className="row-btns">
        <button className="btn btn-ghost btn-sm" id="home-subs" onClick=${() => nav('submissions')}><${Icon} name="inbox" size=${16} /> Community Submissions${pending ? html` <span className="badge">${pending}</span>` : null}</button>
        <button className="btn btn-ghost btn-sm" onClick=${() => nav('invite')}><${Icon} name="share" size=${16} /> Invite Contributors</button>
        <button className="btn btn-ghost btn-sm" onClick=${() => nav('compare')}><${Icon} name="scale" size=${16} /> Source Comparison</button>
      </div>
    </section>` : null}
    <section className="recent">
      <div className="sec-head"><h2>Recent Stories</h2>${stories.length ? html`<button className="btn btn-quiet btn-sm view-all" onClick=${() => nav('library')}>View all <span aria-hidden="true">→</span></button>` : null}</div>
      ${!storiesLoaded ? html`<div className="skeleton"></div>`
        : recent.length ? html`<div className="recent-list">${recent.map((s, i) => html`<${RecentStoryRow} key=${s.id} story=${s} i=${i} />`)}</div>`
        : html`<div className="empty"><h3>No stories yet</h3><p className="muted">Your first story will show up here with its outcomes.</p></div>`}
    </section>
  </div>`;
}

/* ================= Interview Guide ================= */
const GUIDE_STEPS = [
  {id: 'background', title: 'Student background', prompt: 'I want to talk about a student named ___. I met them through ___ around ___. At the time, they were experiencing ___.',
    why: "Where the student started is the \"before\" that every later change is measured against.", listen: ['How you know them and roughly when you met', 'What was hard for them then, in your own words']},
  {id: 'experience', title: 'ABG experience', prompt: 'They became involved in ___, where they participated in ___. One particular experience that stood out was ___.',
    why: 'Naming the program and one real moment connects the outcome to ABG and makes the story memorable.', listen: ['The program, project or mural', 'One moment you remember clearly']},
  {id: 'changes', title: 'Meaningful changes', prompt: 'Before participating, the student ___. Over time, I noticed ___. A specific example was ___.',
    why: 'A before, an after and one example turn "they grew" into something a funder can believe.', listen: ['What they did before, and what they do now', 'One specific example you saw or heard about']},
  {id: 'outcomes', title: 'Measurable outcomes', prompt: 'In terms of school or personal progress, I know that ___. I learned this because ___.',
    why: 'How you know matters as much as what you know. "Her teacher told me" or "I saw it" both count.', listen: ['Attendance, grades, graduation, college, a job, if you know them', 'Who told you, or whether you saw it yourself']},
  {id: 'current', title: 'Current progress', prompt: 'Today, the student is ___. I believe ABG contributed by ___. The most meaningful part of their experience was ___.',
    why: 'Where they are now shows lasting impact, and your view of ABG\'s part keeps the story honest.', listen: ['What they are doing today', "What about ABG you think helped, if anything"]},
];
const GUIDE_EXAMPLES = [
  {topic: 'School attendance', vague: 'She comes to school more now.', strong: 'Her teacher told me she was missing about two days a week in the fall, and hardly any by spring.', adds: ['Before and after', 'Timeframe', 'How you know']},
  {topic: 'Academic improvement', vague: 'His grades got better.', strong: 'He was failing math last fall. His mom told me he passed the class at the end of the year.', adds: ['Before and after', 'How you know']},
  {topic: 'High school graduation', vague: 'She finished school.', strong: 'She graduated from high school in June 2024. I went to the ceremony.', adds: ['Date', 'You saw it']},
  {topic: 'Higher education', vague: "He's in college now.", strong: "He started community college last fall, studying graphic design. He told me he's the first in his family to go.", adds: ['What and when', 'How you know']},
  {topic: 'Confidence and self-expression', vague: "She's more confident.", strong: "In September she wouldn't speak in our group. By March she presented her mural design to the whole class.", adds: ['Before and after', 'A specific moment']},
  {topic: 'Leadership', vague: "He's a leader now.", strong: 'This spring he led four younger students on the library mural and ran the paint station on his own.', adds: ['What he did', 'Number, because you counted']},
  {topic: 'Community engagement', vague: "She's involved in the community.", strong: 'She volunteered at two neighborhood clean-up days this spring and brought a friend each time.', adds: ['What she did', 'Timeframe']},
];
const GUIDE_CHECKLIST = [
  {id: 'who', text: 'Who the student is and how you know them'},
  {id: 'before', text: 'What was going on for them before ABG'},
  {id: 'moments', text: 'One or two specific moments that show progress'},
  {id: 'source', text: 'How you know each change: you saw it, someone told you, or you saw it in writing'},
  {id: 'now', text: 'What they are doing now, if you know'},
  {id: 'privacy', text: 'First name only; skip last names, addresses and private details that aren\'t needed'},
  {id: 'sharing', text: 'Whether the family has said the story can be shared outside ABG'},
];
const GUIDE_STAFF = {
  before: ['Choose Capture a Story, then Staff Impact Story.', "Enter the staff member's first name and whatever background you know: current or former, their role, roughly when they started, and the employment type. All of it is optional except the first name.", 'Say whether they were an ABG student or program participant before working there. If yes, add roughly when, which program, and when they started working for ABG. "Unknown" is fine.'],
  during: ["Tell their story naturally, the way you'd tell a colleague.", 'How they became involved with ABG, and what they were doing before.', 'The employment and professional opportunities ABG gave them. Say whether a role was paid, a stipend, an internship or volunteer work, if you know.', 'Specific examples of growth, achievements or career progress: a new responsibility, a skill, a promotion, students they now mentor.', 'Answer the follow-up questions as accurately as you can.', 'Say "I don\'t know" when you don\'t. The interviewer moves on.'],
  after: ['Read the summary and transcript.', 'Check the outcomes Claude found, and how you know each one.', 'Correct anything that is inaccurate, including the staff card fields.', 'Save the story to the Impact Journal.', 'See the new outcomes under Staff & Employment Impact in Impact Insights.'],
  prompts: [
    {title: 'Opening', prompt: STAFF_OPENING_Q('___')},
    {title: 'Employment', prompt: '___ started working with ABG around ___ as a ___. It was (paid / a stipend / volunteer). Before that, they were ___.'},
    {title: 'Growth', prompt: 'Since then, they have learned ___ and taken on ___. A specific example is ___.'},
    {title: 'Former student', prompt: '___ first joined ABG as a student in ___ around ___. They moved into working for ABG when ___.'},
    {title: 'Today', prompt: 'Today, ___ is ___. They contribute to our students by ___.'},
  ],
};
function GuideSec({id, title, sub, open, children}){
  return html`<details className="sec guide-sec" id=${'g-' + id} open=${open}><summary><span>${title}${sub ? html`<span className="count">${sub}</span>` : null}</span><${Icon} name="chev" size=${18} /></summary><div className="sec-body">${children}</div></details>`;
}
function GuideContent({compact, kind}){
  const [checked, setChecked] = useState(() => { try { return JSON.parse(lsGet('abg-guide-check') || '{}') || {}; } catch (e) { return {}; } });
  const tick = (k, v) => { const n = Object.assign({}, checked, {[k]: v}); setChecked(n); lsSet('abg-guide-check', JSON.stringify(n)); };
  const done = GUIDE_CHECKLIST.filter(c => checked[c.id]).length;
  return html`<div className="guide-body">
    <${GuideSec} id="start" title="Getting started" open=${!compact}>
      <div className="guide-cards">
        <div className="guide-card"><h3>Why we record stories</h3><p>Each story keeps a student's experience on record, in your words, so ABG can show what its programs make possible.</p></div>
        <div className="guide-card"><h3>How stories become evidence</h3><p>The journal pulls out the changes you describe and how you know them. Those add up in Impact Insights and reports for donors, grants and schools.</p></div>
        <div className="guide-card"><h3>Just talk</h3><p>Speak naturally, the way you'd tell a colleague. You don't need every answer. "I don't know" is a perfectly good answer.</p></div>
        <div className="guide-card"><h3>Protect privacy</h3><p>Use first names only. Stories stay internal until someone approves them, and names are shared outside ABG only with permission.</p></div>
        <div className="guide-card"><h3>Two kinds of story</h3><p>A Student Impact Story is about a student's growth. A Staff Impact Story is about how ABG has shaped someone's work and career, including staff who were once ABG students.</p></div>
      </div>
    <//>
    <${GuideSec} id="staff" title="Staff Impact Stories" sub="before, during, after" open=${!!compact && kind === 'staff'}>
      <p className="small">ABG's impact reaches beyond the classroom: jobs, professional growth and careers, sometimes for people who first came to ABG as students. A Staff Impact Story records that.</p>
      <div className="guide-cards guide-staff">
        <div className="guide-card"><h3>Before the interview</h3><ol className="small guide-list">${GUIDE_STAFF.before.map(t => html`<li key=${t}>${t}</li>`)}</ol></div>
        <div className="guide-card"><h3>During the interview</h3><ul className="small guide-list">${GUIDE_STAFF.during.map(t => html`<li key=${t}>${t}</li>`)}</ul></div>
        <div className="guide-card"><h3>After the interview</h3><ol className="small guide-list">${GUIDE_STAFF.after.map(t => html`<li key=${t}>${t}</li>`)}</ol></div>
      </div>
      <p className="notice small guide-warn"><strong>You don't need employment records.</strong> Your firsthand observations are exactly what the journal needs. They are saved as staff-reported observations and are never presented as formally verified employment statistics. Mark something Verified only after checking it against a record.</p>
      <details className="guide-step"><summary><span className="step-title">Optional prompts for a staff story</span><${Icon} name="chev" size=${16} /></summary>
        <div className="step-body">${GUIDE_STAFF.prompts.map(x => html`<div key=${x.title} className="gs-prompt"><p className="eyebrow">${x.title}</p><blockquote className="guide-prompt">${x.prompt}</blockquote><div className="row-btns"><${CopyButton} text=${x.prompt} label="Copy prompt" /></div></div>`)}</div>
      </details>
    <//>
    <${GuideSec} id="community" title="Community stories: review and compare" sub="for ABG staff" open=${false}>
      <p className="small">Students, alumni, staff, parents, volunteers and friends can share their own stories on the Share Your Story page. Their interviews go through the same outcome extraction as yours, then wait for an administrator.</p>
      <div className="guide-cards guide-staff">
        <div className="guide-card"><h3>Review a submission</h3><ol className="small guide-list"><li>Open Community Submissions and pick one under Pending review.</li><li>Read the contributor's answers in the transcript.</li><li>Check each outcome Claude found against their words. Remove anything they didn't really say, and fix the story type if needed.</li><li>Approve it for internal reporting, ask the contributor a question, or exclude it (for example as a duplicate).</li></ol></div>
        <div className="guide-card"><h3>Evidence and sharing</h3><ul className="small guide-list"><li>Someone describing their own experience is a <strong>self-reported</strong> outcome. A parent, volunteer or friend describing what they saw is <strong>community-observed</strong>.</li><li>Nothing is <strong>independently verified</strong> until someone at ABG checks a record.</li><li>Internal approval is not permission to publish. Public use follows the contributor's own choice, and never names someone under 18.</li></ul></div>
        <div className="guide-card"><h3>Source Comparison</h3><ul className="small guide-list"><li>When your interview and a community story may describe the same person, the journal lists them as a possible match. It never links them for you.</li><li>Compare the accounts, then link them only if you know it's the same person. Mark them consistent, complementary, conflicting or insufficient evidence.</li><li>Linked accounts count as one person. Conflicting accounts stay visible as told.</li></ul></div>
      </div>
      <p className="notice small guide-warn"><strong>Don't overstate the evidence.</strong> Count people, not stories. Several people saying the same thing makes a story stronger but doesn't verify it. Journal figures describe the people who shared stories, not all ABG participants.</p>
    <//>
    <${GuideSec} id="portal" title="The Share Your Story page" sub="what contributors see" open=${false}>
      <p className="small">Plain-language answers you can pass on to anyone you invite. The same points appear on the page itself.</p>
      <ul className="small guide-list">
        <li><strong>What it is:</strong> a short, guided conversation about how ABG has made a difference, for students, alumni, staff, parents, volunteers and friends. No account is needed.</li>
        <li><strong>Why ABG asks:</strong> to understand and show funders, schools and partners the difference its programs make.</li>
        <li><strong>How to begin:</strong> open the link or scan the QR code, press Share My Story, and answer a few questions about how you know ABG.</li>
        <li><strong>Talk or type:</strong> answer out loud (your words become text and the recording is deleted) or type in a chat. Both work the same way.</li>
        <li><strong>Skip anything:</strong> every question can be skipped, and "I don't know" is a fine answer.</li>
        <li><strong>How it's used:</strong> ABG staff read every story. It's only shared publicly if the contributor says yes, and never with the name of anyone under 18.</li>
        <li><strong>Changes later:</strong> after sending, contributors get a private link to check the status, answer ABG's questions, correct their story or ask for it to be removed.</li>
        <li><strong>Under 18:</strong> students under 18 need a personal invitation from ABG, created after a parent or guardian gives permission.</li>
        <li><strong>Looks the same everywhere:</strong> the page always uses ABG's light cream design, even on phones set to dark mode.</li>
      </ul>
    <//>
    <${GuideSec} id="preview" title="Preview Mode and Portal Access" sub="authorized consultants" open=${false}>
      <p className="small">Accounts on the server's preview list (currently Jacob Pajimola, who must also be an active administrator) see <strong>Settings › Portal Access</strong>. Nobody else sees it, and the server checks again before it accepts any test story.</p>
      <ol className="small guide-list">
        <li>Open Settings › Portal Access, choose Community Story Portal and press <strong>Switch Portal</strong>. You stay signed in.</li>
        <li>The Share Your Story page opens in <strong>Preview Mode</strong>, with a Preview menu at the top. Complete the interview by voice or typing, exactly as a contributor would.</li>
        <li>Stories you send are tests. They appear under <strong>Community Submissions › Test submissions</strong>, labeled Test, where you can review and even approve them to check the result.</li>
        <li>Test stories never count in Impact Insights, home totals, Source Comparison or exports, can't be shared, and are deleted automatically after 30 days.</li>
        <li>To send a real story from the same browser, choose <strong>Exit Preview Mode</strong> in the Preview menu and confirm. To go back, choose <strong>Return to Staff Dashboard</strong>.</li>
      </ol>
    <//>
    <${GuideSec} id="script" title=${'Guided storytelling script' + (kind === 'staff' ? ' (student stories)' : '')} sub="5 prompts, optional" open=${!!compact && kind !== 'staff'}>
      <p className="small muted">Use these as a guide if it helps. You don't need to read them word for word, follow the order, or fill every blank.</p>
      <ol className="guide-steps">${GUIDE_STEPS.map((st, i) => html`<li key=${st.id}><details className="guide-step" open=${i === 0}>
        <summary><span className="step-num">${i + 1}</span><span className="step-title">${st.title}</span><${Icon} name="chev" size=${16} /></summary>
        <div className="step-body">
          <blockquote className="guide-prompt">${st.prompt}</blockquote>
          <div className="row-btns"><${CopyButton} text=${st.prompt} label="Copy prompt" /></div>
          <p className="small"><strong>Why it helps:</strong> ${st.why}</p>
          <ul className="small guide-listen">${st.listen.map(l => html`<li key=${l}>${l}</li>`)}</ul>
        </div>
      </details></li>`)}</ol>
    <//>
    <${GuideSec} id="strong" title="What makes a strong impact story?" open=${false}>
      <p className="small">Specific beats general. Four things make an observation credible:</p>
      <ul className="guide-keys small">
        <li><strong>Before and after:</strong> what it was like, and what changed.</li>
        <li><strong>When:</strong> a rough timeframe, like "by spring" or "senior year".</li>
        <li><strong>Numbers, only if you know them:</strong> "missing about two days a week" is great if that's what you were told.</li>
        <li><strong>How you know:</strong> you saw it, the student or a teacher told you, or you saw it in writing.</li>
      </ul>
      <p className="notice small guide-warn">Never guess a number or stretch an improvement. "It got better, but I don't know by how much" is more useful than a figure you're unsure of, and it keeps ABG's reports trustworthy.</p>
      <div className="guide-examples">${GUIDE_EXAMPLES.map(x => html`<div className="gx" key=${x.topic}>
        <p className="eyebrow">${x.topic}</p>
        <div className="gx-pair">
          <div className="gx-vague"><span className="gx-tag">General</span><p>"${x.vague}"</p></div>
          <div className="gx-strong"><span className="gx-tag">Specific</span><p>"${x.strong}"</p></div>
        </div>
        <p className="gx-adds small">${x.adds.map(a => html`<span className="chip static small" key=${a}>${a}</span>`)}</p>
      </div>`)}</div>
      <p className="small muted">Examples are made up for illustration.</p>
    <//>
    <${GuideSec} id="prep" title="Before you record" sub=${done ? done + ' of ' + GUIDE_CHECKLIST.length : 'optional'} open=${false}>
      <p className="small muted">A quick, optional checklist. Skip anything you don't know; the interview will help fill gaps.</p>
      <ul className="guide-check">${GUIDE_CHECKLIST.map(c => html`<li key=${c.id}><label className="check"><input type="checkbox" checked=${!!checked[c.id]} onChange=${e => tick(c.id, e.target.checked)} /> ${c.text}</label></li>`)}</ul>
      ${done ? html`<button className="btn btn-quiet btn-sm" onClick=${() => { setChecked({}); lsSet('abg-guide-check', '{}'); }}>Clear checklist</button>` : null}
    <//>
  </div>`;
}
function GuideView(){
  const {nav, readOnly} = useApp();
  return html`<div className="view guide">
    <header className="ins-hello guide-head">
      <p className="eyebrow">Interview Guide</p>
      <h1>Record a story with confidence.</h1>
      <p className="lede">Short tips for telling a student's or staff member's story in a way that's true to them and useful for ABG's impact reporting.</p>
      <div className="row-btns"><button className="btn btn-purple" disabled=${readOnly} onClick=${() => nav('interview')}><${Icon} name="plus" size=${18} /> Capture a Story</button></div>
    </header>
    <${GuideContent} />
    <div className="guide-foot"><p className="small muted">Ready? The interview asks follow-up questions for anything that's missing.</p><button className="btn btn-purple" disabled=${readOnly} onClick=${() => nav('interview')}><${Icon} name="plus" size=${18} /> Capture a Story</button></div>
  </div>`;
}
/* side panel during capture: a sibling of the recorder, so opening or closing it never touches a recording */
function GuidePanel({onClose, kind}){
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return html`<aside className="guide-panel" role="complementary" aria-label="Interview Guide">
    <div className="gp-head"><div><p className="eyebrow">Interview Guide</p><p className="small muted">Your recording keeps going while this is open.</p></div><button className="icon-btn" onClick=${onClose} aria-label="Close guide"><${Icon} name="close" /></button></div>
    <div className="gp-body"><${GuideContent} compact=${true} kind=${kind} /></div>
  </aside>`;
}
function GuideButton({open, onToggle}){
  return html`<button type="button" className="btn btn-ghost btn-sm guide-btn" aria-expanded=${open} onClick=${onToggle}><${Icon} name="compass" size=${16} /> ${open ? 'Hide guide' : html`<span className="gb-long">View Interview Guide</span><span className="gb-short" aria-hidden="true">Guide</span>`}</button>`;
}

/* ================= recording building blocks ================= */
function FocusHeader({title, sub, onBack, action}){
  return html`<header className="focus-head"><button className="icon-btn" onClick=${onBack} aria-label="Back"><${Icon} name="back" /></button><div className="focus-title"><h1 className="h-focus">${title}</h1>${sub ? html`<p className="small muted">${sub}</p>` : null}</div>${action ? html`<div className="focus-action">${action}</div>` : null}</header>`;
}
function Analyzing({onStop, title, body}){
  return html`<div className="card analyzing" role="status">
    <div className="paint-dots" aria-hidden="true"><span></span><span></span><span></span></div>
    <h2>${title || 'Claude is writing the story'}</h2>
    <p className="muted">${body || 'Writing the impact story and finding takeaways, evidence, missing metrics, and timeline moments. This usually takes 20 to 60 seconds. Your words stay saved as a draft on this device.'}</p>
    <button className="btn btn-ghost" onClick=${onStop}>Stop</button>
  </div>`;
}
/* text box with a real recorder: records audio, saves it, transcribes it, and appends the words */
/* one microphone stream shared across answers: phones ask for permission per stream, so an interview reuses it,
   and it is released 30 seconds after the last recording (the browser's mic indicator turns off then) */
const MIC = (() => {
  let stream = null, timer = null;
  const live = () => stream && stream.getAudioTracks().some(t => t.readyState === 'live');
  const stopNow = () => { clearTimeout(timer); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  return {
    async get(){ clearTimeout(timer); if (live()) return stream; stopNow(); stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); return stream; },
    release(){ clearTimeout(timer); timer = setTimeout(stopNow, 30000); },
    stopNow,
  };
})();
function micBlockedHelp(){
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'Microphone access is off for this site. In Safari, tap the aA button in the address bar, then Website Settings, and set Microphone to Allow. Or type your answer instead.';
  if (/Android/.test(ua)) return 'Microphone access is off for this site. Tap the icon next to the web address, then Permissions, and allow the microphone. Or type your answer instead.';
  return 'Microphone access is off for this site. Click the icon next to the web address, allow the microphone, then try again. Or type your answer instead.';
}
function pickMime(){
  try {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
      for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']) if (MediaRecorder.isTypeSupported(t)) return t;
    }
  } catch (e) {}
  return '';
}
function Waveform({analyser}){
  const ref = useRef(null);
  useEffect(() => {
    if (!analyser || !ref.current) return;
    const cv = ref.current, ctx = cv.getContext('2d');
    const color = getComputedStyle(document.documentElement).getPropertyValue('--orange').trim() || '#DD7F4E';
    const buf = new Uint8Array(analyser.fftSize);
    const hist = new Array(48).fill(0.04);
    let raf, last = 0;
    const draw = t => {
      raf = requestAnimationFrame(draw);
      if (t - last < 70) return; last = t;
      analyser.getByteTimeDomainData(buf);
      let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
      hist.shift(); hist.push(Math.max(0.04, Math.min(1, peak * 1.8)));
      const w = cv.width = cv.clientWidth * (window.devicePixelRatio || 1), h = cv.height = cv.clientHeight * (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = color;
      const bw = w / hist.length;
      hist.forEach((v, i) => { const bh = Math.max(2, v * h); ctx.fillRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh); });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);
  return html`<canvas ref=${ref} className="wave" aria-hidden="true"></canvas>`;
}
function AudioClip({path, label}){
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');
  const P = window.__platform;
  if (!P) return null;
  if (src) return html`<audio className="clip" controls preload="metadata" src=${src}></audio>`;
  return html`<span className="clip-row"><button type="button" className="btn btn-ghost btn-sm" onClick=${async () => { try { setSrc(await P.audio.url(path)); } catch (e) { setErr("The recording couldn't be loaded."); } }}><${Icon} name="mic" size=${16} /> ${label || 'Play recording'}</button>${err ? html`<span className="small warn-note">${err}</span>` : null}</span>`;
}
function DictationBox({id, value, onChange, placeholder, label, compact, onAudio, onBusy}){
  const P = window.__platform;
  const [mode, setMode] = useState('idle'); // idle | recording | paused | working
  const [secs, setSecs] = useState(0);
  const [analyser, setAnalyser] = useState(null);
  const [err, setErr] = useState('');
  const [retry, setRetry] = useState(null);
  const valueRef = useRef(value); valueRef.current = value;
  const rec = useRef({});
  const fileRef = useRef(null);
  const canRecord = !!(P && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  useEffect(() => { if (onBusy) onBusy(mode !== 'idle'); }, [mode]);
  useEffect(() => {
    if (mode !== 'recording') return;
    const i = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(i);
  }, [mode]);
  useEffect(() => {
    const warn = e => { if (rec.current.mr && rec.current.mr.state !== 'inactive') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); cleanup(true); };
  }, []);
  function cleanup(discard){
    const r = rec.current;
    if (discard && r.mr && r.mr.state !== 'inactive') { r.discard = true; try { r.mr.stop(); } catch (e) {} }
    if (r.stream) MIC.release();
    if (r.ctx) { try { r.ctx.close(); } catch (e) {} }
    rec.current = discard ? {} : {mr: r.mr};
    setAnalyser(null);
  }
  async function processBlob(blob, seconds){
    setMode('working'); setErr(''); setRetry(null);
    let path = null;
    try {
      path = await P.audio.upload(blob);
      if (onAudio) onAudio({path, seconds: seconds || null, at: nowISO()});
      const text = await P.audio.transcribe(path);
      if (text) { const cur = valueRef.current || ''; onChange(cur.trim() ? cur.trimEnd() + '\n\n' + text : text); }
      else setErr('No speech was detected in that recording.');
    } catch (e) {
      if (path) { setErr("The recording is saved, but it couldn't be transcribed. Try again, or type the answer."); setRetry(path); }
      else setErr("The recording couldn't be saved. Check your connection and try again. Nothing was lost from the text box.");
    }
    setMode('idle');
  }
  async function retryTranscribe(){
    const path = retry; setMode('working'); setErr('');
    try { const text = await P.audio.transcribe(path); const cur = valueRef.current || ''; onChange(cur.trim() ? cur.trimEnd() + '\n\n' + text : text); setRetry(null); }
    catch (e) { setErr("Still couldn't transcribe it. The recording is saved with the story; you can type the answer instead."); }
    setMode('idle');
  }
  async function start(){
    VOICE.stop();
    setErr('');
    let stream;
    try { stream = await MIC.get(); }
    catch (e) { setErr(e && e.name === 'NotFoundError' ? 'No microphone was found on this device. You can type your answer instead.' : micBlockedHelp()); return; }
    const mime = pickMime();
    let mr;
    try { mr = new MediaRecorder(stream, mime ? {mimeType: mime, audioBitsPerSecond: 32000} : {audioBitsPerSecond: 32000}); }
    catch (e) { mr = new MediaRecorder(stream); }
    const chunks = [];
    mr.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    mr.onstop = () => {
      const discard = rec.current.discard;
      const seconds = rec.current.secs;
      cleanup(false);
      if (discard) return;
      const blob = new Blob(chunks, {type: mr.mimeType || mime || 'audio/webm'});
      if (blob.size < 1200) { setMode('idle'); setErr('That recording was too short.'); return; }
      processBlob(blob, seconds);
    };
    let an = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC(); const src = ctx.createMediaStreamSource(stream);
      an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      rec.current = {mr, stream, ctx};
    } catch (e) { rec.current = {mr, stream}; }
    mr.start(1000);
    setSecs(0); setAnalyser(an); setMode('recording');
  }
  function pause(){ const mr = rec.current.mr; if (mr && mr.state === 'recording') { mr.pause(); setMode('paused'); } }
  function resume(){ const mr = rec.current.mr; if (mr && mr.state === 'paused') { mr.resume(); setMode('recording'); } }
  function stop(){ const mr = rec.current.mr; if (mr && mr.state !== 'inactive') { rec.current.secs = secs; mr.stop(); setMode('working'); } }
  function onFile(e){
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > P.audio.maxBytes) { setErr('That file is larger than 25 MB. Split it into shorter recordings, or paste a transcript instead.'); return; }
    processBlob(f, null);
  }
  const live = mode === 'recording';
  return html`<div className=${'composer-surface' + (live ? ' is-live' : '')}>
    <div className="rec-bar">
      ${mode === 'idle' ? html`
        ${canRecord ? html`<button type="button" className="rec-btn" onClick=${start}><span className="rec-btn-dot"></span> Record</button>` : null}
        <span className="small muted">${canRecord ? 'Record your answer, or type below.' : 'Recording isn’t supported in this browser. Type or dictate below.'}</span>
        ${P ? html`<button type="button" className="btn btn-quiet btn-sm rec-upload" onClick=${() => fileRef.current && fileRef.current.click()}>Upload a recording</button><input ref=${fileRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg" hidden onChange=${onFile} />` : null}
      ` : mode === 'working' ? html`
        <span className="paint-dots small-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span className="status-label" aria-live="polite">Saving and transcribing…</span>
      ` : html`
        <span className=${'rec-dot' + (live ? ' live' : '')} aria-hidden="true"></span>
        <span className="status-label" aria-live="polite">${live ? 'Recording' : 'Paused'}</span>
        <span className="tnum rec-time">${mmss(secs)}</span>
        <${Waveform} analyser=${analyser} />
        ${live ? html`<button type="button" className="btn btn-ghost btn-sm" onClick=${pause}>Pause</button>` : html`<button type="button" className="btn btn-ghost btn-sm" onClick=${resume}>Resume</button>`}
        <button type="button" className="btn btn-primary btn-sm" onClick=${stop}>Stop</button>
      `}
    </div>
    ${err ? html`<p className="rec-err small" role="alert">${err}${retry ? html` <button type="button" className="btn btn-quiet btn-sm" onClick=${retryTranscribe}>Try again</button>` : null}</p>` : null}
    <textarea id=${id} className="composer-ta" style=${compact ? {minHeight: '24vh'} : null} value=${value} onChange=${e => onChange(e.target.value)} placeholder=${placeholder || 'Press Record and start talking, or type here.'} aria-label=${label || 'Your answer'}></textarea>
    <div className="rec-foot small muted tnum">${words(value)} words · you can edit the transcript before continuing</div>
  </div>`;
}

/* saves an entry without Claude analysis (new story or added to an existing one) */
async function markBacklogRecorded(db, backlogId, storyId, studentId){
  if (!backlogId) return;
  try { await db.collection('backlog').doc(backlogId).update({status: 'recorded', storyId: storyId, studentId: studentId || null, recordedAt: nowISO()}); } catch (e) { /* the list item was removed; the story is still saved */ }
}
async function saveRawEntry({caps, safeWrite, story, entry, title, whenText, approx, newStudent, studentId, studentName, followupId, backlogId, studentInfo, kind, newStaff, staffId, staffInfo}){
  const db = caps.db; const me = caps.me || {};
  const sid = story ? story.id : uid('s');
  const ed = Object.assign({}, entry, {storyId: sid}); delete ed.id;
  const ok = await safeWrite(async () => {
    if (newStudent) { const sd = Object.assign({}, newStudent); delete sd.id; await db.collection('students').doc(newStudent.id).set(sd); }
    if (newStaff) { const sd = Object.assign({}, newStaff); delete sd.id; await db.collection('staff').doc(newStaff.id).set(sd); }
    await db.collection('entries').doc(entry.id).set(ed);
    if (story) {
      const patch = {entryCount: (story.entryCount || 1) + 1, updatedAt: nowISO(), updatedBy: me.id || null};
      if (followupId) patch.followUps = clone(story.followUps || []).map(f => f.id === followupId ? Object.assign(f, {status: 'done', entryId: entry.id}) : f);
      await db.collection('stories').doc(sid).update(patch);
    } else {
      const s = blankStory(me);
      s.title = title; s.alias = studentName || ''; s.studentId = kind === 'staff' ? null : (studentId || null);
      s.eventDate = {text: whenText || '', iso: '', approximate: !!approx};
      if (kind === 'staff') { s.storyType = 'staff'; s.staffId = staffId || null; s.staffInfo = cleanStaffInfo(staffInfo); s.staffCard = intakeCard(s.staffInfo); s.journey = []; s.journeySummary = ''; }
      else if (studentInfo) { s.overview = Object.assign({}, s.overview, {gender: studentInfo.gender || '', demographics: studentInfo.demographics || ''}); if (studentInfo.school) s.community = studentInfo.school; }
      const sd = Object.assign({}, s); delete sd.id;
      await db.collection('stories').doc(sid).set(sd);
    }
    await markBacklogRecorded(db, backlogId, sid, studentId);
  });
  return ok ? sid : null;
}

/* ================= general story composer (programs, murals, partnerships) ================= */
function ComposerView({params}){
  const {caps, stories, storiesLoaded, nav, readOnly, safeWrite, showToast, storyById, openSheet} = useApp();
  const storyId = params.storyId || null;
  const story = storyId ? storyById(storyId) : null;
  const draftKey = 'abg-draft:' + (storyId || 'new');
  const stored = useMemo(() => { try { return JSON.parse(lsGet(draftKey) || 'null') || {}; } catch (e) { return {}; } }, [draftKey]);
  /* an unfinished general story is offered (Resume Draft / Start New Story), never reopened by itself */
  const [choosing, setChoosing] = useState(() => !storyId && !params.resume && !params.fresh && !!(stored.text || (stored.clips || []).length));
  const initial = choosing || params.fresh ? {} : stored;
  const [text, setText] = useState(initial.text || '');
  const [when, setWhen] = useState(initial.when || '');
  const [approx, setApprox] = useState(!!initial.approx);
  const [pIdx, setPIdx] = useState(0);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [clips, setClips] = useState(initial.clips || []);
  const [recBusy, setRecBusy] = useState(false);
  const ctlRef = useRef(null);
  const restored = !!initial.text && !params.resume;
  const recFlush = useRef(null), recEnded = useRef(false);
  const basePrompt = params.prompt || (storyId ? UPDATE_PROMPT : PROMPTS[0]);
  const prompt = pIdx === 0 ? basePrompt : PROMPTS[pIdx % PROMPTS.length];
  useEffect(() => {
    const write = () => { if (choosing || recEnded.current) return; if (text.trim() || when.trim() || clips.length) lsSet(draftKey, JSON.stringify({text, when, approx, clips, at: Date.now()})); else lsDel(draftKey); };
    recFlush.current = write;
    const t = setTimeout(write, 350);
    return () => clearTimeout(t);
  }, [text, when, approx, clips, draftKey, choosing]);
  useEffect(() => () => { if (!recEnded.current && recFlush.current) recFlush.current(); }, []);
  const unsavedText = !!(text.trim() || clips.length);
  const startNew = () => {
    const go = () => { recEnded.current = true; if (ctlRef.current) ctlRef.current.abort(); lsDel(draftKey); nav('interview', {fresh: true}); };
    if (!unsavedText) { go(); return; }
    openSheet(close => html`<${ConfirmSheet} close=${close} title="Start a new story?" body="Your current unsaved progress will be lost." confirmLabel="Start New Story" onConfirm=${go} />`);
  };
  useEffect(() => () => { if (ctlRef.current) ctlRef.current.abort(); }, []);
  const hasText = !!text.trim();
  function makeEntry(){
    return { id: uid('e'), storyId: story ? story.id : null, recordedAt: nowISO(), eventDateText: when.trim(), eventApprox: approx, prompt: prompt,
      transcript: text.trim(), audio: clips, transcriptEdited: null, summary: '', takeaways: [], source: params.followupId ? 'followup-task' : 'journal', analyzed: false,
      createdBy: (caps.me && caps.me.id) || null };
  }
  async function analyze(){
    if (!hasText || !caps.sample) return;
    setErr(''); setBusy('analyze');
    const ctl = new AbortController(); ctlRef.current = ctl;
    const entry = makeEntry();
    const items = [{id: entry.id, text: entry.transcript, recordedAt: entry.recordedAt}];
    try {
      const analysis = await runAnalysis({sample: caps.sample, mode: story ? 'update' : 'new', story, stories, items, whenHint: when.trim(), signal: ctl.signal});
      ctlRef.current = null;
      nav('review', {mode: story ? 'update' : 'new', storyId: story ? story.id : null, analysis, entry, items, draftKey, whenHint: when.trim(), approx, followupId: params.followupId || null, returnTo: {name: 'record', params}});
    } catch (e) {
      ctlRef.current = null; setBusy(null);
      if (e && e.code === 'cancelled') return;
      setErr(aiErrorMessage(e));
    }
  }
  async function saveRaw(){
    if (!hasText) return;
    setBusy('save');
    const sid = await saveRawEntry({caps, safeWrite, story, entry: makeEntry(), title: titleFromText(text), whenText: when.trim(), approx, followupId: params.followupId});
    setBusy(null);
    if (sid) { recEnded.current = true; lsDel(draftKey); showToast(story ? 'Update saved' : 'Story saved'); nav('story', {id: sid}); }
  }
  const back = () => story ? nav('story', {id: story.id}) : nav('home');
  const [guideOpen, setGuideOpen] = useState(false);
  const title = story ? 'Add Story Update' : 'Record a general story';
  if (readOnly) return html`<div className="view"><${FocusHeader} title=${title} onBack=${() => nav('home')} /><p className="notice">You have view-only access to this journal. Ask the person who shared it for Editor access to record stories.</p></div>`;
  if (storyId && !story) return html`<div className="view"><${FocusHeader} title=${title} onBack=${() => nav('library')} />${storiesLoaded ? html`<p className="notice">This story isn't in the journal anymore.</p>` : html`<div className="skeleton"></div>`}</div>`;
  if (busy === 'analyze') return html`<div className="view"><${FocusHeader} title=${title} sub=${story ? story.title : null} onBack=${() => ctlRef.current && ctlRef.current.abort()} /><${Analyzing} onStop=${() => ctlRef.current && ctlRef.current.abort()} /></div>`;
  if (choosing) return html`<div className="view composer">
    <${FocusHeader} title=${title} sub="You have an unfinished general story on this device" onBack=${back} />
    <section className="card draft-card">
      <p><strong>Unfinished draft</strong> <span className="small muted">from ${fmtDate(new Date(stored.at || Date.now()).toISOString())}</span></p>
      <p className="small muted draft-preview">${asStr(stored.text).slice(0, 160)}${asStr(stored.text).length > 160 ? '…' : ''}</p>
      <div className="row-btns"><button className="btn btn-primary" id="rec-resume" onClick=${() => nav('record', Object.assign({}, params, {resume: true}))}>Resume Draft</button>
        <button className="btn btn-ghost" id="rec-start-new" onClick=${() => openSheet(close => html`<${ConfirmSheet} close=${close} title="Start a new story?" body="Your current unsaved progress will be lost." confirmLabel="Start New Story" onConfirm=${() => { recEnded.current = true; lsDel(draftKey); nav('record', {fresh: true}); }} />`)}>Start New Story</button></div>
    </section>
  </div>`;
  return html`<div className="view composer">
    <${FocusHeader} title=${title} sub=${story ? story.title : 'For programs, murals, partnerships, and community moments. For a student, start a student story instead.'} onBack=${back} action=${html`<div className="focus-actions"><button type="button" className="btn btn-ghost btn-sm new-story-btn" id="rec-new-story" onClick=${startNew}><${Icon} name="plus" size=${16} /> <span className="nsb-long">Start New Story</span><span className="nsb-short" aria-hidden="true">New story</span></button><${GuideButton} open=${guideOpen} onToggle=${() => setGuideOpen(o => !o)} /></div>`} />
    ${guideOpen ? html`<${GuidePanel} onClose=${() => setGuideOpen(false)} />` : null}
    <div className="prompt-card">
      <p className="prompt-text">${prompt}</p>
      <button type="button" className="btn btn-quiet btn-sm" onClick=${() => setPIdx(i => i + 1)}>Try another prompt</button>
    </div>
    <${DictationBox} id="story-text" value=${text} onChange=${setText} label="Your story" onAudio=${c => setClips(x => x.concat([c]))} onBusy=${setRecBusy} />
    <p className="tip small muted"><${Icon} name="mic" size=${16} /><span>Talk naturally. Names of programs, numbers, and what changed are the most useful details. Recorded earlier? Use Upload a recording.</span></p>
    <${Sec} title="When did this happen?" count="Optional" open=${!!when}>
      <${Field} label="When" hint="Leave blank for today. Approximate is fine."><input id="story-when" className="input" value=${when} placeholder="e.g. last Tuesday, spring 2018, around 2015" onChange=${e => setWhen(e.target.value)} /><//>
      <label className="check"><input id="story-approx" type="checkbox" checked=${approx} onChange=${e => setApprox(e.target.checked)} /> The date is approximate</label>
    <//>
    ${err ? html`<p className="error" role="alert">${err}</p>` : null}
    ${!caps.sample ? html`<p className="notice small">Claude analysis isn't available in this view, so this entry will be saved without a summary. You can analyze it later from the story page.</p>` : null}
    ${restored || params.resume ? html`<p className="small muted">${params.resume ? 'Resumed your draft. It stays saved on this device until you save the story.' : 'Restored your unsaved draft from this device.'}</p>` : null}
    <div className="savebar"><div className="inner">
      <button className="btn btn-ghost" onClick=${saveRaw} disabled=${!hasText || !!busy || recBusy}>${busy === 'save' ? 'Saving…' : 'Save without analysis'}</button>
      ${caps.sample ? html`<button className="btn btn-primary" onClick=${analyze} disabled=${!hasText || !!busy || recBusy}><${Icon} name="spark" size=${18} /> Analyze with Claude</button>` : null}
    </div></div>
  </div>`;
}

/* ================= student interview ================= */
function turnsToText(turns){ return turns.map(t => 'Q: ' + t.q + '\nA: ' + (t.status === 'skipped' ? '(skipped)' : t.a)).join('\n\n'); }
function InterviewView({params}){
  const {caps, stories, students, staffPeople, storiesLoaded, settings, nav, readOnly, safeWrite, showToast, storyById, openSheet} = useApp();
  const storyId = params.storyId || null;
  const story = storyId ? storyById(storyId) : null;
  const mode = storyId ? 'update' : 'new';
  /* a brand-new story is its own session (see ivDrafts); story updates and student-list interviews keep their own key */
  const plainNew = mode === 'new' && !params.backlogId && !params.followupId;
  const [drafts, setDrafts] = useState(() => plainNew ? ivDrafts() : []);
  const resumeDraft = plainNew && params.resume ? drafts.find(d => d.id === params.resume) || null : null;
  const [choosing, setChoosing] = useState(() => plainNew && !params.resume && !params.fresh && !params.kind && drafts.length > 0);
  const [sid] = useState(() => resumeDraft ? resumeDraft.id : uid('iv'));
  const draftKey = plainNew ? 'ivd:' + sid : 'abg-interview:' + (storyId || (params.backlogId ? 'bl-' + params.backlogId : 'new'));
  const init = useMemo(() => { if (plainNew) return resumeDraft ? resumeDraft.state : null; try { return JSON.parse(lsGet(draftKey) || 'null') || null; } catch (e) { return null; } }, [draftKey]);
  const fresh = !init || (params.followupId && init.followupId !== params.followupId) || (params.backlogId && init.backlogId !== params.backlogId);
  const I = fresh ? {} : init;
  const presetKind = I.kind || params.kind || (params.backlogId ? 'student' : '');
  const [step, setStep] = useState(I.step || (mode === 'update' ? 'interview' : presetKind ? 'name' : 'type'));
  const [kind, setKind] = useState(presetKind);
  const [si, setSi] = useState(I.si || blankStaffInfo());
  const [staffP, setStaffP] = useState(I.staffP || null);
  const [first, setFirst] = useState(I.first || asStr(params.firstName));
  const [pick, setPick] = useState(I.pick || '');
  const [note, setNote] = useState(I.note || '');
  const [when, setWhen] = useState(I.when || asStr(params.when));
  const [gender, setGender] = useState(I.gender || '');
  const [school, setSchool] = useState(I.school || '');
  const [demo, setDemo] = useState(I.demo || '');
  const [turns, setTurns] = useState(I.turns || []);
  const [current, setCurrent] = useState(I.current || null);
  const [answer, setAnswer] = useState(I.answer || '');
  const [target, setTarget] = useState(I.target || (mode === 'update' ? 3 : 5));
  const [guideOpen, setGuideOpen] = useState(false);
  const [phase, setPhase] = useState(I.phase || 'asking');
  const [student, setStudent] = useState(I.student || null);
  const [notes, setNotes] = useState(I.notes || null);
  const [clips, setClips] = useState(I.clips || []);
  const [recBusy, setRecBusy] = useState(false);
  const [loadingQ, setLoadingQ] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);
  const qCtl = useRef(null);
  const aCtl = useRef(null);
  const restored = !plainNew && !fresh && (I.turns || []).length > 0;
  const [savedSig, setSavedSig] = useState(() => resumeDraft && resumeDraft.snap ? ivSig(resumeDraft.snap) : null);

  const K = mode === 'update' ? (isStaffStory(story) ? 'staff' : 'student') : (kind || 'student');
  const staff = K === 'staff';
  const storyStudent = story && story.studentId ? students.find(x => x.id === story.studentId) : null;
  const name = mode === 'update' ? (staff ? ((story && story.alias) || 'this staff member') : ((storyStudent && storyStudent.firstName) || (story && story.alias) || 'this student'))
    : staff ? ((staffP && staffP.firstName) || asStr(first)) : ((student && student.firstName) || asStr(first));
  const openQ = n => staff ? STAFF_OPENING_Q(n) : OPENING_Q(n);
  const closeQ = n => staff ? STAFF_CLOSING_Q(n) : CLOSING_Q(n);
  const staffInfoNow = mode === 'update' ? cleanStaffInfo(story && story.staffInfo) : cleanStaffInfo(si);
  const setInfo = (k, v) => setSi(x => Object.assign({}, x, {[k]: v}));
  const followupId = params.followupId || I.followupId || null;
  const backlogId = mode === 'new' ? (params.backlogId || I.backlogId || null) : null;
  const memo = backlogId ? asStr(params.memory || I.memo) : '';

  useEffect(() => {
    if (mode === 'update' && story && !current && turns.length === 0) setCurrent({q: params.prompt || (staff ? STAFF_UPDATE_OPENING_Q(name) : UPDATE_OPENING_Q(name)), kind: 'opening'});
  }, [story && story.id]);
  /* the latest unsaved state is written when leaving this screen too, so a quick tap on Back never loses an answer;
     not after Start New Story or saving, which end the session on purpose */
  const flush = useRef(null), ended = useRef(false);
  useEffect(() => () => { if (!ended.current && flush.current) flush.current(); }, []);
  useEffect(() => {
    const write = () => {
      if (choosing || ended.current) return;
      const snap = {step, kind, si, staffP, first, pick, note, when, gender, school, demo, turns, current, answer, target, phase, student, clips, followupId, backlogId, memo, notes, at: Date.now()};
      if (plainNew) {
        if (!asStr(first) && !turns.length && !asStr(answer)) { const d = ivDrafts().find(x => x.id === sid); if (d && !d.snap) ivDel(sid); return; }
        ivPut(sid, {at: Date.now(), state: snap});
        return;
      }
      if ((step === 'name' || step === 'type') && !asStr(first)) { lsDel(draftKey); return; }
      lsSet(draftKey, JSON.stringify(snap));
    };
    flush.current = write;
    const t = setTimeout(write, 350);
    return () => clearTimeout(t);
  }, [step, kind, si, staffP, first, pick, note, when, gender, school, demo, turns, current, answer, target, phase, student, clips, notes, choosing]);
  const storyStudentInfo = story ? {gender: (story.overview || {}).gender || '', school: story.community || '', demographics: (story.overview || {}).demographics || ''} : null;
  const studentInfo = mode === 'update' ? storyStudentInfo : (student ? {gender: student.gender || '', school: student.school || '', demographics: student.demographics || ''} : null);
  useEffect(() => () => { if (qCtl.current) qCtl.current.abort(); if (aCtl.current) aCtl.current.abort(); VOICE.stop(); }, []);
  const [voiceOn, setVoiceOn] = useState(() => lsGet('abg-voice') !== 'off');
  useEffect(() => {
    if (!VOICE.supported || !voiceOn || !current || loadingQ || busy || step !== 'interview') return;
    const t = setTimeout(() => VOICE.say(current.q), 300);
    return () => { clearTimeout(t); VOICE.stop(); };
  }, [current && current.q, voiceOn, loadingQ, busy, step]);
  function toggleVoice(){ const on = !voiceOn; setVoiceOn(on); lsSet('abg-voice', on ? 'on' : 'off'); if (!on) VOICE.stop(); }

  const matches = useMemo(() => { const k = norm(first); return k ? (staff ? (staffPeople || []) : students).filter(x => x.nameKey === k && !x.demo) : []; }, [students, staffPeople, first, staff]);
  const storiesFor = sid => stories.filter(s => staff ? s.staffId === sid : s.studentId === sid);
  const asked = turns.filter(t => t.kind === 'followup').length;

  function begin(){
    let fn = asStr(first).replace(/\s+/g, ' ');
    if (!fn) return;
    fn = fn.charAt(0).toUpperCase() + fn.slice(1);
    let st;
    if (staff) {
      if (pick && pick !== 'new') { const ex = (staffPeople || []).find(x => x.id === pick); st = {id: ex.id, firstName: ex.firstName, existing: true}; }
      else st = {id: uid('sf'), firstName: fn, nameKey: norm(fn), note: asStr(note), createdAt: nowISO(), createdBy: (caps.me && caps.me.id) || null, existing: false};
      setSi(cleanStaffInfo(si)); setStaffP(st); setStep('interview'); setPhase('asking');
      setCurrent({q: STAFF_OPENING_Q(st.firstName), kind: 'opening'});
      return;
    }
    const info = {gender, school: asStr(school), demographics: asStr(demo)};
    if (pick && pick !== 'new') { const ex = students.find(x => x.id === pick); st = Object.assign({id: ex.id, firstName: ex.firstName, existing: true}, {gender: info.gender || ex.gender || '', school: info.school || ex.school || '', demographics: info.demographics || ex.demographics || ''}); }
    else st = Object.assign({id: uid('st'), firstName: fn, nameKey: norm(fn), note: asStr(note), createdAt: nowISO(), createdBy: (caps.me && caps.me.id) || null, existing: false}, info);
    setStudent(st); setStep('interview'); setPhase('asking');
    setCurrent({q: OPENING_Q(st.firstName), kind: 'opening'});
  }
  async function fetchNext(nt){
    if (!caps.sample) { setCurrent({q: closeQ(name), kind: 'closing'}); return; }
    setErr(''); setLoadingQ(true); setCurrent(null);
    const ctl = new AbortController(); qCtl.current = ctl;
    try {
      const pr = avoid => staff ? staffInterviewPrompt({name, turns: nt, mode, story, info: staffInfoNow, notes, avoid, asked: nt.filter(t => t.kind === 'followup').length, target})
        : interviewPrompt({name, turns: nt, mode, story, memo, info: studentInfo, notes, avoid, asked: nt.filter(t => t.kind === 'followup').length, target});
      const ask = avoid => caps.sample.json(pr(avoid), {modelTier: 'default', cache: false, signal: ctl.signal});
      let r = await ask('');
      let q = asStr(r && r.question);
      if (!q) throw {code: 'invalid_json'};
      const dup = nt.find(t => questionOverlap(t.q, q) >= 0.7);
      if (dup) { try { const r2 = await ask(dup.q); const q2 = asStr(r2 && r2.question); if (q2 && !nt.some(t => questionOverlap(t.q, q2) >= 0.7)) { r = r2; q = q2; } } catch (e2) { if (e2 && e2.code === 'cancelled') throw e2; } }
      if (r.notes && typeof r.notes === 'object') setNotes(r.notes);
      const stg = parseInt(asStr(r.stage), 10); setCurrent({q, kind: 'followup', category: asStr(r.target).slice(0, 40), why: asStr(r.why), stage: [1, 2, 3, 4, 5].includes(stg) ? stg : null});
      if (r.enough === true && nt.filter(t => t.kind === 'followup').length >= (mode === 'update' ? 2 : 3)) setTarget(t => Math.min(t, nt.filter(x => x.kind === 'followup').length + 1));
    } catch (e) {
      if (e && e.code === 'cancelled') return;
      setErr(aiErrorMessage(e).replace('The analysis', 'The next question'));
    } finally { qCtl.current = null; setLoadingQ(false); }
  }
  function submit(skip){
    if (!current) return;
    if (!skip && !asStr(answer)) return;
    const t = {q: current.q, kind: current.kind, category: current.category || '', a: skip ? '' : answer.trim(), status: skip ? 'skipped' : 'answered', at: nowISO(), audio: skip ? [] : clips};
    const nt = turns.concat([t]);
    setTurns(nt); setAnswer(''); setClips([]);
    if (current.kind === 'closing') { setCurrent(null); setPhase('done'); finish(nt); return; }
    const n = nt.filter(x => x.kind === 'followup').length;
    if (!caps.sample) { setCurrent({q: closeQ(name), kind: 'closing'}); return; }
    if (n >= target) { setCurrent(null); setPhase('choice'); return; }
    fetchNext(nt);
  }
  function another(){ setPhase('asking'); setTarget(asked + 1); fetchNext(turns); }
  function wrapUp(){ setPhase('asking'); if (qCtl.current) qCtl.current.abort(); setLoadingQ(false); setErr(''); setCurrent({q: closeQ(name), kind: 'closing'}); }
  function finishNow(){
    let nt = turns;
    if (current && asStr(answer)) { nt = turns.concat([{q: current.q, kind: current.kind, category: current.category || '', a: answer.trim(), status: 'answered', at: nowISO(), audio: clips}]); setTurns(nt); setAnswer(''); setClips([]); }
    if (qCtl.current) qCtl.current.abort();
    setCurrent(null); setPhase('done');
    finish(nt);
  }
  function makeEntry(nt){
    return {id: uid('e'), storyId: story ? story.id : null, recordedAt: (nt[0] && nt[0].at) || nowISO(), eventDateText: asStr(when), eventApprox: false, prompt: nt[0] ? nt[0].q : '',
      transcript: turnsToText(nt), turns: nt, audio: nt.reduce((a, t) => a.concat(t.audio || []), []), transcriptEdited: null, summary: '', takeaways: [], source: mode === 'update' ? 'interview-update' : 'interview', analyzed: false, storyType: K,
      createdBy: (caps.me && caps.me.id) || null};
  }
  async function finish(nt){
    if (!nt.some(t => t.status === 'answered')) { setErr('Answer at least the opening question before finishing.'); setPhase('asking'); setCurrent({q: nt[0] ? nt[0].q : openQ(name), kind: 'opening'}); setTurns([]); return; }
    if (!caps.sample) return;
    setErr(''); setBusy('analyze');
    const ctl = new AbortController(); aCtl.current = ctl;
    const entry = makeEntry(nt);
    const items = [{id: entry.id, text: entry.transcript, recordedAt: entry.recordedAt}];
    try {
      const analysis = await runAnalysis({sample: caps.sample, mode, story, stories, items, whenHint: asStr(when), studentName: name, memo, studentInfo, staffInfo: staffInfoNow, kind: K, signal: ctl.signal});
      aCtl.current = null;
      if (staff) {
        const nf = mode === 'new' && staffP && !staffP.existing ? Object.assign({}, staffP) : null;
        if (nf) delete nf.existing;
        nav('review', {mode, kind: 'staff', storyId: story ? story.id : null, analysis, entry, items, draftKey, whenHint: asStr(when), followupId,
          staffId: mode === 'new' ? staffP.id : (story.staffId || null), studentName: name, newStaff: nf, staffInfo: staffInfoNow, returnTo: {name: 'interview', params}});
        return;
      }
      const ns = student && !student.existing ? Object.assign({}, student) : null;
      if (ns) delete ns.existing;
      nav('review', {mode, kind: 'student', storyId: story ? story.id : null, analysis, entry, items, draftKey, whenHint: asStr(when), followupId,
        studentId: mode === 'new' ? student.id : (story.studentId || null), studentName: name, newStudent: ns, backlogId, studentInfo, returnTo: {name: 'interview', params}});
    } catch (e) {
      aCtl.current = null; setBusy(null);
      if (e && e.code === 'cancelled') return;
      setErr(aiErrorMessage(e));
    }
  }
  async function saveRaw(){
    const nt = turns.length ? turns : [];
    if (!nt.some(t => t.status === 'answered')) return;
    setBusy('save');
    const ns = !staff && student && !student.existing ? Object.assign({}, student) : null;
    if (ns) delete ns.existing;
    const nf = staff && mode === 'new' && staffP && !staffP.existing ? Object.assign({}, staffP) : null;
    if (nf) delete nf.existing;
    const sid = await saveRawEntry({caps, safeWrite, story, entry: makeEntry(nt), title: name + (staff ? "'s staff story" : "'s story"), whenText: asStr(when), newStudent: ns, studentId: !staff && student ? student.id : null, studentName: name, followupId, backlogId, studentInfo,
      kind: K, newStaff: nf, staffId: staff && staffP ? staffP.id : null, staffInfo: staffInfoNow});
    setBusy(null);
    if (sid) { ended.current = true; clearDraft(draftKey); showToast('Interview saved'); nav('story', {id: sid}); }
  }
  /* Start New Story: always available; asks first when there is unsaved progress. Saved stories are never touched. */
  const hasContent = !!(asStr(first) || turns.length || asStr(answer) || clips.length);
  const sigNow = ivSig({step, kind, first, pick, note, when, gender, school, demo, si, turns, answer, phase, clips});
  const unsaved = hasContent && sigNow !== savedSig;
  function startNew(){
    const go = () => { ended.current = true; if (qCtl.current) qCtl.current.abort(); if (aCtl.current) aCtl.current.abort(); VOICE.stop(); discardDraft(draftKey); nav('interview', {fresh: true}); };
    if (!unsaved) { go(); return; }
    openSheet(close => html`<${ConfirmSheet} close=${close} title="Start a new story?" body="Your current unsaved progress will be lost." confirmLabel="Start New Story" onConfirm=${go} />`);
  }
  function saveDraft(){
    const snap = {step, kind, si, staffP, first, pick, note, when, gender, school, demo, turns, current, answer, target, phase, student, clips, followupId, backlogId, memo, notes, at: Date.now()};
    ivPut(sid, {at: Date.now(), state: snap, snap, snapAt: Date.now()});
    setSavedSig(sigNow);
    showToast('Draft saved on this device. Resume it any time from Capture a Story.');
  }
  const newBtn = html`<button type="button" className="btn btn-ghost btn-sm new-story-btn" id="iv-new-story" onClick=${startNew}><${Icon} name="plus" size=${16} /> <span className="nsb-long">Start New Story</span><span className="nsb-short" aria-hidden="true">New story</span></button>`;
  const draftBtn = plainNew && hasContent ? html`<button type="button" className="btn btn-quiet btn-sm" id="iv-save-draft" disabled=${!unsaved} onClick=${saveDraft}>${unsaved ? 'Save draft' : 'Draft saved'}</button>` : null;
  const headActions = html`<div className="focus-actions">${draftBtn}${newBtn}<${GuideButton} open=${guideOpen} onToggle=${() => setGuideOpen(o => !o)} /></div>`;
  const back = () => story ? nav('story', {id: story.id}) : nav('home');

  if (readOnly) return html`<div className="view"><${FocusHeader} title="Record a Story" onBack=${() => nav('home')} /><p className="notice">You have view-only access to this journal. Ask the person who shared it for Editor access to record stories.</p></div>`;
  if (storyId && !story) return html`<div className="view"><${FocusHeader} title="Add Story Update" onBack=${() => nav('library')} />${storiesLoaded ? html`<p className="notice">This story isn't in the journal anymore.</p>` : html`<div className="skeleton"></div>`}</div>`;

  /* unfinished interviews on this device: resume one, or start a new story (never reopened automatically) */
  if (choosing) {
    const del = d => openSheet(close => html`<${ConfirmSheet} close=${close} title="Delete this draft?" body=${'The unfinished interview' + (asStr((d.state || {}).first) ? ' with ' + d.state.first : '') + ' will be deleted from this device. Saved stories are not affected.'} confirmLabel="Delete draft" onConfirm=${() => { ivDel(d.id); const l = ivDrafts(); setDrafts(l); if (!l.length) setChoosing(false); }} />`);
    return html`<div className="view interview">
      <${FocusHeader} title="Capture a Story" sub="You have unfinished interviews on this device" onBack=${back} />
      <section className="card draft-card">
        <p>Pick up where you left off, or start a new story. Starting a new story doesn't delete your drafts or any saved story.</p>
        <button className="btn btn-purple btn-lg" id="iv-start-new" onClick=${() => setChoosing(false)}><${Icon} name="plus" size=${20} /> Start New Story</button>
      </section>
      <div className="draft-list">${drafts.map(d => { const st = d.state || {}; const n = (st.turns || []).filter(t => t.status === 'answered').length; return html`<div className="card draft-row" key=${d.id}>
        <div className="draft-main"><strong>${asStr(st.first) || 'Unnamed interview'}</strong>
          <small className="muted">${st.kind === 'staff' ? 'Staff Impact' : st.kind === 'student' ? 'Student Impact' : 'Story type not chosen'} · ${n} ${n === 1 ? 'answer' : 'answers'} · ${d.snap ? 'draft saved' : 'not saved as a draft'} ${fmtDate(new Date(d.at || Date.now()).toISOString())}</small></div>
        <div className="row-btns"><button className="btn btn-primary btn-sm iv-resume" onClick=${() => nav('interview', {resume: d.id})}>Resume Draft</button><button className="btn btn-quiet btn-sm danger iv-del-draft" onClick=${() => del(d)}>Delete</button></div>
      </div>`; })}</div>
    </div>`;
  }

  /* step 0: which kind of story */
  if (step === 'type') {
    const choose = k => { setKind(k); setPick(''); setStep('name'); };
    return html`<div className="view interview">
      <${FocusHeader} title="Capture a Story" sub="What kind of story is this?" onBack=${back} action=${hasContent || mode === 'update' ? headActions : html`<${GuideButton} open=${guideOpen} onToggle=${() => setGuideOpen(o => !o)} />`} />
      ${guideOpen ? html`<${GuidePanel} onClose=${() => setGuideOpen(false)} />` : null}
      <div className="type-grid" role="group" aria-label="Story type">
        <button type="button" className="type-card tone-teal-soft" id="type-student" onClick=${() => choose('student')}>
          <span className="type-ic"><${Icon} name="users" size=${26} /></span>
          <span className="type-text"><strong>Student Impact Story</strong><span>How ABG has shaped a student's education, artistic growth, personal development and future opportunities.</span></span>
          <${Icon} name="chev" size=${20} />
        </button>
        <button type="button" className="type-card tone-purple-soft" id="type-staff" onClick=${() => choose('staff')}>
          <span className="type-ic"><${Icon} name="briefcase" size=${26} /></span>
          <span className="type-text"><strong>Staff Impact Story</strong><span>How ABG has shaped someone's employment, professional development, career, personal growth and community involvement. Includes staff who were once ABG students.</span></span>
          <${Icon} name="chev" size=${20} />
        </button>
      </div>
      <p className="small muted">Recording a program, mural or partnership instead? <button className="btn btn-quiet btn-sm" onClick=${() => nav('record')}>Record a general story</button></p>
    </div>`;
  }

  /* step 1, staff: demographic and background intake */
  if (step === 'name' && staff) {
    const fn = asStr(first);
    const needPick = matches.length > 0 && !pick;
    const programs = uniq((settings.programs || []).concat(stories.filter(x => !x.demo).map(x => x.program)));
    const yearInput = (id, label, key, hint) => html`<${Field} label=${label} hint=${hint}><input id=${id} className="input" inputMode="numeric" maxLength="4" placeholder="e.g. 2018" value=${si[key] || ''} onChange=${e => setInfo(key, e.target.value.replace(/\D/g, '').slice(0, 4))} /><//>`;
    return html`<div className="view interview">
      <${FocusHeader} title="New Staff Impact Story" sub="Step 1 of 3: Staff member information" onBack=${() => { setStep('type'); setPick(''); }} action=${headActions} />
      ${guideOpen ? html`<${GuidePanel} kind="staff" onClose=${() => setGuideOpen(false)} />` : null}
      <section className="card name-card">
        <h2 className="intake-h">Basic information</h2>
        <${Field} label="Staff member's first name"><input id="iv-first" className="input input-lg" autoComplete="off" placeholder="Enter their first name" value=${first} onChange=${e => { setFirst(e.target.value.replace(/\s{2,}/g, ' ')); setPick(''); }} /><//>
        <p className="small muted"><${Icon} name="lock" size=${14} /> First name only, never a last name. Everything below is optional.</p>
        ${matches.length > 0 ? html`<div className="field"><span className="field-label">There ${matches.length === 1 ? 'is already a staff member' : 'are already staff members'} named ${fn} in the journal. Is this the same person?</span>
          <div className="pick-list">
            ${matches.map(m => { const ss = storiesFor(m.id); return html`<label key=${m.id} className=${'pick' + (pick === m.id ? ' on' : '')}><input type="radio" name="iv-pick" checked=${pick === m.id} onChange=${() => setPick(m.id)} /><span><strong>${m.firstName}</strong>${m.note ? ' · ' + m.note : ''}<br /><span className="small muted">${ss.length ? ss.map(s => s.title).slice(0, 2).join('; ') : 'No stories yet'}</span></span></label>`; })}
            <label className=${'pick' + (pick === 'new' ? ' on' : '')}><input type="radio" name="iv-pick" checked=${pick === 'new'} onChange=${() => setPick('new')} /><span><strong>A different person named ${fn}</strong><br /><span className="small muted">Kept as a separate record, so they're counted separately.</span></span></label>
          </div>
          ${pick && pick !== 'new' ? html`<p className="small muted">They'll be counted once in Impact Insights, however many stories they have.</p>` : null}
        </div>` : null}
        ${pick === 'new' ? html`<${Field} label="How to tell them apart (internal only)" hint="e.g. teaching artist since 2020. Never shown in external materials."><input id="iv-note" className="input" value=${note} onChange=${e => setNote(e.target.value)} /><//>` : null}
        <div className="field"><span className="field-label">Current or former staff member</span>
          <div className="seg" role="group" aria-label="Current or former staff member">${STAFF_STATUS.map(o => html`<button type="button" key=${o.id} className="seg-btn" aria-pressed=${si.status === o.id} onClick=${() => setInfo('status', si.status === o.id ? '' : o.id)}>${o.id === 'current' ? 'Current' : 'Former'}</button>`)}</div>
        </div>
        <div className="row">
          <${Field} label="Role or position at ABG"><input id="iv-role" className="input" autoComplete="off" placeholder="e.g. Teaching artist" value=${si.role} onChange=${e => setInfo('role', e.target.value)} /><//>
          ${yearInput('iv-start', 'Year they started working with ABG', 'startYear', 'Approximate is fine.')}
        </div>
        <${Field} label="Employment type, if known"><select id="iv-emp" className="select" value=${si.employmentType} onChange=${e => setInfo('employmentType', e.target.value)}><option value="">Not entered</option>${EMPLOYMENT_TYPES.map(o => html`<option key=${o.id} value=${o.id}>${o.label}</option>`)}</select><//>
        <h2 className="intake-h">Student-to-staff background</h2>
        <div className="field"><span className="field-label" id="iv-former-l">Was this staff member previously an ABG student or program participant?</span>
          <div className="seg seg-wrap" role="group" aria-labelledby="iv-former-l">${FORMER_STUDENT.map(o => html`<button type="button" key=${o.id} id=${'iv-former-' + o.id} className="seg-btn" aria-pressed=${si.formerStudent === o.id} onClick=${() => setInfo('formerStudent', si.formerStudent === o.id ? '' : o.id)}>${o.label}</button>`)}</div>
        </div>
        ${si.formerStudent === 'yes' ? html`<div className="intake-former">
          <div className="row">
            ${yearInput('iv-first-year', 'Year they first participated in ABG', 'firstParticipatedYear', 'Approximate is fine.')}
            ${yearInput('iv-transition', 'Year they began working for ABG', 'transitionYear', 'Approximate is fine.')}
          </div>
          <${Field} label="Program(s) they participated in"><input id="iv-programs" className="input" list="dl-iv-programs" autoComplete="off" placeholder="e.g. School Mural Program" value=${si.programs} onChange=${e => setInfo('programs', e.target.value)} /><//>
          <datalist id="dl-iv-programs">${programs.map(p => html`<option key=${p} value=${p}></option>`)}</datalist>
          <p className="small muted">The interview will also ask about their time as a student and how they moved into working for ABG. If they have a Student Impact Story, you can link it from this story's page after saving, once you've confirmed it's the same person.</p>
        </div>` : null}
        <button className="btn btn-primary btn-lg" id="iv-begin" disabled=${!fn || needPick} onClick=${begin}><${Icon} name="mic" size=${20} /> Start interview</button>
      </section>
    </div>`;
  }

  /* step 1: first name */
  if (step === 'name') {
    const fn = asStr(first);
    const needPick = matches.length > 0 && !pick;
    return html`<div className="view interview">
      <${FocusHeader} title="New Student Impact Story" sub="Step 1 of 3: Student information" onBack=${backlogId ? () => nav('backlog') : params.kind ? back : () => { setStep('type'); setPick(''); }} action=${headActions} />
      ${guideOpen ? html`<${GuidePanel} onClose=${() => setGuideOpen(false)} />` : null}
      ${memo ? html`<p className="memo-note"><${Icon} name="users" size=${16} /><span><strong>From your student list:</strong> ${memo}</span></p>` : null}
      <section className="card name-card">
        <${Field} label="Student's First Name"><input id="iv-first" className="input input-lg" autoComplete="off" placeholder="Enter student's first name" value=${first} onChange=${e => { setFirst(e.target.value.replace(/\s{2,}/g, ' ')); setPick(''); }} /><//>
        <p className="small muted"><${Icon} name="lock" size=${14} /> First name only, never a last name. A nickname is fine.</p>
        ${matches.length > 0 ? html`<div className="field"><span className="field-label">There ${matches.length === 1 ? 'is already a student' : 'are already students'} named ${fn} in the journal. Is this the same person?</span>
          <div className="pick-list">
            ${matches.map(m => { const ss = storiesFor(m.id); return html`<label key=${m.id} className=${'pick' + (pick === m.id ? ' on' : '')}><input type="radio" name="iv-pick" checked=${pick === m.id} onChange=${() => setPick(m.id)} /><span><strong>${m.firstName}</strong>${m.note ? ' · ' + m.note : ''}<br /><span className="small muted">${ss.length ? ss.map(s => s.title).slice(0, 2).join('; ') : 'No stories yet'}</span></span></label>`; })}
            <label className=${'pick' + (pick === 'new' ? ' on' : '')}><input type="radio" name="iv-pick" checked=${pick === 'new'} onChange=${() => setPick('new')} /><span><strong>A different student named ${fn}</strong><br /><span className="small muted">Kept as a separate record so their stories never get combined.</span></span></label>
          </div>
          ${pick && pick !== 'new' ? html`<p className="small muted">To add to one of their existing stories instead, open it and choose Add Story Update. Continuing starts a new story about the same student.</p>` : null}
        </div>` : null}
        ${pick === 'new' ? html`<${Field} label="How to tell them apart (internal only)" hint="e.g. mural program 2018. Never shown in external materials."><input id="iv-note" className="input" value=${note} onChange=${e => setNote(e.target.value)} /><//>` : null}
        <div className="field"><span className="field-label">Gender</span>
          <div className="seg" role="group" aria-label="Gender">${GENDERS.map(g => html`<button type="button" key=${g.id} className="seg-btn" aria-pressed=${gender === g.id} onClick=${() => setGender(gender === g.id ? '' : g.id)}>${g.label}</button>`)}</div>
        </div>
        <${Field} label="School"><input id="iv-school" className="input" list="dl-iv-schools" autoComplete="off" placeholder="e.g. Roosevelt Middle School" value=${school} onChange=${e => setSchool(e.target.value)} /><//>
        <datalist id="dl-iv-schools">${uniq((settings.communities || []).concat(stories.map(x => x.community))).map(c => html`<option key=${c} value=${c}></option>`)}</datalist>
        <${Field} label="Other details (optional)" hint="Grade or age, or anything else useful for reporting."><input id="iv-demo" className="input" placeholder="e.g. 7th grade, age 12" value=${demo} onChange=${e => setDemo(e.target.value)} /><//>
        <button className="btn btn-primary btn-lg" disabled=${!fn || needPick} onClick=${begin}><${Icon} name="mic" size=${20} /> Start interview</button>
      </section>
    </div>`;
  }

  /* analysis running */
  if (busy === 'analyze') return html`<div className="view"><${FocusHeader} title=${'Interview: ' + name} onBack=${() => aCtl.current && aCtl.current.abort()} /><${Analyzing} title=${'Claude is writing ' + name + "'s story"} onStop=${() => aCtl.current && aCtl.current.abort()} /></div>`;

  const answeredCount = turns.filter(t => t.status === 'answered').length;
  const stageLabel = !current ? '' : current.kind === 'opening' ? (mode === 'update' ? 'Story update' : 'Opening story') : current.kind === 'closing' ? 'Closing question' : 'Follow-up ' + (asked + 1) + ' of about ' + Math.max(target, asked + 1) + (current.stage ? ' · ' + labelOf(staff ? STAFF_STAGES : INTERVIEW_STAGES, current.stage) : '');
  return html`<div className="view interview">
    <${FocusHeader} title=${(mode === 'update' ? 'Story update: ' : 'Interview: ') + name} sub=${mode === 'update' ? story.title : 'Step 2 of 3: ' + (staff ? 'Staff Impact interview' : 'Interview')} onBack=${back} action=${headActions} />
    ${guideOpen ? html`<${GuidePanel} kind=${K} onClose=${() => setGuideOpen(false)} />` : null}
    ${(() => { const bits = staff && mode === 'new' && turns.length === 0 ? [staffInfoNow.status ? labelOf(STAFF_STATUS, staffInfoNow.status) : '', staffInfoNow.role, staffInfoNow.startYear ? 'since ' + staffInfoNow.startYear : '', staffInfoNow.formerStudent === 'yes' ? 'former ABG student' : staffInfoNow.formerStudent === 'no' ? 'not a former ABG student' : ''].filter(Boolean) : [];
      return bits.length ? html`<p className="memo-note"><${Icon} name="briefcase" size=${16} /><span><strong>From the intake:</strong> ${bits.join(' · ')}. The interviewer won't ask for these again.</span></p>` : null; })()}
    ${restored ? html`<p className="small muted">Restored your unsaved interview from this device. <button className="btn btn-quiet btn-sm" onClick=${startNew}>Start New Story</button></p>` : null}
    ${resumeDraft && turns.length > 0 ? html`<p className="small muted" id="iv-resumed">Resumed your draft from ${fmtDate(new Date(resumeDraft.at || Date.now()).toISOString())}.</p>` : null}
    ${memo && turns.length === 0 ? html`<p className="memo-note"><${Icon} name="users" size=${16} /><span><strong>Your note:</strong> ${memo}</span></p>` : null}
    ${turns.length > 0 ? html`<details className="sec convo"><summary><span>Conversation so far<span className="count">${turns.length} ${turns.length === 1 ? 'answer' : 'answers'}</span></span><${Icon} name="chev" size=${18} /></summary>
      <div className="sec-body">${turns.map((t, i) => html`<div className="turn" key=${i}><p className="turn-q">${t.q}</p><p className=${'turn-a' + (t.status === 'skipped' ? ' muted' : '')}>${t.status === 'skipped' ? 'Skipped' : t.a}</p></div>`)}</div>
    </details>` : null}

    ${phase === 'choice' ? html`<section className="card">
      <h2>That covers the main follow-ups</h2>
      <p className="muted">You can keep going if there's more to tell, or wrap up with one last question.</p>
      <div className="row-btns"><button className="btn btn-primary" onClick=${wrapUp}>Wrap up</button><button className="btn btn-ghost" onClick=${another}><${Icon} name="spark" size=${18} /> Ask another question</button></div>
    </section>`
    : phase === 'done' ? html`<section className="card">
      <h2>Interview complete</h2>
      <p className="muted">${answeredCount} answers recorded. Claude turns them into ${name}'s ${staff ? 'Staff' : 'Student'} Impact Report, which you review before anything is saved.</p>
      ${err ? html`<p className="error" role="alert">${err}</p>` : null}
      ${!caps.sample ? html`<p className="notice small">Claude isn't available in this view, so the interview will be saved without a report. You can analyze it later from the story page.</p>` : null}
      <div className="row-btns">
        ${caps.sample ? html`<button className="btn btn-primary" onClick=${() => finish(turns)}><${Icon} name="spark" size=${18} /> Write the story</button>` : null}
        <button className="btn btn-ghost" disabled=${busy === 'save'} onClick=${saveRaw}>${busy === 'save' ? 'Saving…' : 'Save without analysis'}</button>
        ${caps.sample ? html`<button className="btn btn-quiet" onClick=${another}>Ask another question</button>` : null}
      </div>
    </section>`
    : html`<section className="question-card" aria-live="polite">
        <div className="q-head"><p className="eyebrow">${loadingQ ? 'Next question' : stageLabel}</p>
          ${VOICE.supported ? html`<div className="q-voice">
            ${voiceOn && current && !loadingQ ? html`<button type="button" className="icon-btn" aria-label="Hear the question again" title="Hear it again" onClick=${() => VOICE.say(current.q)}><${Icon} name="replay" size=${18} /></button>` : null}
            <button type="button" className="voice-toggle" aria-pressed=${voiceOn} title=${voiceOn ? 'Questions are read aloud. Tap to turn the voice off.' : 'Tap to have questions read aloud'} onClick=${toggleVoice}><${Icon} name=${voiceOn ? 'volume' : 'mute'} size=${18} /><span>${voiceOn ? 'Voice on' : 'Voice off'}</span></button>
          </div>` : null}
        </div>
        ${loadingQ ? html`<p className="q-text thinking"><span className="paint-dots small-dots" aria-hidden="true"><span></span><span></span><span></span></span> Thinking of the next question…</p>`
          : current ? html`<p className="q-text">${current.q}</p>${current.why ? html`<p className="small muted">${current.why}</p>` : null}`
          : null}
        ${err ? html`<div className="error" role="alert">${err}<div className="row-btns" style=${{marginTop: '8px'}}><button className="btn btn-ghost btn-sm" onClick=${() => fetchNext(turns)}>Try again</button><button className="btn btn-ghost btn-sm" onClick=${wrapUp}>Wrap up instead</button></div></div>` : null}
      </section>
      ${current ? html`<${DictationBox} id="iv-answer" value=${answer} onChange=${setAnswer} compact=${current.kind !== 'opening'} label=${current.q} onAudio=${c => setClips(x => x.concat([c]))} onBusy=${setRecBusy} placeholder=${current.kind === 'opening' ? (staff ? 'Press Record and take your time: how they got involved, the opportunities ABG gave them, how they have grown, and where they are now. Or type here.' : 'Press Record and take your time: background, challenges, how they found ABG, and what has happened since. Or type here.') : 'Press Record to answer, type here, or skip this one. "I don\'t know" is a fine answer.'} />
        ${current.kind === 'opening' ? html`<p className="tip small muted"><${Icon} name="mic" size=${16} /><span>Nobody will interrupt. You can pause and resume, and follow-up questions come after you finish.</span></p>` : null}` : null}
      <div className="savebar"><div className="inner">
        ${answeredCount > 0 || (current && asStr(answer)) ? html`<button className="btn btn-quiet" onClick=${finishNow} disabled=${(loadingQ && !answeredCount) || recBusy}>Finish interview</button>` : null}
        ${current && current.kind !== 'opening' ? html`<button className="btn btn-ghost" onClick=${() => submit(true)} disabled=${loadingQ || recBusy}>Skip</button>` : null}
        ${current ? html`<button className="btn btn-primary" onClick=${() => submit(false)} disabled=${!asStr(answer) || loadingQ || recBusy}>${current.kind === 'closing' ? 'Finish and write the story' : current.kind === 'opening' ? 'Done, ask follow-ups' : 'Next question'}</button>` : null}
      </div></div>`}
  </div>`;
}

/* ================= review / edit ================= */
function PrivacyPanel({value, onChange, disabled, live}){
  if (isTest(value)) return html`<p className="notice small" id="pv-test">This is a test story from Preview Mode. Test stories can't be approved for external use or shared, and are never counted.</p>`;
  const p = Object.assign({minor: 'unknown', identifying: 'unknown', permission: 'unknown', external: 'unknown', redact: 'unknown', sensitive: 'unknown', sensitiveConsent: 'unknown'}, value.privacy || {});
  const [pending, setPending] = useState(false);
  const [tick, setTick] = useState(false);
  const [pub, setPub] = useState(value.publicName || '');
  useEffect(() => { if (live) setPub(value.publicName || ''); }, [value.publicName]);
  const pubInput = html`<${Field} label="Public alias" hint=${'Used in external materials instead of ' + (value.alias ? value.alias : 'the first name') + '. The first name appears externally only when publication permission is documented. Leave blank to say "' + (isStaffStory(value) ? 'a staff member' : 'a student') + '".'}>
    <input id="pv-alias" className="input" disabled=${disabled} placeholder="e.g. Student A, or a pseudonym" value=${pub}
      onChange=${e => { setPub(e.target.value); if (!live) onChange({publicName: e.target.value}); }}
      onBlur=${() => { if (live && asStr(pub) !== asStr(value.publicName)) onChange({publicName: asStr(pub)}); }} /><//>`;
  const blocked = p.external === 'no';
  const sensitiveCare = needsSensitiveCare(Object.assign({}, value, {privacy: p}));
  const direct = !blocked && !sensitiveCare && (p.permission === 'yes' || (p.identifying === 'no' && p.redact !== 'yes'));
  const setP = (k, v) => onChange({privacy: Object.assign({}, p, {[k]: v})});
  const approve = () => { onChange({status: 'approved', privacy: Object.assign({}, p, {external: p.external === 'unknown' ? 'yes' : p.external})}); setPending(false); setTick(false); };
  const choose = id => {
    if (id === 'approved') { if (blocked || !direct) { setPending(true); return; } approve(); }
    else { setPending(false); onChange({status: id}); }
  };
  return html`<div className="view" style=${{gap: '14px'}}>
    <p className="small muted">A first name combined with a school or a specific event can still identify someone, so first-name records aren't treated as anonymous.</p>
    <div className="yn-list">${PRIVACY.map(f => html`<${YesNo} key=${f.id} label=${f.label} value=${p[f.id]} disabled=${disabled} onChange=${v => setP(f.id, v)} />`)}</div>
    ${pubInput}
    <div className="field"><span className="field-label">Story status</span>
      <div className="status-grid" role="group" aria-label="Story status">${STATUSES.map(s => html`<button type="button" key=${s.id} className=${'status-opt' + (value.status === s.id ? ' tone-' + s.tone : '')} aria-pressed=${value.status === s.id} disabled=${disabled} onClick=${() => choose(s.id)}><span className="dot"></span>${s.label}</button>`)}</div>
    </div>
    ${pending && blocked ? html`<p className="notice small">This story is marked as not usable externally. Change "Can be used externally" before approving it.</p>` : null}
    ${pending && !blocked ? html`<div className="approve-check">
      <p className="small">${sensitiveCare ? 'This story includes sensitive experiences (such as gang involvement) without documented consent. Approve it only after removing those details from the story text; audience versions and reports will leave them out.' : "Publication permission isn't documented for this story. Approve it only if permission is on file or identifying details have been removed."}</p>
      <label className="check"><input type="checkbox" checked=${tick} onChange=${e => setTick(e.target.checked)} /> ${sensitiveCare ? 'Sensitive details are removed from the story text, or consent is documented' : 'Permission is documented, or identifying details are removed'}</label>
      <div className="row-btns"><button type="button" className="btn btn-primary btn-sm" disabled=${!tick} onClick=${approve}>Approve for external use</button><button type="button" className="btn btn-ghost btn-sm" onClick=${() => setPending(false)}>Cancel</button></div>
    </div>` : null}
    <p className="small muted">Only stories approved for external use appear in external exports, impact reports, and audience drafts. AI summaries are never approved automatically.</p>
  </div>`;
}
function EvidenceEdit({ev, onChange, onRemove, onShow}){
  const src = ev.source || {};
  const numeric = ev.kind === 'numeric';
  return html`<div className=${'ev-edit' + (ev._new ? ' is-new' : '')}>
    <div className="ev-edit-top">
      <${EvLabel} e=${ev} />
      <select className="select select-sm" aria-label="Evidence type" title="Evidence type" value=${evidenceClass(ev) === 'planned' ? '' : evidenceClass(ev)} onChange=${e => onChange(classPatch(ev, e.target.value))}>${evidenceClass(ev) === 'planned' ? html`<option value="">Expected, not yet happened</option>` : null}${EVIDENCE_CLASSES.map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}</select>
      <button type="button" className="icon-btn" aria-label="Remove evidence" onClick=${onRemove}><${Icon} name="trash" size=${18} /></button>
    </div>
    <div className="row">
      <${Field} label="Metric"><input className="input" placeholder="e.g. School attendance rate" value=${ev.metric || ''} onChange=${e => onChange({metric: e.target.value})} /><//>
      <${Field} label="Impact area"><select className="select" value=${domainOf(ev)} onChange=${e => onChange({domain: e.target.value})}>${DOMAINS.map(d => html`<option key=${d.id} value=${d.id}>${d.label}</option>`)}</select><//>
    </div>
    <textarea className="textarea" rows="2" aria-label="What the evidence shows" placeholder="What does this show?" value=${ev.statement} onChange=${e => onChange({statement: e.target.value})}></textarea>
    <div className="row">
      <${Field} label="Change"><select className="select" value=${ev.direction || 'unclear'} onChange=${e => onChange({direction: e.target.value})}>${DIRECTIONS.map(d => html`<option key=${d.id} value=${d.id}>${d.label}</option>`)}</select><//>
      <${Field} label="Evidence level"><select className="select" value=${ev.level || 1} onChange=${e => onChange({level: +e.target.value})}>${LEVELS.map(l => html`<option key=${l.id} value=${l.id}>${l.label}</option>`)}</select><//>
    </div>
    ${numeric ? html`<div className="row">
      <${Field} label="Number, if one was given"><input className="input" inputMode="decimal" value=${ev.value == null ? '' : ev.value} onChange=${e => onChange({value: e.target.value})} /><//>
      <${Field} label="Unit"><input className="input" placeholder="percent, sessions, years" value=${ev.unit || ''} onChange=${e => onChange({unit: e.target.value})} /><//>
    </div>` : null}
    <div className="row">
      <${Field} label="Initial condition"><input className="input" placeholder="Not recorded" value=${ev.before || ''} onChange=${e => onChange({before: e.target.value})} /><//>
      <${Field} label="Current condition"><input className="input" placeholder="Not recorded" value=${ev.after || ''} onChange=${e => onChange({after: e.target.value})} /><//>
      <${Field} label="Timeframe"><input className="input" placeholder="e.g. 2024 to 2025" value=${ev.timeframe || ''} onChange=${e => onChange({timeframe: e.target.value})} /><//>
    </div>
    <div className="row">
      <${Field} label="Supporting observation"><input className="input" placeholder="What was seen or heard" value=${ev.observation || ''} onChange=${e => onChange({observation: e.target.value})} /><//>
      <${Field} label="ABG program or activity"><input className="input" placeholder="Not recorded" value=${ev.activity || ''} onChange=${e => onChange({activity: e.target.value})} /><//>
    </div>
    <div className="row">
      <${Field} label="ABG's possible contribution"><input className="input" placeholder="Only what Kyle said" value=${ev.contribution || ''} onChange=${e => onChange({contribution: e.target.value})} /><//>
      <${Field} label="Still unknown or to follow up"><input className="input" placeholder="None" value=${ev.openQuestion || ''} onChange=${e => onChange({openQuestion: e.target.value})} /><//>
    </div>
    <div className="row">
      <${Field} label="Observed or reported by"><select className="select" value=${ev.observer || ''} onChange=${e => onChange({observer: e.target.value})}><option value="">Not recorded</option>${OBSERVERS.map(o => html`<option key=${o.id} value=${o.id}>${o.label}</option>`)}</select><//>
      <${Field} label="Source" hint="How it's known"><input className="input" placeholder="e.g. Kyle observed directly; teacher told Kyle" value=${ev.basis || ''} onChange=${e => onChange({basis: e.target.value})} /><//>
      <${Field} label="Detail"><select className="select" value=${ev.status} onChange=${e => onChange({status: e.target.value})}>${EVIDENCE_STATUS.map(x => html`<option key=${x.id} value=${x.id}>${x.label}</option>`)}</select><//>
    </div>
    ${src.excerpt
      ? html`<div className=${'excerpt' + (src.found ? '' : ' missing')}><span>“${src.excerpt}”</span>${!src.found ? html`<span className="warn-note"> Not found word for word in the transcript. Check it before relying on it.</span>` : null}${onShow ? html` <button type="button" className="btn btn-quiet btn-sm" onClick=${onShow}>Show in transcript</button>` : null}</div>`
      : html`<${Field} label="How it's known" hint="e.g. Kyle saw it at sessions, or a teacher told him"><input className="input" value=${src.note || ''} onChange=${e => onChange({source: Object.assign({}, src, {note: e.target.value})})} /><//>`}
  </div>`;
}
function StoryEditor({draft, setDraft, items, mode}){
  const {settings, stories} = useApp();
  const upd = fn => setDraft(d => { const n = clone(d); fn(n); return n; });
  const val = (fn) => e => { const v = e.target.value; upd(n => fn(n, v)); };
  const [hl, setHl] = useState('');
  const trRef = useRef(null);
  const hasTr = items && items.length > 0;
  const recheck = t => hasTr ? items.some(it => foundIn(t, it.text) || (it.alt && foundIn(t, it.alt))) : false;
  const showIn = ex => { setHl(ex); if (trRef.current) { trRef.current.open = true; setTimeout(() => { try { trRef.current.scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'start'}); } catch (e) {} }, 30); } };
  const programs = uniq((settings.programs || []).concat(stories.map(s => s.program)));
  const communities = uniq((settings.communities || []).concat(stories.map(s => s.community)));
  const suggest = draft._suggest || [];
  const showQ = f => f.kind === 'question' && f.status === 'open' && (mode !== 'update' || f._new);
  const showT = f => f.kind === 'task' && f.status === 'open';
  const fuCount = (draft.followUps || []).filter(f => showQ(f) || showT(f)).length;
  const ed = draft.eventDate || {text: '', iso: '', approximate: false};
  const ov = draft.overview || {};
  const addBtn = (label, fn) => html`<button type="button" className="btn btn-quiet btn-sm" style=${{justifySelf: 'start'}} onClick=${() => upd(fn)}><${Icon} name="plus" size=${16} /> ${label}</button>`;
  const staff = isStaffStory(draft);
  const si = Object.assign(blankStaffInfo(), draft.staffInfo || {});
  const setSi = (k, v) => upd(n => { n.staffInfo = Object.assign(blankStaffInfo(), n.staffInfo || {}, {[k]: v}); });
  const trash = (label, fn) => html`<button type="button" className="icon-btn" aria-label=${label} onClick=${() => upd(fn)}><${Icon} name="trash" size=${18} /></button>`;

  return html`<div className="editor">
    ${hasTr ? html`<${Sec} title=${items.length > 1 ? 'Original entries' : 'Interview transcript'} count=${words(items.map(i => i.text).join(' ')) + ' words'} refEl=${trRef}>
      ${items.map(it => html`<div className="tr-block" key=${it.id}>${items.length > 1 ? html`<p className="eyebrow">Recorded ${fmtDate(it.recordedAt)}</p>` : null}<${TranscriptText} text=${it.text} highlight=${hl} /></div>`)}
      <p className="small muted">The original transcript is kept exactly as recorded. You can correct it later from the story page, and the original stays on file.</p>
    <//>` : null}

    <${Sec} title=${staff ? 'Impact narrative' : 'Student success story'} open=${true}>
      <${Field} label="Title"><input id="ed-title" className="input" value=${draft.title} onChange=${val((n, v) => { n.title = v; })} /><//>
      <${Field} label=${'Full impact story (' + words(draft.story) + ' words)'} hint="Aim for 200 to 350 words."><textarea id="ed-story" className="textarea" rows="14" value=${draft.story || ''} onChange=${val((n, v) => { n.story = v; })}></textarea><//>
      <${Field} label="Short summary" hint="Shown on library cards."><textarea id="ed-summary" className="textarea" rows="3" value=${draft.summary} onChange=${val((n, v) => { n.summary = v; })}></textarea><//>
      <div className="field"><span className="field-label">Key impact takeaways</span>
        ${(draft.takeaways || []).map((t, i) => html`<div className="list-row" key=${i}><input className="input" aria-label=${'Takeaway ' + (i + 1)} value=${t} onChange=${val((n, v) => { n.takeaways[i] = v; })} />${trash('Remove takeaway', n => { n.takeaways.splice(i, 1); })}</div>`)}
        ${(draft.takeaways || []).length < 5 ? addBtn('Add takeaway', n => { n.takeaways = (n.takeaways || []).concat(['']); }) : null}
      </div>
    <//>

    ${staff ? html`<${Sec} title="Staff overview" open=${true}>
      <div className="row">
        <${Field} label="Staff member's first name" hint="First name or pseudonym only."><input id="ed-alias" className="input" value=${draft.alias || ''} onChange=${val((n, v) => { n.alias = v; })} /><//>
        <${Field} label="Current or former"><select id="ed-sstatus" className="select" value=${si.status} onChange=${e => setSi('status', e.target.value)}><option value="">Not recorded</option>${STAFF_STATUS.map(o => html`<option key=${o.id} value=${o.id}>${o.label}</option>`)}</select><//>
      </div>
      <div className="row">
        <${Field} label="Role or position at ABG (intake)"><input id="ed-srole" className="input" value=${si.role} onChange=${e => setSi('role', e.target.value)} /><//>
        <${Field} label="Year started working with ABG"><input id="ed-sstart" className="input" inputMode="numeric" value=${si.startYear} onChange=${e => setSi('startYear', e.target.value.replace(/\D/g, '').slice(0, 4))} /><//>
        <${Field} label="Employment type"><select id="ed-semp" className="select" value=${si.employmentType} onChange=${e => setSi('employmentType', e.target.value)}><option value="">Not recorded</option>${EMPLOYMENT_TYPES.map(o => html`<option key=${o.id} value=${o.id}>${o.label}</option>`)}</select><//>
      </div>
      <div className="row">
        <${Field} label="Previously an ABG student or program participant?"><select id="ed-sformer" className="select" value=${si.formerStudent} onChange=${e => setSi('formerStudent', e.target.value)}><option value="">Not recorded</option>${FORMER_STUDENT.map(o => html`<option key=${o.id} value=${o.id}>${o.label}</option>`)}</select><//>
        ${si.formerStudent === 'yes' ? html`<${Field} label="First participated"><input id="ed-sfirst" className="input" inputMode="numeric" value=${si.firstParticipatedYear} onChange=${e => setSi('firstParticipatedYear', e.target.value.replace(/\D/g, '').slice(0, 4))} /><//>
        <${Field} label="Began working for ABG"><input id="ed-strans" className="input" inputMode="numeric" value=${si.transitionYear} onChange=${e => setSi('transitionYear', e.target.value.replace(/\D/g, '').slice(0, 4))} /><//>` : null}
      </div>
      ${si.formerStudent === 'yes' ? html`<${Field} label="Program(s) they participated in as a student"><input id="ed-sprog" className="input" list="dl-programs" value=${si.programs} onChange=${e => setSi('programs', e.target.value)} /><//>` : null}
      <${Field} label="Relevant background" hint="Only what helps explain ABG's impact. No financial or sensitive details."><textarea id="ed-bg" className="textarea" rows="2" value=${ov.background || ''} onChange=${val((n, v) => { n.overview = Object.assign({}, n.overview, {background: v}); })}></textarea><//>
      <div className="row">
        <${Field} label="ABG program"><input id="ed-program" className="input" list="dl-programs" value=${draft.program || ''} onChange=${val((n, v) => { n.program = v; })} /><//>
        <${Field} label="When it happened"><input id="ed-when" className="input" placeholder="e.g. 2019 to now" value=${ed.text || ''} onChange=${val((n, v) => { n.eventDate = Object.assign({}, n.eventDate, {text: v}); })} /><//>
        <${Field} label="Sort date" hint="YYYY, YYYY-MM or YYYY-MM-DD"><input id="ed-iso" className="input" inputMode="numeric" value=${ed.iso || ''} onChange=${val((n, v) => { n.eventDate = Object.assign({}, n.eventDate, {iso: v}); })} /><//>
      </div>
      <datalist id="dl-programs">${programs.map(p => html`<option key=${p} value=${p}></option>`)}</datalist>
    <//>` : html`<${Sec} title="Student overview" open=${true}>
      <div className="row">
        <${Field} label="Student's first name" hint="First name or pseudonym only."><input id="ed-alias" className="input" value=${draft.alias || ''} onChange=${val((n, v) => { n.alias = v; })} /><//>
        <${Field} label="Age or grade when involved"><input id="ed-age" className="input" value=${ov.ageOrGrade || ''} onChange=${val((n, v) => { n.overview = Object.assign({}, n.overview, {ageOrGrade: v}); })} /><//>
      </div>
      <div className="row">
        <${Field} label="Gender"><select id="ed-gender" className="select" value=${ov.gender || ''} onChange=${val((n, v) => { n.overview = Object.assign({}, n.overview, {gender: v}); })}><option value="">Not recorded</option>${GENDERS.map(g => html`<option key=${g.id} value=${g.id}>${g.label}</option>`)}</select><//>
        <${Field} label="Other details"><input id="ed-demo" className="input" value=${ov.demographics || ''} onChange=${val((n, v) => { n.overview = Object.assign({}, n.overview, {demographics: v}); })} /><//>
      </div>
      <${Field} label="Relevant background" hint="Only what helps explain ABG's impact."><textarea id="ed-bg" className="textarea" rows="2" value=${ov.background || ''} onChange=${val((n, v) => { n.overview = Object.assign({}, n.overview, {background: v}); })}></textarea><//>
      <div className="row">
        <${Field} label="ABG program"><input id="ed-program" className="input" list="dl-programs" value=${draft.program || ''} onChange=${val((n, v) => { n.program = v; })} /><//>
        <${Field} label="School or community"><input id="ed-community" className="input" list="dl-communities" value=${draft.community || ''} onChange=${val((n, v) => { n.community = v; })} /><//>
      </div>
      <div className="row">
        <${Field} label="When the experience happened"><input id="ed-when" className="input" placeholder="e.g. spring 2018" value=${ed.text || ''} onChange=${val((n, v) => { n.eventDate = Object.assign({}, n.eventDate, {text: v}); })} /><//>
        <${Field} label="Sort date" hint="YYYY, YYYY-MM or YYYY-MM-DD"><input id="ed-iso" className="input" inputMode="numeric" value=${ed.iso || ''} onChange=${val((n, v) => { n.eventDate = Object.assign({}, n.eventDate, {iso: v}); })} /><//>
      </div>
      <div className="row-between">
        <label className="check"><input id="ed-approx" type="checkbox" checked=${!!ed.approximate} onChange=${e => { const v = e.target.checked; upd(n => { n.eventDate = Object.assign({}, n.eventDate, {approximate: v}); }); }} /> The date is approximate</label>
        <div className="seg" role="group" aria-label="Type of story">
          <button type="button" className="seg-btn" aria-pressed=${draft.period === 'past'} onClick=${() => upd(n => { n.period = 'past'; })}>Historical</button>
          <button type="button" className="seg-btn" aria-pressed=${draft.period !== 'past'} onClick=${() => upd(n => { n.period = 'recent'; })}>Recent</button>
        </div>
      </div>
      <datalist id="dl-programs">${programs.map(p => html`<option key=${p} value=${p}></option>`)}</datalist>
      <datalist id="dl-communities">${communities.map(p => html`<option key=${p} value=${p}></option>`)}</datalist>
    <//>`}

    <${Sec} title="Measurable outcomes" count=${(draft.evidence || []).filter(isMeasurable).length + ' items'} open=${true}>
      <p className="small muted">Specific metrics and before-and-after comparisons. ${STATUS_LEGEND} Mark something Verified only after checking it against a record.</p>
      ${staff ? html`<div className="field"><span className="field-label">Staff impact card <span className="muted">(${staffKnown(draft)} of ${STAFF_FIELDS.length} documented)</span></span>
        <p className="small muted">The same employment and development fields on every staff story, so they add up across people. Leave a field blank if it isn't documented: blank is never counted as "no" or zero.${mode === 'update' ? ' Values this update changed have an orange edge.' : ''}</p>
        <${MetricsCardEdit} metrics=${draft.staffCard} fields=${STAFF_FIELDS} onChange=${m => upd(n => { n.staffCard = m; })} />
      </div>` : null}
      ${isStudentStory(draft) ? html`<div className="field"><span className="field-label">Student metrics card <span className="muted">(${metricsKnown(draft)} of ${METRIC_FIELDS.length} known)</span></span>
        <p className="small muted">The same fields on every student story, so they add up across students. Leave a field blank if it's unknown.${mode === 'update' ? ' Values this update changed have an orange edge.' : ''}</p>
        <${MetricsCardEdit} metrics=${draft.metrics} onChange=${m => upd(n => { n.metrics = m; })} />
      </div>` : null}
      <div className="field"><span className="field-label">Numbers and comparisons from the interview</span>
        ${(draft.evidence || []).filter(isMeasurable).length === 0 ? html`<p className="empty-note">None found in this interview.</p>` : null}
        ${(draft.evidence || []).map((ev, i) => isMeasurable(ev) ? html`<${EvidenceEdit} key=${ev.id} ev=${ev}
            onChange=${patch => upd(n => { Object.assign(n.evidence[i], patch); })}
            onRemove=${() => upd(n => { n.evidence.splice(i, 1); })}
            onShow=${hasTr && ev.source && ev.source.found ? () => showIn(ev.source.excerpt) : null} />` : null)}
        ${addBtn('Add measurable outcome', n => { n.evidence = (n.evidence || []).concat([{id: uid('ev'), category: 'reach', kind: 'numeric', statement: '', value: '', unit: '', before: '', after: '', timeframe: '', observer: '', status: 'reported', basis: '', source: {entryId: null, excerpt: '', found: false, note: ''}, observed: '', _new: mode === 'update'}]); })}
      </div>
    <//>

    <${Sec} title="Supporting evidence" count=${(draft.evidence || []).filter(isQualitative).length} open=${true}>
      <p className="small muted">Observations and testimonials. Each is labeled by who reported it and whether it's documented, estimated, or unverified.</p>
      ${(draft.evidence || []).filter(isQualitative).length === 0 ? html`<p className="empty-note">None found in this interview.</p>` : null}
      ${(draft.evidence || []).map((ev, i) => isQualitative(ev) ? html`<${EvidenceEdit} key=${ev.id} ev=${ev}
          onChange=${patch => upd(n => { Object.assign(n.evidence[i], patch); })}
          onRemove=${() => upd(n => { n.evidence.splice(i, 1); })}
          onShow=${hasTr && ev.source && ev.source.found ? () => showIn(ev.source.excerpt) : null} />` : null)}
      ${addBtn('Add observation', n => { n.evidence = (n.evidence || []).concat([{id: uid('ev'), category: 'personal', kind: 'qualitative', statement: '', value: '', unit: '', observer: '', status: 'qualitative', basis: '', source: {entryId: null, excerpt: '', found: false, note: ''}, observed: '', _new: mode === 'update'}]); })}
    <//>

    <${Sec} title="Quotes and materials" count=${(draft.quotes || []).length + (draft.materials || []).length} open=${true}>
      <div className="field"><span className="field-label">Quotes</span>
        <p className="small muted">Exact words appear word for word in the transcript. Remembered quotes are what Kyle recalls someone saying. Paraphrased statements can't be used as quotes.</p>
        ${(draft.quotes || []).length === 0 ? html`<p className="empty-note">No quotes found.</p>` : null}
        ${(draft.quotes || []).map((q, i) => html`<div className=${'quote-edit' + (q._new ? ' is-new' : '')} key=${q.id}>
          <textarea className="textarea" rows="2" aria-label="Quote" value=${q.text} onChange=${val((n, v) => { n.quotes[i].text = v; if (hasTr) n.quotes[i].found = recheck(v); })}></textarea>
          <div className="row">
            <${Field} label="Who said it"><input className="input" value=${q.speaker || ''} onChange=${val((n, v) => { n.quotes[i].speaker = v; })} /><//>
            <${Field} label="Kind"><select className="select" value=${q.kind} onChange=${val((n, v) => { n.quotes[i].kind = v; })}>${QUOTE_KINDS.map(k => html`<option key=${k.id} value=${k.id}>${k.label}</option>`)}</select><//>
          </div>
          <div className="row-between">
            ${q.kind !== 'paraphrase' && !q.found ? html`<p className="warn-note small">Not found word for word in the transcript. Mark it Paraphrased or fix the wording.</p>` : html`<span></span>`}
            ${trash('Remove quote', n => { n.quotes.splice(i, 1); })}
          </div>
        </div>`)}
      </div>
      <div className="field" style=${{marginTop: '8px'}}><span className="field-label">Photos, records and other materials</span>
      <p className="small muted">What exists and where it's kept.</p>
      ${(draft.materials || []).map((m, i) => html`<div className=${'list-row' + (m._new ? ' is-new' : '')} key=${m.id}>
        <select className="select select-sm" aria-label="Material type" value=${m.type} onChange=${val((n, v) => { n.materials[i].type = v; })}>${MATERIAL_TYPES.map(t => html`<option key=${t.id} value=${t.id}>${t.label}</option>`)}</select>
        <input className="input" aria-label="Description and location" value=${m.description} onChange=${val((n, v) => { n.materials[i].description = v; })} />
        ${trash('Remove material', n => { n.materials.splice(i, 1); })}
      </div>`)}
      ${addBtn('Add material', n => { n.materials = (n.materials || []).concat([{id: uid('mat'), type: 'photo', description: ''}]); })}
      </div>

    <//>

    <${Sec} title="Missing data" count=${(draft.missingMetrics || []).length + fuCount} open=${true}>
      <p className="small muted">Outcomes that were mentioned but not quantified or verified, and what to check on next.</p>
      ${(draft.missingMetrics || []).map((m, i) => html`<div className=${'ms-edit' + (m._new ? ' is-new' : '')} key=${m.id}>
        <div className="list-row"><input className="input" aria-label="Data gap" value=${m.metric} onChange=${val((n, v) => { n.missingMetrics[i].metric = v; })} />${trash('Remove data gap', n => { n.missingMetrics.splice(i, 1); })}</div>
        <div className="row">
          <${Field} label="Why it matters"><input className="input" value=${m.why || ''} onChange=${val((n, v) => { n.missingMetrics[i].why = v; })} /><//>
          <${Field} label="Where to find it"><input className="input" value=${m.howToGet || ''} onChange=${val((n, v) => { n.missingMetrics[i].howToGet = v; })} /><//>
        </div>
      </div>`)}
      ${(draft.evidence || []).some(e => e.status === 'future') ? html`<div className="field"><span className="field-label">Expected but not yet documented</span>
        ${(draft.evidence || []).map((ev, i) => ev.status === 'future' ? html`<${EvidenceEdit} key=${ev.id} ev=${ev} onChange=${patch => upd(n => { Object.assign(n.evidence[i], patch); })} onRemove=${() => upd(n => { n.evidence.splice(i, 1); })} onShow=${null} />` : null)}
      </div>` : null}
      ${addBtn('Add data gap', n => { n.missingMetrics = (n.missingMetrics || []).concat([{id: uid('mm'), metric: '', why: '', howToGet: ''}]); })}
    ${mode !== 'edit' ? html`<div className="field" style=${{marginTop: '8px'}}><span className="field-label">Follow-up <span className="muted">(${fuCount})</span></span>
      <p className="small muted">Actions that would make the story stronger. They stay on the story until marked done.</p>
      ${(draft.followUps || []).map((f, i) => showT(f) ? html`<div className=${'ms-edit' + (f._new ? ' is-new' : '')} key=${f.id}>
          <div className="list-row"><input className="input" aria-label="Follow-up action" value=${f.question} onChange=${val((n, v) => { n.followUps[i].question = v; })} />${trash('Remove follow-up', n => { n.followUps.splice(i, 1); })}</div>
          <${Field} label="Follow-up date (optional)"><input className="input" type="date" value=${f.due || ''} onChange=${val((n, v) => { n.followUps[i].due = v; })} /><//>
        </div>` : showQ(f) ? html`<div className="list-row" key=${f.id}>
          <span className="pill tone-teal">Question</span>
          <input className="input" aria-label="Open question" value=${f.question} onChange=${val((n, v) => { n.followUps[i].question = v; })} />
          ${trash('Remove question', n => { n.followUps.splice(i, 1); })}
        </div>` : null)}
      ${addBtn('Add follow-up', n => { n.followUps = (n.followUps || []).concat([{id: uid('f'), kind: 'task', question: '', due: '', status: 'open', answer: '', entryId: null}]); })}
    </div>` : null}

    <//>

    ${staff ? html`<${Sec} title="Student-to-staff journey" count=${(draft.journey || []).length} open=${(draft.journey || []).length > 0}>
      <p className="small muted">Only stages the interview supports. Remove any stage that isn't right; never add one that didn't happen.</p>
      ${(draft.journey || []).map((j, i) => html`<div className="ms-edit" key=${j.stage + i}>
        <div className="row">
          <${Field} label="Stage"><select className="select" value=${j.stage} onChange=${val((n, v) => { n.journey[i].stage = v; })}>${JOURNEY_STAGES.map(x => html`<option key=${x.id} value=${x.id}>${x.label}</option>`)}</select><//>
          <${Field} label="What happened"><input className="input" value=${j.text} onChange=${val((n, v) => { n.journey[i].text = v; })} /><//>
        </div>
        <div className="row-between">${j.excerpt ? html`<p className=${'small ' + (j.found ? 'muted' : 'warn-note')}>“${trunc(j.excerpt, 140)}”${j.found ? '' : ' Not found word for word in the transcript.'}</p>` : html`<span></span>`}${trash('Remove stage', n => { n.journey.splice(i, 1); })}</div>
      </div>`)}
      ${(draft.journey || []).length < JOURNEY_STAGES.length ? addBtn('Add stage', n => { const used = new Set((n.journey || []).map(j => j.stage)); const st = JOURNEY_STAGES.find(x => !used.has(x.id)); n.journey = (n.journey || []).concat([{stage: st.id, text: '', excerpt: '', found: false}]); }) : null}
      <${Field} label="Journey summary" hint="For a former ABG student: their progression from student to staff, without exaggerating ABG's role."><textarea id="ed-journey" className="textarea" rows="3" value=${draft.journeySummary || ''} onChange=${val((n, v) => { n.journeySummary = v; })}></textarea><//>
    <//>` : null}

    <${Sec} title=${staff ? 'Stakeholder relevance' : 'Stakeholder value'} open=${true}>
      <p className="small muted">${staff ? "How this person's experience can support ABG's communications and the consulting team's work, without overstating ABG's role." : "Why this student's experience matters, without overstating that ABG caused it."}</p>
      ${(staff ? STAFF_STAKEHOLDERS : [['schools', 'School administrators', 'How does ABG benefit students at our school?'], ['donors', 'Donors', 'What difference is our contribution making?'], ['grants', 'Grant providers', 'Can ABG demonstrate outcomes that justify continued funding?']]).map(([k, l, q]) => html`<${Field} key=${k} label=${l} hint=${q}><textarea className="textarea" rows="2" value=${(draft.stakeholderValue || {})[k] || ''} onChange=${val((n, v) => { n.stakeholderValue = Object.assign({}, n.stakeholderValue, {[k]: v}); })}></textarea><//>`)}
      <${Field} label="Summary" hint="Two or three sentences connecting the outcomes to all three audiences."><textarea id="ed-why" className="textarea" rows="3" value=${draft.stakeholderWhy || ''} onChange=${val((n, v) => { n.stakeholderWhy = v; })}></textarea><//>
      <div className="field"><span className="field-label">Most useful for</span><${ChipGroup} options=${AUDIENCES} value=${draft.audiences} label="Most useful for" onChange=${v => upd(n => { n.audiences = v; })} /></div>
      <div className="field"><span className="field-label">Impact categories</span><${ChipGroup} options=${CATEGORIES} value=${draft.categories} label="Impact categories" onChange=${v => upd(n => { n.categories = v; })} /></div>
      <div className="field"><span className="field-label">Impact themes</span><${ChipGroup} options=${THEMES} value=${draft.themes} label="Impact themes" onChange=${v => upd(n => { n.themes = v; })} /></div>
    <//>

    <${Sec} title=${staff ? 'Staff impact timeline' : 'Student impact timeline'} count=${(draft.milestones || []).length}>
      <p className="small muted">From initial circumstances to long-term outcomes. Future follow-up items are never shown as accomplishments.</p>
      ${(draft.milestones || []).map((m, i) => html`<div className=${'ms-edit' + (m._new ? ' is-new' : '')} key=${m.id}>
        <${Field} label="What happened"><input className="input" value=${m.label} onChange=${val((n, v) => { n.milestones[i].label = v; })} /><//>
        <div className="row">
          <${Field} label="When"><input className="input" placeholder="e.g. 2018" value=${(m.date && m.date.text) || ''} onChange=${val((n, v) => { n.milestones[i].date = Object.assign({}, n.milestones[i].date, {text: v}); })} /><//>
          <${Field} label="Sort date"><input className="input" placeholder="YYYY-MM" value=${(m.date && m.date.iso) || ''} onChange=${val((n, v) => { n.milestones[i].date = Object.assign({}, n.milestones[i].date, {iso: v}); })} /><//>
          <${Field} label="Stage"><select className="select" value=${m.phase} onChange=${val((n, v) => { n.milestones[i].phase = v; if (v === 'future') n.milestones[i].confirmed = false; })}>${PHASES.map(p => html`<option key=${p.id} value=${p.id}>${p.label}</option>`)}</select><//>
        </div>
        <div className="row-between">
          <label className="check"><input type="checkbox" checked=${!!m.confirmed} disabled=${m.phase === 'future'} onChange=${e => { const v = e.target.checked; upd(n => { n.milestones[i].confirmed = v; }); }} /> Confirmed event</label>
          ${trash('Remove milestone', n => { n.milestones.splice(i, 1); })}
        </div>
      </div>`)}
      ${addBtn('Add milestone', n => { n.milestones = (n.milestones || []).concat([{id: uid('m'), date: {text: '', iso: ''}, label: '', phase: 'immediate', confirmed: true, entryId: null, _new: mode === 'update'}]); })}
    <//>

    <${Sec} title="Story structure">
      <p className="small muted">Filled in only where the interview gives the detail. Leave blanks blank.</p>
      ${STRUCTURE.map(f => html`<${Field} key=${f.id} label=${f.label} hint=${f.hint}><textarea className="textarea" rows="2" value=${(draft.structure || {})[f.id] || ''} onChange=${val((n, v) => { n.structure = n.structure || {}; n.structure[f.id] = v; })}></textarea><//>`)}
    <//>

    ${suggest.length > 0 ? html`<${Sec} title="Possible connections" count=${suggest.length} open=${true}>
      ${suggest.map((l, i) => { const other = stories.find(s => s.id === l.storyId); if (!other) return null; return html`<div className="link-suggest" key=${l.storyId}>
        <p><strong>This story may be connected to a previous entry.</strong> Would you like to link them?</p>
        <p className="small"><${Pill} tone="blue">${labelOf(LINK_TYPES, l.type)}<//> ${other.alias ? other.alias + ': ' : ''}${other.title}</p>
        ${l.reason ? html`<p className="small muted">${l.reason}</p>` : null}
        <div className="row-btns">
          <button type="button" className=${'btn btn-sm ' + (l.decision === 'link' ? 'btn-primary' : 'btn-ghost')} onClick=${() => upd(n => { n._suggest[i].decision = 'link'; })}>${l.decision === 'link' ? 'Will link on save' : 'Link them'}</button>
          <button type="button" className="btn btn-sm btn-ghost" aria-pressed=${l.decision === 'no'} onClick=${() => upd(n => { n._suggest[i].decision = 'no'; })}>${l.decision === 'no' ? 'Marked not related' : 'Not related'}</button>
        </div>
      </div>`; })}
    <//>` : null}

    <${Sec} title="Privacy and approval" open=${true}>
      ${draft._wasApproved ? html`<p className="notice small">This story was approved before. Because this update changes it, it's back to Needs verification until you approve it again.</p>` : null}
      <${PrivacyPanel} value=${draft} onChange=${patch => upd(n => { Object.assign(n, patch); })} />
    <//>
  </div>`;
}
/* the short review Kyle sees before saving: fix the story, drop outcomes that aren't supported, confirm how each is known */
const SOURCE_CHOICES = [
  {id: 'observed', label: 'I saw it myself'},
  {id: 'self', label: 'The person told me about their own experience'},
  {id: 'community', label: 'A parent, teacher or someone else told me'},
  {id: 'verified', label: 'Confirmed by a document'},
  {id: 'unconfirmed', label: 'Not sure, or my impression'},
];
/* in a community story, the contributor is the source: their own experience is self-reported; what they witnessed is community-observed */
const COMMUNITY_SOURCE_CHOICES = [
  {id: 'self', label: 'Self-reported (their own experience)'},
  {id: 'community', label: 'Community-observed (they witnessed it)'},
  {id: 'verified', label: 'Independently verified by a document'},
  {id: 'unconfirmed', label: 'Unconfirmed or secondhand'},
];
function QuickReview({draft, setDraft, mode}){
  const {settings, stories} = useApp();
  const programs = uniq((settings.programs || []).concat(stories.filter(x => !x.demo).map(x => x.program)));
  const upd = fn => setDraft(d => { const n = clone(d); fn(n); return n; });
  const shown = (draft.evidence || []).map((e, i) => ({e, i})).filter(x => mode !== 'update' || x.e._new);
  const now = shown.filter(x => x.e.status !== 'future'), planned = shown.filter(x => x.e.status === 'future');
  const row = ({e, i}) => html`<div className="qr-row" key=${e.id}>
    <div className="qr-main">
      <p className="eyebrow">${e.status === 'future' ? 'Planned or hoped for' : outcomeCategoryLabel(e)}</p>
      <p className="qr-text">${e.statement}</p>
      ${hasComparison(e) ? html`<p className="small muted tnum">${e.before} → ${e.after}${e.timeframe ? ' (' + e.timeframe + ')' : ''}</p>` : null}
    </div>
    <div className="qr-side">
      ${e.status !== 'future' ? html`<label className="qr-src"><span className="small muted">How do you know?</span><select className="select select-sm" aria-label=${'How do you know: ' + e.statement} value=${evidenceClass(e)} onChange=${ev => { const v = ev.target.value; upd(n => { Object.assign(n.evidence[i], classPatch(n.evidence[i], v)); }); }}>${SOURCE_CHOICES.map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}</select></label>` : null}
      <button type="button" className="btn btn-ghost btn-xs" aria-label=${'Remove outcome: ' + e.statement} onClick=${() => upd(n => { n.evidence.splice(i, 1); })}>Remove</button>
    </div>
  </div>`;
  return html`<div className="quick-review">
    <section className="card qr-card">
      <h2>${mode === 'update' ? 'The updated story' : 'The story'}</h2>
      <p className="small muted">Read it through and fix anything that isn't right.</p>
      <${Field} label="Title"><input id="qr-title" className="input" value=${draft.title} onChange=${e => { const v = e.target.value; upd(n => { n.title = v; }); }} /><//>
      <${Field} label="Story"><textarea id="qr-story" className="textarea" rows="10" value=${draft.story || ''} onChange=${e => { const v = e.target.value; upd(n => { n.story = v; }); }}></textarea><//>
      <div className="row">
        <${Field} label="ABG program"><input id="qr-program" className="input" list="qr-programs" value=${draft.program || ''} onChange=${e => { const v = e.target.value; upd(n => { n.program = v; }); }} /><//>
        <${Field} label="School or community"><input id="qr-community" className="input" value=${draft.community || ''} onChange=${e => { const v = e.target.value; upd(n => { n.community = v; }); }} /><//>
      </div>
      <datalist id="qr-programs">${programs.map(p => html`<option key=${p} value=${p}></option>`)}</datalist>
    </section>
    ${isStaffStory(draft) ? (() => { const known = STAFF_FIELDS.filter(f => (draft.staffCard || {})[f.id] && asStr(draft.staffCard[f.id].value)).map(f => f.id); return html`<section className="card qr-card">
      <h2>Employment and development details <span className="count">${known.length} of ${STAFF_FIELDS.length}</span></h2>
      <p className="small muted">What the interview and intake form documented. Correct anything that's wrong, and change "Reported" to "Estimate" if it was approximate. Blank fields stay "not documented"; fill them in under All details if you know them.</p>
      ${known.length ? html`<${MetricsCardEdit} metrics=${draft.staffCard} fields=${STAFF_FIELDS} only=${known} onChange=${m => upd(n => { n.staffCard = m; })} />` : html`<p className="empty-note">Nothing documented yet. That's fine: unknown details are never counted as "no".</p>`}
      ${(draft.journey || []).length ? html`<h3 className="qr-sub">Student-to-staff journey</h3><ol className="journey-mini">${draft.journey.map(j => html`<li key=${j.stage}><strong>${labelOf(JOURNEY_STAGES, j.stage)}:</strong> ${j.text}</li>`)}</ol>` : null}
    </section>`; })() : null}
    <section className="card qr-card">
      <h2>Outcomes found <span className="count">${now.length}</span></h2>
      <p className="small muted">Remove anything the interview doesn't really support, and say how you know each one. "Confirmed by a document" is only for things you've seen in writing, like a report card or certificate.</p>
      ${now.length ? html`<div className="qr-list">${now.map(row)}</div>` : html`<p className="empty-note">No outcomes were found${mode === 'update' ? ' in this update' : ''}.</p>`}
      ${planned.length ? html`<h3 className="qr-sub">Planned, not yet happened</h3><p className="small muted">Kept separate from outcomes. They become follow-up reminders.</p><div className="qr-list">${planned.map(row)}</div>` : null}
    </section>
  </div>`;
}
function ReviewView({params}){
  const {caps, stories, students, staffPeople, nav, safeWrite, showToast, storyById, openSheet} = useApp();
  const {mode, storyId, analysis, entry, items, draftKey, whenHint, approx, followupId, answered, analyzedEntryIds, returnTo, studentId, studentName, newStudent, backlogId, studentInfo, kind, staffId, newStaff, staffInfo} = params;
  const base = storyId ? storyById(storyId) : null;
  const me = caps.me || {};
  const [draft, setDraft] = useState(() => buildReviewDraft({mode, base, analysis, whenHint, approx, me, followupId, answered, entry, studentId, studentName, studentInfo, kind, staffId, staffInfo}));
  const [saving, setSaving] = useState(false);
  const back = () => { if (returnTo) nav(returnTo.name, returnTo.params || {}); else if (storyId) nav('story', {id: storyId}); else nav('home'); };
  if (!draft) return html`<div className="view"><${FocusHeader} title="Review" onBack=${() => nav('library')} /><p className="notice">This story isn't in the journal anymore.</p></div>`;

  async function save(){
    if (!asStr(draft.title)) { showToast('Add a title before saving.'); return; }
    setSaving(true);
    const db = caps.db;
    const fin = finalizeStory(draft, me);
    const s = fin.story;
    if (entry) s.entryCount = base ? (base.entryCount || 1) + 1 : 1;
    const ok = await safeWrite(async () => {
      if (newStudent) { const sd = Object.assign({}, newStudent, {firstName: s.alias || newStudent.firstName, nameKey: norm(s.alias || newStudent.firstName)}); delete sd.id; await db.collection('students').doc(newStudent.id).set(sd); }
      else if (s.studentId && s.alias) {
        const st = students.find(x => x.id === s.studentId);
        if (st && st.firstName !== s.alias) await db.collection('students').doc(st.id).update({firstName: s.alias, nameKey: norm(s.alias)});
      }
      if (newStaff) { const sd = Object.assign({}, newStaff, {firstName: s.alias || newStaff.firstName, nameKey: norm(s.alias || newStaff.firstName)}); delete sd.id; await db.collection('staff').doc(newStaff.id).set(sd); }
      else if (s.staffId && s.alias) {
        const sp = (staffPeople || []).find(x => x.id === s.staffId);
        if (sp && sp.firstName !== s.alias) await db.collection('staff').doc(sp.id).update({firstName: s.alias, nameKey: norm(s.alias)});
      }
      if (entry) {
        const ed = Object.assign({}, entry, {storyId: s.id, summary: (analysis && analysis.entrySummary) || '', takeaways: (analysis && analysis.takeaways) || [], analyzed: true});
        delete ed.id;
        await db.collection('entries').doc(entry.id).set(ed);
      }
      for (const eid of (analyzedEntryIds || [])) await db.collection('entries').doc(eid).update({analyzed: true});
      const data = Object.assign({}, s); delete data.id;
      await db.collection('stories').doc(s.id).set(data);
      for (const l of fin.newLinks) {
        const other = stories.find(x => x.id === l.storyId);
        if (!other) continue;
        const ol = clone(other.links || []);
        if (!ol.some(x => x.storyId === s.id && x.type === l.type)) { ol.push({storyId: s.id, type: l.type, reason: l.reason, confirmed: true}); await db.collection('stories').doc(other.id).update({links: ol}); }
      }
      await markBacklogRecorded(db, backlogId, s.id, s.studentId);
    });
    setSaving(false);
    if (ok) { if (draftKey) clearDraft(draftKey); showToast(mode === 'edit' ? 'Changes saved' : 'Story saved'); nav('story', {id: s.id}); }
  }
  const title = mode === 'edit' ? 'Edit story' : mode === 'update' ? 'Review the update' : isStaffStory(draft) ? 'Staff Impact Report' : 'Student Impact Report';
  return html`<div className="view review">
    <${FocusHeader} title=${title} sub=${mode === 'update' && base ? base.title : mode === 'new' ? 'Step 3 of 3' + (draft.alias ? ': ' + draft.alias : '') : (draft.alias || null)} onBack=${back}
      action=${mode !== 'edit' ? html`<div className="focus-actions"><button type="button" className="btn btn-ghost btn-sm new-story-btn" id="rv-new-story" onClick=${() => openSheet(close => html`<${ConfirmSheet} close=${close} title="Start a new story?" body="Your current unsaved progress will be lost." confirmLabel="Start New Story" onConfirm=${() => { discardDraft(draftKey); nav('interview', {fresh: true}); }} />`)}><${Icon} name="plus" size=${16} /> <span className="nsb-long">Start New Story</span><span className="nsb-short" aria-hidden="true">New story</span></button></div>` : null} />
    ${mode !== 'edit' ? html`<p className="review-note"><${Icon} name="spark" size=${16} /><span>Claude drafted this from your words. Nothing is saved until you press Save, and nothing is approved for outside use until you approve it.${mode === 'update' ? ' New items are marked with an orange edge.' : ''}</span></p>` : null}
    ${mode === 'edit' ? html`<${StoryEditor} draft=${draft} setDraft=${setDraft} items=${items || []} mode=${mode} />` : html`
      <${QuickReview} draft=${draft} setDraft=${setDraft} mode=${mode} />
      <details className="sec all-details"><summary><span>All details (optional)<span className="count">${isStaffStory(draft) ? 'transcript, staff card, journey, timeline, privacy' : 'transcript, metrics card, timeline, privacy'}</span></span><${Icon} name="chev" size=${18} /></summary>
        <div className="sec-body"><${StoryEditor} draft=${draft} setDraft=${setDraft} items=${items || []} mode=${mode} /></div>
      </details>`}
    <div className="savebar"><div className="inner">
      <button className="btn btn-ghost" onClick=${back} disabled=${saving}>${returnTo && returnTo.name === 'interview' ? 'Back to interview' : returnTo && returnTo.name === 'record' ? 'Back to transcript' : 'Cancel'}</button>
      <button className="btn btn-primary" onClick=${save} disabled=${saving}>${saving ? 'Saving…' : (mode === 'edit' ? 'Save changes' : 'Save story')}</button>
    </div></div>
  </div>`;
}

/* ================= sheets used from story pages ================= */
function AnalysisRunner({close, mode, story, items, params}){
  const {caps, stories, nav} = useApp();
  const [err, setErr] = useState('');
  const ctlRef = useRef(null);
  const started = useRef(false);
  async function run(){
    setErr('');
    const ctl = new AbortController(); ctlRef.current = ctl;
    try {
      const analysis = await runAnalysis({sample: caps.sample, mode, story, stories, items, whenHint: '', signal: ctl.signal});
      ctlRef.current = null;
      close();
      nav('review', {mode, storyId: story.id, analysis, entry: params.entry || null, items: params.showItems || items, analyzedEntryIds: params.analyzedEntryIds || [], answered: params.answered || null, returnTo: {name: 'story', params: {id: story.id}}});
    } catch (e) {
      ctlRef.current = null;
      if (e && e.code === 'cancelled') { close(); return; }
      setErr(aiErrorMessage(e));
    }
  }
  useEffect(() => { if (!started.current) { started.current = true; run(); } return () => { if (ctlRef.current) ctlRef.current.abort(); }; }, []);
  if (err) return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title="Analysis didn't finish" close=${close} /><p className="error">${err}</p><div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Close</button><button className="btn btn-primary" onClick=${run}>Try again</button></div></div>`;
  return html`<${Analyzing} title=${mode === 'update' ? 'Claude is adding this to the story' : 'Claude is reading the story'} onStop=${() => ctlRef.current && ctlRef.current.abort()} />`;
}
function AnswerSheet({storyId, close}){
  const {caps, stories, safeWrite, showToast, storyById} = useApp();
  const story = storyById(storyId);
  const [qs] = useState(() => story ? openQuestions(story) : []);
  const [ans, setAns] = useState({});
  const [running, setRunning] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!story) return html`<div><${SheetHead} title="Follow-up questions" close=${close} /><p>This story isn't in the journal anymore.</p></div>`;
  if (running) return html`<${AnalysisRunner} close=${close} mode="update" story=${story} items=${running.items} params=${{entry: running.entry, answered: running.statusList}} />`;
  const setA = (id, patch) => setAns(a => Object.assign({}, a, {[id]: Object.assign({status: 'open', text: ''}, a[id] || {}, patch)}));
  async function submit(){
    const answered = qs.filter(q => ans[q.id] && ans[q.id].status === 'open' && asStr(ans[q.id].text));
    const marked = qs.filter(q => ans[q.id] && (ans[q.id].status === 'unknown' || ans[q.id].status === 'skipped'));
    const statusList = answered.map(q => ({id: q.id, status: 'answered', answer: asStr(ans[q.id].text)})).concat(marked.map(q => ({id: q.id, status: ans[q.id].status, answer: ''})));
    if (!statusList.length) { close(); return; }
    if (!answered.length) {
      setSaving(true);
      const fu = clone(story.followUps || []).map(f => { const x = statusList.find(y => y.id === f.id); return x ? Object.assign(f, {status: x.status}) : f; });
      const ok = await safeWrite(() => caps.db.collection('stories').doc(story.id).update({followUps: fu, updatedAt: nowISO()}));
      setSaving(false);
      if (ok) { showToast('Saved'); close(); }
      return;
    }
    const qa = answered.map(q => 'Q: ' + q.question + '\nA: ' + asStr(ans[q.id].text)).join('\n\n');
    const entry = {id: uid('e'), storyId: story.id, recordedAt: nowISO(), eventDateText: '', eventApprox: false, prompt: 'Follow-up questions', transcript: qa, transcriptEdited: null, summary: '', takeaways: [], source: 'followup', analyzed: false, createdBy: (caps.me && caps.me.id) || null};
    if (!caps.sample) {
      setSaving(true);
      const fu = clone(story.followUps || []).map(f => { const x = statusList.find(y => y.id === f.id); return x ? Object.assign(f, {status: x.status, answer: x.answer, entryId: x.status === 'answered' ? entry.id : null}) : f; });
      const ed = Object.assign({}, entry); delete ed.id;
      const ok = await safeWrite(async () => { await caps.db.collection('entries').doc(entry.id).set(ed); await caps.db.collection('stories').doc(story.id).update({followUps: fu, entryCount: (story.entryCount || 1) + 1, updatedAt: nowISO()}); });
      setSaving(false);
      if (ok) { showToast('Answers saved'); close(); }
      return;
    }
    setRunning({entry, statusList, items: [{id: entry.id, text: qa, recordedAt: entry.recordedAt}]});
  }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Follow-up questions" close=${close} />
    <p className="small muted">All optional. Type, or use your keyboard's microphone. Choose Unknown or Skip for anything you can't answer.</p>
    ${qs.map(q => { const a = ans[q.id] || {status: 'open', text: ''}; const off = a.status === 'unknown' || a.status === 'skipped'; return html`<div className="qa" key=${q.id}>
      <p className="q">${q.question}</p>
      <textarea className="textarea" rows="3" aria-label=${q.question} value=${a.text} disabled=${off} onChange=${e => setA(q.id, {text: e.target.value})}></textarea>
      <div className="row-btns">
        <button type="button" className="chip" aria-pressed=${a.status === 'unknown'} onClick=${() => setA(q.id, {status: a.status === 'unknown' ? 'open' : 'unknown'})}>Unknown</button>
        <button type="button" className="chip" aria-pressed=${a.status === 'skipped'} onClick=${() => setA(q.id, {status: a.status === 'skipped' ? 'open' : 'skipped'})}>Skip</button>
      </div>
    </div>`; })}
    <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" disabled=${saving} onClick=${submit}>${saving ? 'Saving…' : 'Add to story'}</button></div>
  </div>`;
}
function AdaptSheet({storyId, close}){
  const {caps, stories, safeWrite, showToast, storyById} = useApp();
  const story = storyById(storyId);
  const [aud, setAud] = useState(() => (story && (story.audiences || [])[0]) || 'donors');
  const [fmt, setFmt] = useState(() => { const a0 = story && (story.audiences || [])[0]; const f0 = FORMATS.find(f => f.aud === a0); return f0 ? f0.id : 'donor_story'; });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ctlRef = useRef(null);
  const runs = useRef(0);
  useEffect(() => () => { if (ctlRef.current) ctlRef.current.abort(); }, []);
  if (!story) return html`<div><${SheetHead} title="Adapt Story for Audience" close=${close} /><p>This story isn't in the journal anymore.</p></div>`;
  if (story.status !== 'approved') return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title="Adapt Story for Audience" close=${close} /><p>Approve this story for external use first. Audience drafts only come from approved stories, so nothing unapproved ends up in donor or partner materials.</p><p className="small muted">Set the status in the Privacy and approval section at the bottom of the story.</p><div className="row-btns end"><button className="btn btn-primary" onClick=${close}>OK</button></div></div>`;
  if (!caps.sample) return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title="Adapt Story for Audience" close=${close} /><p>Claude isn't available in this view, so drafts can't be written here.</p></div>`;
  async function write(){
    setErr(''); setBusy(true); setText('');
    const ctl = new AbortController(); ctlRef.current = ctl; runs.current += 1;
    try {
      const r = await caps.sample(adaptPrompt(story, aud, fmt), {signal: ctl.signal, cache: runs.current > 1 ? false : true, onText: u => setText(u.text)});
      setText(r.text);
    } catch (e) {
      setText(e && e.code !== 'refused' && e.text ? e.text : '');
      if (!(e && e.code === 'cancelled')) setErr(aiErrorMessage(e));
    }
    ctlRef.current = null; setBusy(false);
  }
  async function saveDraft(){
    const d = clone(story.drafts || []);
    d.push({id: uid('d'), audience: aud, format: fmt, text: text.trim(), createdAt: nowISO(), approved: false});
    const ok = await safeWrite(() => caps.db.collection('stories').doc(story.id).update({drafts: d, updatedAt: nowISO()}));
    if (ok) { showToast('Draft saved to the story'); close(); }
  }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Adapt Story for Audience" close=${close} />
    <p className="small muted">Same facts, different emphasis. Versions stay editable and need approval before external distribution. The first name is used only when publication permission is documented.</p>
    <div className="row">
      <${Field} label="Format"><select id="adapt-fmt" className="select" value=${fmt} onChange=${e => { const v = e.target.value; setFmt(v); const f = byId(FORMATS, v); if (f && f.aud) setAud(f.aud); }}>${FORMATS.map(f => html`<option key=${f.id} value=${f.id}>${f.label}</option>`)}</select><//>
      <${Field} label="Audience"><select id="adapt-aud" className="select" value=${aud} onChange=${e => setAud(e.target.value)}>${AUDIENCES.map(a => html`<option key=${a.id} value=${a.id}>${a.label}</option>`)}</select><//>
    </div>
    <div className="row-btns">
      <button className="btn btn-primary" onClick=${write} disabled=${busy}><${Icon} name="spark" size=${18} /> ${busy ? 'Writing…' : text ? 'Write another version' : 'Write draft'}</button>
      ${busy ? html`<button className="btn btn-ghost" onClick=${() => ctlRef.current && ctlRef.current.abort()}>Stop</button>` : null}
    </div>
    ${err ? html`<p className="error">${err}</p>` : null}
    ${text || busy ? html`<textarea id="adapt-text" className="textarea" rows="10" aria-label="Draft text" readOnly=${busy} value=${text || 'Thinking…'} onChange=${e => setText(e.target.value)}></textarea>` : null}
    ${text && !busy ? html`<div className="row-btns end"><${CopyButton} text=${text} /><button className="btn btn-ghost btn-sm" onClick=${saveDraft}>Save draft to story</button></div>` : null}
  </div>`;
}
function AddEvidenceSheet({storyId, close, kind}){
  const {caps, stories, safeWrite, showToast, storyById} = useApp();
  const numeric = kind !== 'qualitative';
  const [f, setF] = useState({statement: '', category: numeric ? 'reach' : 'personal', value: '', unit: '', before: '', after: '', timeframe: '', observer: 'abg_staff', status: numeric ? 'reported' : 'qualitative', note: '', metric: '', domain: numeric ? 'attendance' : 'confidence', direction: 'improved'});
  const set = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
  async function save(){
    const story = storyById(storyId);
    if (!story || !asStr(f.statement)) return;
    const v = toNum(f.value);
    const ev = clone(story.evidence || []);
    ev.push({id: uid('ev'), category: f.category, kind: numeric ? 'numeric' : 'qualitative', statement: asStr(f.statement), value: v, unit: asStr(f.unit), before: asStr(f.before), after: asStr(f.after), timeframe: asStr(f.timeframe), observer: f.observer, status: f.status, metric: asStr(f.metric), domain: f.domain, direction: f.direction, level: f.status === 'verified' ? 3 : (asStr(f.before) && asStr(f.after) ? 2 : 1), source: {entryId: null, excerpt: '', found: false, note: asStr(f.note)}, observed: todayLocal()});
    const ok = await safeWrite(() => caps.db.collection('stories').doc(storyId).update({evidence: ev, updatedAt: nowISO()}));
    if (ok) { showToast('Evidence added'); close(); }
  }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title=${numeric ? 'Add a measurable outcome' : 'Add qualitative evidence'} close=${close} />
    <p className="small muted">${numeric ? 'For something counted or compared, like sessions attended, months in the program, or how the student acted before versus now.' : 'For an observation, or something a teacher, parent, or the student told you.'}</p>
    <div className="row">
      <${Field} label="Metric"><input id="ae-metric" className="input" placeholder=${numeric ? 'e.g. School attendance rate' : 'e.g. Classroom participation'} value=${f.metric} onChange=${e => set('metric', e.target.value)} /><//>
      <${Field} label="Impact area"><select id="ae-domain" className="select" value=${f.domain} onChange=${e => set('domain', e.target.value)}>${DOMAINS.map(d => html`<option key=${d.id} value=${d.id}>${d.label}</option>`)}</select><//>
    </div>
    <${Field} label="What it shows"><textarea id="ae-statement" className="textarea" rows="2" value=${f.statement} onChange=${e => set('statement', e.target.value)}></textarea><//>
    <${Field} label="Change"><select id="ae-direction" className="select" value=${f.direction} onChange=${e => set('direction', e.target.value)}>${DIRECTIONS.map(d => html`<option key=${d.id} value=${d.id}>${d.label}</option>`)}</select><//>
    ${numeric ? html`<div className="row">
      <${Field} label="Number (optional)"><input id="ae-value" className="input" inputMode="decimal" value=${f.value} onChange=${e => set('value', e.target.value)} /><//>
      <${Field} label="Unit"><input id="ae-unit" className="input" placeholder="percent, sessions, years" value=${f.unit} onChange=${e => set('unit', e.target.value)} /><//>
    </div>
    <div className="row">
      <${Field} label="Before (optional)"><input id="ae-before" className="input" placeholder="e.g. 78% attendance" value=${f.before} onChange=${e => set('before', e.target.value)} /><//>
      <${Field} label="After (optional)"><input id="ae-after" className="input" placeholder="e.g. 93% attendance" value=${f.after} onChange=${e => set('after', e.target.value)} /><//>
    </div>
    <${Field} label="Period compared (optional)"><input id="ae-time" className="input" placeholder="e.g. fall 2025 to spring 2026" value=${f.timeframe} onChange=${e => set('timeframe', e.target.value)} /><//>` : null}
    <${Field} label="Observed or reported by"><select id="ae-observer" className="select" value=${f.observer} onChange=${e => set('observer', e.target.value)}>${OBSERVERS.map(o => html`<option key=${o.id} value=${o.id}>${o.label}</option>`)}</select><//>
    <div className="row">
      <${Field} label="Category"><select id="ae-cat" className="select" value=${f.category} onChange=${e => set('category', e.target.value)}>${CATEGORIES.map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}</select><//>
      <${Field} label="Status"><select id="ae-status" className="select" value=${f.status} onChange=${e => set('status', e.target.value)}>${EVIDENCE_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</select><//>
    </div>
    <${Field} label="Source"><input id="ae-source" className="input" placeholder="e.g. Saturday sessions, or what her teacher said" value=${f.note} onChange=${e => set('note', e.target.value)} /><//>
    <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" disabled=${!asStr(f.statement)} onClick=${save}>Add evidence</button></div>
  </div>`;
}
function AddTaskSheet({storyId, close}){
  const {caps, stories, safeWrite, showToast, storyById} = useApp();
  const [q, setQ] = useState('');
  const [due, setDue] = useState('');
  async function save(){
    const story = storyById(storyId);
    if (!story || !asStr(q)) return;
    const fu = clone(story.followUps || []);
    fu.push({id: uid('f'), kind: 'task', question: asStr(q), due: due, status: 'open', answer: '', entryId: null});
    const ok = await safeWrite(() => caps.db.collection('stories').doc(storyId).update({followUps: fu, updatedAt: nowISO()}));
    if (ok) { showToast('Reminder added'); close(); }
  }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Check back later" close=${close} />
    <p className="small muted">A possible development to follow up on. It stays a possibility until you record what happened.</p>
    <${Field} label="What to find out"><input id="at-q" className="input" placeholder="e.g. Is she still painting after the program ended?" value=${q} onChange=${e => setQ(e.target.value)} /><//>
    <${Field} label="Follow-up date (optional)"><input id="at-due" className="input" type="date" value=${due} onChange=${e => setDue(e.target.value)} /><//>
    <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" disabled=${!asStr(q)} onClick=${save}>Add reminder</button></div>
  </div>`;
}
function TranscriptSheet({entry, close}){
  const {caps, safeWrite, showToast} = useApp();
  const [t, setT] = useState(entry.transcriptEdited || entry.transcript || '');
  async function save(){ const v = t.trim(); const ok = await safeWrite(() => caps.db.collection('entries').doc(entry.id).update({transcriptEdited: v && v !== entry.transcript ? v : null})); if (ok) { showToast('Transcript corrected. The original is still on file.'); close(); } }
  async function restore(){ const ok = await safeWrite(() => caps.db.collection('entries').doc(entry.id).update({transcriptEdited: null})); if (ok) { showToast('Original transcript restored'); close(); } }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Correct transcript" close=${close} />
    <p className="small muted">Fix dictation slips here. The original transcript is kept unchanged alongside your correction.</p>
    <textarea id="tr-edit" className="textarea" rows="12" value=${t} onChange=${e => setT(e.target.value)} aria-label="Corrected transcript"></textarea>
    <div className="row-btns end">${entry.transcriptEdited ? html`<button className="btn btn-quiet" onClick=${restore}>Restore original</button>` : null}<button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" onClick=${save}>Save correction</button></div>
  </div>`;
}
function ConfirmSheet({title, body, confirmLabel, onConfirm, close}){
  const [busy, setBusy] = useState(false);
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title=${title} close=${close} />
    <p>${body}</p>
    <div className="row-btns end"><button className="btn btn-ghost" onClick=${close} disabled=${busy}>Cancel</button><button className="btn btn-danger" disabled=${busy} onClick=${async () => { setBusy(true); await onConfirm(); setBusy(false); close(); }}>${busy ? 'Working…' : confirmLabel}</button></div>
  </div>`;
}

/* ================= story detail ================= */
function EvidenceRow({ev, entries, onStatus, readOnly}){
  const [open, setOpen] = useState(false);
  const src = ev.source || {};
  const entry = (entries || []).find(e => e.id === src.entryId);
  const tone = (byId(EVIDENCE_STATUS, ev.status) || {}).tone || 'neutral';
  return html`<div className="ev">
    <p className="eyebrow">${labelOf(DOMAINS, domainOf(ev))}${ev.level ? ' · Level ' + ev.level : ''}${ev.direction && ev.direction !== 'unclear' ? ' · ' + labelOf(DIRECTIONS, ev.direction) : ''}</p>
    <div className="ev-head">
      <p className="ev-statement">${ev.value != null && ev.value !== '' ? html`<span className="ev-num tnum">${fmtNum(ev.value)}${ev.unit ? ' ' + ev.unit : ''}</span>` : null}${ev.statement}</p>
      <${EvLabel} e=${ev} />
    </div>
    ${!readOnly ? html`<label className="small muted ev-verify">Verification <select className=${'status-select tone-' + tone} aria-label="Verification status" value=${ev.status} onChange=${e => onStatus(e.target.value)}>${EVIDENCE_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</select></label>` : null}
    ${comparisonText(ev) ? html`<p className="ev-compare small tnum">${comparisonText(ev)}</p>` : null}
    ${ev.observation ? html`<p className="small"><span className="muted">Supporting observation:</span> ${ev.observation}</p>` : null}
    ${ev.contribution || ev.activity ? html`<p className="small"><span className="muted">ABG's possible contribution:</span> ${[ev.activity, ev.contribution].filter(Boolean).join(': ')}</p>` : null}
    ${ev.openQuestion ? html`<p className="small"><span className="muted">Still unknown:</span> ${ev.openQuestion}</p>` : null}
    <p className="small muted">${ev.observer ? 'Observed by: ' + labelOf(OBSERVERS, ev.observer) + ' · ' : ''}Source: ${ev.basis || (src.note ? src.note : (src.excerpt ? "Kyle's account" : 'not recorded'))}</p>
    ${src.excerpt ? html`<button type="button" className="btn btn-quiet btn-sm src-toggle" aria-expanded=${open} onClick=${() => setOpen(o => !o)}>${open ? 'Hide passage' : 'Show passage'}</button>` : null}
    ${open ? html`<div className=${'excerpt' + (!src.found ? ' missing' : '')}>
      <span>“${src.excerpt}”</span>
      ${entry ? html`<span className="small"> From the entry recorded ${fmtDate(entry.recordedAt)}.</span>` : null}
      ${!src.found ? html`<span className="warn-note"> Not found word for word in the transcript.</span>` : null}
    </div>` : null}
  </div>`;
}
/* completed milestones in order, with each follow-up interview shown where it was recorded */
function Timeline({milestones, entries}){
  const updates = (entries || []).slice().sort((a, b) => (a.recordedAt || '').localeCompare(b.recordedAt || '')).slice(1)
    .map(e => ({id: 'u-' + e.id, update: true, label: e.summary || 'Story update recorded', date: {text: fmtDate(e.recordedAt), iso: (e.recordedAt || '').slice(0, 7)}}));
  const items = milestones.map(m => ({m, iso: (m.date && m.date.iso) || ''})).concat(updates.map(u => ({m: u, iso: u.date.iso})));
  const dated = items.filter(x => x.iso).sort((a, b) => a.iso.localeCompare(b.iso)), undated = items.filter(x => !x.iso);
  const all = milestones.length && !milestones.some(m => m.date && m.date.iso) ? milestones.map(m => ({m})).concat(updates.map(u => ({m: u}))) : dated.concat(undated);
  if (!all.length) return html`<p className="empty-note">No milestones yet. Add a new observation when you learn what happened next.</p>`;
  return html`<ol className="timeline">${all.map(({m}) => { const pending = !m.update && !m.confirmed; return html`<li key=${m.id} className=${'tl-item ' + (m.update ? 'tl-update' : 'phase-' + m.phase) + (pending ? ' pending' : '')}>
    <span className="tl-swatch" aria-hidden="true"></span>
    <p className="eyebrow">${m.update ? 'Follow-up update' : labelOf(PHASES, m.phase)} · ${fmtEventDate(m.date) || 'Date unknown'}</p>
    <p>${m.label}</p>
    ${pending ? html`<p className="small muted">Unconfirmed</p>` : null}
  </li>`; })}</ol>`;
}
function MaterialSheet({storyId, close}){
  const {caps, stories, safeWrite, showToast, storyById} = useApp();
  const [type, setType] = useState('photo');
  const [desc, setDesc] = useState('');
  async function save(){
    const story = storyById(storyId);
    if (!story || !asStr(desc)) return;
    const m = clone(story.materials || []); m.push({id: uid('mat'), type, description: asStr(desc)});
    const ok = await safeWrite(() => caps.db.collection('stories').doc(storyId).update({materials: m, updatedAt: nowISO()}));
    if (ok) { showToast('Material added'); close(); }
  }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Add supporting material" close=${close} />
    <p className="small muted">Note what exists and where it's kept, such as "Mural photos in the ABG Drive, Fall 2024 folder". Files themselves stay where they are.</p>
    <${Field} label="Type"><select id="mat-type" className="select" value=${type} onChange=${e => setType(e.target.value)}>${MATERIAL_TYPES.map(t => html`<option key=${t.id} value=${t.id}>${t.label}</option>`)}</select><//>
    <${Field} label="What it is and where it's kept"><input id="mat-desc" className="input" value=${desc} onChange=${e => setDesc(e.target.value)} /><//>
    <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" disabled=${!asStr(desc)} onClick=${save}>Add material</button></div>
  </div>`;
}
function TurnsView({turns}){
  return html`<div className="view" style=${{gap: '12px'}}>${turns.map((t, i) => html`<div className="turn" key=${i}><p className="turn-q">${t.q}</p><p className=${'turn-a transcript' + (t.status === 'skipped' ? ' muted' : '')}>${t.status === 'skipped' ? 'Skipped' : t.a}</p>${(t.audio || []).map((c, j) => html`<${AudioClip} key=${c.path} path=${c.path} label=${'Play recording' + ((t.audio || []).length > 1 ? ' ' + (j + 1) : '') + (c.seconds ? ' (' + mmss(c.seconds) + ')' : '')} />`)}</div>`)}</div>`;
}
function StoryView({id}){
  const {caps, stories, students, staffPeople, storiesLoaded, nav, openSheet, safeWrite, showToast, readOnly, role, storyById} = useApp();
  const story = storyById(id);
  const [entries, setEntries] = useState(null);
  const [openEntry, setOpenEntry] = useState(null);
  const [showOrig, setShowOrig] = useState({});
  useEffect(() => {
    const unsub = caps.db.collection('entries').where('storyId', '==', id).onSnapshot(
      snap => setEntries(snap.docs.map(d => Object.assign({id: d.id}, d.data())).sort((a, b) => (a.recordedAt || '').localeCompare(b.recordedAt || ''))),
      () => setEntries([]));
    return () => unsub();
  }, [id]);
  const names = useNames((entries || []).map(e => e.createdBy));
  if (!story) return html`<div className="view">${storiesLoaded ? html`<div className="empty"><h3>This story isn't in the journal</h3><p className="muted">It may have been deleted.</p><button className="btn btn-primary" onClick=${() => nav('library')}>Go to Story Library</button></div>` : html`<div className="skeleton"></div><div className="skeleton"></div>`}</div>`;

  const me = caps.me || {};
  const update = fields => safeWrite(() => caps.db.collection('stories').doc(id).update(Object.assign({}, fields, {updatedAt: nowISO(), updatedBy: me.id || null})));
  const student = story.studentId ? students.find(x => x.id === story.studentId) : null;
  const siblings = story.studentId ? stories.filter(s => s.studentId === story.studentId && s.id !== id) : [];
  const unanalyzed = (entries || []).filter(e => e.analyzed === false);
  const never = !story.analysis || story.analysis.state !== 'done';
  const oq = openQuestions(story);
  const tasks = (story.followUps || []).filter(f => f.kind === 'task');
  const doneQs = (story.followUps || []).filter(f => f.kind === 'question' && f.status !== 'open');
  const linked = (story.links || []).map(l => Object.assign({}, l, {other: stories.find(s => s.id === l.storyId)})).filter(l => l.other);
  const items = (entries || []).map(e => ({id: e.id, text: e.transcript || '', alt: e.transcriptEdited || '', recordedAt: e.recordedAt}));
  const evAll = (story.evidence || []).map((e, i) => ({e, i}));
  const RANK = {verified: 0, reported: 1, estimate: 2, unverified: 3, qualitative: 1};
  const byRank = (a, b) => (RANK[a.e.status] || 0) - (RANK[b.e.status] || 0);
  const LRANK = {verified: 0, teacher: 1, student: 2, staff: 3, estimate: 4, unverified: 5};
  const byLabel = (a, b) => (LRANK[evidenceLabelId(a.e)] || 0) - (LRANK[evidenceLabelId(b.e)] || 0);
  const comparisons = evAll.filter(x => x.e.status !== 'future' && hasComparison(x.e)).sort((a, b) => DOMAINS.findIndex(d => d.id === domainOf(a.e)) - DOMAINS.findIndex(d => d.id === domainOf(b.e)));
  const others = evAll.filter(x => x.e.status !== 'future' && !hasComparison(x.e)).sort(byLabel);

  const expected = evAll.filter(x => x.e.status === 'future');
  const unknownCard = METRIC_FIELDS.filter(f => !metricVal(story, f.id));
  const milestoneItems = storyMilestoneItems(story);
  const editStory = () => nav('review', {mode: 'edit', storyId: id, items, returnTo: {name: 'story', params: {id}}});
  const ms = sortMilestones(story.milestones || []);
  const ov = story.overview || {};
  const ev = fmtEventDate(story.eventDate);
  const updates = Math.max(0, (story.entryCount || 1) - 1);
  const filledStructure = STRUCTURE.filter(f => (story.structure || {})[f.id]);
  const primaryAud = (story.audiences || []).slice(0, 3);
  const updateTarget = (story.studentId || story.alias || isStaffStory(story)) ? 'interview' : 'record';
  const staff = isStaffStory(story);
  const si = cleanStaffInfo(story.staffInfo);
  const staffPerson = staff && story.staffId ? (staffPeople || []).find(x => x.id === story.staffId) : null;
  const staffSiblings = staff && story.staffId ? stories.filter(s => s.staffId === story.staffId && s.id !== id) : [];
  const samePerson = linked.filter(l => l.type === 'same_person');
  const staffRows = [
    ['Staff member', (story.alias || 'Not recorded') + (staffPerson && staffPerson.note ? ' (' + staffPerson.note + ')' : '')],
    ['Story type', 'Staff Impact'], ['Current or former', si.status ? labelOf(STAFF_STATUS, si.status) : ''], ['Role at ABG', (staffVal(story, 'role') || {}).value || si.role],
    ['Started working with ABG', si.startYear || (staffVal(story, 'startYear') || {}).value], ['Employment type', si.employmentType ? labelOf(EMPLOYMENT_TYPES, si.employmentType) : ''],
    ['Former ABG student', si.formerStudent ? labelOf(FORMER_STUDENT, si.formerStudent) : 'Not recorded'],
    ['First participated in ABG', si.firstParticipatedYear], ['Programs as a student', si.programs], ['Began working for ABG', si.transitionYear],
    ['Background', ov.background], ['ABG program', story.program],
    ['Recorded', fmtDate(story.createdAt) + (updates > 0 ? ' · last update ' + fmtDate(story.updatedAt) : '')],
  ].filter(r => r[1]);
  const overviewRows = [
    ['Student', (story.alias || 'Not recorded') + (student && student.note ? ' (' + student.note + ')' : '')],
    ['Gender', ov.gender ? labelOf(GENDERS, ov.gender) : ''], ['Age or grade', ov.ageOrGrade], ['School or community', story.community], ['Other details', ov.demographics], ['Background', ov.background], ['ABG program', story.program],
    ['When involved', ov.involvementDate || (ev ? ev + (story.eventDate.approximate ? ' (approx.)' : '') : '')],
    ['Recorded', fmtDate(story.createdAt) + (updates > 0 ? ' · last update ' + fmtDate(story.updatedAt) : '')],
  ].filter(r => r[1]);

  function startAnalysis(){
    if (!caps.sample) { showToast("Claude isn't available in this view."); return; }
    if (!entries || !entries.length) { showToast('There are no entries to analyze.'); return; }
    if (never) openSheet(close => html`<${AnalysisRunner} close=${close} mode="new" story=${story} items=${items} params=${{analyzedEntryIds: entries.map(e => e.id)}} />`);
    else { const ua = items.filter(it => unanalyzed.some(u => u.id === it.id)); openSheet(close => html`<${AnalysisRunner} close=${close} mode="update" story=${story} items=${ua} params=${{analyzedEntryIds: ua.map(x => x.id)}} />`); }
  }
  const setEvStatus = (i, v) => { const e = clone(story.evidence || []); if (!e[i]) return; e[i].status = v; update({evidence: e}); };
  const setQuote = (i, v) => { const q = clone(story.quotes || []); if (!q[i]) return; q[i].approved = v; update({quotes: q}); };
  const setTask = (tid, patch) => { const fu = clone(story.followUps || []).map(f => f.id === tid ? Object.assign(f, patch) : f); update({followUps: fu}); };
  const setDraftApproved = (did, v) => { const d = clone(story.drafts || []).map(x => x.id === did ? Object.assign(x, {approved: v}) : x); update({drafts: d}); };
  const removeDraft = did => update({drafts: clone(story.drafts || []).filter(x => x.id !== did)});
  const removeMaterial = mid => update({materials: clone(story.materials || []).filter(x => x.id !== mid)});
  const removeMissing = mid => update({missingMetrics: clone(story.missingMetrics || []).filter(x => x.id !== mid)});
  const unlink = sid => openSheet(close => html`<${ConfirmSheet} close=${close} title="Remove link?" body="The two stories stay in the journal. Only the connection is removed." confirmLabel="Remove link" onConfirm=${async () => {
    await update({links: clone(story.links || []).filter(l => l.storyId !== sid)});
    const other = stories.find(s => s.id === sid);
    if (other) await safeWrite(() => caps.db.collection('stories').doc(sid).update({links: clone(other.links || []).filter(l => l.storyId !== id)}));
  }} />`);
  function exportStory(){ saveFile(caps, showToast, 'abg-' + (story.demo ? 'DEMO-' : '') + 'story-' + slug(story.title) + '.md', (story.demo ? '> FICTIONAL DEMO STORY. Not a real ABG student or outcome.\n\n' : '') + storyMarkdown(story, entries || [])); }
  function confirmDelete(){
    const n = (entries || []).length || story.entryCount || 1;
    openSheet(close => html`<${ConfirmSheet} close=${close} title="Delete this story?" body=${'This deletes the story, its ' + n + ' journal entr' + (n === 1 ? 'y' : 'ies') + ', transcripts and recordings, its evidence, and its timeline. The student record stays. This can\'t be undone.'} confirmLabel="Delete story" onConfirm=${async () => {
      const ok = await safeWrite(async () => {
        const snap = await caps.db.collection('entries').where('storyId', '==', id).get();
        const paths = []; snap.docs.forEach(d => { const x = d.data() || {}; (x.audio || []).forEach(c => paths.push(c.path)); });
        for (const d of snap.docs) await caps.db.collection('entries').doc(d.id).delete();
        if (window.__platform) { try { await window.__platform.audio.remove(paths); } catch (e) {} }
        for (const o of stories.filter(s => s.id !== id && (s.links || []).some(l => l.storyId === id))) await caps.db.collection('stories').doc(o.id).update({links: clone(o.links || []).filter(l => l.storyId !== id)});
        await caps.db.collection('stories').doc(id).delete();
      });
      if (ok) { showToast('Story deleted'); nav('library'); }
    }} />`);
  }
  function deleteEntry(e){
    openSheet(close => html`<${ConfirmSheet} close=${close} title="Delete this entry?" body="This deletes the entry, its transcript, and its recordings. Evidence that came from it stays on the story, without its source passage." confirmLabel="Delete entry" onConfirm=${async () => {
      const ok = await safeWrite(async () => { if (window.__platform) { try { await window.__platform.audio.remove((e.audio || []).map(c => c.path)); } catch (x) {} } await caps.db.collection('entries').doc(e.id).delete(); await caps.db.collection('stories').doc(id).update({entryCount: Math.max(0, (story.entryCount || 1) - 1), updatedAt: nowISO()}); });
      if (ok) showToast('Entry deleted');
    }} />`);
  }
  const adapt = () => openSheet(close => html`<${AdaptSheet} storyId=${id} close=${close} />`);

  return html`<div className="view story">
    <div className="crumbs"><button className="btn btn-quiet btn-sm" onClick=${() => nav('library')}><${Icon} name="back" size=${16} /> Story Library</button></div>
    ${story.demo ? html`<p className="notice demo-note small"><strong>Fictional demo story.</strong> This student, school and outcomes are invented to show how a recorded story becomes impact evidence. Demo stories are left out of reports and exports unless included in Settings.</p>` : null}
    ${isTest(story) ? html`<div className="banner banner-test" id="story-test-banner"><${Icon} name="eye" size=${22} /><div><strong>Test story from Preview Mode.</strong><p className="small">${(story.review || {}).testBy ? 'Created by ' + story.review.testBy + ' while testing the Share Your Story page. ' : ''}It's never counted in Impact Insights, totals, Source Comparison or exports, and can't be shared.</p></div></div>` : null}
    ${isCommunity(story) && isWithdrawn(story) ? html`<div className="banner banner-bad"><${Icon} name="trash" size=${22} /><div><strong>The contributor asked ABG to remove this story.</strong><p className="small">It's left out of Impact Insights and reports. An administrator should delete it from Community Submissions.</p></div>${story.submissionId ? html`<button className="btn btn-primary btn-sm" onClick=${() => nav('submission', {id: story.submissionId})}>Open submission</button>` : null}</div>` : null}
    <header className="story-head">
      <div className="chips">
        ${story.demo ? html`<${DemoPill} />` : null}
        <${TypePill} story=${story} />
        ${isCommunity(story) ? html`<${Pill} tone="purple">Community · ${sourceLabel(story)}<//>` : null}
        <${StatusPill} status=${story.status} />
        ${story.period === 'past' ? html`<${Pill} tone="orange">Historical<//>` : null}
        ${updates > 0 ? html`<${Pill} tone="blue">${updates} update${updates > 1 ? 's' : ''}<//>` : null}
        ${yearSpan(story) >= 1 ? html`<${Pill} tone="teal">${yearRange(story)}<//>` : null}
      </div>
      ${story.alias ? html`<p className="eyebrow">${story.alias}${staff ? ((staffVal(story, 'role') || {}).value || si.role ? ' · ' + ((staffVal(story, 'role') || {}).value || si.role) : '') : (student && student.note ? ' · ' + student.note : '')}</p>` : null}
      <h1>${story.title || 'Untitled story'}</h1>
      ${!readOnly ? html`<div className="row-btns">
        <button className="btn btn-primary" onClick=${() => nav(updateTarget, {storyId: id})}><${Icon} name="mic" size=${18} /> Add Story Update</button>
        <button className="btn btn-ghost" onClick=${adapt}><${Icon} name="spark" size=${18} /> Adapt for audience</button>
        <button className="btn btn-ghost" onClick=${() => nav('review', {mode: 'edit', storyId: id, items, returnTo: {name: 'story', params: {id}}})}><${Icon} name="edit" size=${18} /> Edit</button>
        ${caps.downloads ? html`<button className="btn btn-ghost" onClick=${exportStory}><${Icon} name="download" size=${18} /> Export</button>` : null}
      </div>` : null}
    </header>

    ${!readOnly && entries && entries.length > 0 && (never || unanalyzed.length > 0) ? html`<div className="banner">
      <${Icon} name="spark" size=${22} />
      <div><strong>${never ? "This story hasn't been analyzed yet." : unanalyzed.length + ' new entr' + (unanalyzed.length > 1 ? "ies haven't" : "y hasn't") + ' been analyzed.'}</strong><p className="small">${caps.sample ? 'Claude can write the impact story and find the evidence, missing metrics, and timeline.' : "Claude isn't available in this view. Open the journal in Claude to analyze it."}</p></div>
      ${caps.sample ? html`<button className="btn btn-primary btn-sm" onClick=${startAnalysis}>Analyze now</button>` : null}
    </div>` : null}
    ${!readOnly && oq.length > 0 ? html`<div className="banner banner-q">
      <${Icon} name="spark" size=${22} />
      <div><strong>${oq.length} open question${oq.length > 1 ? 's' : ''} about this story</strong><p className="small">${oq[0].question}</p></div>
      <button className="btn btn-primary btn-sm" onClick=${() => openSheet(close => html`<${AnswerSheet} storyId=${id} close=${close} />`)}>Answer</button>
    </div>` : null}

    ${isCommunity(story) ? html`<section className="card source-card">
      <h2>Source</h2>
      <dl className="overview">
        <div><dt>Source</dt><dd>Community submission (Share Your Story)</dd></div>
        <div><dt>Contributor</dt><dd>${contributorText(story)}</dd></div>
        <div><dt>Evidence</dt><dd>${(story.contributor || {}).perspective === 'self' ? 'Self-reported' : 'Community-observed'} unless ABG later verifies an outcome against a record</dd></div>
        <div><dt>Public sharing</dt><dd>${PUBLICATION[(story.publication || {}).choice] || 'Not recorded'}${(story.publication || {}).choice && story.publication.choice !== 'internal' ? (story.publication.confirmed ? ' (checked by ABG)' : ' (not yet checked by ABG)') : ''}</dd></div>
        <div><dt>Review</dt><dd>${isTest(story) ? 'Test only (never counted)' : !isWithdrawn(story) ? 'Approved for internal reporting' : 'Withdrawn'}${(story.review || {}).by ? ' by ' + story.review.by : ''}${(story.review || {}).at ? ' on ' + fmtDate(story.review.at) : ''}</dd></div>
      </dl>
      ${story.submissionId ? html`<div><button className="btn btn-ghost btn-sm" onClick=${() => nav('submission', {id: story.submissionId})}><${Icon} name="inbox" size=${16} /> Open the submission and its review history</button></div>` : null}
    </section>` : null}
    ${staff ? html`<section className="card">
      <h2>Staff overview</h2>
      <dl className="overview">${staffRows.map(r => html`<div key=${r[0]}><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`)}</dl>
      ${staffSiblings.length ? html`<p className="small muted">Other stories about this staff member (counted once in Insights): ${staffSiblings.map(s => html`<button key=${s.id} className="btn btn-quiet btn-sm" onClick=${() => nav('story', {id: s.id})}>${s.title}</button>`)}</p>` : null}
      <${SamePersonLinks} story=${story} links=${samePerson} readOnly=${readOnly} />
    </section>` : html`<section className="card">
      <h2>Student overview</h2>
      <dl className="overview">${overviewRows.map(r => html`<div key=${r[0]}><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`)}</dl>
      ${siblings.length ? html`<p className="small muted">Other stories about this student: ${siblings.map((s, i) => html`<button key=${s.id} className="btn btn-quiet btn-sm" onClick=${() => nav('story', {id: s.id})}>${s.title}</button>`)}</p>` : null}
      ${samePerson.length ? html`<p className="small"><${Pill} tone="purple">Later joined ABG staff<//> ${samePerson.map(l => html`<button key=${l.storyId} className="btn btn-quiet btn-sm" onClick=${() => nav('story', {id: l.storyId})}>${l.other.title}</button>`)}</p>` : null}
    </section>`}

    <section className="card prose">
      <h2>${staff ? 'Impact narrative' : 'Student success story'}</h2>
      ${story.story ? story.story.split(/\n{2,}/).map((p, i) => html`<p key=${i}>${p}</p>`) : story.summary ? html`<p>${story.summary}</p>` : html`<p className="muted">No story written yet.</p>`}
      ${(story.takeaways || []).length > 0 ? html`<h3>${staff ? 'Key outcomes' : 'Key impact takeaways'}</h3><ul className="takeaways">${story.takeaways.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul>` : null}
      ${(story.themes || []).length > 0 ? html`<div className="chips">${story.themes.map(c => html`<span key=${c} className="chip static">${labelOf(THEMES, c)}</span>`)}</div>` : null}
    </section>

    <section className="card">
      <div className="sec-head"><h2>Measurable outcomes</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${AddEvidenceSheet} storyId=${id} close=${close} kind="numeric" />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      ${milestoneItems.length ? html`<div className="ev-group"><div className="ev-group-head"><h3>Key milestones</h3><span className="count">${milestoneItems.length}</span></div>
        <ul className="ms-list">${milestoneItems.map(x => html`<li key=${x.key}><span className="ms-check" aria-hidden="true">✓</span><span><strong>${x.label}</strong>${x.detail ? html` <span className="muted">· ${x.detail}</span>` : null}</span>${x.e ? html`<${EvLabel} e=${x.e} />` : html`<${MetricPill} status=${x.status} />`}</li>`)}</ul>
      </div>` : null}
      ${comparisons.length ? html`<${OutcomeTable} rows=${comparisons.map(r => r.e)} />` : html`<p className="empty-note small">${staff ? 'No before-and-after comparisons yet, such as their role when they started versus now.' : 'No before-and-after comparisons yet, such as how the student acted when they started versus now, or a change a teacher mentioned.'}</p>`}
      ${isStudentStory(story) ? html`<${MetricsCardView} story=${story} readOnly=${readOnly} embedded=${true} onEdit=${editStory} />` : null}
      ${staff ? html`<${StaffCardView} story=${story} readOnly=${readOnly} onEdit=${editStory} />` : null}
    </section>

    ${staff && ((story.journey || []).length || story.journeySummary || isFormerStudent(story)) ? html`<section className="card">
      <h2>Student-to-staff journey</h2>
      <p className="small muted">Only the stages this story supports. A missing stage means it isn't documented, not that it didn't happen.</p>
      <${JourneyPath} journey=${story.journey || []} />
      ${story.journeySummary ? html`<p>${story.journeySummary}</p>` : isFormerStudent(story) && !(story.journey || []).length ? html`<p className="empty-note small">Marked as a former ABG student, but the journey isn't documented yet. Add a story update about their time as a student and how they joined the staff.</p>` : null}
    </section>` : null}

    <section className="card">
      <div className="sec-head"><h2>Supporting evidence</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${AddEvidenceSheet} storyId=${id} close=${close} kind="qualitative" />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      <p className="small muted">Every outcome shows its evidence type: independently verified, staff-observed, self-reported, community-observed, or unconfirmed. Verified is only for things checked against a record or independent document.</p>
      ${comparisons.length ? html`<details className="ev-more"><summary className="small">Sources for the ${comparisons.length} before-and-after outcome${comparisons.length > 1 ? 's' : ''}</summary>${comparisons.map(r => html`<${EvidenceRow} key=${r.e.id} ev=${r.e} entries=${entries} readOnly=${readOnly} onStatus=${v => setEvStatus(r.i, v)} />`)}</details>` : null}
      ${others.length === 0 ? html`<p className="empty-note small">No other observations recorded.</p>` : others.map(r => html`<${EvidenceRow} key=${r.e.id} ev=${r.e} entries=${entries} readOnly=${readOnly} onStatus=${v => setEvStatus(r.i, v)} />`)}
      ${(story.quotes || []).length > 0 ? html`<div className="ev-group">
        <div className="ev-group-head"><h3>Quotes</h3><span className="count">${story.quotes.length}</span></div>
        ${story.quotes.map((q, i) => { const usable = q.kind !== 'paraphrase' && q.found; return html`<figure className="quote" key=${q.id}>
          <blockquote>“${q.text}”</blockquote>
          <figcaption className="small muted">${q.speaker || 'Unknown speaker'} · ${labelOf(QUOTE_KINDS, q.kind)}${q.kind !== 'paraphrase' && !q.found ? ' · not found word for word in the transcript' : ''}</figcaption>
          ${!readOnly ? html`<label className="check small"><input type="checkbox" checked=${!!q.approved} disabled=${!usable && !q.approved} onChange=${e => setQuote(i, e.target.checked)} /> Approved for external use${!usable ? ' (only exact or remembered quotes found in the transcript)' : ''}</label>` : (q.approved ? html`<${Pill} tone="good">Approved<//>` : null)}
        </figure>`; })}
      </div>` : null}
      <div className="ev-group"><div className="sec-head"><h3>Photos, records and other materials</h3>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${MaterialSheet} storyId=${id} close=${close} />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      ${(story.materials || []).length === 0 ? html`<p className="empty-note">No photos, artwork, testimonials, or records noted yet.</p>` : story.materials.map(m => html`<div className="linked" key=${m.id}>
        <div style=${{minWidth: 0}}><${Pill} tone="neutral">${labelOf(MATERIAL_TYPES, m.type)}<//> <span>${m.description}</span></div>
        ${!readOnly ? html`<button className="icon-btn" aria-label="Remove material" onClick=${() => removeMaterial(m.id)}><${Icon} name="close" size=${18} /></button>` : null}
      </div>`)}
      </div>
    </section>

    <section className="card">
      <h2>Missing data</h2>
      <p className="small muted">Outcomes that were mentioned but not counted or confirmed, plus records ABG or the consulting team could request later.</p>
      ${(story.missingMetrics || []).length === 0 ? html`<p className="empty-note small">None identified.</p>` : story.missingMetrics.map(m => html`<div className="ev" key=${m.id}>
        <div className="ev-head"><p className="ev-statement"><strong>${m.metric}</strong></p>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => removeMissing(m.id)}>Found or not needed</button>` : null}</div>
        ${m.why ? html`<p className="small">${m.why}</p>` : null}
        ${m.howToGet ? html`<p className="small muted">Where to find it: ${m.howToGet}</p>` : null}
      </div>`)}
      ${expected.length ? html`<div className="ev-group">
        <div className="ev-group-head"><h3>Expected but not yet documented</h3><span className="count">${expected.length}</span></div>
        <p className="small muted">Hoped-for outcomes. Not accomplishments.</p>
        ${expected.map(r => html`<${EvidenceRow} key=${r.e.id} ev=${r.e} entries=${entries} readOnly=${readOnly} onStatus=${v => setEvStatus(r.i, v)} />`)}
      </div>` : null}
      <div className="ev-group"><div className="sec-head"><h3>Follow-up</h3>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${AddTaskSheet} storyId=${id} close=${close} />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      ${tasks.length === 0 && doneQs.length === 0 ? html`<p className="empty-note">Nothing to follow up on.</p>` : null}
      ${tasks.map(t => html`<div className=${'task' + (t.status !== 'open' ? ' done' : '')} key=${t.id}>
        <div><p>${t.question}</p><p className="small muted">${t.status === 'open' ? (t.due ? 'By ' + fmtDay(t.due) : 'No date set') + ' · Awaiting update' : 'Done' + (t.answer ? ': ' + t.answer : '')}</p></div>
        ${t.status === 'open' && !readOnly ? html`<div className="row-btns"><button className="btn btn-ghost btn-sm" onClick=${() => nav(updateTarget, {storyId: id, prompt: t.question, followupId: t.id})}>Record what happened</button><button className="btn btn-quiet btn-sm" onClick=${() => setTask(t.id, {status: 'done'})}>Mark done</button></div>` : null}
      </div>`)}
      ${doneQs.length > 0 ? html`<details><summary className="small muted" style=${{cursor: 'pointer'}}>${doneQs.length} answered or skipped question${doneQs.length > 1 ? 's' : ''}</summary>
        <ul className="small" style=${{marginTop: '8px', display: 'grid', gap: '6px'}}>${doneQs.map(q => html`<li key=${q.id}>${q.question} <span className="muted">(${q.status === 'answered' ? 'answered' + (q.answer ? ': ' + q.answer : '') : q.status})</span></li>`)}</ul>
      </details>` : null}
      </div>

    </section>

    <section className="card">
      <h2>${staff ? 'Stakeholder relevance' : 'Stakeholder value'}</h2>
      ${(() => { const svl = staff ? STAFF_STAKEHOLDERS : [['schools', 'School administrators'], ['donors', 'Donors'], ['grants', 'Grant providers']]; const any = svl.some(([k]) => (story.stakeholderValue || {})[k]); return html`
      ${any ? html`<dl className="sv-list">
        ${svl.map(([k, l]) => (story.stakeholderValue || {})[k] ? html`<div key=${k}><dt>${l}</dt><dd>${story.stakeholderValue[k]}</dd></div>` : null)}
      </dl>` : null}
      ${story.stakeholderWhy ? html`<p>${story.stakeholderWhy}</p>` : (!any ? html`<p className="muted">Not written yet.</p>` : null)}`; })()}
      ${primaryAud.length ? html`<p className="small"><strong>Most useful for:</strong> ${primaryAud.map(a => labelOf(AUDIENCES, a)).join(', ')}</p>` : null}
      ${!readOnly ? html`<div><button className="btn btn-ghost btn-sm" onClick=${adapt}><${Icon} name="spark" size=${16} /> Adapt story for audience</button></div>` : null}
    </section>

    <section className="card">
      <h2>${staff ? 'Staff timeline' : 'Student timeline'}</h2>
      <p className="small muted">From initial challenges to the latest update. Planned milestones are kept separate until they happen.</p>
      <${Timeline} milestones=${ms.filter(m => m.phase !== 'future')} entries=${entries || []} />
      ${(() => {
        /* one line per plan: planned milestones, then reminders that aren't just restating one of them */
        const fm = ms.filter(m => m.phase === 'future');
        const planned = fm.map(m => ({id: m.id, text: m.label, when: fmtEventDate(m.date)}))
          .concat((story.followUps || []).filter(f => f.kind === 'task' && f.status === 'open' && !fm.some(m => questionOverlap(f.question.replace(/^Check on: /, ''), m.label) >= 0.5)).map(f => ({id: f.id, text: f.question, when: f.due ? 'Due ' + fmtDay(f.due) : ''})));
        return planned.length ? html`<div className="planned"><h3>Planned and to check</h3><ul>${planned.map(p => html`<li key=${p.id}><span className="tl-plan-dot" aria-hidden="true"></span><span>${p.text}${p.when ? html` <small className="muted">· ${p.when}</small>` : null}</span></li>`)}</ul></div>` : null;
      })()}
      ${!readOnly ? html`<div><button className="btn btn-ghost btn-sm" onClick=${() => nav('record', {storyId: id})}><${Icon} name="plus" size=${16} /> Add a new observation</button></div>` : null}
    </section>



    ${filledStructure.length > 0 ? html`<details className="sec"><summary><span>Story structure</span><${Icon} name="chev" size=${18} /></summary><div className="sec-body">
      ${filledStructure.map(f => html`<div key=${f.id}><p className="eyebrow">${f.label}</p><p>${story.structure[f.id]}</p></div>`)}
    </div></details>` : null}

    ${linked.length > 0 ? html`<section className="card">
      <h2>Linked stories</h2>
      ${linked.map(l => html`<div className="linked" key=${l.storyId + l.type}>
        <div style=${{minWidth: 0}}><${Pill} tone="blue">${labelOf(LINK_TYPES, l.type)}<//> <button className="btn btn-quiet btn-sm" onClick=${() => nav('story', {id: l.storyId})}>${l.other.title}</button></div>
        ${!readOnly ? html`<button className="icon-btn" aria-label="Remove link" onClick=${() => unlink(l.storyId)}><${Icon} name="close" size=${18} /></button>` : null}
      </div>`)}
    </section>` : null}

    ${html`<section className="card">
      <h2>Interview transcripts</h2>
      <p className="small muted">The original account and every update, kept as recorded.</p>
      ${entries === null ? html`<div className="skeleton" style=${{height: '60px'}}></div>` : entries.length === 0 ? html`<p className="empty-note">No entries on file.</p>` : entries.map((e, idx) => {
        const isOpen = openEntry === e.id; const so = !!showOrig[e.id];
        const useEdited = !so && e.transcriptEdited;
        const who = names[e.createdBy];
        const label = idx === 0 ? 'Original interview' : (e.source === 'followup' ? 'Follow-up answers' : 'Story update');
        return html`<div className="entry" key=${e.id}>
          <button className="entry-head" aria-expanded=${isOpen} onClick=${() => setOpenEntry(isOpen ? null : e.id)}>
            <span><strong>${label}</strong><span className="small muted"> · Recorded ${fmtDate(e.recordedAt)}${who ? ' by ' + who : ''}${e.eventDateText ? ' · about ' + e.eventDateText : ''}</span></span>
            <${Icon} name="chev" size=${18} />
          </button>
          ${e.summary ? html`<p className="small muted">${e.summary}</p>` : null}
          ${isOpen ? html`<div className="entry-body">
            ${e.transcriptEdited ? html`<div className="row-btns"><${Pill} tone="blue">${so ? 'Original transcript' : 'Corrected transcript'}<//><button className="btn btn-quiet btn-sm" onClick=${() => setShowOrig(s => Object.assign({}, s, {[e.id]: !so}))}>${so ? 'Show correction' : 'Show original'}</button></div>` : null}
            ${!useEdited && Array.isArray(e.turns) && e.turns.length ? html`<${TurnsView} turns=${e.turns} />` : html`${e.prompt ? html`<p className="small muted">Prompt: ${e.prompt}</p>` : null}<p className="transcript">${useEdited ? e.transcriptEdited : e.transcript}</p>${!(Array.isArray(e.turns) && e.turns.length) ? (e.audio || []).map((c, j) => html`<${AudioClip} key=${c.path} path=${c.path} label=${'Play recording' + ((e.audio || []).length > 1 ? ' ' + (j + 1) : '')} />`) : null}`}
            ${!readOnly ? html`<div className="row-btns"><button className="btn btn-ghost btn-sm" onClick=${() => openSheet(close => html`<${TranscriptSheet} entry=${e} close=${close} />`)}><${Icon} name="edit" size=${16} /> Correct transcript</button><button className="btn btn-quiet btn-sm danger" onClick=${() => deleteEntry(e)}>Delete entry</button></div>` : null}
          </div>` : null}
        </div>`; })}
    </section>`}

    ${(story.drafts || []).length > 0 ? html`<section className="card">
      <h2>Audience versions</h2>
      ${story.drafts.map(d => html`<div className="draft" key=${d.id}>
        <p className="eyebrow">${labelOf(FORMATS, d.format)} · ${(byId(AUDIENCES, d.audience) || {}).short || d.audience}</p>
        <p className="transcript">${d.text}</p>
        <div className="row-btns">
          <${Pill} tone=${d.approved ? 'good' : 'neutral'}>${d.approved ? 'Approved for distribution' : 'Draft'}<//>
          <${CopyButton} text=${d.text} />
          ${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => setDraftApproved(d.id, !d.approved)}>${d.approved ? 'Mark as draft' : 'Approve for distribution'}</button><button className="btn btn-quiet btn-sm danger" onClick=${() => removeDraft(d.id)}>Delete</button>` : null}
        </div>
      </div>`)}
    </section>` : null}

    <section className="card">
      <h2>Privacy and approval</h2>
      <${PrivacyPanel} value=${story} disabled=${readOnly} live=${true} onChange=${patch => update(patch)} />
    </section>

    ${!readOnly ? html`<div><button className="btn btn-ghost danger" onClick=${confirmDelete}><${Icon} name="trash" size=${18} /> Delete story</button></div>` : null}
  </div>`;
}

/* ================= student metrics card ================= */
function MetricsCardEdit({metrics, onChange, fields, only}){
  const m = metrics || {};
  const list = (fields || METRIC_FIELDS).filter(f => !only || only.includes(f.id));
  const set = (id, patch) => {
    const cur = Object.assign({value: '', status: 'reported'}, m[id] || {});
    const nx = Object.assign({}, cur, patch); delete nx._new;
    const out = Object.assign({}, m);
    if (!String(nx.value == null ? '' : nx.value).trim()) delete out[id]; else out[id] = nx;
    onChange(out);
  };
  return html`<div className="mc-edit">${list.map(f => {
    const x = m[f.id] || {}; const v = x.value == null ? '' : String(x.value);
    return html`<div className=${'mc-row' + (x._new ? ' is-new' : '')} key=${f.id}>
      <label className="mc-label" htmlFor=${'mc-' + f.id}>${f.label}${x.excerpt ? html`<small className="mc-src muted" title=${x.excerpt}>“${trunc(x.excerpt, 90)}”</small>` : x.source === 'intake' ? html`<small className="mc-src muted">From the intake form</small>` : null}</label>
      <div className="mc-inputs">
        ${f.type === 'choice'
          ? html`<select id=${'mc-' + f.id} className="select select-sm mc-val" value=${v} onChange=${e => set(f.id, {value: e.target.value})}><option value="">Unknown</option>${f.options.map(o => html`<option key=${o} value=${o}>${o}</option>`)}</select>`
          : html`<input id=${'mc-' + f.id} className="input mc-val" inputMode=${f.type === 'number' ? 'decimal' : 'text'} placeholder=${f.type === 'number' ? 'Unknown (' + f.unit + ')' : 'Unknown, ' + f.ph} value=${v} onChange=${e => set(f.id, {value: e.target.value})} />`}
        <select className="select select-sm mc-status" aria-label=${f.label + ': how certain'} disabled=${!v.trim()} value=${v.trim() ? (x.status || 'reported') : ''} onChange=${e => set(f.id, {status: e.target.value})}>
          ${!v.trim() ? html`<option value="">No value</option>` : null}
          ${METRIC_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}
        </select>
      </div>
    </div>`; })}</div>`;
}
function MetricsCardView({story, readOnly, onEdit, embedded}){
  const rows = METRIC_FIELDS.map(f => ({f, m: metricVal(story, f.id)}));
  const n = rows.filter(r => r.m).length;
  return html`<section className=${embedded ? 'ev-group mc-embedded' : 'card'}>
    <div className="sec-head">${embedded ? html`<h3>Student metrics card</h3>` : html`<h2>Student metrics card</h2>`}<div className="row-btns"><span className="small muted tnum">${n} of ${METRIC_FIELDS.length} known</span>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${onEdit}><${Icon} name="edit" size=${16} /> Fill in</button>` : null}</div></div>
    <p className="small muted">The same measurable fields on every student story. Unknown fields are worth asking about in the next update.</p>
    <dl className="mc-view">${rows.map(r => html`<div key=${r.f.id} className=${r.m ? '' : 'is-unknown'}><dt>${r.f.label}</dt><dd>${r.m ? html`<span>${fmtMetric(r.f, r.m.value)}</span> <${MetricPill} status=${r.m.status} />` : html`<span className="muted">Unknown</span>`}</dd></div>`)}</dl>
  </section>`;
}
/* ================= Community Submissions (review queue) =================
   Stories sent through the public portal wait here. They never reach Impact Insights until an administrator
   approves them; approval turns the submission into an ordinary journal story (source "community") built with
   the same draft, review and evidence model as Kyle's interviews. The database only lets administrators change
   a submission, and every status change is recorded in its history. */
function SubStatusPill({status}){ const s = byId(SUB_STATUS, status) || {label: status, tone: 'neutral'}; return html`<${Pill} tone=${s.tone} dot=${true}>${s.label}<//>`; }
function SubmissionsView(){
  const {subs, subsState, reloadSubs, nav, isAdmin} = useApp();
  const [tab, setTab] = useState('pending_review');
  useEffect(() => { reloadSubs(); }, []);
  const real = subs.filter(x => !x.is_test), tests = subs.filter(x => x.is_test);
  const count = id => real.filter(x => x.status === id).length;
  const list = (tab === 'test' ? tests : real.filter(x => x.status === tab)).sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
  const tabs = SUB_STATUS.map(x => ({id: x.id, label: x.label, badge: count(x.id) || null})).concat(tests.length || tab === 'test' ? [{id: 'test', label: 'Test submissions', badge: tests.length || null}] : []);
  return html`<div className="view subs">
    <header className="page-head row-between"><div><h1>Community Submissions</h1><p className="muted">Stories shared through the Share Your Story page. They count in Impact Insights only after an administrator approves them.</p></div>
      <button className="btn btn-ghost btn-sm" onClick=${() => nav('invite')}><${Icon} name="share" size=${16} /> Invite contributors</button></header>
    ${!isAdmin ? html`<p className="notice small">You can read submissions. Only administrators can approve, reject or ask contributors questions.</p>` : null}
    ${subsState === 'missing' ? html`<p className="notice">Community submissions aren't set up on the server yet. An administrator needs to run <code>supabase/community.sql</code> in Supabase (see the README).</p>` : null}
    ${subsState === 'error' ? html`<p className="error">Couldn't load submissions. Check your connection. <button className="btn btn-quiet btn-sm" onClick=${reloadSubs}>Try again</button></p>` : null}
    <${PageTabs} label="Submission status" value=${tab} onChange=${setTab} tabs=${tabs} />
    ${tab === 'test' ? html`<p className="notice small test-note"><${TestPill} /> <span>Stories sent from Preview Mode while testing the Share Your Story page. They're kept out of every count, chart, comparison and export, even if approved, and are deleted automatically after 30 days.</span></p>` : null}
    ${subsState === 'loading' ? html`<div className="skeleton"></div>`
      : list.length === 0 ? html`<div className="empty"><h3>Nothing here</h3><p className="muted">${tab === 'pending_review' ? 'New community stories will appear here for review.' : tab === 'test' ? 'No test submissions.' : 'No submissions with this status.'}</p></div>`
      : html`<div className="sub-list">${list.map(x => { const i = x.intake || {}; const nm = subName(x); return html`<button className="card sub-row" key=${x.id} onClick=${() => nav('submission', {id: x.id})}>
        <span className="sub-main">
          <span className="chips">${x.is_test ? html`<${TestPill} />` : null}<${Pill} tone=${x.story_type === 'staff' ? 'purple' : x.story_type === 'student' ? 'teal' : 'neutral'}>${x.story_type === 'staff' ? 'Staff Impact' : x.story_type === 'student' ? 'Student Impact' : 'General'}<//>${x.is_minor ? html`<${Pill} tone="warn">Involves a minor<//>` : null}${i.formerStudent === 'yes' && x.story_type === 'staff' ? html`<span className="pill tone-path">Student → Staff</span>` : null}</span>
          <strong>${subTitle(x)}</strong>
          <small className="muted">${labelOf(RELATIONSHIPS, x.relationship)}${i.firstName ? ' ' + i.firstName : ''} · ${x.perspective === 'self' ? 'own experience' : 'witnessed' + (nm ? ': about ' + nm : '')} · ${i.method === 'voice' ? 'voice' : 'written'} · submitted ${fmtDate(x.submitted_at)}</small>
        </span>
        <span className="sub-side"><${SubStatusPill} status=${x.status} /><${Icon} name="chev" size=${18} /></span>
      </button>`; })}</div>`}
  </div>`;
}
const REJECT_REASONS = [{id: 'duplicate', label: 'Duplicate of a story already in the journal'}, {id: 'not_abg', label: "Not about ABG's programs"}, {id: 'unsupported', label: "Can't be used as evidence"}, {id: 'inappropriate', label: 'Inappropriate or unsafe content'}, {id: 'other', label: 'Other'}];
function SubmissionView({id}){
  const {caps, stories, subs, reloadSubs, nav, isAdmin, safeWrite, showToast, openSheet, storyById} = useApp();
  const [sub, setSub] = useState(() => subs.find(x => x.id === id) || null);
  const [events, setEvents] = useState([]);
  const [type, setType] = useState('');
  const [draft, setDraft] = useState(null);
  const [mode, setMode] = useState('');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [pubOk, setPubOk] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const me = caps.me || {};
  const email = (window.__platform && window.__platform.email) || me.email || '';
  const api = window.__platform && window.__platform.community;
  const load = async () => { if (!api) return; try { const x = await api.get(id); setSub(x); try { setEvents(await api.events(id)); } catch (e) {} } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (sub && isAdmin && !draft && sub.analysis) { const t = type || sub.story_type; setType(t); setDraft(draftFromSubmission(sub, me, t)); } }, [sub && sub.id, sub && !!sub.analysis]);
  if (!sub) return html`<div className="view"><div className="crumbs"><button className="btn btn-quiet btn-sm" onClick=${() => nav('submissions')}><${Icon} name="back" size=${16} /> Community Submissions</button></div>${err ? html`<p className="error">${err}</p>` : html`<div className="skeleton"></div>`}</div>`;
  const i = sub.intake || {};
  const nm = subName(sub);
  const open = ['pending_review', 'needs_clarification'].includes(sub.status);
  const story = sub.story_id ? storyById(sub.story_id) : null;
  const matches = nm && !sub.is_test ? stories.filter(s => norm(s.alias) === norm(nm) && s.id !== sub.story_id && !s.demo).slice(0, 6) : [];
  const ed = sub.contributor_edits || {};
  const update = async (patch, msg) => { setBusy('save'); setErr(''); try { await api.update(sub.id, patch); showToast(msg || 'Saved'); await load(); reloadSubs(); setMode(''); setText(''); } catch (e) { setErr(e.message); } setBusy(''); };
  const changeType = t => { setType(t); setDraft(draftFromSubmission(sub, me, t)); };
  async function analyze(){
    if (!caps.sample) return;
    setBusy('analyze'); setErr('');
    try {
      const raw = await caps.sample.json(communityAnalysisPrompt({intake: i, transcript: subTranscript(sub), type: type || sub.story_type, today: todayLocal()}), {modelTier: 'default'});
      await api.update(sub.id, {analysis: raw, data: Object.assign({}, sub.data || {}, {analysisFailed: false})});
      const fresh = Object.assign({}, sub, {analysis: raw}); setSub(fresh); setDraft(draftFromSubmission(fresh, me, type || sub.story_type));
    } catch (e) { setErr(e && e.message ? e.message : aiErrorMessage(e)); }
    setBusy('');
  }
  async function approve(){
    if (!draft) return;
    setBusy('approve'); setErr('');
    const fin = finalizeStory(draft, me);
    const s = fin.story;
    const now = nowISO();
    const pub = sub.publication_consent;
    const privacy = Object.assign({}, s.privacy, {minor: sub.is_minor ? 'yes' : (s.privacy || {}).minor || 'unknown'});
    if (pub === 'internal') Object.assign(privacy, {external: 'no', permission: 'no'});
    else if (pubOk && pub === 'anonymous') Object.assign(privacy, {external: 'yes', permission: 'no', redact: 'yes'});
    else if (pubOk && pub === 'public_name') Object.assign(privacy, {external: 'yes', permission: 'yes', redact: 'no'});
    /* a Preview Mode test becomes a test story: labeled Test, never counted, never shared */
    if (sub.is_test) Object.assign(privacy, {external: 'no', permission: 'no'});
    Object.assign(s, {source: 'community', submissionId: sub.id, status: 'internal', privacy, createdAt: sub.submitted_at || now, entryCount: 1, test: !!sub.is_test,
      contributor: {relationship: sub.relationship, perspective: sub.perspective, firstName: i.firstName || '', subject: i.subject || '', isMinor: !!sub.is_minor, method: i.method || 'written', guardianConsent: i.adult === false},
      publication: {choice: sub.is_test ? 'internal' : pub, confirmed: !sub.is_test && pub !== 'internal' && pubOk},
      review: Object.assign({status: 'approved', by: email, at: now, note: asStr(text)}, sub.is_test ? {test: true, testBy: sub.test_by || ''} : {})});
    const entry = {storyId: s.id, recordedAt: sub.submitted_at || now, eventDateText: i.yearsInvolved || '', eventApprox: true, prompt: (sub.turns[0] || {}).q || '',
      transcript: subTranscript(sub), turns: (sub.turns || []).map(t => ({q: t.q, kind: t.kind || 'followup', a: t.a || '', status: t.status || 'answered', at: t.at || now, audio: []})), audio: [],
      transcriptEdited: null, summary: 'Community submission from a ' + (labelOf(RELATIONSHIPS, sub.relationship) || 'community member').toLowerCase(), takeaways: [], source: 'community', analyzed: true, createdBy: null};
    const ok = await safeWrite(async () => {
      await caps.db.collection('entries').doc(uid('e')).set(entry);
      const d = Object.assign({}, s); delete d.id;
      await caps.db.collection('stories').doc(s.id).set(d);
    });
    if (!ok) { setBusy(''); return; }
    try { await api.update(sub.id, {status: 'approved', story_id: s.id, review: Object.assign({}, sub.review || {}, {note: asStr(text), by: email, at: now, publicationConfirmed: pubOk, type: type || sub.story_type})}); }
    catch (e) { setErr('The story was saved, but the submission status could not be updated: ' + e.message); setBusy(''); return; }
    setBusy(''); reloadSubs(); showToast(sub.is_test ? 'Test approved. The test story is never counted.' : 'Approved for internal reporting'); nav('story', {id: s.id});
  }
  const askQuestion = () => update({status: 'needs_clarification', clarifications: (sub.clarifications || []).concat([{from: 'abg', text: asStr(text), at: nowISO(), by: email}]), review: Object.assign({}, sub.review || {}, {note: 'Asked: ' + asStr(text)})}, 'Question sent to the contributor');
  const reject = () => update({status: 'rejected', review: Object.assign({}, sub.review || {}, {note: asStr(text), reason, by: email, at: nowISO()})}, 'Excluded from reporting');
  const removeAll = () => openSheet(close => html`<${ConfirmSheet} close=${close} title="Delete this submission?" body=${'This permanently deletes the submission' + (story ? ' and the journal story made from it, with its transcript' : '') + '. Its review history stays. This can\'t be undone.'} confirmLabel="Delete" onConfirm=${async () => {
    setErr('');
    if (story) { const ok = await safeWrite(async () => { const snap = await caps.db.collection('entries').where('storyId', '==', story.id).get(); for (const d of snap.docs) await caps.db.collection('entries').doc(d.id).delete(); for (const o of stories.filter(x => x.id !== story.id && (x.links || []).some(l => l.storyId === story.id))) await caps.db.collection('stories').doc(o.id).update({links: (o.links || []).filter(l => l.storyId !== story.id)}); await caps.db.collection('stories').doc(story.id).delete(); }); if (!ok) return; }
    try { await api.remove(sub.id); showToast('Submission deleted'); reloadSubs(); nav('submissions'); } catch (e) { setErr(e.message); }
  }} />`);
  const rows = [
    ['Connection to ABG', labelOf(RELATIONSHIPS, sub.relationship)], ['Perspective', sub.perspective === 'self' ? 'Their own experience (self-reported)' : 'An experience they witnessed (community-observed)'],
    ["Contributor's first name", i.firstName], ['Age', i.adult === true ? '18 or older' : i.adult === false ? 'Under 18 (guardian consent recorded on a personal invitation)' : ''],
    ['About', sub.perspective === 'witnessed' ? ((SUBJECTS.find(x => x.id === i.subject) || {}).label || '') + (i.subjectFirstName ? ': ' + i.subjectFirstName : '') + (i.subjectMinor === 'yes' ? ' (under 18)' : '') : ''],
    ['Do they know it was shared?', sub.perspective === 'witnessed' && i.subject !== 'general' ? ({yes: 'Yes', no: 'No', unknown: 'Not sure'}[i.subjectAware] || '') : ''],
    ['ABG programs', i.programs], ['Years involved', i.yearsInvolved], ['Background', i.background],
    ['Role at ABG', i.staffRole], ['Current or former staff', i.staffStatus ? labelOf(STAFF_STATUS, i.staffStatus) : ''],
    ['Former ABG student', sub.relationship === 'staff' && sub.perspective === 'self' ? labelOf(FORMER_STUDENT, i.formerStudent) + (i.formerStudent === 'yes' ? [i.firstParticipatedYear ? ' · first participated ' + i.firstParticipatedYear : '', i.studentPrograms ? ' · ' + i.studentPrograms : '', i.transitionYear ? ' · began working ' + i.transitionYear : ''].join('') : '') : ''],
    ['Interview', (i.method === 'voice' ? 'Voice (recording transcribed, audio not kept)' : 'Written')], ['Public sharing choice', PUBLICATION[sub.publication_consent]],
    ['Submitted', fmtDate(sub.submitted_at)], ['Personal invitation', sub.invite_id ? 'Yes' : 'No (public link)'],
  ].filter(r => r[1]);
  return html`<div className="view submission">
    <div className="crumbs"><button className="btn btn-quiet btn-sm" onClick=${() => nav('submissions')}><${Icon} name="back" size=${16} /> Community Submissions</button></div>
    <header className="story-head">
      <div className="chips">${sub.is_test ? html`<${TestPill} />` : null}<${SubStatusPill} status=${sub.status} /><${Pill} tone=${sub.story_type === 'staff' ? 'purple' : sub.story_type === 'student' ? 'teal' : 'neutral'}>${sub.story_type === 'staff' ? 'Staff Impact' : sub.story_type === 'student' ? 'Student Impact' : 'General'}<//>${sub.is_minor ? html`<${Pill} tone="warn">Involves a minor<//>` : null}</div>
      <p className="eyebrow">Community submission · ${labelOf(RELATIONSHIPS, sub.relationship)}</p>
      <h1>${subTitle(sub)}</h1>
    </header>
    ${sub.is_test ? html`<div className="banner banner-test" id="sub-test-banner"><${Icon} name="eye" size=${22} /><div><strong>Test submission from Preview Mode.</strong><p className="small">${sub.test_by ? 'Sent by ' + sub.test_by + ' while testing the Share Your Story page. ' : ''}You can review it like a real one. If you approve it, the journal story is labeled Test and is never counted in Impact Insights, totals, Source Comparison or exports. Deleted automatically after 30 days.</p></div></div>` : null}
    ${sub.status === 'removal_requested' ? html`<div className="banner banner-bad"><${Icon} name="trash" size=${22} /><div><strong>The contributor asked ABG to remove this story.</strong><p className="small">${story ? 'Its journal story is already left out of all reporting. ' : ''}Please delete it.</p></div>${isAdmin ? html`<button className="btn btn-primary btn-sm" onClick=${removeAll}>Delete now</button>` : null}</div>` : null}
    ${story ? html`<p className="notice small">Approved ${fmtDate((sub.review || {}).at)}${(sub.review || {}).by ? ' by ' + sub.review.by : ''}. <button className="link-btn" onClick=${() => nav('story', {id: story.id})}>Open the journal story</button></p>` : null}
    ${err ? html`<p className="error" role="alert">${err}</p>` : null}
    <section className="card"><h2>Contributor</h2><dl className="overview">${rows.map(r => html`<div key=${r[0]}><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`)}</dl></section>
    ${ed.note || (sub.clarifications || []).length ? html`<section className="card"><h2>Notes and questions</h2>
      ${ed.note ? html`<p><strong>Contributor's note:</strong> ${ed.note}</p>` : null}
      ${(sub.clarifications || []).map((c, k) => html`<p key=${k} className=${'clar clar-' + c.from}><strong>${c.from === 'abg' ? 'ABG asked' : 'Contributor replied'}</strong> <small className="muted">${fmtDate(c.at)}</small><br />${c.text}</p>`)}
    </section>` : null}
    <${Sec} title="Interview transcript" count=${(sub.turns || []).filter(t => t.status === 'answered').length + ' answers'} open=${!sub.analysis}>
      <${TurnsView} turns=${(sub.turns || []).map(t => Object.assign({}, t, {audio: []}))} />
      <p className="small muted">The contributor's original words, kept exactly as sent. ${ed.story ? 'They edited the summary before sending it; the edited version is used below.' : ''}</p>
    <//>
    ${matches.length ? html`<section className="card"><h2>Stories that may be about the same person</h2>
      <p className="small muted">Same first name only, so this is not a match by itself. ${story ? 'Compare and link confirmed matches in Source Comparison.' : 'After approval, compare and link confirmed matches in Source Comparison so one person is never counted twice. If it repeats a story already in the journal, exclude it as a duplicate.'}</p>
      ${matches.map(m => html`<div className="linked" key=${m.id}><div style=${{minWidth: 0}}><${Pill} tone="neutral">${sourceLabel(m)}<//> <button className="btn btn-quiet btn-sm" onClick=${() => nav('story', {id: m.id})}>${m.alias ? m.alias + ': ' : ''}${m.title}</button></div>${story ? html`<button className="btn btn-ghost btn-sm" onClick=${() => nav('compare', {a: story.id, b: m.id})}><${Icon} name="scale" size=${16} /> Compare</button>` : null}</div>`)}
    </section>` : null}
    ${isAdmin && open ? html`<section className="card">
      <div className="sec-head"><h2>Review the story</h2>
        <label className="ins-filter"><span className="small muted">Story type </span><select id="sub-type" className="select select-sm" value=${type || sub.story_type} onChange=${e => changeType(e.target.value)}><option value="student">Student Impact</option><option value="staff">Staff Impact</option><option value="general">General community story</option></select></label></div>
      ${!sub.analysis ? html`<p className="notice small">There's no summary yet${(sub.data || {}).analysisFailed ? " (writing it failed when the contributor finished)" : ''}. Claude can write one from the transcript, with the same outcome extraction as Kyle's interviews.</p>
        <div><button className="btn btn-primary" id="sub-analyze" disabled=${!caps.sample || busy === 'analyze'} onClick=${analyze}><${Icon} name="spark" size=${18} /> ${busy === 'analyze' ? 'Writing…' : 'Write the summary'}</button></div>`
      : draft ? html`<p className="small muted">Claude drafted this from the contributor's words. Check each outcome against the transcript, correct anything that's wrong, and remove what isn't supported. Own-experience outcomes are self-reported; witnessed ones are community-observed. Nothing is verified until someone at ABG checks a record.</p>
        <${QuickReview} draft=${draft} setDraft=${setDraft} mode="new" />
        <details className="sec all-details"><summary><span>All details (optional)<span className="count">metrics card, timeline, stakeholder value</span></span><${Icon} name="chev" size=${18} /></summary>
          <div className="sec-body"><${StoryEditor} draft=${draft} setDraft=${setDraft} items=${[{id: 'sub-' + sub.id, text: subTranscript(sub), recordedAt: sub.submitted_at}]} mode="new" /></div></details>` : null}
    </section>` : sub.analysis && !story ? html`<section className="card prose"><h2>Summary</h2><p>${ed.story || sub.analysis.story || ''}</p>
      ${(sub.analysis.evidence || []).filter((e, k) => !(ed.removed || []).includes(k)).length ? html`<h3>Outcomes found</h3><ul>${(sub.analysis.evidence || []).filter((e, k) => !(ed.removed || []).includes(k)).map((e, k) => html`<li key=${k}>${e.statement}</li>`)}</ul>` : null}</section>` : null}
    ${isAdmin && open ? html`<section className="card review-actions">
      <h2>Decision</h2>
      <div className="row-btns">
        <button className=${'btn ' + (mode === 'approve' ? 'btn-primary' : 'btn-ghost')} id="sub-approve-open" disabled=${!draft} onClick=${() => { setMode('approve'); setText(''); }}><${Icon} name="check" size=${18} /> Approve for internal reporting</button>
        <button className=${'btn ' + (mode === 'ask' ? 'btn-primary' : 'btn-ghost')} id="sub-ask-open" onClick=${() => { setMode('ask'); setText(''); }}>Ask the contributor a question</button>
        <button className=${'btn ' + (mode === 'reject' ? 'btn-primary' : 'btn-ghost')} id="sub-reject-open" onClick=${() => { setMode('reject'); setText(''); setReason(''); }}>Reject / exclude</button>
      </div>
      ${mode === 'approve' ? html`<div className="approve-check">
        ${sub.is_test ? html`<p className="small"><strong>This is a test.</strong> Approval creates a journal story labeled Test so you can check the result. It is never counted anywhere and can't be shared.</p>`
          : html`<p className="small">Approval adds this story to the Impact Journal and its outcomes to Impact Insights, labeled as a community ${sub.perspective === 'self' ? 'self-report' : 'observation'}. It stays internal: public sharing is a separate decision.</p>`}
        <p className="small"><strong>Contributor's sharing choice:</strong> ${PUBLICATION[sub.publication_consent]}${sub.is_minor ? '. Involves a minor: never share it publicly without documented parent or guardian permission.' : ''}</p>
        ${sub.publication_consent !== 'internal' && !sub.is_test ? html`<label className="check"><input type="checkbox" id="sub-pub-ok" checked=${pubOk} onChange=${e => setPubOk(e.target.checked)} /> I've checked this sharing choice${sub.is_minor ? ' and the guardian permission' : ''}, so the story may later be approved for external use</label>` : null}
        <${Field} label="Review note (optional, internal)"><input id="sub-note" className="input" value=${text} onChange=${e => setText(e.target.value)} /><//>
        <div className="row-btns"><button className="btn btn-primary" id="sub-approve" disabled=${busy === 'approve'} onClick=${approve}>${busy === 'approve' ? 'Approving…' : 'Approve and add to the journal'}</button><button className="btn btn-ghost" onClick=${() => setMode('')}>Cancel</button></div>
      </div>` : null}
      ${mode === 'ask' ? html`<div className="approve-check">
        <p className="small">The contributor sees this question when they open their private link. Keep it short and friendly. It doesn't email them.</p>
        <${Field} label="Your question"><textarea id="sub-question" className="textarea" rows="3" value=${text} onChange=${e => setText(e.target.value)}></textarea><//>
        <div className="row-btns"><button className="btn btn-primary" id="sub-ask" disabled=${!asStr(text) || busy === 'save'} onClick=${askQuestion}>Send question</button><button className="btn btn-ghost" onClick=${() => setMode('')}>Cancel</button></div>
      </div>` : null}
      ${mode === 'reject' ? html`<div className="approve-check">
        <${Field} label="Reason"><select id="sub-reason" className="select" value=${reason} onChange=${e => setReason(e.target.value)}><option value="">Choose a reason</option>${REJECT_REASONS.map(r => html`<option key=${r.id} value=${r.id}>${r.label}</option>`)}</select><//>
        <${Field} label="Note (internal)" hint=${reason === 'duplicate' ? 'Say which story it duplicates.' : ''}><input id="sub-reject-note" className="input" value=${text} onChange=${e => setText(e.target.value)} /><//>
        <p className="small muted">Excluded submissions never count in reporting. The contributor sees that it won't be used. They're deleted automatically after 180 days.</p>
        <div className="row-btns"><button className="btn btn-primary" id="sub-reject" disabled=${!reason || busy === 'save'} onClick=${reject}>Exclude from reporting</button><button className="btn btn-ghost" onClick=${() => setMode('')}>Cancel</button></div>
      </div>` : null}
    </section>` : null}
    <${Sec} title="Review history" count=${events.length}>
      ${events.length === 0 ? html`<p className="empty-note small">No changes recorded yet.</p>` : html`<ul className="audit-list">${events.map((ev, k) => html`<li key=${k}><span>${ev.actor === 'contributor' ? 'The contributor' : ev.actor} · ${ev.action.replace('status:', 'status → ').replace(/_/g, ' ')}${ev.details && ev.details.note ? ': ' + ev.details.note : ''}</span><small className="muted">${fmtDate(ev.at)}</small></li>`)}</ul>`}
    <//>
    ${isAdmin && !['removal_requested'].includes(sub.status) ? html`<div><button className="btn btn-ghost danger" onClick=${removeAll}><${Icon} name="trash" size=${18} /> Delete submission${story ? ' and story' : ''}</button></div>` : null}
  </div>`;
}

/* ================= Source Comparison =================
   Connects accounts of the same person from different perspectives (Kyle's interview, the student's own story,
   a parent's observation...). Nothing is ever merged automatically: the journal only suggests possible matches,
   and an administrator confirms each link. A confirmed link gives the stories one participant record, so the
   person is counted once; every original account is kept as it was. Agreement between accounts strengthens a
   story but never makes an outcome "independently verified". */
const COMPARISON = [
  {id: 'consistent', label: 'Consistent', tone: 'good', desc: 'The accounts describe compatible experiences or outcomes.'},
  {id: 'complementary', label: 'Complementary', tone: 'blue', desc: 'The accounts add different, relevant details.'},
  {id: 'conflicting', label: 'Conflicting', tone: 'bad', desc: 'The accounts disagree about relevant facts or measurements.'},
  {id: 'insufficient', label: 'Insufficient evidence', tone: 'warn', desc: "There isn't enough information to tell whether they agree."},
];
function samePersonLink(a, b){ return (a.links || []).find(l => l.storyId === b.id && l.type === 'same_person') || null; }
/* groups of stories about one individual: shared participant record (student or staff) or a confirmed same-person link */
function participantGroups(list){
  const parent = new Map(list.map(s => [s.id, s.id]));
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const join = (a, b) => { if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b)); };
  const first = {};
  list.forEach(s => {
    const k = isStaffStory(s) ? (s.staffId ? 'sf:' + s.staffId : '') : isStudentStory(s) ? (s.studentId ? 'st:' + s.studentId : '') : '';
    if (k) { if (first[k]) join(first[k], s.id); else first[k] = s.id; }
    (s.links || []).forEach(l => { if (l.type === 'same_person') join(s.id, l.storyId); });
  });
  const g = new Map();
  list.forEach(s => { const r = find(s.id); if (!g.has(r)) g.set(r, []); g.get(r).push(s); });
  return Array.from(g.values());
}
function groupComparisons(group){
  const out = [];
  group.forEach((a, i) => group.slice(i + 1).forEach(b => { const l = samePersonLink(a, b) || samePersonLink(b, a); if (l) out.push({a, b, link: l}); }));
  return out;
}
/* possible matches for a person to review: same first name, not linked, not dismissed, at least one community account */
function possibleMatches(list){
  const groups = participantGroups(list);
  const gi = new Map(); groups.forEach((g, k) => g.forEach(s => gi.set(s.id, k)));
  const named = list.filter(s => asStr(s.alias) && (isStudentStory(s) || isStaffStory(s)));
  const out = [];
  named.forEach((a, i) => named.slice(i + 1).forEach(b => {
    if (norm(a.alias) !== norm(b.alias) || gi.get(a.id) === gi.get(b.id)) return;
    if (!!a.demo !== !!b.demo) return;
    if (!isCommunity(a) && !isCommunity(b)) return;
    if ((a.notSamePerson || []).includes(b.id) || (b.notSamePerson || []).includes(a.id)) return;
    const shared = [norm(a.program) && norm(a.program) === norm(b.program) ? 'same program' : '', norm(a.community) && norm(a.community) === norm(b.community) ? 'same school or community' : ''].filter(Boolean);
    out.push({a, b, why: ['Same first name'].concat(shared).join(', '), score: shared.length});
  }));
  return out.sort((x, y) => y.score - x.score);
}
function outcomeAreaOf(e){ const o = outcomeCategoryOf(e); return o ? {id: o.id, label: o.label} : {id: domainOf(e), label: labelOf(DOMAINS, domainOf(e))}; }
function comparePrompt(a, b){
  const acct = s => ({source: sourceLabel(s), contributor: isCommunity(s) ? contributorText(s) : 'ABG staff member (interview)', recorded: fmtDate(s.createdAt), personInStory: s.alias || null, storyType: storyTypeLabel(s),
    summary: trunc(s.story || s.summary, 1500), outcomes: (s.evidence || []).filter(e => e.status !== 'future').map(e => ({area: outcomeAreaOf(e).label, statement: e.statement, before: e.before || null, after: e.after || null, timeframe: e.timeframe || null, evidenceType: classLabel(e), detail: labelOf(EVIDENCE_STATUS, e.status), excerpt: (e.source || {}).excerpt || null}))});
  return `${ABG_CONTEXT} Two accounts in ABG's impact journal may describe the same person. An ABG administrator will decide whether they do; you only compare what the accounts say.

Compare the outcomes in the two accounts. Do not assume either account is more accurate, and do not decide whether they are the same person. Agreement between accounts does not make anything verified. Never invent details.

Categories: consistent (compatible experiences or outcomes), complementary (each adds different relevant details), conflicting (they disagree about relevant facts or measurements), insufficient (not enough information to tell).

Account A: ${JSON.stringify(acct(a))}
Account B: ${JSON.stringify(acct(b))}

Reply with only JSON: {"category": "consistent | complementary | conflicting | insufficient", "summary": "2 or 3 plain sentences", "consistent": ["outcomes both accounts support, short"], "complementary": ["details only one account adds, short"], "conflicting": ["specific disagreements, short"], "needsVerification": ["outcomes worth checking against records"]}`;
}
async function linkAccounts({caps, a, b, category, note, email}){
  const now = nowISO();
  const link = other => ({storyId: other.id, type: 'same_person', comparison: category, note: asStr(note), by: email, at: now, confirmed: true, reason: 'Confirmed as the same person by ' + (email || 'an administrator') + ' on ' + fmtDay(todayLocal())});
  const patches = {[a.id]: {}, [b.id]: {}};
  const studentPair = isStudentStory(a) && isStudentStory(b), staffPair = isStaffStory(a) && isStaffStory(b);
  if (studentPair) {
    let sid = a.studentId || b.studentId;
    if (!sid) { sid = uid('st'); const nm = a.alias || b.alias || ''; await caps.db.collection('students').doc(sid).set({firstName: nm, nameKey: norm(nm), note: 'Created when linking accounts', createdAt: now, createdBy: (caps.me || {}).id || null}); }
    [a, b].forEach(x => { if (x.studentId !== sid) patches[x.id] = {studentId: sid, linkedFrom: {studentId: x.studentId || null, at: now}}; });
  } else if (staffPair) {
    let fid = a.staffId || b.staffId;
    if (!fid) { fid = uid('sf'); const nm = a.alias || b.alias || ''; await caps.db.collection('staff').doc(fid).set({firstName: nm, nameKey: norm(nm), note: 'Created when linking accounts', createdAt: now, createdBy: (caps.me || {}).id || null}); }
    [a, b].forEach(x => { if (x.staffId !== fid) patches[x.id] = {staffId: fid, linkedFrom: {staffId: x.staffId || null, at: now}}; });
  }
  for (const [x, y] of [[a, b], [b, a]]) {
    const links = (x.links || []).filter(l => !(l.storyId === y.id && l.type === 'same_person')).concat([link(y)]);
    await caps.db.collection('stories').doc(x.id).update(Object.assign({}, patches[x.id], {links, updatedAt: now}));
  }
}
async function unlinkAccounts({caps, a, b}){
  for (const [x, y] of [[a, b], [b, a]]) {
    const links = (x.links || []).filter(l => !(l.storyId === y.id && l.type === 'same_person'));
    const patch = {links, updatedAt: nowISO()};
    /* give back the participant record a story had before it was linked, unless it is still linked to someone else */
    if (x.linkedFrom && !links.some(l => l.type === 'same_person')) { if ('studentId' in x.linkedFrom) patch.studentId = x.linkedFrom.studentId || null; if ('staffId' in x.linkedFrom) patch.staffId = x.linkedFrom.staffId || null; patch.linkedFrom = null; }
    await caps.db.collection('stories').doc(x.id).update(patch);
  }
}
function AccountColumn({s, nav}){
  const ev = (s.evidence || []).filter(e => e.status !== 'future');
  return html`<div className="acct card">
    <div className="chips"><${Pill} tone=${isCommunity(s) ? 'purple' : 'blue'}>${sourceLabel(s)}<//><${TypePill} story=${s} /></div>
    <h3><button className="link-btn" onClick=${() => nav('story', {id: s.id})}>${s.alias ? s.alias + ': ' : ''}${s.title}</button></h3>
    <p className="small muted">${isCommunity(s) ? contributorText(s) : 'ABG staff interview'} · recorded ${fmtDate(s.createdAt)}</p>
    <p className="small">${trunc(s.summary || s.story, 320)}</p>
    ${ev.length ? html`<ul className="acct-ev">${ev.map(e => html`<li key=${e.id}><p className="eyebrow">${outcomeAreaOf(e).label}</p><p>${e.statement}${hasComparison(e) ? html` <span className="muted tnum">(${e.before} → ${e.after}${e.timeframe ? ', ' + e.timeframe : ''})</span>` : null}</p>
      <p className="small"><${EvLabel} e=${e} /> <span className="muted">${labelOf(EVIDENCE_STATUS, e.status)}</span></p>${(e.source || {}).excerpt ? html`<p className="small muted acct-ex">“${trunc(e.source.excerpt, 160)}”</p>` : null}</li>`)}</ul>` : html`<p className="empty-note small">No outcomes recorded.</p>`}
  </div>`;
}
function ComparePair({a, b}){
  const {caps, nav, isAdmin, safeWrite, showToast, openSheet} = useApp();
  const link = samePersonLink(a, b) || samePersonLink(b, a);
  const [cat, setCat] = useState(link ? link.comparison || '' : '');
  const [note, setNote] = useState(link ? link.note || '' : '');
  const [sure, setSure] = useState(!!link);
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState('');
  const email = (window.__platform && window.__platform.email) || '';
  const areas = new Map();
  [a, b].forEach((s, k) => (s.evidence || []).filter(e => e.status !== 'future').forEach(e => { const ar = outcomeAreaOf(e); if (!areas.has(ar.id)) areas.set(ar.id, {label: ar.label, sides: [[], []]}); areas.get(ar.id).sides[k].push(e); }));
  const crossPerson = (isStudentStory(a) && isStaffStory(b)) || (isStaffStory(a) && isStudentStory(b));
  async function suggest(){
    setBusy('ai'); setAi(null);
    try { const r = await caps.sample.json(comparePrompt(a, b), {modelTier: 'default'}); setAi(r); if (!cat && byId(COMPARISON, r.category)) setCat(r.category); }
    catch (e) { setAi({error: aiErrorMessage(e)}); }
    setBusy('');
  }
  async function save(){
    setBusy('link');
    const ok = await safeWrite(() => linkAccounts({caps, a, b, category: cat, note, email}));
    setBusy(''); if (ok) showToast(link ? 'Comparison updated' : 'Accounts linked. This person is now counted once.');
  }
  const unlink = () => openSheet(close => html`<${ConfirmSheet} close=${close} title="Unlink these accounts?" body="Both stories stay in the journal. They'll be counted as separate people again." confirmLabel="Unlink" onConfirm=${async () => { const ok = await safeWrite(() => unlinkAccounts({caps, a, b})); if (ok) showToast('Accounts unlinked'); }} />`);
  const dismiss = async () => { const ok = await safeWrite(async () => { await caps.db.collection('stories').doc(a.id).update({notSamePerson: uniq((a.notSamePerson || []).concat([b.id]))}); await caps.db.collection('stories').doc(b.id).update({notSamePerson: uniq((b.notSamePerson || []).concat([a.id]))}); }); if (ok) { showToast('Marked as different people'); nav('compare'); } };
  return html`<div className="view compare-pair">
    <div className="crumbs"><button className="btn btn-quiet btn-sm" onClick=${() => nav('compare')}><${Icon} name="back" size=${16} /> Source Comparison</button></div>
    <header className="page-head"><h1>Compare accounts</h1><p className="muted">${link ? 'These accounts are linked as the same person.' : 'These accounts may describe the same person. Only link them if you know they do: a shared first name is not enough.'}</p></header>
    <div className="acct-grid"><${AccountColumn} s=${a} nav=${nav} /><${AccountColumn} s=${b} nav=${nav} /></div>
    <section className="card">
      <h2>Outcomes side by side</h2>
      <p className="small muted">By impact area. "Both accounts" means each one mentions the area; read the statements to see whether they agree.</p>
      ${areas.size === 0 ? html`<p className="empty-note">Neither account has outcomes yet.</p>` : html`<div className="cmp-table">${Array.from(areas.values()).map(r => html`<div className="cmp-row" key=${r.label}>
        <p className="cmp-area"><strong>${r.label}</strong> <${Pill} tone=${r.sides[0].length && r.sides[1].length ? 'teal' : 'outline'}>${r.sides[0].length && r.sides[1].length ? 'Both accounts' : r.sides[0].length ? 'Only the first account' : 'Only the second account'}<//></p>
        ${r.sides.map((side, k) => html`<div className="cmp-cell" key=${k}>${side.length ? side.map(e => html`<p key=${e.id} className="small">${e.statement} <${EvLabel} e=${e} /></p>`) : html`<p className="small muted">Not mentioned</p>`}</div>`)}
      </div>`)}</div>`}
    </section>
    <section className="card">
      <div className="sec-head"><h2>How do they compare?</h2>${caps.sample ? html`<button className="btn btn-ghost btn-sm" id="cmp-ai" disabled=${busy === 'ai'} onClick=${suggest}><${Icon} name="spark" size=${16} /> ${busy === 'ai' ? 'Comparing…' : 'Ask Claude for a suggestion'}</button>` : null}</div>
      ${ai && ai.error ? html`<p className="error">${ai.error}</p>` : ai ? html`<div className="ai-suggest"><p><strong>Claude's suggestion:</strong> ${(byId(COMPARISON, ai.category) || {}).label || 'No category'}. ${ai.summary || ''}</p>
        ${[['consistent', 'Supported by both'], ['complementary', 'Added by one account'], ['conflicting', 'Disagreements'], ['needsVerification', 'Worth checking against records']].map(([k, l]) => asArr(ai[k]).length ? html`<p className="small" key=${k}><strong>${l}:</strong> ${asArr(ai[k]).join('; ')}</p>` : null)}
        <p className="small muted">A suggestion only. You decide, and neither account is treated as more accurate.</p></div>` : null}
      <div className="cmp-cats" role="radiogroup" aria-label="Comparison">${COMPARISON.map(c => html`<label key=${c.id} className=${'pick' + (cat === c.id ? ' on' : '')}><input type="radio" name="cmp-cat" id=${'cmp-' + c.id} disabled=${!isAdmin} checked=${cat === c.id} onChange=${() => setCat(c.id)} /><span><strong>${c.label}</strong><br /><span className="small muted">${c.desc}</span></span></label>`)}</div>
      <${Field} label="Note (internal)"><input id="cmp-note" className="input" disabled=${!isAdmin} value=${note} onChange=${e => setNote(e.target.value)} placeholder="e.g. Kyle saw attendance improve; the student describes wanting to come to school" /><//>
      ${crossPerson ? html`<p className="small muted">One is a Student Impact story and the other a Staff Impact story: linking shows the person's student-to-staff path without combining their student and staff counts.</p>` : null}
      ${isAdmin ? html`${!link ? html`<label className="check"><input type="checkbox" id="cmp-sure" checked=${sure} onChange=${e => setSure(e.target.checked)} /> I've confirmed these accounts describe the same person, not just two people with the same first name.</label>` : null}
        <div className="row-btns">
          <button className="btn btn-primary" id="cmp-link" disabled=${!cat || !sure || busy === 'link'} onClick=${save}>${link ? 'Save comparison' : 'Link as the same person'}</button>
          ${link ? html`<button className="btn btn-ghost" id="cmp-unlink" onClick=${unlink}>Unlink</button>` : html`<button className="btn btn-ghost" id="cmp-dismiss" onClick=${dismiss}>Not the same person</button>`}
        </div>` : html`<p className="small muted">Only administrators can link accounts.</p>`}
    </section>
  </div>`;
}
function CompareView({a, b}){
  const {stories, nav, isAdmin, storiesLoaded} = useApp();
  const list = useMemo(() => stories.filter(reportable), [stories]);
  const A = a ? stories.find(s => s.id === a) : null, B = b ? stories.find(s => s.id === b) : null;
  if (a && b) return A && B ? html`<${ComparePair} a=${A} b=${B} />` : html`<div className="view">${storiesLoaded ? html`<p className="notice">One of these stories isn't in the journal anymore.</p>` : html`<div className="skeleton"></div>`}</div>`;
  const matches = possibleMatches(list);
  const groups = participantGroups(list).filter(g => g.length > 1);
  const pairs = [].concat.apply([], groups.map(groupComparisons));
  const st = sourceStats(list);
  return html`<div className="view compare">
    <header className="page-head"><h1>Source Comparison</h1><p className="muted">Connect accounts of the same person from different perspectives, see where they agree or differ, and keep one person from being counted twice.</p></header>
    <div className="stats stats-5">
      <div className="stat"><b>${st.individuals}</b><span>Unique individuals</span></div>
      <div className="stat"><b>${st.stories}</b><span>Stories</span></div>
      <div className="stat"><b>${st.outcomes}</b><span>Reported outcomes</span></div>
      <div className="stat"><b>${st.perspectives}</b><span>Supporting perspectives</span></div>
      <div className="stat"><b>${st.verified}</b><span>Independently verified outcomes</span></div>
    </div>
    <section className="card">
      <h2>Possible matches to review <span className="count">${matches.length}</span></h2>
      <p className="small muted">Found only by a shared first name (plus program or school when they match). Open each pair, read both accounts, and link them only if you know it's the same person.</p>
      ${matches.length === 0 ? html`<p className="empty-note">No possible matches right now.</p>` : html`<div className="match-list">${matches.map(m => html`<div className="linked" key=${m.a.id + m.b.id}>
        <div style=${{minWidth: 0}}><strong>${m.a.alias}</strong> <span className="small muted">· ${m.why}</span><br /><span className="small">${sourceLabel(m.a)}: ${trunc(m.a.title, 60)} · ${sourceLabel(m.b)}: ${trunc(m.b.title, 60)}</span></div>
        <button className="btn btn-ghost btn-sm" onClick=${() => nav('compare', {a: m.a.id, b: m.b.id})}><${Icon} name="scale" size=${16} /> Compare</button>
      </div>`)}</div>`}
    </section>
    <section className="card">
      <h2>Linked individuals <span className="count">${groups.length}</span></h2>
      <p className="small muted">People with more than one account in the journal. Each is counted once in Impact Insights; every account stays as it was told.</p>
      ${groups.length === 0 ? html`<p className="empty-note">No linked accounts yet.</p>` : html`<div className="group-list">${groups.map((g, k) => { const cmps = [].concat(groupComparisons(g)); return html`<div className="grp" key=${k}>
        <p><strong>${g.map(s => s.alias).filter(Boolean)[0] || 'Unnamed'}</strong> <span className="small muted">· ${g.length} accounts: ${uniq(g.map(sourceLabel)).join(', ')}</span></p>
        <div className="chips">${cmps.map((c, j) => { const cc = byId(COMPARISON, c.link.comparison); return html`<button key=${j} className="chip" onClick=${() => nav('compare', {a: c.a.id, b: c.b.id})}>${cc ? cc.label : 'Not categorized'} · ${sourceLabel(c.a)} / ${sourceLabel(c.b)}</button>`; })}
          ${cmps.length === 0 ? html`<span className="small muted">Linked by a shared participant record.</span>` : null}</div>
      </div>`; })}</div>`}
    </section>
    ${!isAdmin ? html`<p className="small muted">Only administrators can link or unlink accounts.</p>` : null}
  </div>`;
}
/* counts used in Source Comparison and Impact Insights. People are deduplicated; outcomes are counted as recorded. */
function sourceStats(list){
  const groups = participantGroups(list);
  const persons = groups.filter(g => g.some(s => isStudentStory(s) || isStaffStory(s)));
  const outcomes = [].concat.apply([], list.map(s => (s.evidence || []).filter(e => e.status !== 'future').map(e => ({s, e}))));
  const multi = groups.filter(g => g.length > 1);
  const perspectives = multi.reduce((t, g) => t + Math.max(0, uniq(g.map(sourceKind)).length - 1), 0);
  /* outcome areas supported by two or more different perspectives about the same person */
  const supported = [];
  multi.forEach(g => {
    const by = new Map();
    g.forEach(s => (s.evidence || []).filter(e => e.status !== 'future' && POSITIVE(e.direction) && evidenceClass(e) !== 'unconfirmed').forEach(e => { const ar = outcomeAreaOf(e); if (!by.has(ar.id)) by.set(ar.id, {label: ar.label, kinds: new Set(), items: []}); by.get(ar.id).kinds.add(sourceKind(s)); by.get(ar.id).items.push({s, e}); }));
    by.forEach(v => { if (v.kinds.size > 1) supported.push(Object.assign({group: g}, v)); });
  });
  const pairs = [].concat.apply([], multi.map(groupComparisons));
  return {individuals: persons.length, stories: list.length, outcomes: outcomes.length, perspectives, verified: outcomes.filter(x => evidenceClass(x.e) === 'verified').length,
    supported, pairs, conflicts: pairs.filter(p => p.link.comparison === 'conflicting'), multi,
    unverifiedLinked: [].concat.apply([], multi.map(g => [].concat.apply([], g.map(s => (s.evidence || []).filter(e => e.status !== 'future' && evidenceClass(e) !== 'verified').map(e => ({s, e}))))))};
}

/* ================= Invite Contributors ================= */
const INVITE_MESSAGE = "ABG is collecting stories about how our programs have impacted students, staff, and the community. We'd love to hear about your experience! You can share your story through a short, guided interview using our Impact Journal.";
function QrCode({text, label}){
  const svg = useMemo(() => { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({cellSize: 6, margin: 2, scalable: true, alt: label || 'QR code'}); } catch (e) { return ''; } }, [text]);
  return svg ? html`<div className="qr" role="img" aria-label=${label || 'QR code'} dangerouslySetInnerHTML=${{__html: svg}}></div>` : null;
}
function qrSvg(text){ const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({cellSize: 10, margin: 4}); }
function InviteView(){
  const {caps, subs, subsState, reloadSubs, isAdmin, showToast, nav} = useApp();
  const api = window.__platform && window.__platform.community;
  const url = location.origin + '/share';
  const [msg, setMsg] = useState(INVITE_MESSAGE + '\n\n' + url);
  const [invites, setInvites] = useState(null);
  const [form, setForm] = useState({label: '', relationship: '', maxUses: 1, days: 30, note: '', minorConsent: false});
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const loadInv = async () => { if (!api) return; try { setInvites(await api.invites()); } catch (e) { setInvites([]); setErr(e.message); } };
  useEffect(() => { loadInv(); reloadSubs(); }, []);
  const set = (k, v) => setForm(f => Object.assign({}, f, {[k]: v}));
  async function create(){
    setBusy(true); setErr('');
    try {
      const token = await api.createInvite({label: asStr(form.label).split(/\s+/)[0] || '', relationship: form.relationship, maxUses: +form.maxUses, days: +form.days, note: asStr(form.note), minorConsent: isAdmin && form.minorConsent, email: window.__platform.email});
      const link = url + '#i=' + token;
      setMade({link, label: form.label, msg: (form.label ? 'Hi ' + asStr(form.label).split(/\s+/)[0] + '! ' : '') + INVITE_MESSAGE + '\n\nYour personal link: ' + link});
      setForm({label: '', relationship: '', maxUses: 1, days: 30, note: '', minorConsent: false});
      loadInv();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  const revoke = async id => { try { await api.revokeInvite(id); showToast('Invitation link turned off'); loadInv(); } catch (e) { setErr(e.message); } };
  const invState = v => v.revoked_at ? ['Turned off', 'neutral'] : new Date(v.expires_at) < new Date() ? ['Expired', 'neutral'] : v.uses >= v.max_uses ? ['Used', 'good'] : ['Active', 'blue'];
  const since = Date.now() - 30 * 864e5;
  const realSubs = subs.filter(x => !x.is_test);
  const recent = realSubs.filter(x => Date.parse(x.submitted_at || 0) >= since);
  const byRel = RELATIONSHIPS.map(r => [r.label, realSubs.filter(x => x.relationship === r.id).length]).filter(r => r[1]);
  const mail = 'mailto:?subject=' + encodeURIComponent('Share your ABG story') + '&body=' + encodeURIComponent(msg);
  const sms = 'sms:?&body=' + encodeURIComponent(msg);
  return html`<div className="view invite">
    <header className="page-head"><h1>Invite Contributors</h1><p className="muted">Ask students, alumni, staff, parents, volunteers and friends to share their own stories. The link opens the Share Your Story page only: it never gives access to the journal.</p></header>
    ${err ? html`<p className="error" role="alert">${err}</p>` : null}
    <section className="card inv-link">
      <div><h2>Community link</h2>
        <p className="small muted">Anyone with this link can share a story. Put it on ABG's website, in emails and texts, or print the QR code on flyers. Adults only: students under 18 need a personal invitation (below).</p>
        <div className="linkbox"><input id="inv-url" className="input" readOnly=${true} value=${url} onFocus=${e => e.target.select()} /><${CopyButton} text=${url} label="Copy link" /></div>
        <div className="row-btns"><a className="btn btn-ghost btn-sm" href="/share" target="_blank" rel="noopener">Open the page</a>${caps.downloads ? html`<button className="btn btn-ghost btn-sm" onClick=${() => saveFile(caps, showToast, 'abg-share-your-story-qr.svg', qrSvg(url))}><${Icon} name="download" size=${16} /> Download QR code</button>` : null}</div>
      </div>
      <${QrCode} text=${url} label="QR code for the Share Your Story page" />
    </section>
    <section className="card">
      <h2>Invitation message</h2>
      <p className="small muted">Edit it if you like, then copy it into an email, text or post.</p>
      <textarea id="inv-msg" className="textarea" rows="5" value=${msg} onChange=${e => setMsg(e.target.value)}></textarea>
      <div className="row-btns"><${CopyButton} text=${msg} label="Copy message" /><a className="btn btn-ghost btn-sm" href=${mail}>Email it</a><a className="btn btn-ghost btn-sm" href=${sms}>Text it</a></div>
    </section>
    <section className="card">
      <h2>Personal invitation links</h2>
      <p className="small muted">A private link for one person (or a small group), shown once. It greets them by first name, can preset how they know ABG, and stops working after its uses or expiry date.</p>
      <div className="row">
        <${Field} label="Their first name (optional)"><input id="inv-label" className="input" maxLength="40" value=${form.label} onChange=${e => set('label', e.target.value)} /><//>
        <${Field} label="How they know ABG (optional)"><select id="inv-rel" className="select" value=${form.relationship} onChange=${e => set('relationship', e.target.value)}><option value="">Let them choose</option>${RELATIONSHIPS.map(r => html`<option key=${r.id} value=${r.id}>${r.label}</option>`)}</select><//>
      </div>
      <div className="row">
        <${Field} label="Can be used"><select id="inv-uses" className="select" value=${form.maxUses} onChange=${e => set('maxUses', e.target.value)}><option value="1">Once</option><option value="5">Up to 5 times</option><option value="25">Up to 25 times</option></select><//>
        <${Field} label="Expires after"><select id="inv-days" className="select" value=${form.days} onChange=${e => set('days', e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select><//>
      </div>
      <${Field} label="Internal note (optional)" hint="Only ABG staff see this."><input id="inv-note" className="input" value=${form.note} onChange=${e => set('note', e.target.value)} /><//>
      ${isAdmin ? html`<label className="check inv-minor"><input type="checkbox" id="inv-minor" checked=${form.minorConsent} onChange=${e => set('minorConsent', e.target.checked)} /> <span><strong>For a student under 18:</strong> I have documented permission from their parent or guardian for them to share their story with ABG. <span className="muted">Students under 18 can only take part through a link like this.</span></span></label>` : html`<p className="small muted">Inviting a student under 18? Ask an administrator: they record the parent or guardian's permission on the invitation.</p>`}
      ${form.minorConsent ? html`<p className="notice small">Use "Once" and send the link to the parent or guardian. Stories by students under 18 are never shared publicly with names.</p>` : null}
      <div><button className="btn btn-primary" id="inv-create" disabled=${busy || !api} onClick=${create}><${Icon} name="plus" size=${18} /> ${busy ? 'Creating…' : 'Create personal link'}</button></div>
      ${made ? html`<div className="inv-made" id="inv-made">
        <p className="small"><strong>Here's the link${made.label ? ' for ' + made.label : ''}.</strong> Copy it now: for privacy it isn't stored and can't be shown again.</p>
        <div className="linkbox"><input id="inv-made-link" className="input" readOnly=${true} value=${made.link} onFocus=${e => e.target.select()} /><${CopyButton} text=${made.link} label="Copy link" /></div>
        <div className="row-btns"><${CopyButton} text=${made.msg} label="Copy invitation message" /><a className="btn btn-ghost btn-sm" href=${'mailto:?subject=' + encodeURIComponent('Share your ABG story') + '&body=' + encodeURIComponent(made.msg)}>Email it</a><a className="btn btn-ghost btn-sm" href=${'sms:?&body=' + encodeURIComponent(made.msg)}>Text it</a></div>
        <${QrCode} text=${made.link} label="QR code for this personal link" />
      </div>` : null}
      ${invites && invites.length ? html`<div className="inv-list">${invites.map(v => { const [label, tone] = invState(v); return html`<div className="linked" key=${v.id}>
        <div style=${{minWidth: 0}}><${Pill} tone=${tone}>${label}<//> <strong>${v.label || 'No name'}</strong>${v.relationship ? ' · ' + labelOf(RELATIONSHIPS, v.relationship) : ''}${v.minor_consent ? html` <${Pill} tone="warn">Guardian permission on file<//>` : null}<br />
          <span className="small muted">Used ${v.uses} of ${v.max_uses} · expires ${fmtDate(v.expires_at)} · by ${v.created_by}${v.note ? ' · ' + v.note : ''}</span></div>
        ${label === 'Active' ? html`<button className="btn btn-quiet btn-sm" onClick=${() => revoke(v.id)}>Turn off</button>` : null}
      </div>`; })}</div>` : invites ? html`<p className="empty-note small">No personal links yet.</p>` : null}
    </section>
    <section className="card">
      <h2>Submission activity</h2>
      ${subsState === 'missing' ? html`<p className="notice small">Community submissions aren't set up on the server yet.</p>` : html`
      <div className="stats stats-3">
        <div className="stat"><b>${realSubs.length}</b><span>Stories submitted</span></div>
        <div className="stat"><b>${recent.length}</b><span>In the last 30 days</span></div>
        <div className="stat"><b>${realSubs.filter(x => x.status === 'pending_review').length}</b><span>Waiting for review</span></div>
      </div>
      ${byRel.length ? html`<p className="small muted">By connection: ${byRel.map(r => r[0] + ' ' + r[1]).join(' · ')}</p>` : null}
      <div><button className="btn btn-ghost btn-sm" onClick=${() => nav('submissions')}><${Icon} name="inbox" size=${16} /> Open Community Submissions</button></div>`}
    </section>
  </div>`;
}

/* ---------- Impact Insights: Community Perspectives and Source Comparison ---------- */
const LONG_TERM_DOMAINS = ['graduation', 'higher_ed', 'career', 'returned', 'arts_continued', 'pathways', 'next_employment', 'further_ed', 'role_growth', 'mentoring_students'];
function CommunityPerspectivesSection({list, period}){
  const {nav, openSheet} = useApp();
  const show = (title, rule, rows) => openSheet(close => html`<${BehindSheet} title=${title} rule=${rule} rows=${rows} close=${close} />`);
  const com = list.filter(isCommunity);
  const kinds = [['alumni_self', 'Alumni experiences'], ['parent_obs', 'Parent observations'], ['volunteer_obs', 'Volunteer observations'], ['community', 'Community testimonials'], ['student_self', 'Student self-reports'], ['staff_self', 'Staff self-reports']];
  const ofKind = k => com.filter(s => k === 'community' ? ['community_obs', 'community_self'].includes(sourceKind(s)) : sourceKind(s) === k);
  const themes = THEMES.map(t => ({t, n: com.filter(s => (s.themes || []).includes(t.id))})).filter(x => x.n.length).sort((a, b) => b.n.length - a.n.length).slice(0, 6);
  const areas = ACTIVE_OUTCOMES.map(o => ({o, n: com.filter(s => storyOutcomes(s).has(o.id))})).filter(x => x.n.length).sort((a, b) => b.n.length - a.n.length);
  const longTerm = com.filter(s => (s.evidence || []).some(e => e.status !== 'future' && LONG_TERM_DOMAINS.includes(domainOf(e)) && POSITIVE(e.direction)));
  const voices = com.slice().sort((a, b) => ((b.status === 'approved') - (a.status === 'approved')) || (outcomeCount(b) - outcomeCount(a))).slice(0, 3);
  return html`<section className="ins-section" aria-labelledby="h-community">
    <h2 id="h-community" className="ins-h">Community Perspectives</h2>
    <p className="tiny muted ins-hint">Stories shared through the Share Your Story page and approved by an administrator (${com.length} in this view, ${period}). Self-reports and observations, not verified records.</p>
    ${com.length === 0 ? html`<section className="card ins-card"><p className="empty-note">Not yet documented. Community stories appear here after an administrator approves them in Community Submissions.</p><div><button className="btn btn-ghost btn-sm" onClick=${() => nav('invite')}><${Icon} name="share" size=${16} /> Invite contributors</button></div></section>` : html`
    <div className="ins-charts">
      <section className="card ins-card"><div><h3>Who shared</h3><p className="small muted">Approved community stories by perspective</p></div>
        <ul className="ms-list">${kinds.map(([k, label]) => { const rows = ofKind(k); return html`<li key=${k}><button className="ms-btn" onClick=${() => show(label, rows.length + ' approved community stories.', rows.map(s => ({story: s, lines: [{text: contributorText(s)}]})))}><span>${label}</span><b className="tnum">${rows.length}</b></button></li>`; })}</ul>
      </section>
      <section className="card ins-card"><div><h3>Recurring themes and outcomes</h3><p className="small muted">Number of community stories mentioning each</p></div>
        <ul className="ms-list">${areas.slice(0, 5).map(x => html`<li key=${x.o.id}><button className="ms-btn" onClick=${() => show(x.o.label, x.n.length + ' of ' + com.length + ' community stories.', x.n.map(s => ({story: s, lines: (s.evidence || []).filter(e => evidenceCategories(e).includes(x.o.id)).map(insLine)})))}><span>${x.o.label}</span><b className="tnum">${x.n.length}<small className="muted"> of ${com.length}</small></b></button></li>`)}
          ${themes.slice(0, 3).map(x => html`<li key=${x.t.id}><button className="ms-btn" onClick=${() => show('Theme: ' + x.t.label, x.n.length + ' community stories.', x.n.map(s => ({story: s, lines: []})))}><span>Theme: ${x.t.label}</span><b className="tnum">${x.n.length}</b></button></li>`)}
          <li><button className="ms-btn" onClick=${() => show('Long-term outcomes', 'Community stories describing graduation, college, careers, returning to ABG, continued art or professional growth.', longTerm.map(s => ({story: s, lines: (s.evidence || []).filter(e => e.status !== 'future' && LONG_TERM_DOMAINS.includes(domainOf(e))).map(insLine)})))}><span>Long-term outcomes described</span><b className="tnum">${longTerm.length}</b></button></li>
        </ul>
      </section>
    </div>
    <section className="card ins-card"><div><h3>Community voices</h3><p className="small muted">In contributors' own experience. Public use only where the story is approved for external use.</p></div>
      <div className="fs-grid">${voices.map(s => html`<button className="fs-card" key=${s.id} onClick=${() => nav('story', {id: s.id})}>${storyArt(s.id)}<span className="fs-main"><strong>${s.alias || sourceLabel(s)}</strong><small className="muted">${sourceLabel(s)}</small><span className="fs-sum">${s.summary || s.title}</span></span></button>`)}</div>
    </section>`}
  </section>`;
}
function SourceComparisonSection({list}){
  const {nav, openSheet} = useApp();
  const show = (title, rule, rows) => openSheet(close => html`<${BehindSheet} title=${title} rule=${rule} rows=${rows} close=${close} />`);
  const st = useMemo(() => sourceStats(list), [list]);
  const matches = useMemo(() => possibleMatches(list), [list]);
  const byCat = id => st.pairs.filter(p => p.link.comparison === id);
  const stat = (value, label, sub, onClick) => html`<button className="stat-card ins-stat" onClick=${onClick}><span className="stat-text"><b className="tnum">${value}</b><span className="stat-label">${label}</span><small className="muted">${sub}</small></span></button>`;
  return html`<section className="ins-section" aria-labelledby="h-sources">
    <h2 id="h-sources" className="ins-h">Source Comparison</h2>
    <p className="tiny muted ins-hint">People are counted once even when several accounts describe them. Agreement between perspectives strengthens a story; it doesn't make an outcome independently verified.</p>
    <div className="ins-stats">
      ${stat(st.individuals, 'Unique individuals represented', 'Students and staff, each counted once', () => nav('compare'))}
      ${stat(st.stories, 'Stories', 'Internal interviews and approved community stories', () => nav('library'))}
      ${stat(st.outcomes, 'Reported outcomes', 'Outcome records, as recorded', () => nav('compare'))}
      ${stat(st.perspectives, 'Supporting perspectives', 'Extra perspectives on the same person', () => show('Supporting perspectives', 'People with accounts from more than one perspective.', st.multi.map(g => ({story: g[0], lines: g.map(s => ({text: sourceLabel(s) + ': ' + s.title}))}))))}
      ${stat(st.verified, 'Independently verified outcomes', 'Checked against records', () => nav('compare'))}
    </div>
    <div className="ins-charts">
      <section className="card ins-card"><div><h3>Linked accounts</h3><p className="small muted">How confirmed accounts of the same person compare</p></div>
        <ul className="ms-list">${COMPARISON.map(c => { const rows = byCat(c.id); return html`<li key=${c.id}><button className="ms-btn" onClick=${() => show(c.label, c.desc, rows.map(p => ({story: p.a, lines: [{text: sourceLabel(p.a) + ' and ' + sourceLabel(p.b) + (p.link.note ? ': ' + p.link.note : ''), tag: c.label}]})))}><span>${c.label}</span><b className="tnum">${rows.length}</b></button></li>`; })}
          <li><button className="ms-btn" onClick=${() => nav('compare')}><span>Possible matches awaiting review</span><b className="tnum">${matches.length}</b></button></li></ul>
      </section>
      <section className="card ins-card"><div><h3>Cross-perspective findings</h3><p className="small muted">From people with more than one account</p></div>
        <ul className="ms-list">
          <li><button className="ms-btn" onClick=${() => show('Outcomes supported by multiple perspectives', 'An outcome area with a positive account from two or more different perspectives about the same person.', st.supported.map(x => ({story: x.group[0], lines: x.items.map(i => ({text: sourceLabel(i.s) + ': ' + i.e.statement, e: i.e}))})))}><span>Outcomes supported by multiple perspectives</span><b className="tnum">${st.supported.length}</b></button></li>
          <li><button className="ms-btn" onClick=${() => show('Conflicting accounts', 'Linked accounts an administrator marked as conflicting. Both accounts are kept as told.', st.conflicts.map(p => ({story: p.a, lines: [{text: sourceLabel(p.a) + ' vs ' + sourceLabel(p.b) + (p.link.note ? ': ' + p.link.note : '')}]})))}><span>Conflicting accounts needing review</span><b className="tnum">${st.conflicts.length}</b></button></li>
          <li><button className="ms-btn" onClick=${() => show('Outcomes that need verification', 'Outcomes in linked accounts that no one has checked against a record yet.', groupRows(st.unverifiedLinked.map(x => ({s: x.s, line: insLine(x.e)}))))}><span>Outcomes in linked accounts not yet verified</span><b className="tnum">${st.unverifiedLinked.length}</b></button></li>
        </ul>
      </section>
    </div>
  </section>`;
}

/* ================= staff story pieces ================= */
function TypePill({story}){
  const t = storyTypeOf(story);
  if (t === 'general') return null;
  return html`${t === 'staff' ? html`<${Pill} tone="purple">Staff Impact<//>` : html`<${Pill} tone="teal">Student Impact<//>`}${isFormerStudent(story) ? html`<span className="pill tone-path" title="This staff member was an ABG student first">Student → Staff</span>` : null}`;
}
const STAFF_CARD_GROUPS = [{id: 'employment', label: 'Employment'}, {id: 'development', label: 'Professional development'}, {id: 'community', label: 'Community contribution'}, {id: 'career', label: 'Career'}];
function StaffCardView({story, readOnly, onEdit}){
  const n = staffKnown(story);
  return html`<section className="ev-group mc-embedded">
    <div className="sec-head"><h3>Staff impact card</h3><div className="row-btns"><span className="small muted tnum">${n} of ${STAFF_FIELDS.length} documented</span>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${onEdit}><${Icon} name="edit" size=${16} /> Correct or fill in</button>` : null}</div></div>
    <p className="small muted">The same employment and development fields on every staff story. "Not documented" means the interview didn't say; it is never counted as "no". Reported values are Kyle's observations, not verified employment records.</p>
    ${STAFF_CARD_GROUPS.map(g => html`<div key=${g.id}><p className="eyebrow sc-group">${g.label}</p>
      <dl className="mc-view">${STAFF_FIELDS.filter(f => f.group === g.id).map(f => { const m = staffVal(story, f.id); return html`<div key=${f.id} className=${m ? '' : 'is-unknown'}><dt>${f.label}</dt><dd>${m ? html`<span>${fmtMetric(f, m.value)}</span> <${MetricPill} status=${m.status} />${m.excerpt ? html`<small className="mc-src muted">“${trunc(m.excerpt, 120)}”</small>` : m.source === 'intake' ? html`<small className="mc-src muted">From the intake form</small>` : null}` : html`<span className="muted">Not documented</span>`}</dd></div>`; })}</dl>
    </div>`)}
  </section>`;
}
function JourneyPath({journey}){
  const by = {}; (journey || []).forEach(j => { by[j.stage] = j; });
  return html`<ol className="journey">${JOURNEY_STAGES.map((st, i) => { const j = by[st.id]; return html`<li key=${st.id} className=${'jn' + (j ? ' on' : '')}>
    <span className="jn-dot" aria-hidden="true">${j ? '✓' : i + 1}</span>
    <span className="jn-text"><strong>${st.label}</strong>${j ? html`<span>${j.text}</span>` : html`<span className="muted">Not documented</span>`}</span>
  </li>`; })}</ol>`;
}
/* links a Staff Impact story to the same person's Student Impact story. Never automatic: a person confirms it */
function SamePersonLinks({story, links, readOnly}){
  const {nav, openSheet} = useApp();
  return html`<div className="same-person">
    ${links.length ? html`<p className="small"><${Pill} tone="teal">Linked Student Impact story<//> ${links.map(l => html`<button key=${l.storyId} className="btn btn-quiet btn-sm" onClick=${() => nav('story', {id: l.storyId})}>${l.other.alias ? l.other.alias + ': ' : ''}${l.other.title}</button>`)}</p>`
      : isFormerStudent(story) ? html`<p className="small muted">If ${story.alias || 'this person'} has a Student Impact story in the journal, link it so both stories show the same person's path.</p>` : null}
    ${!readOnly && (isFormerStudent(story) || links.length) ? html`<button className="btn btn-ghost btn-sm" onClick=${() => openSheet(close => html`<${LinkStudentSheet} story=${story} close=${close} />`)}><${Icon} name="link" size=${16} /> ${links.length ? 'Link another Student Impact story' : 'Link their Student Impact story'}</button>` : null}
  </div>`;
}
function LinkStudentSheet({story, close}){
  const {caps, stories, students, staffPeople, safeWrite, showToast} = useApp();
  const [q, setQ] = useState(asStr(story.alias));
  const [pick, setPick] = useState('');
  const [sure, setSure] = useState(false);
  const already = new Set((story.links || []).filter(l => l.type === 'same_person').map(l => l.storyId));
  const k = norm(q);
  const options = stories.filter(s => isStudentStory(s) && !already.has(s.id) && (!!s.demo === !!story.demo) && (!k || norm([s.alias, s.title, s.program].join(' ')).includes(k)))
    .sort((a, b) => (a.alias || '').localeCompare(b.alias || '')).slice(0, 30);
  const other = stories.find(s => s.id === pick);
  async function link(){
    if (!other || !sure) return;
    const me = caps.me || {};
    const reason = 'Confirmed as the same person by ' + (asStr(me.name) || 'ABG staff') + ' on ' + fmtDay(todayLocal());
    const ok = await safeWrite(async () => {
      await caps.db.collection('stories').doc(story.id).update({links: clone(story.links || []).concat([{storyId: other.id, type: 'same_person', reason, confirmed: true}]), updatedAt: nowISO(), updatedBy: me.id || null});
      await caps.db.collection('stories').doc(other.id).update({links: clone(other.links || []).filter(l => !(l.storyId === story.id && l.type === 'same_person')).concat([{storyId: story.id, type: 'same_person', reason, confirmed: true}])});
      const sp = story.staffId ? (staffPeople || []).find(x => x.id === story.staffId) : null;
      if (sp && other.studentId && !sp.studentId) await caps.db.collection('staff').doc(sp.id).update({studentId: other.studentId});
    });
    if (ok) { showToast('Stories linked'); close(); }
  }
  const studentNote = s => { const st = s.studentId ? students.find(x => x.id === s.studentId) : null; return st && st.note ? ' (' + st.note + ')' : ''; };
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Link a Student Impact story" close=${close} />
    <p className="small">Link only when you know this is the same person. A matching first name isn't enough: two people can share a name.</p>
    <${Field} label="Find the student story"><input id="ls-q" className="input" type="search" value=${q} onChange=${e => { setQ(e.target.value); setPick(''); setSure(false); }} placeholder="First name, title or program" /><//>
    ${options.length === 0 ? html`<p className="empty-note">No student stories match.</p>` : html`<div className="pick-list">${options.map(s => html`<label key=${s.id} className=${'pick' + (pick === s.id ? ' on' : '')}><input type="radio" name="ls-pick" checked=${pick === s.id} onChange=${() => { setPick(s.id); setSure(false); }} /><span><strong>${s.alias || 'Student'}${studentNote(s)}</strong><br /><span className="small muted">${s.title}${s.program ? ' · ' + s.program : ''}${fmtEventDate(s.eventDate) ? ' · ' + fmtEventDate(s.eventDate) : ''}</span></span></label>`)}</div>`}
    ${other ? html`<label className="check"><input id="ls-sure" type="checkbox" checked=${sure} onChange=${e => setSure(e.target.checked)} /> I've confirmed that ${other.alias || 'this student'} in "${trunc(other.title, 50)}" is the same person as ${story.alias || 'this staff member'}.</label>` : null}
    <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" id="ls-link" disabled=${!other || !sure} onClick=${link}>Link stories</button></div>
  </div>`;
}
function MilestonesSection(){
  const {stories: shownAll, storiesLoaded} = useApp();
  const stories = useMemo(() => shownAll.filter(reportable), [shownAll]);
  const st = useMemo(() => milestoneStats(stories), [stories]);
  return html`<section className="card">
    <h2>Student milestones</h2>
    <p className="small muted">How many students documented in this journal reached each milestone. These are counts from the stories Kyle chose to record, not success rates for all ABG students.</p>
    ${!storiesLoaded ? html`<div className="skeleton"></div>` : st.N === 0 ? html`<p className="empty-note">No student stories yet.</p>` : html`<div className="ms-dash">${st.rows.map(r => html`<div className=${'ms-row' + (r.n ? '' : ' is-zero')} key=${r.mi.id}>
      <span className="ms-n tnum">${r.n}</span>
      <span className="ms-text"><strong>${r.mi.label}</strong><small className="muted">${r.n ? 'of ' + st.N + ' students documented · ' + [r.observed ? r.observed + ' Kyle observed' : '', r.reported ? r.reported + ' reported to Kyle' : '', r.card ? r.card + ' from metrics card' : ''].filter(Boolean).join(', ') : 'None recorded yet'}</small></span>
    </div>`)}</div>`}
  </section>`;
}
function ImpactByCategory(){
  const {stories: shownAll, storiesLoaded} = useApp();
  const stories = useMemo(() => shownAll.filter(reportable), [shownAll]);
  const stats = useMemo(() => categoryStats(stories), [stories]);
  const N = studentProfiles(stories).length;
  const verifiedStories = stories.filter(s => (s.evidence || []).some(e => e.status === 'verified')).length;
  const missingStories = stories.filter(s => (s.missingMetrics || []).length > 0).length;
  return html`<section className="card">
    <h2>Impact by category</h2>
    <p className="small muted">Patterns across students. Each student counts once, even with several stories. Percentages use only students with relevant data, shown as "of n". Missing data never counts as "no improvement", and a change during participation doesn't prove ABG caused it.</p>
    ${!storiesLoaded ? html`<div className="skeleton"></div>` : html`<div className="stats stats-3">
        <div className="stat"><b>${N}</b><span>Students documented</span></div>
        <div className="stat"><b>${verifiedStories}</b><span>Stories with verified evidence</span></div>
        <div className="stat"><b>${missingStories}</b><span>Stories with missing data</span></div>
      </div>
      <div className="cat-grid">${stats.map(c => html`<div className="cat" key=${c.d.id}>
        <h3>${c.d.label}</h3>
        ${c.n === 0 ? html`<p className="small muted">No data recorded yet.</p>` : c.d.id === 'participation' ? html`
          <p><strong>${c.retained} of ${c.n}</strong> <span className="small muted">still participating or returned</span></p>
          ${c.years.length >= 2 ? html`<p className="small">Average ${round1(c.years.reduce((a, b) => a + b, 0) / c.years.length)} years with ABG <span className="muted">(${c.years.length} students)</span></p>` : null}
          ${c.sessions.length >= 2 ? html`<p className="small">Average ${round1(c.sessions.reduce((a, b) => a + b, 0) / c.sessions.length)} sessions attended <span className="muted">(${c.sessions.length} students)</span></p>` : null}
          <p className="small muted">${c.n} student${c.n === 1 ? '' : 's'} with participation data · ${c.verifiedStories} stor${c.verifiedStories === 1 ? 'y' : 'ies'} with verified evidence</p>` : html`
          <p><strong>${c.improved} of ${c.n}</strong> <span className="small muted">with a reported improvement${c.n ? ' (' + pct(c.improved, c.n) + ')' : ''}${c.improvedVerified ? ' · ' + c.improvedVerified + ' verified' : ''}</span></p>
          <p className="small">${c.measurable} of ${c.n} with a measurable before-and-after improvement (${pct(c.measurable, c.n)})</p>
          ${c.averages.map(av => av.n >= 2 ? html`<p className="small tnum" key=${av.unit}>Average ${avgLine(av)} <span className="muted">· ${av.n} students${av.verified ? ', ' + av.verified + ' verified' : ''}</span></p>` : html`<p className="small muted" key=${av.unit}>1 student with ${unitLabel(av.unit)} figures; too few to average.</p>`)}
          <p className="small muted">${c.verifiedStories} stor${c.verifiedStories === 1 ? 'y' : 'ies'} with verified evidence</p>`}
      </div>`)}</div>`}
  </section>`;
}
function OutcomesSection(){
  const {stories: shownAll, nav, storiesLoaded} = useApp();
  const stories = useMemo(() => shownAll.filter(reportable), [shownAll]);
  const profiles = useMemo(() => studentProfiles(stories), [stories]);
  const lines = useMemo(() => outcomeLines(profiles), [profiles]);
  const N = profiles.length;
  const filled = lines.reduce((a, l) => a + l.n, 0);
  const gaps = lines.filter(l => l.n < N).sort((a, b) => a.n - b.n).slice(0, 3);
  return html`<section className="card">
    <h2>Student metrics card summary</h2>
    <p className="small muted">Rolled up from the metrics card on each student story. Every line says how many students it rests on and how sure the values are. These describe the students documented here, not every student ABG serves. Open a line to see whose stories it comes from.</p>
    ${!storiesLoaded ? html`<div className="skeleton"></div>`
      : N === 0 ? html`<p className="empty-note">No student stories yet. Outcomes appear here once stories with metrics cards are saved.</p>`
      : html`<div className="stats stats-3">
          <div className="stat"><b>${N}</b><span>Students documented</span></div>
          <div className="stat"><b>${Math.round(100 * filled / (N * METRIC_FIELDS.length))}%</b><span>Metrics cards filled in</span></div>
          <div className="stat"><b>${lines.reduce((a, l) => a + l.counts.verified, 0)}</b><span>Verified values</span></div>
        </div>
        <div className="oc-list">${lines.map(l => html`<details className=${'oc' + (l.n ? '' : ' is-empty')} key=${l.f.id}>
          <summary><span className="oc-main"><strong>${l.f.label}</strong>${l.text ? html`<span>${l.text}</span>` : null}<span className="small muted tnum">${l.n ? basisText(l) : 'Unknown for all ' + N + ' documented students'}</span></span><${Icon} name="chev" size=${18} /></summary>
          <div className="oc-body">${l.vals.length ? l.vals.map(v => html`<div className="linked" key=${v.p.key}><button className="btn btn-quiet btn-sm" style=${{whiteSpace: 'normal', textAlign: 'left'}} onClick=${() => nav('story', {id: v.storyId})}>${v.p.name || 'Student'}</button><span className="small tnum">${fmtMetric(l.f, v.value)} <${MetricPill} status=${v.status} /></span></div>`) : html`<p className="small muted">No values recorded yet.</p>`}</div>
        </details>`)}</div>
        ${gaps.length ? html`<p className="small muted"><strong>Most often unknown:</strong> ${gaps.map(g => g.f.short + ' (' + (N - g.n) + ' of ' + N + ')').join(', ')}. Worth asking about in the next interviews or updates.</p>` : null}`}
  </section>`;
}

/* ================= student list (backlog) ================= */
const WHENISH = /\b(19|20)\d{2}\b|\b(spring|summer|fall|autumn|winter|ago|last year|this year|grade|semester|years?)\b|\d(st|nd|rd|th)\b/i;
function cleanFirstName(s){ const w = asStr(s).replace(/[^\p{L}\p{M}'’-]+/gu, ' ').trim().split(/\s+/)[0] || ''; return w ? w.charAt(0).toUpperCase() + w.slice(1) : ''; }
function parseBacklog(text){
  return String(text || '').split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).map(l => {
    const parts = l.split(/\s*[,;|\t]\s*|\s+[-–—]\s+|\s*:\s+/).map(asStr).filter(Boolean);
    const name = cleanFirstName(parts.shift());
    let when = '';
    if (parts.length >= 2 || (parts.length === 1 && WHENISH.test(parts[0]) && parts[0].length <= 30)) when = parts.shift();
    return {name: name.slice(0, 40), when: when.slice(0, 60), memory: parts.join(', ').slice(0, 300)};
  }).filter(x => x.name);
}
function sortBacklog(list){ return list.slice().sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || '').localeCompare(b.createdAt || '')); }
function startBacklogInterview(nav, b){ nav('interview', {backlogId: b.id, firstName: b.name, when: b.when || '', memory: b.memory || ''}); }
function Progress({done, total}){ const pct = total ? Math.round(100 * done / total) : 0; return html`<div className="progress" role="progressbar" aria-valuemin="0" aria-valuemax=${total} aria-valuenow=${done} aria-label=${done + ' of ' + total + ' recorded'}><span style=${{width: pct + '%'}}></span></div>`; }
function BacklogSheet({item, close}){
  const {caps, safeWrite, showToast} = useApp();
  const [name, setName] = useState(item.name || '');
  const [when, setWhen] = useState(item.when || '');
  const [memory, setMemory] = useState(item.memory || '');
  const ref = caps.db.collection('backlog').doc(item.id);
  async function save(){ const n = cleanFirstName(name); if (!n) return; if (await safeWrite(() => ref.update({name: n, when: asStr(when), memory: asStr(memory)}))) close(); }
  async function remove(){ if (await safeWrite(() => ref.delete())) { showToast('Removed from the list'); close(); } }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Edit student" close=${close} />
    <${Field} label="First name" hint="First name or nickname only."><input id="bl-edit-name" className="input" value=${name} onChange=${e => setName(e.target.value)} /><//>
    <${Field} label="Roughly when"><input className="input" value=${when} onChange=${e => setWhen(e.target.value)} placeholder="e.g. 2019, or this fall" /><//>
    <${Field} label="What you remember"><textarea className="textarea" rows="3" value=${memory} onChange=${e => setMemory(e.target.value)}></textarea><//>
    ${item.status === 'recorded' ? html`<p className="small muted">Removing this from the list doesn't delete the story.</p>` : null}
    <div className="row-btns end"><button className="btn btn-quiet danger" onClick=${remove}>Remove</button><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" disabled=${!cleanFirstName(name)} onClick=${save}>Save</button></div>
  </div>`;
}
function BacklogView({embedded}){
  const {caps, backlog, backlogLoaded, stories, nav, readOnly, safeWrite, showToast, openSheet} = useApp();
  const [name, setName] = useState('');
  const [when, setWhen] = useState('');
  const [memory, setMemory] = useState('');
  const [paste, setPaste] = useState(() => lsGet('abg-backlog-paste') || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => { if (paste.trim()) lsSet('abg-backlog-paste', paste); else lsDel('abg-backlog-paste'); }, 300); return () => clearTimeout(t); }, [paste]);
  const waiting = sortBacklog(backlog.filter(b => b.status === 'waiting'));
  const recorded = backlog.filter(b => b.status === 'recorded').sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''));
  const skipped = sortBacklog(backlog.filter(b => b.status === 'skipped'));
  const total = waiting.length + recorded.length;
  const parsed = parseBacklog(paste);
  const exists = x => backlog.some(b => norm(b.name) === norm(x.name) && norm(b.memory) === norm(x.memory));
  const fresh = parsed.filter(x => !exists(x));
  const db = caps.db;
  const maxOrder = backlog.reduce((m, b) => Math.max(m, b.order || 0), 0);
  const doc = (x, i) => ({name: x.name, when: asStr(x.when), memory: asStr(x.memory), status: 'waiting', storyId: null, studentId: null, order: maxOrder + i + 1, createdAt: nowISO(), createdBy: (caps.me && caps.me.id) || null});
  async function addOne(e){
    e.preventDefault();
    const n = cleanFirstName(name); if (!n) return;
    setBusy(true);
    const ok = await safeWrite(() => db.collection('backlog').doc(uid('bl')).set(doc({name: n, when, memory}, 0)));
    setBusy(false);
    if (ok) { setName(''); setWhen(''); setMemory(''); showToast(n + ' added to the list'); try { document.getElementById('bl-name').focus(); } catch (er) {} }
  }
  async function addAll(){
    if (!fresh.length) return;
    setBusy(true);
    const ok = await safeWrite(async () => { for (let i = 0; i < fresh.length; i++) await db.collection('backlog').doc(uid('bl')).set(doc(fresh[i], i)); });
    setBusy(false);
    if (ok) { showToast(fresh.length + ' student' + (fresh.length > 1 ? 's' : '') + ' added'); setPaste(''); }
  }
  const setStatus = (b, status) => safeWrite(() => db.collection('backlog').doc(b.id).update({status}));
  const storyOf = b => b.storyId ? stories.find(s => s.id === b.storyId) : null;
  const edit = b => openSheet(close => html`<${BacklogSheet} item=${b} close=${close} />`);
  return html`<div className="view backlog">
    ${embedded ? null : html`<header className="page-head"><h1>Student List</h1><p className="muted">Every student whose story is still only in your head. List them quickly, then record them one at a time. Each interview ends with the same metrics card, so the stories add up.</p></header>`}
    ${readOnly ? html`<p className="notice small"><strong>View-only access.</strong> You can see the list but not change it.</p>` : null}
    <section className="card">
      <div className="sec-head"><h2>Progress</h2><span className="small muted tnum">${backlogLoaded ? recorded.length + ' of ' + total + ' stories recorded' : ''}</span></div>
      <${Progress} done=${recorded.length} total=${total} />
      ${backlogLoaded && total === 0 ? html`<p className="small muted">Nobody on the list yet. Add students below, one at a time or as a pasted list.</p>` : null}
    </section>
    ${!readOnly ? html`<section className="card">
      <h2>Add students</h2>
      <p className="small muted"><${Icon} name="lock" size=${14} /> First names or nicknames only. Only the first word of a name is kept, so last names never get saved.</p>
      <form className="bl-form" onSubmit=${addOne}>
        <${Field} label="First name"><input id="bl-name" className="input" autoComplete="off" value=${name} onChange=${e => setName(e.target.value)} placeholder="e.g. Maya" /><//>
        <${Field} label="Roughly when (optional)"><input id="bl-when" className="input" value=${when} onChange=${e => setWhen(e.target.value)} placeholder="e.g. 2019, or 7th grade" /><//>
        <${Field} label="One thing you remember (optional)"><input id="bl-memory" className="input" value=${memory} onChange=${e => setMemory(e.target.value)} placeholder="e.g. barely spoke, then led the library mural" /><//>
        <button className="btn btn-primary" type="submit" disabled=${!cleanFirstName(name) || busy}><${Icon} name="plus" size=${18} /> Add to list</button>
      </form>
      <details className="sec bl-paste" open=${!!paste.trim()}>
        <summary><span>Paste or dictate a whole list</span><${Icon} name="chev" size=${18} /></summary>
        <div className="sec-body">
          <p className="small muted">One student per line: first name, roughly when, what you remember. For example: <em>Maya, 2019, painted the library mural</em>. Dictating works too; just start a new line for each student.</p>
          <textarea id="bl-paste" className="textarea" rows="7" value=${paste} onChange=${e => setPaste(e.target.value)} placeholder=${'Maya, 2019, barely spoke, then led the library mural\nLuis, spring 2021, came every Saturday\nAna, 8th grade, wants to study design'}></textarea>
          ${parsed.length ? html`<div className="bl-preview">${parsed.slice(0, 40).map((x, i) => html`<p key=${i} className=${'small' + (exists(x) ? ' muted' : '')}><strong>${x.name}</strong>${x.when ? ' · ' + x.when : ''}${x.memory ? ' · ' + x.memory : ''}${exists(x) ? ' (already on the list)' : ''}</p>`)}${parsed.length > 40 ? html`<p className="small muted">and ${parsed.length - 40} more</p>` : null}</div>` : null}
          <div className="row-btns"><button className="btn btn-primary" disabled=${!fresh.length || busy} onClick=${addAll}>${fresh.length ? 'Add ' + fresh.length + ' student' + (fresh.length > 1 ? 's' : '') : 'Add students'}</button></div>
        </div>
      </details>
    </section>` : null}
    <section className="card">
      <div className="sec-head"><h2>To record</h2><span className="count">${waiting.length}</span></div>
      ${!backlogLoaded ? html`<div className="skeleton"></div>` : waiting.length === 0 ? html`<p className="empty-note">${total ? 'Every student on the list has a story. Nice work.' : 'No students waiting.'}</p>`
        : waiting.map((b, i) => html`<div className="bl-item" key=${b.id}>
          <div className="bl-text"><p><strong>${b.name}</strong>${b.when ? html` <span className="small muted">· ${b.when}</span>` : null}</p>${b.memory ? html`<p className="small muted">${b.memory}</p>` : null}</div>
          ${!readOnly ? html`<div className="row-btns">
            <button className=${'btn btn-sm ' + (i === 0 ? 'btn-primary' : 'btn-ghost')} onClick=${() => startBacklogInterview(nav, b)}><${Icon} name="mic" size=${16} /> Record story</button>
            <button className="btn btn-quiet btn-sm" onClick=${() => setStatus(b, 'skipped')}>Skip</button>
            <button className="icon-btn" aria-label=${'Edit ' + b.name} onClick=${() => edit(b)}><${Icon} name="edit" size=${18} /></button>
          </div>` : null}
        </div>`)}
    </section>
    ${recorded.length ? html`<section className="card">
      <div className="sec-head"><h2>Recorded</h2><span className="count">${recorded.length}</span></div>
      ${recorded.map(b => { const s = storyOf(b); return html`<div className="bl-item" key=${b.id}>
        <div className="bl-text"><p><strong>${b.name}</strong> <${Pill} tone="good">Recorded<//></p>${s ? html`<p className="small muted tnum">${metricsKnown(s)} of ${METRIC_FIELDS.length} metrics known · ${labelOf(STATUSES, s.status)}</p>` : html`<p className="small muted">The story was removed.</p>`}</div>
        <div className="row-btns">${s ? html`<button className="btn btn-ghost btn-sm" onClick=${() => nav('story', {id: s.id})}>${trunc(s.title, 40)}</button>` : null}${!readOnly ? html`<button className="icon-btn" aria-label=${'Edit ' + b.name} onClick=${() => edit(b)}><${Icon} name="edit" size=${18} /></button>` : null}</div>
      </div>`; })}
    </section>` : null}
    ${skipped.length ? html`<details className="sec"><summary><span>Skipped<span className="count">${skipped.length}</span></span><${Icon} name="chev" size=${18} /></summary><div className="sec-body">
      ${skipped.map(b => html`<div className="bl-item" key=${b.id}><div className="bl-text"><p><strong>${b.name}</strong>${b.memory ? html` <span className="small muted">· ${b.memory}</span>` : null}</p></div>${!readOnly ? html`<div className="row-btns"><button className="btn btn-quiet btn-sm" onClick=${() => setStatus(b, 'waiting')}>Put back</button><button className="icon-btn" aria-label=${'Edit ' + b.name} onClick=${() => edit(b)}><${Icon} name="edit" size=${18} /></button></div>` : null}</div>`)}
    </div></details>` : null}
  </div>`;
}

/* ================= library ================= */
function isLongTerm(s){ return yearSpan(s) >= 1 || (s.categories || []).includes('longterm') || (s.themes || []).includes('alumni_return') || (s.themes || []).includes('long_term_development') || (s.milestones || []).some(m => m.phase === 'long_term' && m.confirmed); }
function applyFilters(stories, f, q){
  const toks = norm(q).split(' ').filter(Boolean);
  return stories.filter(s => {
    if (f.type && storyTypeOf(s) !== f.type) return false;
    if (f.source && f.source !== 'test' && (f.source === 'community') !== isCommunity(s)) return false;
    if (f.contributor && relationshipOf(s) !== f.contributor) return false;
    if (f.evclass && !(s.evidence || []).some(e => e.status !== 'future' && evidenceClass(e) === f.evclass)) return false;
    if (f.review === 'withdrawn' && !isWithdrawn(s)) return false;
    if (f.former === 'yes' && !isFormerStudent(s)) return false;
    if (f.status && s.status !== f.status) return false;
    if (f.category && !(s.categories || []).includes(f.category)) return false;
    if (f.theme && !(s.themes || []).includes(f.theme)) return false;
    if (f.audience && !(s.audiences || []).includes(f.audience)) return false;
    if (f.program && s.program !== f.program) return false;
    if (f.community && s.community !== f.community) return false;
    if (f.period === 'past' && s.period !== 'past') return false;
    if (f.period === 'recent' && s.period === 'past') return false;
    if (f.period === 'ongoing' && !isOngoing(s)) return false;
    if (f.period === 'longterm' && !isLongTerm(s)) return false;
    if (f.student && s.studentId !== f.student) return false;
    if (f.horizon === 'long' && !isLongTerm(s)) return false;
    if (f.horizon === 'short' && (isLongTerm(s) || !(s.milestones || []).some(m => m.phase === 'immediate' || m.phase === 'short_term'))) return false;
    if (f.evidence === 'measurable' && !hasMeasurable(s)) return false;
    if (f.evidence === 'verified' && !hasVerifiedNumeric(s)) return false;
    if (f.need === 'yes' && !(needsInfo(s) || openTasks(s).length > 0)) return false;
    const y = storyYear(s);
    if (f.from && (!y || y < +f.from)) return false;
    if (f.to && (!y || y > +f.to)) return false;
    if (toks.length) {
      const hay = norm([s.title, s.summary, s.story, s.alias, s.program, s.community, fmtEventDate(s.eventDate), storyTypeLabel(s), isStaffStory(s) ? (s.staffInfo || {}).role : '', isFormerStudent(s) ? 'former student student to staff' : ''].concat(s.takeaways || [], (s.themes || []).map(t => labelOf(THEMES, t)), (s.categories || []).map(c => labelOf(CATEGORIES, c)), (s.evidence || []).map(e => e.statement)).join(' '));
      if (!toks.every(t => hay.includes(t))) return false;
    }
    return true;
  });
}
function sortStories(list, sort){
  const a = list.slice();
  const ev = s => (s.eventDate && s.eventDate.iso) || (s.createdAt || '').slice(0, 10);
  if (sort === 'updated') a.sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''));
  else if (sort === 'event_new') a.sort((x, y) => ev(y).localeCompare(ev(x)));
  else if (sort === 'event_old') a.sort((x, y) => ev(x).localeCompare(ev(y)));
  else a.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
  return a;
}
function FilterSheet({initial, programs, communities, students, onApply, close}){
  const [f, setF] = useState(Object.assign({}, initial));
  const set = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
  const sel = (id, label, key, opts) => html`<${Field} label=${label}><select id=${id} className="select" value=${f[key] || ''} onChange=${e => set(key, e.target.value)}><option value="">Any</option>${opts.map(o => html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`)}</select><//>`;
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Filter stories" close=${close} />
    <div className="row">${sel('fl-contrib', 'Contributor relationship', 'contributor', CONTRIBUTOR_TYPES.map(c => [c.id, c.label]))}${sel('fl-evclass', 'Evidence classification', 'evclass', EVIDENCE_CLASSES.map(c => [c.id, c.label]))}</div>
    <div className="row">${sel('fl-status', 'Review status', 'status', STATUSES.map(s => [s.id, s.label]))}${sel('fl-period', 'Historical or recent', 'period', [['past', 'Historical'], ['recent', 'Recent'], ['ongoing', 'Ongoing (has updates)']])}</div>
    <div className="row">${sel('fl-student', 'Student first name', 'student', students.slice().sort((a, b) => a.firstName.localeCompare(b.firstName)).map(x => [x.id, x.firstName + (x.note ? ' (' + x.note + ')' : '')]))}${sel('fl-horizon', 'Impact', 'horizon', [['short', 'Short-term impact'], ['long', 'Long-term impact']])}</div>
    <div className="row">${sel('fl-cat', 'Impact category', 'category', CATEGORIES.map(c => [c.id, c.label]))}${sel('fl-theme', 'Theme', 'theme', THEMES.map(c => [c.id, c.label]))}</div>
    <div className="row">${sel('fl-aud', 'Useful for', 'audience', AUDIENCES.map(c => [c.id, c.label]))}${sel('fl-ev', 'Evidence', 'evidence', [['measurable', 'Has measurable evidence'], ['verified', 'Has verified numbers']])}</div>
    <div className="row">${sel('fl-prog', 'Program', 'program', programs.map(p => [p, p]))}${sel('fl-comm', 'School or community', 'community', communities.map(p => [p, p]))}</div>
    <div className="row">
      <${Field} label="From year"><input id="fl-from" className="input" inputMode="numeric" placeholder="e.g. 2015" value=${f.from || ''} onChange=${e => set('from', e.target.value.replace(/\D/g, '').slice(0, 4))} /><//>
      <${Field} label="To year"><input id="fl-to" className="input" inputMode="numeric" placeholder="e.g. 2026" value=${f.to || ''} onChange=${e => set('to', e.target.value.replace(/\D/g, '').slice(0, 4))} /><//>
    </div>
    <label className="check"><input id="fl-need" type="checkbox" checked=${f.need === 'yes'} onChange=${e => set('need', e.target.checked ? 'yes' : '')} /> Only stories that need follow-up or information</label>
    <div className="row-btns end"><button className="btn btn-ghost" onClick=${() => setF({})}>Clear all</button><button className="btn btn-primary" onClick=${() => { onApply(f); close(); }}>Show stories</button></div>
  </div>`;
}
function LibraryView({embedded}){
  const {caps, stories: realStories, testStories, students, storiesLoaded, settings, nav, openSheet, readOnly} = useApp();
  const [q, setQ] = useState('');
  const [f, setF] = useState(() => { try { return JSON.parse(lsGet('abg-lib-f') || '{}') || {}; } catch (e) { return {}; } });
  const [sort, setSort] = useState(() => lsGet('abg-lib-sort') || 'recorded');
  const [ai, setAi] = useState(null);
  const ctlRef = useRef(null);
  useEffect(() => { lsSet('abg-lib-f', JSON.stringify(f)); }, [f]);
  useEffect(() => { lsSet('abg-lib-sort', sort); }, [sort]);
  /* Preview Mode test stories only appear under the Test source filter */
  const stories = f.source === 'test' ? (testStories || []) : realStories;
  useEffect(() => () => { if (ctlRef.current) ctlRef.current.abort(); }, []);
  const programs = uniq((settings.programs || []).concat(stories.map(s => s.program)));
  const communities = uniq((settings.communities || []).concat(stories.map(s => s.community)));
  const list = useMemo(() => sortStories(applyFilters(stories, f, q), sort), [stories, f, q, sort]);
  const active = Object.keys(f).filter(k => f[k] && k !== 'type' && k !== 'former' && k !== 'source').length;
  const quick = [['status', 'approved', 'Approved'], ['need', 'yes', 'Needs follow-up'], ['evidence', 'measurable', 'Has measurable evidence'], ['period', 'ongoing', 'Ongoing'], ['period', 'past', 'Historical'], ['horizon', 'long', 'Long-term impact']];
  async function ask(){
    if (!asStr(q) || !caps.sample) return;
    if (ctlRef.current) ctlRef.current.abort();
    const ctl = new AbortController(); ctlRef.current = ctl;
    setAi({query: q, loading: true});
    try {
      const res = await caps.sample.json(searchPrompt(q, stories), {modelTier: 'quick', signal: ctl.signal});
      const results = asArr(res && res.results).filter(r => r && stories.some(s => s.id === r.id)).map(r => ({id: r.id, why: asStr(r.why)}));
      setAi({query: q, results});
    } catch (e) {
      if (e && e.code === 'cancelled') return;
      setAi({query: q, error: aiErrorMessage(e)});
    }
    ctlRef.current = null;
  }
  return html`<div className="view library">
    ${embedded ? null : html`<header className="page-head"><h1>Story Library</h1><p className="muted">${realStories.length} ${realStories.length === 1 ? 'story' : 'stories'} from every period of ABG's work.</p></header>`}
    <form className="search" role="search" onSubmit=${e => { e.preventDefault(); ask(); }}>
      <div className="search-box"><${Icon} name="search" size=${18} /><input id="lib-search" className="search-input" type="search" aria-label="Search stories" placeholder="Search, or ask: staff who were once ABG students" value=${q} onChange=${e => { setQ(e.target.value); if (ai) setAi(null); }} /></div>
      ${caps.sample ? html`<button type="submit" className="btn btn-ghost" disabled=${!asStr(q) || !stories.length}><${Icon} name="spark" size=${18} /> Ask Claude</button>` : null}
    </form>
    <div className="type-filter">
      <div className="seg" role="group" aria-label="Story type">${[['', 'All stories'], ['student', 'Student Impact'], ['staff', 'Staff Impact']].map(([v, l]) => html`<button type="button" key=${v || 'all'} id=${'lt-' + (v || 'all')} className="seg-btn" aria-pressed=${(f.type || '') === v} onClick=${() => setF(x => Object.assign({}, x, {type: v, former: v === 'staff' ? x.former : ''}))}>${l}<span className="seg-n tnum">${v ? stories.filter(s => storyTypeOf(s) === v).length : stories.length}</span></button>`)}</div>
      <div className="seg" role="group" aria-label="Source">${[['', 'All sources'], ['internal', 'Internal interviews'], ['community', 'Community submissions']].concat((testStories || []).length || f.source === 'test' ? [['test', 'Test (Preview Mode)']] : []).map(([v, l]) => html`<button type="button" key=${v || 'all'} id=${'ls-' + (v || 'all')} className="seg-btn" aria-pressed=${(f.source || '') === v} onClick=${() => setF(x => Object.assign({}, x, {source: v}))}>${l}<span className="seg-n tnum">${v ? stories.filter(s => (v === 'community') === isCommunity(s)).length : stories.length}</span></button>`)}</div>
      ${f.type === 'staff' ? html`<button type="button" id="lt-former" className="chip chip-path" aria-pressed=${f.former === 'yes'} onClick=${() => setF(x => Object.assign({}, x, {former: x.former === 'yes' ? '' : 'yes'}))}>Former ABG students (Student → Staff) <span className="tnum">${stories.filter(isFormerStudent).length}</span></button>` : null}
    </div>
    <div className="filter-row">
      <div className="chip-scroll">${quick.map(c => html`<button type="button" key=${c[0] + c[1]} className="chip" aria-pressed=${f[c[0]] === c[1]} onClick=${() => setF(x => Object.assign({}, x, {[c[0]]: x[c[0]] === c[1] ? '' : c[1]}))}>${c[2]}</button>`)}</div>
      <button className="btn btn-ghost btn-sm" onClick=${() => openSheet(close => html`<${FilterSheet} initial=${f} programs=${programs} communities=${communities} students=${students} onApply=${setF} close=${close} />`)}><${Icon} name="filter" size=${16} /> Filters${active ? ' (' + active + ')' : ''}</button>
      <select id="lib-sort" className="select select-sm" aria-label="Sort stories" value=${sort} onChange=${e => setSort(e.target.value)}>
        <option value="recorded">Newest recorded</option><option value="updated">Recently updated</option><option value="event_new">Event date, newest</option><option value="event_old">Event date, oldest</option>
      </select>
    </div>
    ${ai ? html`<div className="view" style=${{gap: '12px'}}>
      <div className="ai-head"><span className="small"><strong>Claude's matches</strong> for "${ai.query}"</span><button className="btn btn-quiet btn-sm" onClick=${() => { if (ctlRef.current) ctlRef.current.abort(); setAi(null); }}>Back to all stories</button></div>
      ${ai.loading ? html`<div className="grid"><div className="skeleton"></div><div className="skeleton"></div></div>`
        : ai.error ? html`<p className="error">${ai.error}</p>`
        : ai.results.length === 0 ? html`<p className="empty-note">No stories match that request.</p>`
        : html`<div className="grid">${ai.results.map(r => { const s = stories.find(x => x.id === r.id); return s ? html`<${StoryCard} key=${s.id} story=${s} why=${r.why} />` : null; })}</div>`}
    </div>`
    : !storiesLoaded ? html`<div className="grid"><div className="skeleton"></div><div className="skeleton"></div></div>`
    : stories.length === 0 ? html`<div className="empty"><h3>The library is empty</h3><p className="muted">Recorded stories land here as cards you can search and filter by program, school, theme, or audience.</p>${!readOnly ? html`<button className="btn btn-primary" onClick=${() => nav('record')}><${Icon} name="mic" size=${18} /> Record a story</button>` : null}</div>`
    : list.length === 0 ? html`<div className="empty"><h3>No stories match</h3><p className="muted">Try fewer filters or a different search.${caps.sample && asStr(q) ? ' To search by meaning instead of exact words, press Ask Claude.' : ''}</p><button className="btn btn-ghost" onClick=${() => { setF({}); setQ(''); }}>Clear search and filters</button></div>`
    : html`<p className="small muted tnum">Showing ${list.length} of ${stories.length}</p><div className="grid">${list.map(s => html`<${StoryCard} key=${s.id} story=${s} />`)}</div>`}
  </div>`;
}

/* ================= insights ================= */
function BarList({rows, onPick}){
  if (!rows.length) return html`<p className="empty-note">Nothing yet. These fill in as stories are analyzed.</p>`;
  const max = Math.max.apply(null, [1].concat(rows.map(r => r.n)));
  return html`<div className="barlist">${rows.map(r => html`<button type="button" className="barrow" key=${r.id} title=${r.label + ': ' + r.n + (r.n === 1 ? ' story' : ' stories')} disabled=${!onPick} onClick=${onPick ? () => onPick(r.id) : undefined}>
    <span className="bar-label">${r.label}</span>
    <span className="bartrack"><span className="barfill" style=${{width: (r.n / max * 100) + '%'}}></span></span>
    <span className="bar-n tnum">${r.n}</span>
  </button>`)}</div>`;
}
function MetricSheet({metric, close}){
  const {caps, stories, safeWrite, showToast} = useApp();
  const m0 = metric || {};
  const [f, setF] = useState({label: m0.label || '', value: m0.value == null ? '' : String(m0.value), unit: m0.unit || '', period: m0.period || '', source: m0.source || '', notes: m0.notes || '', storyId: m0.storyId || ''});
  const set = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
  const valid = asStr(f.label) && toNum(f.value) != null && asStr(f.source);
  async function save(){
    if (!valid) return;
    const id = metric ? metric.id : uid('mt');
    const data = {label: asStr(f.label), value: toNum(f.value), unit: asStr(f.unit), period: asStr(f.period), source: asStr(f.source), notes: asStr(f.notes), storyId: f.storyId || '', createdAt: m0.createdAt || nowISO(), updatedAt: nowISO(), enteredBy: (caps.me && caps.me.id) || null};
    const ok = await safeWrite(() => caps.db.collection('metrics').doc(id).set(data));
    if (ok) { showToast(metric ? 'Metric updated' : 'Metric added'); close(); }
  }
  async function remove(){ const ok = await safeWrite(() => caps.db.collection('metrics').doc(metric.id).delete()); if (ok) { showToast('Metric deleted'); close(); } }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title=${metric ? 'Edit verified metric' : 'Add verified metric'} close=${close} />
    <p className="small muted">Enter numbers from a record you trust, such as attendance sheets, partner reports, or volunteer logs. These are the only numbers shown as program reach.</p>
    <${Field} label="Metric"><input id="mt-label" className="input" list="dl-metrics" placeholder="e.g. Students served" value=${f.label} onChange=${e => set('label', e.target.value)} /><//>
    <datalist id="dl-metrics">${METRIC_SUGGESTIONS.map(s => html`<option key=${s} value=${s}></option>`)}</datalist>
    <div className="row">
      <${Field} label="Value"><input id="mt-value" className="input" inputMode="decimal" value=${f.value} onChange=${e => set('value', e.target.value)} /><//>
      <${Field} label="Unit"><input id="mt-unit" className="input" placeholder="students, hours, murals" value=${f.unit} onChange=${e => set('unit', e.target.value)} /><//>
    </div>
    <div className="row">
      <${Field} label="Period"><input id="mt-period" className="input" placeholder="e.g. 2025–26 school year" value=${f.period} onChange=${e => set('period', e.target.value)} /><//>
      <${Field} label="Source (required)"><input id="mt-source" className="input" placeholder="e.g. program attendance sheets" value=${f.source} onChange=${e => set('source', e.target.value)} /><//>
    </div>
    <${Field} label="Related story (optional)"><select id="mt-story" className="select" value=${f.storyId} onChange=${e => set('storyId', e.target.value)}><option value="">None</option>${stories.map(s => html`<option key=${s.id} value=${s.id}>${trunc(s.title, 60)}</option>`)}</select><//>
    <${Field} label="Notes"><textarea id="mt-notes" className="textarea" rows="2" value=${f.notes} onChange=${e => set('notes', e.target.value)}></textarea><//>
    <div className="row-btns end">${metric ? html`<button className="btn btn-quiet danger" onClick=${remove}>Delete</button>` : null}<button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" disabled=${!valid} onClick=${save}>${metric ? 'Save' : 'Add metric'}</button></div>
  </div>`;
}
function InsightsView({embedded}){
  const {stories: shownAll, metrics, nav, openSheet, readOnly, storiesLoaded} = useApp();
  const stories = useMemo(() => shownAll.filter(reportable), [shownAll]);
  const total = stories.length;
  const past = stories.filter(s => s.period === 'past').length;
  const approved = stories.filter(s => s.status === 'approved').length;
  const pickTheme = id => { lsSet('abg-lib-f', JSON.stringify({theme: id})); nav('library'); };
  const pickCat = id => { lsSet('abg-lib-f', JSON.stringify({category: id})); nav('library'); };
  const themeRows = THEMES.map(t => ({id: t.id, label: t.label, n: stories.filter(s => (s.themes || []).includes(t.id)).length})).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
  const catRows = CATEGORIES.map(c => ({id: c.id, label: c.label, n: stories.filter(s => (s.categories || []).includes(c.id)).length})).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
  const evAll = []; stories.forEach(s => (s.evidence || []).forEach(e => evAll.push(e)));
  const evCounts = EVIDENCE_STATUS.map(st => Object.assign({}, st, {n: evAll.filter(e => e.status === st.id).length}));
  const awaiting = stories.filter(s => s.status === 'draft' || s.status === 'needs_verification').length;
  const needing = stories.filter(s => needsInfo(s)).length;
  const openFU = stories.reduce((n, s) => n + openTasks(s).length, 0);
  const longStories = stories.filter(s => yearSpan(s) >= 1 || (s.themes || []).includes('alumni_return') || (s.categories || []).includes('longterm')).sort((a, b) => yearSpan(b) - yearSpan(a));
  const tiles = [
    ['Stories recorded', total], ['Added this month', stories.filter(s => (s.createdAt || '').slice(0, 7) === todayLocal().slice(0, 7)).length], ['Historical stories', past],
    ['With long-term updates', stories.filter(s => isOngoing(s) && isLongTerm(s)).length], ['Approved for communications', approved], ['Students documented', uniq(stories.map(s => s.studentId)).length],
  ];
  return html`<div className="view insights">
    ${embedded ? null : html`<header className="page-head"><h1>Impact Insights</h1><p className="muted">What the journal has documented so far. Story counts describe what's been recorded, not outcomes for every student.</p></header>`}
    <section className="view" style=${{gap: '10px'}}>
      <h2>Story documentation</h2>
      <div className="stats stats-6">${tiles.map(t => html`<div className="stat" key=${t[0]}><b>${storiesLoaded ? t[1] : '–'}</b><span>${t[0]}</span></div>`)}</div>
    </section>
    <${MilestonesSection} />
    <${ImpactByCategory} />
    <${OutcomesSection} />
    <section className="card">
      <h2>Impact themes</h2>
      <p className="small muted">Number of stories with evidence related to each theme. These are counts of stories, not the share of students who experienced an outcome. Select a theme to see its stories.</p>
      <${BarList} rows=${themeRows} onPick=${pickTheme} />
    </section>
    <section className="card">
      <h2>Impact categories</h2>
      <p className="small muted">Stories can fall in more than one category, so these don't add up to the total.</p>
      <${BarList} rows=${catRows} onPick=${pickCat} />
    </section>
    <section className="card">
      <div className="sec-head"><h2>Verified program outcomes</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${MetricSheet} close=${close} />`)}><${Icon} name="plus" size=${16} /> Add verified metric</button>` : null}</div>
      <p className="small muted">Only numbers entered from a verified source. Story mentions are never added together, because several stories can describe the same student or program.</p>
      ${metrics.length === 0 ? html`<p className="empty-note">No verified metrics yet. Add students served, schools involved, murals completed, or volunteer hours from your records.</p>`
        : metrics.slice().sort((a, b) => (a.label || '').localeCompare(b.label || '')).map(m => html`<div className="metric-row" key=${m.id}>
          <div><p className="metric-val tnum">${fmtNum(m.value)}${m.unit ? html` <span className="small muted">${m.unit}</span>` : null}</p><p><strong>${m.label}</strong>${m.period ? ' · ' + m.period : ''}</p><p className="small muted">Source: ${m.source}${m.notes ? ' · ' + m.notes : ''}</p></div>
          <div className="row-btns"><${Pill} tone="good">Verified<//>${!readOnly ? html`<button className="icon-btn" aria-label=${'Edit ' + m.label} onClick=${() => openSheet(close => html`<${MetricSheet} metric=${m} close=${close} />`)}><${Icon} name="edit" size=${18} /></button>` : null}</div>
        </div>`)}
    </section>
    <section className="card">
      <h2>Long-term student outcomes</h2>
      <div className="stats stats-4">
        <div className="stat"><b>${stories.filter(s => yearSpan(s) >= 1).length}</b><span>Stories spanning more than one year</span></div>
        <div className="stat"><b>${stories.filter(s => (s.themes || []).includes('alumni_return')).length}</b><span>Alumni engagement</span></div>
        <div className="stat"><b>${stories.filter(s => (s.themes || []).includes('continued_engagement')).length}</b><span>Continued participation</span></div>
        <div className="stat"><b>${stories.filter(s => isOngoing(s) || (s.followUps || []).some(f => f.status === 'answered' || f.status === 'done')).length}</b><span>With documented follow-up</span></div>
      </div>
      ${longStories.length ? html`<div className="view" style=${{gap: '0'}}>${longStories.slice(0, 5).map(s => html`<div className="linked" key=${s.id}><button className="btn btn-quiet btn-sm" style=${{whiteSpace: 'normal', textAlign: 'left'}} onClick=${() => nav('story', {id: s.id})}>${s.title}</button><span className="small muted tnum">${yearRange(s) || fmtEventDate(s.eventDate)}</span></div>`)}</div>` : null}
    </section>
    <section className="card">
      <h2>Evidence quality</h2>
      <p className="small muted">Where the documented impact is well supported, and where better measurement would help.</p>
      <div className="stats stats-6">
        <div className="stat"><b>${stories.filter(hasVerifiedNumeric).length}</b><span>Stories with verified numbers</span></div>
        <div className="stat"><b>${stories.filter(s => (s.evidence || []).some(e => e.kind !== 'numeric' && e.status !== 'future')).length}</b><span>Stories with reported observations</span></div>
        <div className="stat"><b>${stories.filter(s => s.status === 'needs_verification' || (s.evidence || []).some(e => ['reported', 'estimate', 'unverified'].includes(e.status) && e.kind === 'numeric')).length}</b><span>Stories requiring verification</span></div>
        <div className="stat"><b>${stories.filter(s => openTasks(s).length > 0 || openQuestions(s).length > 0).length}</b><span>Stories awaiting follow-up</span></div>
        <div className="stat"><b>${awaiting}</b><span>Stories awaiting approval</span></div>
        <div className="stat"><b>${stories.reduce((n, s) => n + (s.missingMetrics || []).length, 0)}</b><span>Missing metrics identified</span></div>
      </div>
      <p className="small muted">Evidence items across all stories:</p>
      <div className="dq">${evCounts.map(e => html`<${Pill} key=${e.id} tone=${e.tone}>${e.label}: ${e.n}<//>`)}</div>
    </section>
  </div>`;
}

/* ================= follow-ups ================= */
function FollowupsView({embedded}){
  const {stories, nav, openSheet, safeWrite, caps, readOnly} = useApp();
  const today = todayLocal();
  const tasks = allTasks(stories);
  const open = tasks.filter(x => x.t.status === 'open').sort(byDue);
  const done = tasks.filter(x => x.t.status !== 'open');
  const withQs = stories.filter(s => openQuestions(s).length > 0);
  const soon = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const setTask = (s, tid, patch) => { const fu = clone(s.followUps || []).map(f => f.id === tid ? Object.assign(f, patch) : f); safeWrite(() => caps.db.collection('stories').doc(s.id).update({followUps: fu, updatedAt: nowISO()})); };
  const dueTone = d => !d ? 'neutral' : d < today ? 'bad' : d <= soon ? 'warn' : 'neutral';
  return html`<div className="view followups">
    ${embedded ? null : html`<header className="page-head"><h1>Follow-Ups</h1><p className="muted">Stories that may develop further. These are possibilities to check on, not documented impact.</p></header>`}
    <section className="card">
      <h2>Awaiting updates</h2>
      ${open.length === 0 ? html`<p className="empty-note">No open reminders. Add one from any story page with "Check-back reminder".</p>` : open.map(x => html`<div className="task" key=${x.t.id}>
        <div><p>${x.t.question}</p><p className="small"><button className="btn btn-quiet btn-sm" style=${{marginLeft: '-8px', whiteSpace: 'normal', textAlign: 'left'}} onClick=${() => nav('story', {id: x.s.id})}>${x.s.title}</button></p>
          <${Pill} tone=${dueTone(x.t.due)}>${x.t.due ? (x.t.due < today ? 'Overdue · ' : 'By ') + fmtDay(x.t.due) : 'No date set'}<//></div>
        ${!readOnly ? html`<div className="row-btns"><button className="btn btn-ghost btn-sm" onClick=${() => nav(x.s.studentId || x.s.alias ? 'interview' : 'record', {storyId: x.s.id, prompt: x.t.question, followupId: x.t.id})}><${Icon} name="mic" size=${16} /> Record what happened</button><button className="btn btn-quiet btn-sm" onClick=${() => setTask(x.s, x.t.id, {status: 'done'})}>Mark complete</button></div>` : null}
      </div>`)}
    </section>
    <section className="card">
      <h2>Stories with open questions</h2>
      ${withQs.length === 0 ? html`<p className="empty-note">No open questions.</p>` : withQs.map(s => html`<div className="task" key=${s.id}>
        <div><p><strong>${s.title}</strong></p><p className="small muted">${openQuestions(s).length} question${openQuestions(s).length > 1 ? 's' : ''}: ${openQuestions(s)[0].question}</p></div>
        ${!readOnly ? html`<button className="btn btn-primary btn-sm" onClick=${() => openSheet(close => html`<${AnswerSheet} storyId=${s.id} close=${close} />`)}>Answer</button>` : null}
      </div>`)}
    </section>
    ${done.length > 0 ? html`<details className="sec"><summary><span>Completed<span className="count">${done.length}</span></span><${Icon} name="chev" size=${18} /></summary><div className="sec-body">
      ${done.map(x => html`<div className="task done" key=${x.t.id}><div><p>${x.t.question}</p><p className="small muted">${x.s.title}${x.t.answer ? ' · ' + x.t.answer : ''}</p></div></div>`)}
    </div></details>` : null}
  </div>`;
}

/* ================= reports ================= */
/* ---------- stakeholder report: numbers computed from the records, stories chosen by staff ---------- */
const REPORT_EDU = [{id: 'graduated', label: 'Graduated high school'}, {id: 'higher_ed', label: 'Went on to college or further education'}, {id: 'first_gen', label: 'First in their family to attend college'}, {id: 'school_engagement', label: 'Improved attendance, grades or engagement'}, {id: 'career', label: 'Career, job or internship'}, {id: 'returned', label: 'Returned to ABG to mentor, volunteer or teach'}];
function buildStakeholderReport({stories, period, external, selected, includesDemo}){
  const ix = insightIndex(stories);
  const N = ix.N, R = ix.records.length;
  const pct = (n, d) => d ? Math.round(100 * n / d) + '%' : '0%';
  const programs = uniq(stories.map(s => asStr(s.program)));
  const withOut = ix.students.filter(st => st.any).length;
  const areas = ACTIVE_OUTCOMES.map(o => { const hit = ix.students.filter(st => st.cats[o.id] && st.cats[o.id].counted); const by = {}; hit.forEach(st => { const c = st.cats[o.id].cls; by[c] = (by[c] || 0) + 1; }); return {o, n: hit.length, by}; }).sort((a, b) => b.n - a.n);
  const edu = REPORT_EDU.map(m => ({m, n: ix.students.filter(st => st.ms[m.id]).length}));
  const cls = {}; ix.records.forEach(r => { const c = evidenceClass(r.e); cls[c] = (cls[c] || 0) + 1; });
  const incomplete = ix.records.filter(r => !isComplete(r.e)).length;
  const gaps = {}; stories.forEach(s => (s.missingMetrics || []).forEach(m => { const k = asStr(m.metric); if (k) gaps[k] = (gaps[k] || 0) + 1; }));
  const topGaps = Object.entries(gaps).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top = areas.filter(a => a.n > 0).slice(0, 3);
  const out = [];
  out.push('# ABG Impact Report', '', '_Stories first recorded ' + period + '. Prepared from the ABG Impact Journal on ' + fmtDay(todayLocal()) + '._' + (includesDemo ? ' **Includes fictional demo stories, marked [DEMO]. Not for distribution.**' : ''), '');
  out.push('## Executive summary', '');
  out.push('ABG staff documented ' + N + ' student' + (N === 1 ? '' : 's') + ' in ' + stories.length + ' stor' + (stories.length === 1 ? 'y' : 'ies') + (programs.length ? ' across ' + programs.length + ' program' + (programs.length === 1 ? '' : 's') : '') + '. ' + withOut + ' of ' + N + ' students (' + pct(withOut, N) + ') have at least one documented outcome.' +
    (top.length ? ' The most frequently documented areas were ' + top.map(a => a.o.label.toLowerCase() + ' (' + a.n + ' of ' + N + ')').join(', ') + '.' : '') +
    (edu[0].n || edu[1].n ? ' ' + edu[0].n + ' documented student' + (edu[0].n === 1 ? '' : 's') + ' graduated high school and ' + edu[1].n + ' went on to college or further education.' : '') +
    ' Of ' + R + ' outcome records, ' + pct(cls.observed || 0, R) + ' were directly observed by ABG staff, ' + pct(cls.self || 0, R) + ' were self-reported, ' + pct(cls.community || 0, R) + ' were community-observed, ' + pct(cls.verified || 0, R) + ' were independently verified and ' + pct(cls.unconfirmed || 0, R) + ' are unconfirmed.', '');
  out.push('These figures describe the students ABG staff chose to document. They are not a representative sample and are not rates for all ABG students.', '');
  out.push('## Key findings', '');
  out.push('- Students documented: ' + N + ' (each counted once)');
  out.push('- Students with at least one documented outcome: ' + withOut + ' of ' + N + ' (' + pct(withOut, N) + ')');
  out.push('- Stories recorded: ' + stories.length + '; outcome records: ' + R);
  edu.filter(x => x.n > 0).forEach(x => out.push('- ' + x.m.label + ': ' + x.n + ' of ' + N + ' students'));
  out.push('');
  out.push('## Outcomes by area', '', '| Outcome area | Students | Share of students documented | Verified | Staff-observed | Self-reported | Community-observed | Unconfirmed |', '|---|---|---|---|---|---|---|---|');
  areas.forEach(a => out.push('| ' + [a.o.label, a.n, pct(a.n, N), a.by.verified || 0, a.by.observed || 0, a.by.self || 0, a.by.community || 0, a.by.unconfirmed || 0].join(' | ') + ' |'));
  out.push('', '_A student counts once per area, using the strongest evidence on file. No-change, declines and planned outcomes are not counted._', '');
  const sx = staffImpactStats(stories);
  if (sx.N) {
    const sm = sx.summary, M = sx.N;
    out.push('## Staff and employment impact', '', '_ABG staff documented ' + M + ' staff member' + (M === 1 ? '' : 's') + ' in Staff Impact stories. These are counts of the people documented, not all ABG employees or every job ABG has created; details that were not documented are not counted._', '');
    out.push('- Staff members documented: ' + M + ' (each counted once)');
    out.push('- Paid opportunities documented: ' + sm.paidOpportunitiesDocumented + ' of ' + M + (sm.positionsDocumented ? ' (' + sm.positionsDocumented.total + ' positions held, where known for ' + sm.positionsDocumented.staffWithAKnownCount + ')' : ''));
    if (sm.employmentDurationYears) out.push('- Years working with ABG: average ' + sm.employmentDurationYears.average + ' (' + sm.employmentDurationYears.staffWithAKnownDuration + ' of ' + M + ' with a known duration)');
    [['firstPaidJobAtAbg', 'ABG was their first paid job'], ['currentlyWithAbg', 'Currently working with ABG'], ['promotedOrExpandedResponsibilities', 'Promoted or given expanded responsibilities'], ['skillDevelopment', 'Professional or artistic skill development'], ['trainingOrMentorship', 'Training or mentorship received'], ['leadership', 'Leadership responsibilities'], ['furtherEducation', 'Further education or certifications'], ['laterOrAdditionalEmployment', 'Went on to other or additional employment'], ['mentorsOrTeachesStudents', 'Mentor or teach ABG students']]
      .forEach(([k, l]) => { if (sm[k]) out.push('- ' + l + ': ' + sm[k] + ' of ' + M); });
    out.push('');
    if (sm.formerAbgStudentsWhoBecameStaff) out.push('**Student-to-staff pathway:** ' + sm.formerAbgStudentsWhoBecameStaff + ' of ' + M + ' staff members documented first came to ABG as students. ' + sm.formerStudentsWithPaidOpportunity + ' have a paid opportunity documented, ' + sm.formerStudentsMentoringOrTeaching + ' mentor or teach ABG students, and ' + sm.formerStudentsWithLaterProfessionalOutcomes + ' have later professional outcomes documented (advancement, leadership, further education or work in the field). Not every person completes every stage.', '');
  }
  const chosen = stories.filter(s => selected.includes(s.id));
  if (chosen.length) {
    out.push(chosen.some(isStaffStory) ? '## Student and staff stories' : '## Student stories', '', '_Selected by ABG staff to illustrate the findings above, not as typical results._', '');
    chosen.forEach(s => {
      const who = isStaffStory(s) ? 'A staff member' : 'A student';
      const nm = external ? (externalName(s) || who) : (s.alias || who);
      const sw = t => external ? scrubName(t, s.alias, nm) : String(t || '');
      out.push('### ' + sw(s.title), '', '_' + [nm, isStaffStory(s) ? 'Staff Impact' + (isFormerStudent(s) ? ', former ABG student' : '') : '', s.program, external && needsRedaction(s) ? '' : s.community].filter(Boolean).join(' · ') + '_', '', sw(s.story || s.summary), '');
      const ev = (external ? externalEvidence(s) : (s.evidence || [])).filter(e => e.status !== 'future');
      if (ev.length) { out.push('**Documented outcomes**'); ev.forEach(e => out.push('- ' + sw(e.statement) + (hasComparison(e) ? ' (' + sw(e.before) + ' → ' + sw(e.after) + ')' : '') + ' [' + classLabel(e) + ']')); out.push(''); }
    });
  }
  out.push('## Evidence sources and verification', '', '| Evidence type | Outcome records | Share |', '|---|---|---|');
  EVIDENCE_CLASSES.forEach(c => out.push('| ' + c.label + ' | ' + (cls[c.id] || 0) + ' | ' + pct(cls[c.id] || 0, R) + ' |'));
  out.push('', '"Verified" means ABG staff checked a document. A confident account from staff is never treated as verified on its own.', '');
  out.push('## Limitations and missing data', '');
  out.push('- These are the students ABG staff chose to record, so they are not a representative sample of all ABG participants. Results should not be read as program-wide rates.');
  out.push('- The reporting period is based on when stories were first recorded; some outcomes happened earlier.');
  out.push('- ' + incomplete + ' of ' + R + ' outcome records lack an initial condition, a current condition or a known source.');
  out.push('- ' + pct((cls.self || 0) + (cls.community || 0) + (cls.unconfirmed || 0), R) + ' of outcome records are self-reported, community-observed or unconfirmed; ' + pct(cls.verified || 0, R) + ' are independently verified.');
  if (topGaps.length) out.push('- Most common data gaps: ' + topGaps.map(g => g[0] + ' (' + g[1] + ')').join('; ') + '.');
  if (external) out.push('- Student names appear only where publication permission is documented; sensitive experiences are left out unless consent is documented.');
  out.push('- ABG\'s contribution is described as staff observed or students reported it. These records do not establish that ABG caused an outcome.');
  return out.join('\n');
}
function StakeholderReport({stories, includesDemo}){
  const {caps, showToast} = useApp();
  const [range, setRange] = useState('12m');
  const [external, setExternal] = useState(true);
  const days = (byId(RANGES, range) || {}).days || 0;
  const since = days ? new Date(Date.now() - days * 864e5).toISOString() : '';
  const period = since ? 'from ' + fmtDate(since) + ' to ' + fmtDate(nowISO()) : 'at any time';
  const inRange = stories.filter(s => !since || (s.createdAt || '') >= since);
  const eligible = inRange.filter(s => (isStudentStory(s) || isStaffStory(s)) && (!external || s.status === 'approved'));
  const [picked, setPicked] = useState(null);
  const selected = picked || eligible.slice().sort((a, b) => outcomeCount(b) - outcomeCount(a)).slice(0, 3).map(s => s.id);
  const toggle = id => setPicked((picked || selected).includes(id) ? (picked || selected).filter(x => x !== id) : (picked || selected).concat([id]));
  const md = useMemo(() => buildStakeholderReport({stories: inRange, period, external, selected: selected.filter(id => eligible.some(s => s.id === id)), includesDemo}), [stories, period, external, selected.join(), includesDemo]);
  return html`<section className="card stake">
    <h2>Stakeholder report</h2>
    <p className="small muted">Combines an executive summary, key findings, outcomes by area, staff and employment impact, selected stories, evidence types and limitations. Every number is counted from the journal; you choose the stories.</p>
    <div className="row">
      <${Field} label="Reporting period"><select id="sr-range" className="select" value=${range} onChange=${e => setRange(e.target.value)}>${RANGES.map(r => html`<option key=${r.id} value=${r.id}>${r.label}</option>`)}</select><//>
      <${Field} label="Use"><select id="sr-use" className="select" value=${external ? 'ext' : 'int'} onChange=${e => { setExternal(e.target.value === 'ext'); setPicked(null); }}><option value="ext">External (donors, grants, schools): approved stories only</option><option value="int">Internal (ABG staff): any story</option></select><//>
    </div>
    <div className="field"><span className="field-label">Student and staff stories to include</span>
      ${eligible.length === 0 ? html`<p className="small muted">${external ? 'No approved student stories in this period. Approve stories in their Privacy and approval section, or switch to internal use.' : 'No student stories in this period.'}</p>` : html`<div className="pick-chips">${eligible.map(s => html`<label key=${s.id} className=${'chip' + (selected.includes(s.id) ? ' on' : '')}><input type="checkbox" className="sr-only" checked=${selected.includes(s.id)} onChange=${() => toggle(s.id)} />${(external ? externalName(s) || (isStaffStory(s) ? 'A staff member' : 'A student') : s.alias) + (isStaffStory(s) ? ' (staff)' : '') + ': ' + trunc(s.title, 40)}</label>`)}</div>`}
    </div>
    <textarea id="sr-text" className="textarea report-ta" rows="16" aria-label="Stakeholder report" readOnly=${true} value=${md}></textarea>
    <div className="row-btns end"><${CopyButton} text=${md} /><button className="btn btn-ghost btn-sm" disabled=${!caps.downloads} onClick=${() => saveFile(caps, showToast, 'abg-stakeholder-report' + (includesDemo ? '-DEMO' : '') + '.md', md)}><${Icon} name="download" size=${16} /> Download .md</button></div>
  </section>`;
}

function ReportsView({embedded}){
  const {caps, stories: shown, students: shownStudents, metrics, showToast, settings, safeWrite, readOnly, role} = useApp();
  const rset = forReporting(shown, shownStudents, settings);
  const stories = rset.stories, students = rset.students;
  const setDemoInExports = v => safeWrite(() => caps.db.doc('config/settings').set(Object.assign({}, settings, {demo: Object.assign({}, settings.demo || {}, {inExports: v}), updatedAt: nowISO()})));
  const approved = stories.filter(s => s.status === 'approved');
  const [report, setReport] = useState(() => lsGet('abg-report') || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [aud, setAud] = useState('');
  const [busyExport, setBusyExport] = useState('');
  const ctlRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => lsSet('abg-report', report), 400); return () => clearTimeout(t); }, [report]);
  useEffect(() => () => { if (ctlRef.current) ctlRef.current.abort(); }, []);
  async function generate(){
    setErr(''); setBusy(true); setReport('');
    const ctl = new AbortController(); ctlRef.current = ctl;
    try { const r = await caps.sample(reportPrompt(stories, metrics), {cache: false, signal: ctl.signal, onText: u => setReport(u.text)}); setReport(r.text); }
    catch (e) { setReport(e && e.code !== 'refused' && e.text ? e.text : ''); if (!(e && e.code === 'cancelled')) setErr(aiErrorMessage(e)); }
    ctlRef.current = null; setBusy(false);
  }
  const dl = (name, data) => saveFile(caps, showToast, name, data);
  async function transcripts(){
    setBusyExport('tr');
    try {
      const snap = await caps.db.collection('entries').get();
      const all = snap.docs.map(d => Object.assign({id: d.id}, d.data()));
      const out = ['ABG Impact Journal: full transcripts', 'INTERNAL ONLY. Contains unedited accounts about students. Exported ' + fmtDay(todayLocal()) + '.', ''];
      sortStories(stories, 'event_old').forEach(s => {
        const es = all.filter(e => e.storyId === s.id).sort((a, b) => (a.recordedAt || '').localeCompare(b.recordedAt || ''));
        out.push('==== ' + s.title + ' (' + labelOf(STATUSES, s.status) + ') ====', '');
        es.forEach((e, i) => { out.push('-- Entry ' + (i + 1) + ', recorded ' + fmtDate(e.recordedAt) + ' --', e.transcript || ''); if (e.transcriptEdited) out.push('', '[Corrected version]', e.transcriptEdited); out.push(''); });
      });
      await dl('abg-transcripts-internal.txt', out.join('\n'));
    } catch (e) { showToast(dbErrorMessage(e)); }
    setBusyExport('');
  }
  const row = (title, desc, btn) => html`<div className="export-row" key=${title}><div><p><strong>${title}</strong></p><p className="small muted">${desc}</p></div><div className="row-btns">${btn}</div></div>`;
  const dlBtn = (fn, label) => html`<button className="btn btn-ghost btn-sm" disabled=${!caps.downloads} onClick=${fn}><${Icon} name="download" size=${16} /> ${label || 'Download'}</button>`;
  return html`<div className="view reports">
    ${embedded ? null : html`<header className="page-head"><h1>Impact Reports</h1><p className="muted">Turn approved stories and verified evidence into fundraising materials, grant applications, partnership packets, newsletters, and annual impact summaries.</p></header>`}
    ${rset.demoN > 0 ? html`<div className=${'notice small demo-note' + (rset.included ? ' warn' : '')}>
      ${rset.included ? html`<p><strong>Fictional demo stories are included</strong> in this report and these exports, marked "[DEMO, fictional]". Don't share these files outside ABG.</p>` : html`<p><strong>${rset.demoN} fictional demo stor${rset.demoN === 1 ? 'y is' : 'ies are'} left out</strong> of reports and exports. Include them to try the report and exports with sample data.</p>`}
      ${readOnly ? null : html`<button className="btn btn-ghost btn-sm" onClick=${() => setDemoInExports(!rset.included)}>${rset.included ? 'Leave demo stories out' : 'Include demo stories'}</button>`}
    </div>` : null}
    <${StakeholderReport} stories=${stories} includesDemo=${rset.included && rset.demoN > 0} />
    <section className="card">
      <h2>Draft a narrative report with Claude</h2>
      <p className="small muted">Uses only stories approved for external use (${approved.length} now) and verified program metrics (${metrics.length}). Theme counts and data gaps cover all stories. The draft keeps storytelling separate from verified numbers and cites each story.</p>
      ${approved.length === 0 ? html`<p className="notice small">No stories are approved for external use yet. Approve stories in the Privacy and approval section of each story first.</p>` : null}
      ${!caps.sample ? html`<p className="notice small">Claude isn't available in this view, so reports can't be generated here.</p>` : null}
      <div className="row-btns">
        <button className="btn btn-primary" disabled=${!caps.sample || approved.length === 0 || busy} onClick=${generate}><${Icon} name="spark" size=${18} /> ${busy ? 'Writing…' : report ? 'Write a new draft' : 'Generate report'}</button>
        ${busy ? html`<button className="btn btn-ghost" onClick=${() => ctlRef.current && ctlRef.current.abort()}>Stop</button>` : null}
      </div>
      ${err ? html`<p className="error">${err}</p>` : null}
      ${report || busy ? html`<textarea id="report-text" className="textarea report-ta" rows="18" aria-label="Impact report draft" readOnly=${busy} value=${report || 'Thinking…'} onChange=${e => setReport(e.target.value)}></textarea>` : null}
      ${report && !busy ? html`<div className="row-btns end"><${CopyButton} text=${report} />${dlBtn(() => dl('abg-impact-report.md', report), 'Download .md')}</div>` : null}
    </section>
    <section className="card">
      <h2>Exports</h2>
      ${!caps.downloads ? html`<p className="notice small">Downloads aren't available in this view. Open the journal in Claude to export files.</p>` : null}
      <div>
        ${row('Approved stories', 'Summaries, takeaways, evidence with status, approved quotes, and approved audience drafts. Markdown pastes cleanly into Google Docs and Word.', html`<select id="exp-aud" className="select select-sm" aria-label="Audience" value=${aud} onChange=${e => setAud(e.target.value)}><option value="">All audiences</option>${AUDIENCES.map(a => html`<option key=${a.id} value=${a.id}>${a.short}</option>`)}</select><${CopyButton} text=${approvedMarkdown(stories, aud)} />${dlBtn(() => dl('abg-approved-stories' + (aud ? '-' + aud : '') + '.md', approvedMarkdown(stories, aud)))}`)}
        ${row('Student outcomes for the consulting team (CSV, names removed)', 'One row per student: the metrics card with how certain each value is, themes, audiences, evidence counts, approval status, and summaries. First names are replaced with codes (Student 01, Student 02…). Program and school names stay in, so read the summaries for other identifying details before sharing.', dlBtn(() => dl('abg-student-outcomes-team.csv', teamCSV(stories, students))))}
        ${row('Stories (CSV)', 'Every story with its type (Student Impact, Staff Impact or general), status, dates, program, themes, audiences, and privacy fields. Internal.', dlBtn(() => dl('abg-stories.csv', storiesCSV(stories))))}
        ${row('Staff and employment outcomes (CSV)', 'One row per documented staff member, never double-counted across stories: the staff card with how sure each value is, the student-to-staff background, and whether a Student Impact story is linked. Blank values read "Not documented". Internal: contains first names.', dlBtn(() => dl('abg-staff-outcomes.csv', staffCSV(stories))))}
        ${row('Structured impact records (JSON)', 'One record per story with every outcome field: category, initial and current condition, supporting observation, evidence source and type, values, timeframe, ABG activity and contribution, and open questions. Unknown fields are null.', dlBtn(() => dl('abg-impact-records.json', JSON.stringify(impactRecords(stories), null, 2))))}
        ${row('Measurable outcomes, evidence and data gaps (CSV)', 'Each measurable outcome and observation with before and after values, who observed it, its verification status, and the transcript passage, plus data gaps.', dlBtn(() => dl('abg-evidence.csv', evidenceCSV(stories))))}
        ${row('Verified program metrics (CSV)', 'Numbers entered from verified sources, with their sources.', dlBtn(() => dl('abg-verified-metrics.csv', metricsCSV(metrics, stories))))}
        ${row('Approved quotes (CSV)', 'Quotes marked approved, from approved stories only.', dlBtn(() => dl('abg-approved-quotes.csv', quotesCSV(stories))))}
        ${row('Student impact timelines (CSV)', 'Every milestone by stage, from initial circumstances to long-term outcomes, with pending items marked.', dlBtn(() => dl('abg-timelines.csv', timelineCSV(stories))))}
        ${row('Follow-ups (CSV)', 'Questions and check-back reminders with their status and answers.', dlBtn(() => dl('abg-followups.csv', followupsCSV(stories))))}
        ${row('Full interview transcripts (internal only)', 'Every original transcript, with corrections. Keep this file inside ABG.', html`<button className="btn btn-ghost btn-sm" disabled=${!caps.downloads || busyExport === 'tr'} onClick=${transcripts}><${Icon} name="download" size=${16} /> ${busyExport === 'tr' ? 'Preparing…' : 'Download'}</button>`)}
      </div>
    </section>
  </div>`;
}

/* ================= settings ================= */
function ListEditor({title, hint, items, onChange, placeholder, disabled, id}){
  const [v, setV] = useState('');
  const add = () => { const t = asStr(v); if (!t) return; if (!items.includes(t)) onChange(items.concat([t])); setV(''); };
  return html`<section className="card">
    <h2>${title}</h2>
    ${hint ? html`<p className="small muted">${hint}</p>` : null}
    <div className="chips">${items.length ? items.map(it => html`<span className="chip static removable" key=${it}>${it}${!disabled ? html`<button type="button" aria-label=${'Remove ' + it} onClick=${() => onChange(items.filter(x => x !== it))}><${Icon} name="close" size=${14} /></button>` : null}</span>`) : html`<span className="small muted">None yet.</span>`}</div>
    ${!disabled ? html`<form className="add-row" onSubmit=${e => { e.preventDefault(); add(); }}><input id=${id} className="input" aria-label=${'Add to ' + title} placeholder=${placeholder} value=${v} onChange=${e => setV(e.target.value)} /><button className="btn btn-ghost" type="submit">Add</button></form>` : null}
  </section>`;
}
/* ---------- fictional demo stories (src/demoData.js) ----------
   Built through the same steps as a real interview: transcript entries, the analysis structure,
   normalizeAnalysis, newStoryFromAnalysis and finalizeStory. Every record carries demo: true and a
   fixed id, so loading twice never duplicates and removal is exact. */
const DEMO_ID = {story: k => 'demo-story-' + k, student: k => 'demo-student-' + k, staff: k => 'demo-staff-' + k, entry: (k, i) => 'demo-entry-' + k + '-' + (i + 1)};
const DEMO_STAFF_N = DEMO_STORIES.filter(d => d.kind === 'staff').length;
const DEMO_SUMMARY = (DEMO_STORIES.length - DEMO_STAFF_N) + ' fictional students' + (DEMO_STAFF_N ? ' and ' + DEMO_STAFF_N + ' fictional staff members' : '');
function buildDemoRecords(me){
  const out = {students: [], staff: [], entries: [], stories: []};
  DEMO_STORIES.forEach(d => {
    const name = d.firstName, sid = DEMO_ID.story(d.key);
    const isStaff = d.kind === 'staff';
    const entries = d.entries.map((en, i) => {
      const turns = en.turns.map(([q, a], j) => ({
        q: q === 'OPENING' ? (isStaff ? STAFF_OPENING_Q(name) : OPENING_Q(name)) : q === 'UPDATE' ? (isStaff ? STAFF_UPDATE_OPENING_Q(name) : UPDATE_OPENING_Q(name)) : q === 'CLOSING' ? (isStaff ? STAFF_CLOSING_Q(name) : CLOSING_Q(name)) : q,
        kind: q === 'OPENING' || q === 'UPDATE' ? 'opening' : q === 'CLOSING' ? 'closing' : 'followup', category: '',
        a, status: 'answered', at: new Date(Date.parse(en.recordedAt) + j * 150000).toISOString(), audio: []}));
      return {id: DEMO_ID.entry(d.key, i), storyId: sid, recordedAt: en.recordedAt, eventDateText: '', eventApprox: false, prompt: turns[0].q,
        transcript: turnsToText(turns), turns, audio: [], transcriptEdited: null, summary: i === 0 ? (d.analysis.entrySummary || '') : 'Update interview', takeaways: [],
        source: i === 0 ? 'interview' : 'interview-update', analyzed: true, createdBy: (me && me.id) || null, demo: true};
    });
    const a = normalizeAnalysis(d.analysis, {items: entries.map(e => ({id: e.id, text: e.transcript})), storyIds: new Set(), kind: isStaff ? 'staff' : 'student'});
    const draft = isStaff ? newStoryFromAnalysis(a, {me, kind: 'staff', staffId: DEMO_ID.staff(d.key), studentName: name, staffInfo: d.staffInfo})
      : newStoryFromAnalysis(a, {me, studentId: DEMO_ID.student(d.key), studentName: name, studentInfo: {gender: d.gender, school: d.school, demographics: d.demographics}});
    const st = finalizeStory(draft, me).story;
    const fu = (d.tasks || []).map((t, i) => ({id: 'demo-fu-' + d.key + '-t' + i, kind: 'task', question: t.q, due: t.due || '', status: t.status || 'open', answer: t.answer || '', entryId: null, suggested: true}))
      .concat((d.questions || []).map((q, i) => ({id: 'demo-fu-' + d.key + '-q' + i, kind: 'question', question: q.q, due: '', status: q.status || 'open', answer: q.answer || '', entryId: q.status === 'answered' ? entries[entries.length - 1].id : null})));
    Object.assign(st, {id: sid, demo: true, status: d.status, privacy: Object.assign({}, st.privacy, d.privacy), createdAt: d.createdAt, updatedAt: d.updatedAt, createdBy: (me && me.id) || null,
      entryCount: entries.length, followUps: fu, analysis: {state: 'done', at: d.updatedAt},
      quotes: st.quotes.map(q => Object.assign({}, q, {approved: d.status === 'approved'})),
      drafts: (d.drafts || []).map((x, i) => ({id: 'demo-draft-' + d.key + '-' + i, audience: x.audience || '', format: x.format, text: x.text, createdAt: d.updatedAt, approved: !!x.approved})),
      links: (d.links || []).map(l => ({storyId: DEMO_ID.story(l.key), type: l.type, reason: l.reason, confirmed: true}))});
    out.stories.push(st);
    out.entries = out.entries.concat(entries);
    if (isStaff) out.staff.push({id: DEMO_ID.staff(d.key), firstName: name, nameKey: norm(name), note: '', createdAt: d.createdAt, createdBy: (me && me.id) || null, demo: true});
    else out.students.push({id: DEMO_ID.student(d.key), firstName: name, nameKey: norm(name), gender: d.gender || '', school: d.school || '', demographics: d.demographics || '', note: '', createdAt: d.createdAt, createdBy: (me && me.id) || null, demo: true});
  });
  /* links go both ways */
  out.stories.forEach(st => st.links.forEach(l => { const o = out.stories.find(x => x.id === l.storyId); if (o && !o.links.some(x => x.storyId === st.id)) o.links.push({storyId: st.id, type: l.type, reason: l.reason, confirmed: true}); }));
  return out;
}
async function loadDemoData(db, me){
  const r = buildDemoRecords(me);
  const put = async (col, rec) => { const x = Object.assign({}, rec); delete x.id; await db.collection(col).doc(rec.id).set(x); };
  for (const x of r.students) await put('students', x);
  for (const x of r.staff) await put('staff', x);
  for (const x of r.entries) await put('entries', x);
  for (const x of r.stories) await put('stories', x);
  return r;
}
async function removeDemoData(db, allStories, allStudents, allStaff){
  const storyIds = uniq(DEMO_STORIES.map(d => DEMO_ID.story(d.key)).concat(allStories.filter(x => x.demo).map(x => x.id)));
  for (const sid of storyIds) {
    const snap = await db.collection('entries').where('storyId', '==', sid).get();
    for (const d of snap.docs) await db.collection('entries').doc(d.id).delete();
    if (allStories.some(x => x.id === sid) || DEMO_STORIES.some(d => DEMO_ID.story(d.key) === sid)) await db.collection('stories').doc(sid).delete();
  }
  for (const id of uniq(DEMO_STORIES.filter(d => d.kind !== 'staff').map(d => DEMO_ID.student(d.key)).concat(allStudents.filter(x => x.demo).map(x => x.id)))) await db.collection('students').doc(id).delete();
  for (const id of uniq(DEMO_STORIES.filter(d => d.kind === 'staff').map(d => DEMO_ID.staff(d.key)).concat((allStaff || []).filter(x => x.demo).map(x => x.id)))) await db.collection('staff').doc(id).delete();
  /* a real story never keeps a link to a removed demo story */
  for (const o of allStories.filter(x => !x.demo && (x.links || []).some(l => storyIds.includes(l.storyId)))) await db.collection('stories').doc(o.id).update({links: (o.links || []).filter(l => !storyIds.includes(l.storyId))});
}
/* demo records stay out of reports and exports unless included; when included they are clearly marked */
function forReporting(all, students, settings){
  const stories = all.filter(reportable);
  const inc = !!((settings && settings.demo) || {}).inExports;
  if (!inc) return {stories: stories.filter(x => !x.demo), students: (students || []).filter(x => !x.demo), demoN: stories.filter(x => x.demo).length, included: false};
  const mark = x => x.demo ? Object.assign({}, x, {title: '[DEMO, fictional] ' + (x.title || ''), summary: '[Fictional demo story] ' + (x.summary || '')}) : x;
  return {stories: stories.map(mark), students: students || [], demoN: stories.filter(x => x.demo).length, included: true};
}
function TestPill(){ return html`<span className="pill tone-test" title="Test story from Preview Mode: never counted">Test</span>`; }
function DemoPill(){ return html`<span className="pill tone-demo" title="Fictional demo story">Demo</span>`; }

/* ---------- roles ----------
   Two roles, stored on the server (public.user_roles) and changed only through the admin Edge Function:
   Admin: manage users and application settings, plus everything a standard user can do.
   Standard user: record, review, edit and export stories, and see Impact Insights. */
const ROLE_OPTS = [{id: 'admin', label: 'Admin'}, {id: 'user', label: 'Standard user'}];

/* ---------- Manage Users (administrators only; every action is checked again on the server) ---------- */
const USER_STATUS = {active: {label: 'Active', tone: 'good'}, invited: {label: 'Invitation sent', tone: 'blue'}, deactivated: {label: 'Deactivated', tone: 'bad'}, not_invited: {label: 'Not invited yet', tone: 'neutral'}};
const AUDIT_LABEL = {invited: 'invited', invite_resent: 'resent an invitation to', role_changed: 'changed the role of', deactivated: 'deactivated', reactivated: 'reactivated', removed: 'removed', admin_granted: 'made an administrator:'};
function ManageUsers(){
  const {caps, showToast, openSheet} = useApp();
  const me = caps.me || {};
  const myEmail = asStr((window.__platform && window.__platform.email) || me.email).toLowerCase();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [names, setNames] = useState({});
  const api = (action, payload) => window.__platform.admin(action, payload);
  const load = async () => { try { setData(await api('list')); setErr(''); } catch (e) { setErr((e && e.message) || "The user list couldn't load."); } };
  useEffect(() => { load(); }, []);
  useEffect(() => { const un = caps.db.collection('members').onSnapshot(snap => { const m = {}; snap.docs.forEach(d => { const x = d.data() || {}; if (x.email) m[String(x.email).toLowerCase()] = x.name || ''; }); setNames(m); }, () => {}); return () => { try { un(); } catch (e) {} }; }, []);
  async function act(key, action, payload, done){
    setBusy(key);
    try { await api(action, payload); if (done) showToast(done); await load(); return true; }
    catch (e) { showToast((e && e.message) || "That didn't work. Try again."); return false; }
    finally { setBusy(''); }
  }
  async function invite(e){
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { showToast('Enter a valid email address.'); return; }
    if (await act('invite', 'invite', {email: em, role: newRole}, 'Invitation sent to ' + em)) { setEmail(''); setNewRole('user'); }
  }
  const confirmThen = (title, body, label, fn) => openSheet(close => html`<${ConfirmSheet} close=${close} title=${title} body=${body} confirmLabel=${label} onConfirm=${fn} />`);
  const users = data ? (Array.isArray(data.users) ? data.users : []).slice().sort((a, b) => (a.email === myEmail ? -1 : b.email === myEmail ? 1 : 0) || ((a.role === 'admin') === (b.role === 'admin') ? a.email.localeCompare(b.email) : a.role === 'admin' ? -1 : 1)) : [];
  const counts = {admins: users.filter(u => u.role === 'admin').length, active: users.filter(u => u.status === 'active').length, pending: users.filter(u => u.status === 'invited' || u.status === 'not_invited').length};
  return html`<div className="manage-users">
    <form className="invite-form" onSubmit=${invite}>
      <${Field} label="Invite someone by email"><input id="mu-email" className="input" type="email" inputMode="email" autoComplete="off" placeholder="name@example.org" value=${email} onChange=${e => setEmail(e.target.value)} /><//>
      <${Field} label="Role"><select id="mu-role" className="select" value=${newRole} onChange=${e => setNewRole(e.target.value)}>${ROLE_OPTS.map(r => html`<option key=${r.id} value=${r.id}>${r.label}</option>`)}</select><//>
      <button className="btn btn-primary" type="submit" disabled=${busy === 'invite' || !email.trim()}>${busy === 'invite' ? 'Sending…' : 'Send invitation'}</button>
    </form>
    <p className="small muted">They get an email with a secure link. After accepting once, they stay signed in on that device.</p>
    ${err ? html`<div className="notice small"><p>${err}</p><button className="btn btn-ghost btn-sm" onClick=${load}>Try again</button></div>` : null}
    ${data == null && !err ? html`<p className="small muted">Loading users…</p>` : null}
    ${data ? html`<p className="small muted mu-counts">${users.length} people · ${counts.admins} admin${counts.admins === 1 ? '' : 's'} · ${counts.active} active · ${counts.pending} invitation${counts.pending === 1 ? '' : 's'} pending</p>
      <div className="item-list">${users.map(u => { const self = u.email === myEmail; const st = USER_STATUS[u.status] || USER_STATUS.active; const k = k2 => k2 + ':' + u.email; return html`<div className="user-row" key=${u.email}>
        <div className="user-main">
          <strong>${names[u.email] || u.email}${self ? html` <span className="pill tone-teal">You</span>` : null}</strong>
          <small className="muted">${names[u.email] ? u.email + ' · ' : ''}${u.status === 'active' ? (u.lastSignIn ? 'Last signed in ' + fmtDate(u.lastSignIn) : 'Active') : u.status === 'invited' ? 'Invited ' + (u.invitedAt ? fmtDate(u.invitedAt) : '') + ', not accepted yet' : u.status === 'not_invited' ? 'Has a role but no invitation yet' : 'Can\'t sign in'}</small>
        </div>
        <span className=${'pill tone-' + st.tone}>${st.label}</span>
        <div className="user-controls">
        ${self ? html`<span className="pill tone-blue">${labelOf(ROLE_OPTS, u.role)}</span>` : html`<select className="select select-sm" aria-label=${'Role for ' + u.email} value=${u.role} disabled=${!!busy} onChange=${e => { const v = e.target.value; act(k('role'), 'set_role', {email: u.email, role: v}, u.email + ' is now ' + labelOf(ROLE_OPTS, v).toLowerCase()); }}>${ROLE_OPTS.map(r => html`<option key=${r.id} value=${r.id}>${r.label}</option>`)}</select>`}
        ${self ? null : html`<div className="user-actions">
          ${u.status === 'invited' ? html`<button className="btn btn-ghost btn-xs" disabled=${!!busy} onClick=${() => act(k('resend'), 'resend', {email: u.email}, 'Invitation resent to ' + u.email)}>${busy === k('resend') ? 'Sending…' : 'Resend invite'}</button>` : null}
          ${u.status === 'not_invited' ? html`<button className="btn btn-ghost btn-xs" disabled=${!!busy} onClick=${() => act(k('invite'), 'invite', {email: u.email, role: u.role}, 'Invitation sent to ' + u.email)}>Send invite</button>` : null}
          ${u.status === 'active' || u.status === 'invited' ? html`<button className="btn btn-ghost btn-xs" disabled=${!!busy} onClick=${() => confirmThen('Deactivate ' + u.email + '?', 'They will be signed out and unable to open the journal until an administrator reactivates them. Their stories stay in the journal.', 'Deactivate', () => act(k('deact'), 'deactivate', {email: u.email}, u.email + ' deactivated'))}>Deactivate</button>` : null}
          ${u.status === 'deactivated' ? html`<button className="btn btn-ghost btn-xs" disabled=${!!busy} onClick=${() => act(k('react'), 'reactivate', {email: u.email}, u.email + ' reactivated')}>Reactivate</button>` : null}
          <button className="icon-btn icon-btn-box" aria-label=${'Remove ' + u.email} disabled=${!!busy} onClick=${() => confirmThen('Remove ' + u.email + '?', 'This removes their account and access. Stories they recorded stay in the journal. You can invite them again later.', 'Remove access', () => act(k('remove'), 'remove', {email: u.email}, u.email + ' removed'))}><${Icon} name="trash" size=${17} /></button>
        </div>`}
        </div>
      </div>`; })}</div>
      <details className="sec mu-audit"><summary><span>Recent activity<span className="count">${(data.audit || []).length}</span></span><${Icon} name="chev" size=${18} /></summary><div className="sec-body">
        ${(data.audit || []).length === 0 ? html`<p className="small muted">No changes recorded yet.</p>` : html`<ul className="audit-list small">${data.audit.map((a, i) => html`<li key=${i}><span className="muted tnum">${fmtDate(a.at)}</span> <span><strong>${a.actor_email === 'setup' ? 'Initial setup' : (names[a.actor_email] || a.actor_email)}</strong> ${AUDIT_LABEL[a.action] || a.action} <strong>${a.target_email || ''}</strong>${a.action === 'role_changed' && a.details ? ' (' + labelOf(ROLE_OPTS, a.details.from) + ' → ' + labelOf(ROLE_OPTS, a.details.to) + ')' : a.action === 'invited' && a.details && a.details.role ? ' as ' + labelOf(ROLE_OPTS, a.details.role).toLowerCase() : ''}</span></li>`)}</ul>`}
      </div></details>` : null}
  </div>`;
}

/* log out asks first, so a stray tap doesn't sign someone out */
function confirmLogout(openSheet){
  openSheet(close => html`<${ConfirmSheet} close=${close} title="Log out of this device?" body="You'll need a sign-in code from your email to get back in on this device. Only log out on a shared or borrowed device. Your other devices stay signed in." confirmLabel="Log out" onConfirm=${async () => { await window.__platform.signOut(); }} />`);
}
/* ---------- Settings ---------- */
const SETTINGS_SECTIONS = [
  {id: 'profile', label: 'Profile', icon: 'user'},
  {id: 'portal', label: 'Portal Access', icon: 'swap', portal: true},
  {id: 'programs', label: 'Programs', icon: 'book'},
  {id: 'outcomes', label: 'Outcome Categories', icon: 'list'},
  {id: 'voice', label: 'Interview Voice', icon: 'volume'},
  {id: 'privacy', label: 'Data & Privacy', icon: 'shield'},
  {id: 'display', label: 'Display', icon: 'monitor'},
  {id: 'team', label: 'Manage Users', icon: 'users'},
  {id: 'demo', label: 'Demo Stories', icon: 'spark'},
];
const ROLES = ['Program Director', 'Program Coordinator', 'Executive Director', 'Teaching Artist', 'Staff', 'Volunteer', 'Consultant'];
const THEME_OPTS = [{id: 'light', label: 'Light', hint: 'The standard cream look.'}, {id: 'auto', label: 'Match this device', hint: 'Light or dark, following your phone or computer.'}, {id: 'dark', label: 'Dark', hint: 'Easier on the eyes at night.'}];
function applyTheme(t){
  try { const el = document.documentElement; if (t === 'auto' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme'); } catch (e) {}
}
/* a profile photo is cropped to a small square and stored with the member record */
function resizePhoto(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}
function ItemForm({kind, init, onSave, onCancel, withWords, taken}){
  const [name, setName] = useState(init.name || '');
  const [desc, setDesc] = useState(init.desc || '');
  const [color, setColor] = useState(init.color || SWATCHES[0]);
  const [words, setWords] = useState(asArr(init.words).join(', '));
  const clash = !!(taken && asStr(name) && taken(asStr(name)));
  const submit = e => { e.preventDefault(); if (!asStr(name) || clash) return; onSave({name: asStr(name), desc: asStr(desc), color, words: words.split(',').map(asStr).filter(Boolean)}); };
  return html`<form className="item-form" onSubmit=${submit}>
    <div className="item-form-grid">
      <${Field} label=${kind + ' name'}><input className="input" value=${name} onChange=${e => setName(e.target.value)} autoFocus=${true} /><//>
      <${Field} label="Description"><input className="input" value=${desc} onChange=${e => setDesc(e.target.value)} placeholder="One short line" /><//>
    </div>
    ${withWords ? html`<${Field} label="Words that signal this outcome" hint="Separate with commas. A story counts toward this outcome when its evidence or takeaways mention one of these words."><input className="input" value=${words} onChange=${e => setWords(e.target.value)} placeholder="e.g. mentor, mentoring, tutor" /><//>` : null}
    <div className="field"><span className="field-label">Color</span>
      <div className="swatches" role="radiogroup" aria-label="Color">${SWATCHES.map(c => html`<button type="button" key=${c} role="radio" aria-checked=${c === color} aria-label=${'Color ' + c} className="swatch" style=${{background: c}} onClick=${() => setColor(c)}></button>`)}</div>
    </div>
    ${clash ? html`<p className="small warn-note">That name is already in the list.</p>` : null}
    <div className="row-btns"><button className="btn btn-primary btn-sm" type="submit" disabled=${!asStr(name) || clash}>Save</button><button type="button" className="btn btn-ghost btn-sm" onClick=${onCancel}>Cancel</button></div>
  </form>`;
}
function ItemRow({color, name, desc, onEdit, onDelete, readOnly, deleteLabel}){
  return html`<div className="item-row">
    <span className="item-dot" style=${{background: color}}></span>
    <strong className="item-name">${name}</strong>
    <span className="item-desc">${desc || ''}</span>
    ${readOnly ? html`<span></span>` : html`<span className="item-actions">
      <button type="button" className="btn btn-ghost btn-xs" onClick=${onEdit} aria-label=${'Edit ' + name}>Edit</button>
      <button type="button" className="icon-btn icon-btn-box" onClick=${onDelete} aria-label=${(deleteLabel || 'Delete') + ' ' + name}><${Icon} name="trash" size=${17} /></button>
    </span>`}
  </div>`;
}
function SettingsView(){
  const {caps, settings, stories, allStories, allStudents, allStaff, safeWrite, readOnly, updateMe, openSheet, showToast, role: myRole, isAdmin} = useApp();
  /* application settings (programs, schools, outcome categories, demo data) are for administrators */
  const lock = readOnly || !isAdmin;
  const me = caps.me || {};
  const demo = settings.demo || {};
  const demoStories = (allStories || []).filter(x => x.demo);
  const [demoBusy, setDemoBusy] = useState('');
  const setDemo = patch => save({demo: Object.assign({}, cur().demo || {}, patch)});
  const [demoShow, setDemoShow] = useState(!demo.hidden);
  const [demoExp, setDemoExp] = useState(!!demo.inExports);
  useEffect(() => { setDemoShow(!demo.hidden); setDemoExp(!!demo.inExports); }, [demo.hidden, demo.inExports]);
  async function loadDemo(){ setDemoBusy('load'); const ok = await safeWrite(async () => { await loadDemoData(caps.db, me); }); if (ok) { await setDemo({loadedAt: nowISO(), removedAt: null, hidden: false, version: DEMO_VERSION}); showToast('Six demo stories added'); } setDemoBusy(''); }
  const removeDemo = () => openSheet(close => html`<${ConfirmSheet} close=${close} title="Remove all demo stories?" body=${'This deletes the ' + demoStories.length + ' fictional demo stories, their interview entries and demo student and staff records. Real stories are not touched. You can load the demo stories again later.'} confirmLabel="Remove demo stories" onConfirm=${async () => { const ok = await safeWrite(() => removeDemoData(caps.db, allStories || [], allStudents || [], allStaff || [])); if (ok) { await setDemo({removedAt: nowISO(), loadedAt: null}); showToast('Demo stories removed'); } }} />`);
  /* saves build on the latest written values, so quick edits in a row never overwrite each other */
  const latest = useRef(settings);
  useEffect(() => { latest.current = settings; }, [settings]);
  const cur = () => latest.current || {};
  const save = patch => { const next = Object.assign({}, cur(), patch, {updatedAt: nowISO()}); latest.current = next; return safeWrite(() => caps.db.doc('config/settings').set(next)); };

  /* Portal Access: shown only when the server says this account may preview the Share Your Story page */
  const [portalOk, setPortalOk] = useState(false);
  const [portalPick, setPortalPick] = useState('community');
  useEffect(() => { const f = window.__platform && window.__platform.canPreviewPortal; if (f) f().then(ok => setPortalOk(!!ok), () => setPortalOk(false)); }, []);
  const switchPortal = () => { const go = window.__platform && window.__platform.openCommunityPreview; if (portalPick === 'community' && go) go(); };

  /* section navigation: jump to a section, and highlight the one in view */
  const [active, setActive] = useState('profile');
  const jumping = useRef(0);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(es => { if (Date.now() < jumping.current) return; es.forEach(e => { if (e.isIntersecting) setActive(e.target.getAttribute('data-sec')); }); }, {rootMargin: '-25% 0px -65% 0px'});
    document.querySelectorAll('.set-sec[data-sec]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
  /* while a jump scrolls past other sections, keep the chosen one highlighted */
  const jump = id => {
    setActive(id); jumping.current = Date.now() + 2500;
    const done = () => { jumping.current = 0; setActive(id); };
    try { window.addEventListener('scrollend', done, {once: true}); } catch (e) {}
    const el = document.getElementById('sec-' + id); if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  /* profile */
  const parts = asStr(me.name).split(/\s+/);
  const [first, setFirst] = useState(me.firstName || parts[0] || '');
  const [last, setLast] = useState(me.lastName != null && me.firstName ? me.lastName : parts.slice(1).join(' '));
  const [role, setRole] = useState(me.role || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [pSaved, setPSaved] = useState(false);
  const email = (window.__platform && window.__platform.email) || me.email || '';
  const fullName = [asStr(first), asStr(last)].filter(Boolean).join(' ');
  async function saveProfile(){
    const patch = {name: fullName, firstName: asStr(first), lastName: asStr(last), role: asStr(role), phone: asStr(phone)};
    const ok = await safeWrite(() => caps.db.doc('members/' + me.id).update(patch));
    if (ok) { updateMe(patch); setPSaved(true); setTimeout(() => setPSaved(false), 2000); }
  }
  async function pickPhoto(e){
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    let photo; try { photo = await resizePhoto(file); } catch (x) { showToast(x.message); return; }
    if (await safeWrite(() => caps.db.doc('members/' + me.id).update({photo}))) { updateMe({photo}); showToast('Photo updated'); }
  }
  async function removePhoto(){ if (await safeWrite(() => caps.db.doc('members/' + me.id).update({photo: ''}))) updateMe({photo: ''}); }
  const roles = ROLES.includes(asStr(me.role)) || !asStr(me.role) ? ROLES : [asStr(me.role)].concat(ROLES);

  /* programs */
  const programs = settings.programs || [];
  const info = settings.programInfo || {};
  const [editP, setEditP] = useState(null);
  async function saveProgram(old, v){
    const programs = asArr(cur().programs), info = cur().programInfo || {};
    const nextInfo = Object.assign({}, info); if (old) delete nextInfo[old]; nextInfo[v.name] = {desc: v.desc, color: v.color};
    const next = old ? programs.map(p => p === old ? v.name : p) : programs.concat([v.name]);
    if (!(await save({programs: next, programInfo: nextInfo}))) return;
    setEditP(null);
    if (old && old !== v.name) {
      const tagged = stories.filter(s => s.program === old);
      if (tagged.length && await safeWrite(async () => { for (const s of tagged) await caps.db.collection('stories').doc(s.id).update({program: v.name}); })) showToast('Renamed on ' + tagged.length + ' stor' + (tagged.length === 1 ? 'y' : 'ies'));
    }
  }
  const deleteProgram = p => openSheet(close => html`<${ConfirmSheet} close=${close} title=${'Remove ' + p + '?'} body="It will no longer be suggested on new stories. Stories already tagged with this program keep it." confirmLabel="Remove program" onConfirm=${async () => { const ni = Object.assign({}, cur().programInfo || {}); delete ni[p]; await save({programs: asArr(cur().programs).filter(x => x !== p), programInfo: ni}); }} />`);

  /* outcome categories */
  const saved = asArr(settings.outcomes);
  const outcomes = mergeOutcomes(saved);
  const hiddenN = saved.filter(o => o.hidden && !o.custom).length;
  const changed = saved.some(o => !o.custom);
  const [editO, setEditO] = useState(null);
  const upsert = (id, fields) => { const all = asArr(cur().outcomes); const prev = all.find(o => o.id === id) || {id}; return all.filter(o => o.id !== id).concat([Object.assign({}, prev, fields)]); };
  async function saveOutcome(o, v){
    const fields = {label: v.name, desc: v.desc, color: v.color};
    const next = !o ? asArr(cur().outcomes).concat([Object.assign({id: uid('oc'), custom: true, words: v.words}, fields)]) : upsert(o.id, o.custom ? Object.assign(fields, {words: v.words}) : fields);
    if (await save({outcomes: next})) setEditO(null);
  }
  const deleteOutcome = o => openSheet(close => html`<${ConfirmSheet} close=${close} title=${(o.custom ? 'Delete ' : 'Hide ') + o.label + '?'} body=${'It will no longer appear in Impact Insights charts, filters or story tags. Stories and their evidence are not changed.' + (o.custom ? '' : ' You can bring it back with Restore defaults.')} confirmLabel=${o.custom ? 'Delete outcome' : 'Hide outcome'} onConfirm=${async () => { await save({outcomes: o.custom ? asArr(cur().outcomes).filter(x => x.id !== o.id) : upsert(o.id, {hidden: true})}); }} />`);
  const restoreOutcomes = () => save({outcomes: asArr(cur().outcomes).filter(o => o.custom)});

  /* interview voice (saved on this device) */
  const [voiceOn, setVoiceOn] = useState(() => lsGet('abg-voice') !== 'off');
  const setVoice = on => { setVoiceOn(on); lsSet('abg-voice', on ? 'on' : 'off'); if (!on) VOICE.stop(); };
  const [engine, setEngine] = useState(() => lsGet('abg-voice-engine') === 'device' ? 'device' : 'natural');
  const [vname, setVname] = useState(naturalVoiceName);
  const [sampleNote, setSampleNote] = useState('');
  const chooseEngine = e => { setEngine(e); lsSet('abg-voice-engine', e); setSampleNote(''); };
  const chooseName = n => { setVname(n); lsSet('abg-voice-name', n); setSampleNote(''); };
  async function sample(){
    setSampleNote('');
    const used = await VOICE.say('Hi ' + (asStr(first) || 'there') + '. Can you walk me through how you first met this student, and what stood out to you?');
    if (engine === 'natural' && used === 'device') setSampleNote(VOICE.naturalState() === 'off' ? "The natural voice isn't set up yet, so this device's voice was used." : VOICE.naturalState() === 'limited' ? "The natural voice reached Groq's free daily limit, so this device's voice is being used for now. It frees up again within a day." : "The natural voice couldn't be reached just now, so this device's voice was used.");
    else if (used === 'blocked') setSampleNote('Tap the button again to hear it.');
  }

  /* display (saved on this device) */
  const [theme, setTheme] = useState(() => { const t = lsGet('abg-theme'); return t === 'auto' || t === 'dark' ? t : 'light'; });
  const chooseTheme = t => { setTheme(t); lsSet('abg-theme', t); applyTheme(t); };


  const head = (title, sub, action) => html`<div className="set-card-head"><div><h2>${title}</h2>${sub ? html`<p className="small muted">${sub}</p>` : null}</div>${action || null}</div>`;
  const addBtn = (label, onClick) => lock ? null : html`<button type="button" className="btn btn-ghost btn-sm" onClick=${onClick}><${Icon} name="plus" size=${16} /> ${label}</button>`;

  return html`<div className="view settings2">
    <header className="ins-hello set-head"><p className="eyebrow">Settings</p><h1>Settings</h1><p className="lede">Manage your profile, program details, interview voice, and how your journal data is organized and used.</p></header>
    <div className="set-layout">
      <nav className="set-nav" aria-label="Settings sections">${SETTINGS_SECTIONS.filter(s => !s.portal || portalOk).map(s => s.id === 'team' && !isAdmin ? Object.assign({}, s, {label: 'Your Account', icon: 'user'}) : s).map(s => html`<button key=${s.id} type="button" className="set-link" aria-current=${active === s.id ? 'true' : undefined} onClick=${() => jump(s.id)}><${Icon} name=${s.icon} /><span>${s.label}</span></button>`)}</nav>
      <div className="set-main">

        <div className="set-sec" id="sec-profile" data-sec="profile"><section className="card set-card">
          <div className="set-card-head with-rule">
            <div><h2>Your Profile</h2><p className="small muted">Update your information and role.</p></div>
            <div className="prof-id"><${Avatar} name=${fullName || me.name} photo=${me.photo} big=${true} /><span className="prof-text"><strong>${fullName || me.name || 'Your name'}</strong><small className="muted">${asStr(role) || 'Add your job title'}</small></span></div>
            <div className="photo-btns">
              <label className="btn btn-ghost btn-sm photo-btn"><${Icon} name="camera" size=${17} /> ${me.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" className="sr-only" onChange=${pickPhoto} /></label>
              ${me.photo ? html`<button type="button" className="btn btn-quiet btn-sm" onClick=${removePhoto}>Remove</button>` : null}
            </div>
          </div>
          <div className="prof-grid">
            <${Field} label="First name"><input id="set-first" className="input" value=${first} onChange=${e => setFirst(e.target.value)} autoComplete="given-name" /><//>
            <${Field} label="Last name"><input id="set-last" className="input" value=${last} onChange=${e => setLast(e.target.value)} autoComplete="family-name" /><//>
            <${Field} label="Email"><input className="input" value=${email} readOnly=${true} aria-readonly="true" title="Your sign-in email" /><//>
            <${Field} label="Job title"><select id="set-role" className="select" value=${role} onChange=${e => setRole(e.target.value)}><option value="">Choose a job title</option>${roles.map(r => html`<option key=${r} value=${r}>${r}</option>`)}</select><//>
            <${Field} label=${html`Phone <span className="opt">(optional)</span>`}><input id="set-phone" className="input" type="tel" value=${phone} onChange=${e => setPhone(e.target.value)} placeholder="(213) 555-1234" autoComplete="tel" /><//>
            <div className="prof-save"><button className="btn btn-primary" disabled=${!asStr(first)} onClick=${saveProfile}>${pSaved ? 'Saved' : 'Save changes'}</button></div>
          </div>
          <p className="tiny muted">Your name and role appear in the sidebar, and the greeting uses your first name. Your photo and phone number are visible to the team.</p>
        </section>
</div>

        ${portalOk ? html`<div className="set-sec" id="sec-portal" data-sec="portal"><section className="card set-card">
          ${head('Portal Access', 'Move between the staff dashboard and the public Share Your Story page without signing out.')}
          <div className="portal-picks" role="radiogroup" aria-label="Portal">
            <label className=${'portal-pick' + (portalPick === 'staff' ? ' on' : '')}><input type="radio" name="set-portal" id="portal-staff" checked=${portalPick === 'staff'} onChange=${() => setPortalPick('staff')} />
              <span className="portal-ic tone-teal"><${Icon} name="home" size=${22} /></span>
              <span className="portal-text"><strong>Staff Dashboard <span className="pill tone-teal">Current portal</span></strong><small>Manage stories, review community submissions, view impact insights, and access authorized administrative functions.</small></span></label>
            <label className=${'portal-pick' + (portalPick === 'community' ? ' on' : '')}><input type="radio" name="set-portal" id="portal-community" checked=${portalPick === 'community'} onChange=${() => setPortalPick('community')} />
              <span className="portal-ic tone-purple"><${Icon} name="share" size=${22} /></span>
              <span className="portal-text"><strong>Community Story Portal <span className="pill tone-purple">Opens in Preview Mode</span></strong><small>Experience the public-facing story submission process as a community member would.</small></span></label>
          </div>
          <div className="row-btns"><button type="button" className="btn btn-purple" id="portal-switch" disabled=${portalPick !== 'community'} onClick=${switchPortal}><${Icon} name="swap" size=${18} /> ${portalPick === 'community' ? 'Switch Portal' : "You're in the Staff Dashboard"}</button></div>
          <p className="tiny muted">You stay signed in, with the same permissions. In Preview Mode, stories you send are saved as tests: they're labeled Test, appear only under Community Submissions › Test submissions, and never count in Impact Insights, totals, Source Comparison or exports. Use the Preview menu at the top of the Share Your Story page to come back here, or to exit Preview Mode before sending a real story. Only accounts on the server's preview list see this section, and the server checks again before it accepts a test story.</p>
        </section></div>` : null}

        <div className="set-sec" id="sec-programs" data-sec="programs">
          <section className="card set-card">
            ${head('Programs', 'Manage the ABG programs and activities that appear in the journal.' + (lock ? ' Only administrators can change them.' : ''), addBtn('Add program', () => setEditP('__new')))}
            <div className="item-list">
              ${editP === '__new' ? html`<${ItemForm} kind="Program" init=${{color: SWATCHES[programs.length % SWATCHES.length]}} taken=${n => programs.some(p => p.toLowerCase() === n.toLowerCase())} onCancel=${() => setEditP(null)} onSave=${v => saveProgram(null, v)} />` : null}
              ${programs.map((p, i) => editP === p
                ? html`<${ItemForm} key=${p} kind="Program" init=${{name: p, desc: (info[p] || {}).desc, color: programColor(settings, p, i)}} taken=${n => n.toLowerCase() !== p.toLowerCase() && programs.some(x => x.toLowerCase() === n.toLowerCase())} onCancel=${() => setEditP(null)} onSave=${v => saveProgram(p, v)} />`
                : html`<${ItemRow} key=${p} color=${programColor(settings, p, i)} name=${p} desc=${(info[p] || {}).desc} readOnly=${lock} onEdit=${() => setEditP(p)} onDelete=${() => deleteProgram(p)} deleteLabel="Remove" />`)}
              ${!programs.length && editP !== '__new' ? html`<p className="empty-note">No programs yet. Programs you add are suggested on every story, used as filters, and colored in Impact Insights.</p>` : null}
            </div>
          </section>
          <${ListEditor} id="set-communities" title="Schools and communities" hint="Partner schools, neighborhoods, and community organizations, suggested on every story." items=${settings.communities || []} disabled=${lock} placeholder="e.g. a partner school or neighborhood" onChange=${v => save({communities: v})} />
        </div>

        <div className="set-sec" id="sec-outcomes" data-sec="outcomes"><section className="card set-card">
          ${head('Outcome Categories', 'Customize the outcomes used in Impact Insights charts, filters and story tags.' + (lock ? ' Only administrators can change them.' : ''), addBtn('Add outcome', () => setEditO('__new')))}
          <div className="item-list">
            ${editO === '__new' ? html`<${ItemForm} kind="Outcome" withWords=${true} init=${{color: SWATCHES[(outcomes.length + 3) % SWATCHES.length]}} taken=${n => outcomes.some(o => o.label.toLowerCase() === n.toLowerCase())} onCancel=${() => setEditO(null)} onSave=${v => saveOutcome(null, v)} />` : null}
            ${outcomes.map(o => editO === o.id
              ? html`<${ItemForm} key=${o.id} kind="Outcome" withWords=${!!o.custom} init=${{name: o.label, desc: o.desc, color: o.color, words: o.words}} taken=${n => n.toLowerCase() !== o.label.toLowerCase() && outcomes.some(x => x.label.toLowerCase() === n.toLowerCase())} onCancel=${() => setEditO(null)} onSave=${v => saveOutcome(o, v)} />`
              : html`<${ItemRow} key=${o.id} color=${o.color} name=${o.label} desc=${o.desc + (o.custom && o.words && o.words.length ? ' · Matches: ' + o.words.join(', ') : '')} readOnly=${lock} onEdit=${() => setEditO(o.id)} onDelete=${() => deleteOutcome(o)} deleteLabel=${o.custom ? 'Delete' : 'Hide'} />`)}
          </div>
          <p className="tiny muted">The standard outcomes are matched automatically from each story's evidence and metrics card.${hiddenN ? ' ' + hiddenN + ' hidden.' : ''} ${changed && !lock ? html`<button type="button" className="link-btn" onClick=${restoreOutcomes}>Restore defaults</button>` : null}</p>
        </section></div>

        <div className="set-sec" id="sec-voice" data-sec="voice">
          <section className="card set-card">
            ${head('Interview Voice', 'Read each interview question aloud so the interview feels like a conversation. Saved on this device.')}
            ${VOICE.supported ? html`<label className="switch-row"><span><strong>Read interview questions aloud</strong><br /><span className="small muted">Only the question is read, and the voice stops when you press Record. You can also turn it off with the Voice button on any question.</span></span><input id="set-voice" type="checkbox" className="switch" checked=${voiceOn} onChange=${e => setVoice(e.target.checked)} /></label>
              ${voiceOn ? html`<div className="voice-grid">
                <div className="field"><span className="field-label">Voice type</span>
                  <div className="pick-list">
                    <label className=${'pick' + (engine === 'natural' ? ' on' : '')}><input type="radio" name="set-engine" checked=${engine === 'natural'} onChange=${() => chooseEngine('natural')} /><span><strong>Natural voice</strong> (Groq)<br /><span className="small muted">Sounds like a real person. Takes a moment to load each question. Only the question text is sent to Groq to be spoken.</span></span></label>
                    <label className=${'pick' + (engine === 'device' ? ' on' : '')}><input type="radio" name="set-engine" checked=${engine === 'device'} onChange=${() => chooseEngine('device')} /><span><strong>This device's voice</strong><br /><span className="small muted">Instant and works offline. Sounds more robotic on some devices.</span></span></label>
                  </div>
                </div>
                <div className="voice-side">
                  ${engine === 'natural' ? html`<${Field} label="Natural voice"><select id="set-voice-name" className="select" value=${vname} onChange=${e => chooseName(e.target.value)}>${NATURAL_VOICES.map(v => html`<option key=${v.id} value=${v.id}>${v.label}</option>`)}</select><//>` : null}
                  <div><button type="button" className="btn btn-ghost btn-sm" onClick=${sample}><${Icon} name="volume" size=${16} /> Hear a sample</button></div>
                  ${sampleNote ? html`<p className="small warn-note">${sampleNote}</p>` : null}
                </div>
              </div>` : null}`
            : html`<p className="small muted">This browser can't read questions aloud.</p>`}
          </section>
          <section className="card set-card">
            ${head('Shortcut to a new interview')}
            <p className="small">Add <strong>#record</strong> to the end of this app's link and save it to your phone's home screen (Share, then Add to Home Screen on iPhone). It opens straight to a new interview.</p>
          </section>
        </div>

        <div className="set-sec" id="sec-privacy" data-sec="privacy"><section className="card set-card">
          ${head('Data & Privacy', 'How student information is stored, shared and used.')}
          <ul className="priv-list small">
            <li>Students are recorded by first name or pseudonym only. The journal never asks for a student's last name. Students who share a first name get separate records.</li>
            <li>A first name with a school or event can still identify someone. External exports and audience versions use the first name only when publication permission is documented; otherwise they use the story's public alias or "a student".</li>
            <li>Sensitive experiences, such as gang involvement, stay out of external material unless consent is documented.</li>
            <li>Only people invited to this app can sign in. Stories, transcripts, and recordings are stored privately in ABG's Supabase project.</li>
            <li>Recordings are sent to Groq to be transcribed. Story text is sent to Anthropic's Claude API to choose interview questions, write impact stories, find evidence, answer searches, and draft audience versions.</li>
            <li>AI summaries and drafts are never approved automatically. Only approved stories appear in external exports and reports.</li>
            <li>Original transcripts are never overwritten. Corrections are saved alongside them.</li>
            <li>With the natural interview voice, only the question text is sent to Groq to be spoken. With this device's voice, nothing is sent anywhere.</li>
          </ul>
        </section></div>

        <div className="set-sec" id="sec-display" data-sec="display"><section className="card set-card">
          ${head('Display', 'How the journal looks on this device.')}
          <div className="field"><span className="field-label">Theme</span>
            <div className="theme-picks" role="radiogroup" aria-label="Theme">${THEME_OPTS.map(t => html`<label key=${t.id} className=${'pick' + (theme === t.id ? ' on' : '')}><input type="radio" name="set-theme" checked=${theme === t.id} onChange=${() => chooseTheme(t.id)} /><span><strong>${t.label}</strong><br /><span className="small muted">${t.hint}</span></span></label>`)}</div>
          </div>
        </section></div>

        <div className="set-sec" id="sec-demo" data-sec="demo"><section className="card set-card">
          ${head('Demo Stories', DEMO_SUMMARY.charAt(0).toUpperCase() + DEMO_SUMMARY.slice(1) + ', named after famous artists, show how recorded stories turn into Impact Insights. Their schools, programs, jobs and outcomes are invented.')}
          ${demoStories.length ? html`
            <p className="small">${demoStories.length} demo stor${demoStories.length === 1 ? 'y' : 'ies'} in the journal, each labeled <${DemoPill} />. Their numbers are calculated from the demo records, the same way real stories are.</p>
            <label className="switch-row"><span><strong>Show demo stories in the journal</strong><br /><span className="small muted">Turn off to hide them everywhere (Overview, Story Library, Impact Insights) without deleting them.</span></span><input id="set-demo-show" type="checkbox" className="switch" checked=${demoShow} disabled=${!isAdmin} onChange=${e => { const v = e.target.checked; setDemoShow(v); setDemo({hidden: !v}); }} /></label>
            <label className="switch-row"><span><strong>Include demo stories in reports and exports</strong><br /><span className="small muted">Off by default, so fictional stories never end up in donor reports or files. When on, they're marked "[DEMO, fictional]".</span></span><input id="set-demo-exports" type="checkbox" className="switch" checked=${demoExp} disabled=${!isAdmin} onChange=${e => { const v = e.target.checked; setDemoExp(v); setDemo({inExports: v}); }} /></label>
            ${!isAdmin ? html`<p className="small muted">Only admins can change or remove demo stories.</p>` : html`<div><button className="btn btn-ghost btn-sm danger-text" onClick=${removeDemo}><${Icon} name="trash" size=${16} /> Remove all demo stories</button></div>`}`
          : html`<p className="small">No demo stories are in the journal.</p>${!isAdmin ? null : html`<div><button className="btn btn-primary btn-sm" disabled=${!!demoBusy} onClick=${loadDemo}>${demoBusy === 'load' ? 'Adding…' : 'Load ' + DEMO_STORIES.length + ' demo stories'}</button></div>`}`}
        </section></div>

        <div className="set-sec" id="sec-team" data-sec="team"><section className="card set-card">
          ${isAdmin ? html`${head('Manage Users', 'Invite people, set their role, and remove access. Administrators can do everything; standard users record and work with stories.')}<${ManageUsers} />` : head('Your Account', 'Administrators manage who has access to the journal.')}
          <div className="acct-row"><span className="small">Signed in as <strong>${email || me.name}</strong> · ${labelOf(ROLE_OPTS, myRole)}. This device stays signed in; log out only on a shared device.</span>${window.__platform ? html`<button className="btn btn-ghost btn-sm" onClick=${() => confirmLogout(openSheet)}><${Icon} name="logout" size=${16} /> Log out</button>` : null}</div>
        </section></div>

      </div>
    </div>
  </div>`;
}

/* ================= app shell ================= */
function SheetHost({sheet, close}){
  useEffect(() => { const k = e => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return html`<div className="sheet-backdrop" onMouseDown=${e => { if (e.target === e.currentTarget) close(); }}><div className="sheet" role="dialog" aria-modal="true">${sheet.render(close)}</div></div>`;
}
function initialRoute(){
  let h = '';
  try { h = (location.hash || '').replace('#', ''); } catch (e) {}
  const ok = ['record', 'library', 'insights', 'followups', 'reports', 'backlog', 'guide'];
  return {name: h === 'record' ? 'interview' : (ok.includes(h) ? h : 'home'), params: {}, key: 1};
}
function App(){
  const [caps, setCaps] = useState({status: 'loading'});
  const [stories, setStories] = useState([]);
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [metrics, setMetrics] = useState([]);
  const [students, setStudents] = useState([]);
  const [staffPeople, setStaffPeople] = useState([]);
  const [subs, setSubs] = useState([]);
  const [subsState, setSubsState] = useState('loading');
  const [backlog, setBacklog] = useState([]);
  const [backlogLoaded, setBacklogLoaded] = useState(false);
  const [settings, setSettings] = useState({programs: [], communities: [], programInfo: {}, outcomes: [], demo: {}});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [role, setRole] = useState(null);
  const demoSeeded = useRef(false);
  const [route, setRoute] = useState(initialRoute);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [readOnly, setReadOnly] = useState(false);

  const showToast = useCallback(msg => setToast({msg, k: Date.now()}), []);
  useEffect(() => { applyTheme(lsGet('abg-theme')); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cl = window.claude;
      if (!cl || typeof cl.use !== 'function') { setCaps({status: 'nodb'}); return; }
      const res = await Promise.all(['db', 'user', 'sample', 'downloads'].map(n => cl.use(n).catch(() => null)));
      const db = res[0], user = res[1], sample = res[2], downloads = res[3];
      let me = {id: null, name: ''}, canWrite = null;
      if (user) { try { me = await user.me(); } catch (e) {} try { canWrite = await user.can('data.write'); } catch (e) {} }
      if (!alive) return;
      if (!db) { setCaps({status: 'nodb', me}); return; }
      setReadOnly(canWrite === false);
      setCaps({status: 'ready', db, user, sample, downloads, me, canWrite});
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (caps.status !== 'ready') return;
    const db = caps.db;
    const u1 = db.collection('stories').onSnapshot(snap => { setStories(snap.docs.map(d => Object.assign({id: d.id}, d.data()))); setStoriesLoaded(true); }, err => { setStoriesLoaded(true); showToast(dbErrorMessage(err)); });
    const u2 = db.collection('metrics').onSnapshot(snap => setMetrics(snap.docs.map(d => Object.assign({id: d.id}, d.data()))), () => {});
    const u4 = db.collection('students').onSnapshot(snap => setStudents(snap.docs.map(d => Object.assign({id: d.id}, d.data()))), () => {});
    const u7 = db.collection('staff').onSnapshot(snap => setStaffPeople(snap.docs.map(d => Object.assign({id: d.id}, d.data()))), () => {});
    const u3 = db.doc('config/settings').onSnapshot(snap => { const d = snap.exists ? (snap.data() || {}) : {}; ACTIVE_OUTCOMES = mergeOutcomes(d.outcomes); setSettings({programs: asArr(d.programs), communities: asArr(d.communities), programInfo: d.programInfo && typeof d.programInfo === 'object' ? d.programInfo : {}, outcomes: asArr(d.outcomes), demo: d.demo && typeof d.demo === 'object' ? d.demo : {}}); setSettingsLoaded(true); }, () => setSettingsLoaded(true));
    let alive = true;
    const loadRole = () => (window.__platform && window.__platform.getRole ? window.__platform.getRole() : Promise.resolve('user')).then(r => { if (alive) setRole(r || 'user'); }, () => { if (alive) setRole('user'); });
    loadRole();
    const u6 = () => { alive = false; };
    const u5 = db.collection('backlog').onSnapshot(snap => { setBacklog(snap.docs.map(d => Object.assign({id: d.id}, d.data()))); setBacklogLoaded(true); }, () => setBacklogLoaded(true));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [caps.status]);

  const nav = useCallback((name, params) => { setSheet(null); setRoute({name, params: params || {}, key: Date.now()}); try { window.scrollTo(0, 0); } catch (e) {} }, []);
  const openSheet = useCallback(render => setSheet({render}), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const safeWrite = useCallback(async fn => {
    try { await fn(); return true; }
    catch (e) {
      if (e && e.code === 'invalid_argument' && caps.canWrite == null) { setReadOnly(true); showToast("You don't have permission to change this journal."); }
      else showToast(dbErrorMessage(e));
      return false;
    }
  }, [caps.canWrite, showToast]);

  /* community submissions: read through row-level security (submitted stories only, never unfinished drafts) */
  const reloadSubs = useCallback(async () => {
    const api = window.__platform && window.__platform.community;
    if (!api) { setSubsState('none'); return; }
    try { setSubs(await api.list()); setSubsState('ready'); }
    catch (e) { setSubsState(/not set up/.test((e && e.message) || '') ? 'missing' : 'error'); }
  }, []);
  useEffect(() => {
    if (caps.status !== 'ready') return;
    reloadSubs();
    const t = setInterval(reloadSubs, 120000);
    const v = () => { if (!document.hidden) reloadSubs(); };
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [caps.status]);
  const updateMe = useCallback(patch => setCaps(c => Object.assign({}, c, {me: Object.assign({}, c.me, patch)})), []);
  /* fictional demo stories: added once so a new journal has something to explore; hidden or removed from Settings */
  useEffect(() => {
    if (caps.status !== 'ready' || !storiesLoaded || !settingsLoaded || role !== 'admin' || readOnly || demoSeeded.current || window.__ABG_NO_DEMO_SEED) return;
    const dc = settings.demo || {};
    if (dc.removedAt) return;
    if (dc.loadedAt) {
      /* demo records from an older version are refreshed in place (fixed ids, so nothing duplicates) */
      if ((dc.version || 1) >= DEMO_VERSION || !stories.some(x => x.demo)) return;
      demoSeeded.current = true;
      safeWrite(async () => { await loadDemoData(caps.db, caps.me || {}); await caps.db.doc('config/settings').set(Object.assign({}, settings, {demo: Object.assign({}, dc, {version: DEMO_VERSION}), updatedAt: nowISO()})); });
      return;
    }
    demoSeeded.current = true;
    (async () => {
      const ok = await safeWrite(async () => {
        await caps.db.doc('config/settings').set(Object.assign({}, settings, {demo: Object.assign({}, dc, {loadedAt: nowISO(), hidden: false, inExports: false, version: DEMO_VERSION}), updatedAt: nowISO()}));
        await loadDemoData(caps.db, caps.me || {});
      });
      if (ok) showToast(DEMO_STORIES.length + ' fictional demo stories were added so you can explore. They are labeled Demo; manage them in Settings.');
    })();
  }, [caps.status, storiesLoaded, settingsLoaded, role, readOnly]);
  const demoHidden = !!(settings.demo || {}).hidden;
  const allStories = stories, allStudents = students;
  const visibleStories = useMemo(() => demoHidden ? stories.filter(x => !x.demo) : stories, [stories, demoHidden]);
  /* Preview Mode test stories are kept apart: every list, count and report uses shownStories, which never holds a test */
  const shownStories = useMemo(() => visibleStories.filter(x => !isTest(x)), [visibleStories]);
  const testStories = useMemo(() => visibleStories.filter(isTest), [visibleStories]);
  const storyById = useCallback(id => visibleStories.find(x => x.id === id) || null, [visibleStories]);
  const shownStudents = useMemo(() => demoHidden ? students.filter(x => !x.demo) : students, [students, demoHidden]);
  const shownStaff = useMemo(() => demoHidden ? staffPeople.filter(x => !x.demo) : staffPeople, [staffPeople, demoHidden]);
  const ctx = {caps, updateMe, stories: shownStories, testStories, storyById, students: shownStudents, staffPeople: shownStaff, allStaff: staffPeople, subs, subsState, reloadSubs, allStories, allStudents, backlog, backlogLoaded, storiesLoaded, metrics, settings, route, nav, openSheet, closeSheet, showToast, safeWrite,
    readOnly, role: role || 'user', isAdmin: role === 'admin'};
  const focus = caps.status === 'ready' && (route.name === 'record' || route.name === 'review' || route.name === 'interview');
  let content;
  if (caps.status === 'loading') content = html`<div className="boot"><div className="boot-mark"></div><p>Opening ABG Impact Journal…</p></div>`;
  else if (caps.status === 'nodb') content = html`<div className="view"><div className="empty" style=${{marginTop: '24px'}}><${Brand} /><h2>The journal can't open here</h2><p className="muted">Sign in to Claude and open this journal's link again. If you're already signed in, ask the person who shared it to give you Contributor or Editor access.</p></div></div>`;
  else {
    const p = route.params || {};
    switch (route.name) {
      case 'library': content = html`<${StoriesView} key=${route.key} tab=${p.tab || 'stories'} />`; break;
      case 'story': content = html`<${StoryView} key=${p.id} id=${p.id} />`; break;
      case 'record': content = html`<${ComposerView} key=${route.key} params=${p} />`; break;
      case 'interview': content = html`<${InterviewView} key=${route.key} params=${p} />`; break;
      case 'review': content = html`<${ReviewView} key=${route.key} params=${p} />`; break;
      case 'insights': content = html`<${DashboardView} key=${route.key} tab="overview" />`; break;
      case 'backlog': content = html`<${StoriesView} key=${route.key} tab="list" />`; break;
      case 'followups': content = html`<${StoriesView} key=${route.key} tab="followups" />`; break;
      case 'reports': content = html`<${DashboardView} key=${route.key} tab="reports" />`; break;
      case 'settings': content = html`<${SettingsView} />`; break;
      case 'guide': content = html`<${GuideView} key=${route.key} />`; break;
      case 'submissions': content = html`<${SubmissionsView} key=${route.key} />`; break;
      case 'submission': content = html`<${SubmissionView} key=${p.id} id=${p.id} />`; break;
      case 'compare': content = html`<${CompareView} key=${route.key} a=${p.a} b=${p.b} />`; break;
      case 'invite': content = html`<${InviteView} key=${route.key} />`; break;
      default: content = html`<${HomeView} />`;
    }
  }
  return html`<${Ctx.Provider} value=${ctx}>
    <div className=${'app' + (focus ? ' focus' : '')}>
      ${!focus && caps.status === 'ready' ? html`<${Sidebar} />` : null}
      ${!focus && caps.status === 'ready' ? html`<${TopBar} />` : null}
      <main className="main" id="main">${content}</main>
      ${!focus && caps.status === 'ready' ? html`<${TabBar} />` : null}
    </div>
    ${sheet ? html`<${SheetHost} sheet=${sheet} close=${closeSheet} />` : null}
    ${toast ? html`<div className="toast" role="status" key=${toast.k}>${toast.msg}</div>` : null}
  <//>`;
}

window.__mountJournal = el => ReactDOM.createRoot(el).render(html`<${App} />`);
})();
