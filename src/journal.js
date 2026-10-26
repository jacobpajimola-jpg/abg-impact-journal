(function(){
'use strict';
if (!window.React || !window.ReactDOM || !window.htm) {
  var bp = document.querySelector('.boot p');
  if (bp) bp.textContent = "The journal couldn't load. Check your connection and reload the page.";
  return;
}
const { useState, useEffect, useMemo, useRef, useCallback, useContext, createContext } = React;
const html = htm.bind(React.createElement);

/* ================= vocabulary ================= */
const CATEGORIES = [
  {id:'engagement', label:'Student engagement'},
  {id:'personal', label:'Personal development'},
  {id:'creative', label:'Educational and creative development'},
  {id:'longterm', label:'Long-term student outcomes'},
  {id:'reach', label:'Program reach and participation'},
  {id:'community', label:'Community and partnership impact'},
];
const THEMES = [
  {id:'confidence', label:'Confidence'},
  {id:'self_expression', label:'Self-expression'},
  {id:'attendance', label:'Attendance'},
  {id:'classroom_engagement', label:'Classroom engagement'},
  {id:'creativity', label:'Creative development'},
  {id:'artistic_skills', label:'Artistic skills'},
  {id:'continued_engagement', label:'Continued participation'},
  {id:'belonging', label:'Belonging'},
  {id:'communication', label:'Communication'},
  {id:'leadership', label:'Leadership'},
  {id:'collaboration', label:'Collaboration'},
  {id:'alumni_return', label:'Alumni engagement'},
  {id:'volunteering', label:'Volunteering'},
  {id:'public_art', label:'Public art'},
  {id:'school_partnership', label:'School partnership'},
  {id:'family_community', label:'Community involvement'},
  {id:'long_term_development', label:'Long-term development'},
  {id:'challenges', label:'Challenges and unmet needs'},
];
const AUDIENCES = [
  {id:'donors', label:'Donors and foundations', short:'Donors', emphasis:'number of students served, program reach, student outcomes, continued participation, long-term development, what financial support made possible, and verified evidence of program effectiveness'},
  {id:'schools', label:'School administrators', short:'Schools', emphasis:'school attendance, classroom engagement, program participation, student confidence, communication skills, academic development, student retention, and access to arts education'},
  {id:'corporate', label:'Corporate partners', short:'Corporate partners', emphasis:'community impact, student participation, employee volunteer involvement, volunteer hours, completed projects, and partnership outcomes'},
  {id:'community', label:'Community organizations and neighborhood councils', short:'Community groups', emphasis:'youth engagement, community participation, neighborhood art projects, family involvement, public murals, and school and community partnerships. Never claim crime reduction or other broad community statistics'},
  {id:'artists', label:'Artists and volunteers', short:'Artists and volunteers', emphasis:'creative collaboration, student engagement, volunteer experiences, community contribution, and artistic development'},
];
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
const DOMAIN_GROUPS = [{id:'academic', label:'Academic progress'}, {id:'personal', label:'Community and personal development'}, {id:'longterm', label:'Long-term student success'}, {id:'program', label:'Program engagement'}];
const DOMAINS = [
  {id:'attendance', label:'School attendance', group:'academic', change:true},
  {id:'academics', label:'Grades and academic performance', group:'academic', change:true},
  {id:'engagement', label:'Motivation and school engagement', group:'academic', change:true},
  {id:'graduation', label:'High school graduation', group:'academic', milestone:true},
  {id:'higher_ed', label:'College or further education', group:'longterm', milestone:true},
  {id:'career', label:'Career, employment or internships', group:'longterm', milestone:true},
  {id:'returned', label:'Returned to ABG as mentor, volunteer or instructor', group:'longterm', milestone:true},
  {id:'arts_continued', label:'Continued art or creative pursuits', group:'longterm', milestone:true},
  {id:'risk', label:'Reduced risky behavior', group:'personal', change:true, sensitive:true},
  {id:'social', label:'Peer groups and relationships', group:'personal', change:true},
  {id:'activities', label:'Productive after-school activities', group:'personal', change:true},
  {id:'confidence', label:'Confidence, leadership and communication', group:'personal', change:true},
  {id:'aspirations', label:'Decision-making and future aspirations', group:'personal', change:true},
  {id:'behavior', label:'Behavior', group:'personal', change:true},
  {id:'participation', label:'Continued participation in ABG', group:'program'},
  {id:'mentorship', label:'Mentor relationships at ABG', group:'program'},
  {id:'leadership_abg', label:'Leadership roles within ABG', group:'program', milestone:true},
  {id:'access', label:'Access to arts education', group:'program'},
  {id:'artistic', label:'Artistic skills', group:'program'},
  {id:'pathways', label:'Career or college interests', group:'longterm'},
  {id:'other', label:'Other', group:'program'},
];
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
const OBSERVERS = [
  {id:'abg_staff', label:'ABG staff (Kyle)'},
  {id:'teacher', label:'Teacher'},
  {id:'school_staff', label:'School administrator or staff'},
  {id:'parent', label:'Parent or family'},
  {id:'student', label:'The student'},
  {id:'records', label:'Records or documents'},
  {id:'other', label:'Someone else'},
];
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
const LINK_TYPES = [
  {id:'same_student', label:'Same student'},
  {id:'same_school', label:'Same school'},
  {id:'same_mural', label:'Same mural'},
  {id:'same_program', label:'Same program'},
  {id:'same_community', label:'Same community'},
  {id:'same_partnership', label:'Same partnership'},
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
const METRIC_SUGGESTIONS = ['Students served','Schools reached','Workshops completed','Murals or projects completed','Volunteer hours','Volunteers','Families attending events','Program sessions held'];
/* the standard metrics card: the same measurable fields on every student story */
const METRIC_FIELDS = [
  {id:'startGrade', label:'Grade or age when they started', short:'Starting grade or age', type:'text', ph:'e.g. 7th grade, about 12'},
  {id:'yearsWithAbg', label:'Years involved with ABG', short:'Years with ABG', type:'number', unit:'years'},
  {id:'sessionsAttended', label:'Sessions or workshops attended', short:'Sessions attended', type:'number', unit:'sessions'},
  {id:'programs', label:'ABG programs or projects', short:'Programs', type:'text', ph:'e.g. School mural program'},
  {id:'artworksCompleted', label:'Murals or artworks completed', short:'Artworks completed', type:'number', unit:'works'},
  {id:'continuedArt', label:'Kept making art after the program', short:'Kept making art', type:'choice', options:['Yes','No']},
  {id:'grades', label:'Grades or schoolwork during or after ABG', short:'Grades', type:'choice', options:['Improved','Stayed about the same','Declined']},
  {id:'schoolAttendance', label:'School attendance during or after ABG', short:'School attendance', type:'choice', options:['Improved','Stayed about the same','Declined']},
  {id:'stillParticipating', label:'Still participating in ABG', short:'Still participating', type:'choice', options:['Yes','No']},
  {id:'graduated', label:'Graduated high school', short:'Graduated high school', type:'choice', options:['Yes','No','Not yet (still in school)']},
  {id:'firstGenCollege', label:'First in their family to attend college', short:'First-generation college', type:'choice', options:['Yes','No']},
  {id:'nextStep', label:'College, training or creative work afterward', short:'College or creative path', type:'text', ph:'e.g. community college art classes'},
  {id:'returnedToAbg', label:'Came back to ABG (volunteer, mentor or alum)', short:'Came back to ABG', type:'choice', options:['Yes','No']},
  {id:'currentStatus', label:'What they are doing now', short:'Doing now', type:'text', ph:'e.g. high school senior'},
];
const METRIC_STATUS = [
  {id:'verified', label:'Verified', tone:'good'},
  {id:'reported', label:'Reported', tone:'blue'},
  {id:'estimate', label:'Estimate', tone:'warn'},
];

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
function cleanMetrics(raw, aiOnly){
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  METRIC_FIELDS.forEach(f => {
    let x = r[f.id]; if (x == null) return;
    if (typeof x !== 'object') x = {value: x};
    let v = asStr(x.value).replace(/^(null|unknown)$/i, '');
    if (!v) return;
    let status = pickEnum(x.status, METRIC_STATUS, 'reported');
    if (aiOnly && status === 'verified') status = 'reported';
    if (f.type === 'number') { const mm = v.replace(/,/g, '').match(/-?\d+(\.\d+)?/); const n = mm ? toNum(mm[0]) : null; if (aiOnly && n == null) return; if (n != null && (aiOnly || /^\s*(about|around|roughly|approx\.?|~)?\s*-?[\d.,]+\s*\+?\s*[a-z]*\s*$/i.test(v))) v = String(n); }
    if (f.type === 'choice') { const o = matchOption(f, v); if (!o) return; v = o; }
    const m = {value: v, status: status};
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
function isStudentStory(s){ return !!(s && (s.studentId || asStr(s.alias))); }
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
    case 'session_expired': return "Your Claude session expired. Sign in again, then try again.";
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
const ABG_CONTEXT = "Arts Bridging the Gap (ABG) is a Los Angeles nonprofit that serves youth from under-resourced communities through arts education, creative programming and community art projects. Kyle is its Executive Director.";

const INTERVIEW_NOTES_SHAPE = {facts: [], outcomes: {}, strongestClaim: '', askedAbout: []};
function interviewPrompt({name, turns, mode, story, asked, target, memo, info, notes, avoid}){
  const convo = turns.map(t => 'Q (' + t.kind + '): ' + t.q + '\nA: ' + (t.status === 'skipped' ? '[Kyle skipped this question]' : t.a)).join('\n\n');
  const existing = story ? {summary: story.summary, timeline: (story.milestones || []).map(m => (fmtEventDate(m.date) || 'undated') + ': ' + m.label), missingData: (story.missingMetrics || []).map(m => m.metric),
    evidenceOnFile: (story.evidence || []).slice(0, 12).map(e => labelOf(DOMAINS, domainOf(e)) + ': ' + e.statement + (hasComparison(e) ? ' (' + e.before + ' to ' + e.after + ')' : '') + ' [' + labelOf(EVIDENCE_LABELS, evidenceLabelId(e)) + ']')} : null;
  return `${ABG_CONTEXT}

You are interviewing Kyle about a student named ${name}. The goal is a compelling success story and the meaningful, long-term outcomes behind it, especially graduation, higher education, careers, avoiding risky activities, school engagement and personal growth. These matter to donors, grant providers and school administrators.
${mode === 'update' ? 'This is an UPDATE interview about a story already in the journal. Focus on what is new since it was recorded. Existing record: ' + JSON.stringify(existing) : ''}
${memo ? "Kyle's one-line note about " + name + ' from his student list: "' + memo + '". A starting point, not confirmed detail.' : ''}
${studentInfoText(info) ? 'Already entered about ' + name + ' (never ask for these): ' + studentInfoText(info) + '.' : ''}

YOUR JOB EACH TURN
1. Update your interview notes from the whole conversation (previous notes are below).
2. Choose the single most valuable next question.

WHO YOU'RE TALKING TO
Kyle is ABG's Program Director. He works directly with students and knows them personally, often over years: their backgrounds, challenges, growth and what happened to them later. He does NOT have school records: no attendance percentages, GPAs or transcripts. Talk to him like a colleague who knows the student, not like an analyst with a database.
- Never ask for records, documentation, exact percentages or GPAs, and never ask him to verify something.
- Not every valuable outcome is a number. "She graduated and is at UCLA", "first in his family to go to college", "he came back as an instructor" are strong outcomes as they stand.
- If he mentions a number naturally, keep it. If he doesn't know one, accept his description and move on.

OUTCOMES TO LISTEN FOR (only the ones this story points to; never run through a checklist)
- Academic progress: better school attendance, better grades, more motivation for school, high school graduation, college, university or vocational programs.
- Community and personal development: positive changes in friends and peer groups, productive after-school activities, confidence, leadership, communication, better decisions, future goals, and less involvement in risky behavior such as gangs.
- Long-term success: graduating, first in the family to attend college, a degree or career, jobs or internships, returning to ABG as a mentor, volunteer or instructor, continuing with art.
- Program engagement: staying with ABG, relationships with mentors, joining more than one program, leadership roles at ABG.

PRIORITY when choosing what to ask
1. Meaningful milestones (graduated, college, career, came back to ABG).
2. Observable changes in behavior and development.
3. Academic and educational achievements.
4. Long-term outcomes: what they're doing today.
5. Continued participation and engagement with ABG.
6. Numbers, only when readily available (how long they were in the program, how many sessions or projects).

HOW TO FOLLOW UP
When Kyle mentions a positive change, ask one natural next question that follows the student's path forward or clarifies the outcome. Examples:
- "Her grades started improving." -> "Did she eventually graduate high school?" -> "Yes, and she's in college now." -> "Do you know what she's studying?"
- "He was involved with gangs before joining." -> "Did that change after he joined ABG?" -> "He stopped." -> "Did he ever share how ABG played into that?"
- "She's doing really well now." -> "What is she doing today?" -> "Studying graphic design." -> "Did ABG influence that interest?"
Also note where each outcome came from: something Kyle saw himself, or something the student, family or a teacher told him. If that's unclear for an important outcome, a quick "Did she tell you that, or did you see it?" is fine.

SENSITIVE TOPICS
Ask about gang involvement, family circumstances, the justice system or other sensitive experiences ONLY if Kyle brings them up first. Never assume a student was involved in gangs or risky behavior because of their background, school or neighborhood.

RULES
- Never ask about anything in notes.facts or notes.askedAbout, or anything Kyle already answered, even partly. If he said "I don't know" or skipped, that topic is closed.
- Don't assume an outcome happened or that ABG caused it. Ask "Did their grades change?", not "How much did they improve?".
- Never ask for a last name or other identifying details.
- One question, ideally under 12 words, never more than 18. Plain and natural. No preamble, no praise, no "and/or" double questions, no "could you elaborate", "tell me more" or "share details".
- Good: "Did they eventually graduate high school?" "Did they go on to college?" "What are they doing today?" "Did you notice their school attendance improve?" "Did their grades improve?" "Did they develop any career interests through ABG?" "Are they still involved with ABG?" "Have they come back to mentor younger students?"
${avoid ? '- Your last suggestion repeated an earlier question ("' + avoid + '"). Choose a different gap.' : ''}

Follow-up questions asked so far: ${asked}. Aim for about ${target}. Set "enough" to true when the story and the most important relevant evidence are covered, or the remaining gaps are things Kyle doesn't know.

PREVIOUS NOTES (empty at the start):
${JSON.stringify(notes || INTERVIEW_NOTES_SHAPE)}

CONVERSATION SO FAR:
${convo}

Reply with only JSON:
{"notes": {"facts": ["short facts already captured, under 10 words each"], "outcomes": {"academic": "what is known so far, or not discussed", "personal": "...", "longTerm": "...", "program": "..."}, "strongestClaim": "the most meaningful outcome so far, and whether Kyle saw it or was told", "askedAbout": ["topics already asked about, including skipped or don't know"]},
 "question": "the next question", "target": "which domain or claim it targets", "why": "a few words on what this adds", "enough": false}`;
}
/* rough word-overlap check so the interviewer doesn't repeat itself */
function questionOverlap(a, b){
  const stop = new Set('the a an and or of to in on did do does was were is are they their them he she his her it that this with for about how what any you your have has had after before abg'.split(' '));
  const w = t => new Set(norm(t).split(' ').filter(x => x.length > 2 && !stop.has(x)));
  const A = w(a), B = w(b); if (!A.size || !B.size) return 0;
  let n = 0; A.forEach(x => { if (B.has(x)) n++; });
  return n / Math.min(A.size, B.size);
}

const ANALYSIS_SHAPE = `{
  "title": "4 to 8 word title in sentence case, e.g. From hesitant painter to mural lead",
  "summary": "2 or 3 sentences for library cards",
  "story": "the Student Success Story, 200 to 350 words: a concise, compelling narrative covering the student's background, challenges before ABG, how they became involved, their experiences during the program, and the observed changes and outcomes. Warm, engaging and authentic. Mention key outcomes in words, but leave detailed figures to the evidence list. No generic praise, exaggeration or unsupported claims. Leave out any part the interview didn't cover.",
  "entrySummary": "1 or 2 sentences on what this specific interview adds",
  "alias": "the student's first name as given, or null",
  "overview": {"ageOrGrade": "approximate age or grade when involved, or null", "background": "1 or 2 sentences of background relevant to ABG's impact, or null", "involvementDate": "when they were involved with ABG, in Kyle's words, or null"},
  "metricsCard": {"field id": {"value": "the value; for choice fields one of the listed options exactly", "status": "reported | estimate"}},
  "isMinor": "yes | no | unknown",
  "period": "past (months or years ago) | recent",
  "eventDate": {"text": "when the original experience happened, in Kyle's words, or null", "iso": "YYYY, YYYY-MM or YYYY-MM-DD, or null", "approximate": true},
  "program": "ABG program or project, or null",
  "community": "school or community, or null",
  "takeaways": ["3 to 5 takeaways drawn from what Kyle actually said"],
  "structure": {"character": "text or null", "circumstances": "text or null", "involvement": "text or null", "events": "text or null", "outcomes": "text or null", "longTerm": "text or null"},
  "categories": ["category ids"],
  "themes": ["theme ids"],
  "stakeholders": {"primary": ["up to 3 audience ids, most relevant first"], "schools": "one sentence: how this student's documented or reported outcomes answer 'How does ABG benefit students at our school?', or null if nothing relevant", "donors": "one sentence answering 'What difference is our contribution making?', or null", "grants": "one sentence answering 'Can ABG demonstrate outcomes that justify continued funding?', naming the evidence level, or null", "why": "Stakeholder value: 2 or 3 sentences on how the documented outcomes show ABG's impact and support donor funding or school partnerships. Claim only what the evidence supports, and say when outcomes are reported or estimated rather than verified."},
  "evidence": [{"metric": "short name of the outcome, e.g. High school graduation, College enrollment, Field of study, Current job, Returned as instructor, School attendance, Leadership role at ABG, Sessions attended", "domain": "${DOMAINS.map(d => d.id).join(' | ')}", "direction": "achieved (a milestone such as graduating or enrolling) | improved | same | declined | mixed | unclear (only what Kyle said)", "level": "1 personal observation | 2 observable improvement | 3 documented metric (give the number)", "category": "category id", "kind": "numeric for measurable outcomes (numbers, counts, rates, before-and-after comparisons, durations) | qualitative for observations and testimonials", "statement": "what the evidence shows", "value": null, "unit": "students, sessions, hours, percent, years... or null", "before": "the value or situation before ABG, or null", "after": "the value or situation after, or null", "timeframe": "the period compared, e.g. fall 2023 to spring 2024, or null", "status": "reported | estimate | qualitative | unverified | future", "observer": "abg_staff | teacher | school_staff | parent | student | records | other", "basis": "who observed or reported it, e.g. Kyle observed directly; teacher told Kyle; attendance records Kyle mentioned", "excerpt": "short passage copied word for word from the interview"}],
  "missingMetrics": [{"metric": "Missing data: an outcome that was mentioned but not quantified or confirmed, or a relevant core metric the interview didn't cover. Kyle has no school records, so phrase record-based items as things ABG or the consulting team could request (e.g. School attendance records could be requested from the school; A teacher statement could confirm the change Kyle observed)", "why": "how it would strengthen the case for stakeholders", "howToGet": "where it might come from"}],
  "quotes": [{"text": "the words", "speaker": "first name or role, or Narrator", "kind": "exact | remembered | paraphrase"}],
  "milestones": [{"date": {"text": "when, or null", "iso": "YYYY or YYYY-MM, or null"}, "label": "what happened", "phase": "circumstances | involvement | immediate | short_term | long_term | future", "confirmed": true}],
  "materials": [{"type": "photo | artwork | video | testimonial | record | survey | other", "description": "what exists and where, as Kyle described it"}],
  "recommendedFollowUps": ["up to 5 concrete actions, e.g. Verify attendance information with the school"],
  "followUpQuestions": ["up to 2 questions still open for Kyle, if any"],
  "possibleLinks": [{"storyId": "id from the other-stories list", "type": "link type id", "reason": "short reason"}],
  "containsIdentifying": false,
  "containsSensitive": false
}`;

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
- Story first, evidence second, stakeholder value third. Preserve the human element; don't reduce the story to statistics.
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
link types: ${LINK_TYPES.map(l => l.id).join(', ')}`,
    others.length ? "OTHER STORIES ALREADY IN THE JOURNAL. Suggest a link only when the entries likely concern the same student, school, mural, program, community or partnership; when unsure, leave it out. Two students can share a first name, so a matching name alone is not enough.\n" + JSON.stringify(others) : "There are no other stories in the journal yet, so possibleLinks must be an empty list.",
    "ENTRIES\n" + entriesText,
    "Reply with only JSON in exactly this shape:\n" + ANALYSIS_SHAPE,
  ].filter(Boolean).join('\n\n');
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
      status: status, basis: nul(e.basis), source: {entryId: loc.entryId, excerpt: excerpt, found: loc.found, note: ''}, observed: '' };
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
  const links = asArr(r.possibleLinks).filter(l => l && ctx.storyIds.has(l.storyId)).slice(0, 4)
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
    stakeholderValue: {schools: nul(st.schools), donors: nul(st.donors), grants: nul(st.grants)},
    evidence, quotes, milestones, followUps, missingMetrics, materials, links,
    metrics: cleanMetrics(r.metricsCard, true),
    containsIdentifying: r.containsIdentifying === true,
    containsSensitive: r.containsSensitive === true || evidence.some(e => e.domain === 'risk'),
  };
}

async function runAnalysis({sample, mode, story, stories, items, whenHint, studentName, memo, studentInfo, signal}){
  const others = stories.filter(s => !story || s.id !== story.id)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 80)
    .map(s => ({id: s.id, title: s.title || null, student: s.alias || null, program: s.program || null, community: s.community || null, summary: trunc(s.summary, 220) || null}));
  const prompt = analysisPrompt({mode, story, items, others, whenHint, memo: asStr(memo), studentInfo, studentName: studentName || (story && story.alias) || ''});
  let raw;
  try { raw = await sample.json(prompt, {modelTier: 'default', signal}); }
  catch (e) {
    if (!e || e.code !== 'invalid_json') throw e;
    /* one automatic retry, with a firmer reminder about the format */
    raw = await sample.json(prompt + '\n\nYour previous reply could not be read as JSON. Reply with only the JSON object, starting with { and ending with }. Keep "story" under 350 words.', {modelTier: 'default', signal});
  }
  return normalizeAnalysis(raw, {items, storyIds: new Set(others.map(o => o.id))});
}

function searchPrompt(q, stories){
  const index = stories.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 250).map(s => ({
    id: s.id, title: s.title, student: s.alias || null, summary: trunc(s.summary, 220), program: s.program || null, community: s.community || null,
    when: fmtEventDate(s.eventDate) || null, themes: (s.themes || []).map(t => labelOf(THEMES, t)), usefulFor: (s.audiences || []).map(a => labelOf(AUDIENCES, a)),
    status: labelOf(STATUSES, s.status), evidence: (s.evidence || []).slice(0, 5).map(e => trunc(e.statement, 110) + ' [' + e.status + ']'),
  }));
  return `Find the stories in this Arts Bridging the Gap journal index that best match the request below. Match on meaning, not only keywords, but only on what the stories actually record: don't treat a story as showing an outcome (improved attendance, for example) unless its summary or evidence says so. If the request is about material for an outside audience (donors, schools, partners), prefer stories with status "Approved for external use" and mention the status in the reason.

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
  const record = {
    title: s.title, impactStory: s.story || s.summary, student: name || 'a student (do not use any name)', ageOrGrade: (s.overview || {}).ageOrGrade || null,
    when: fmtEventDate(s.eventDate) || null, program: s.program || null, community: needsRedaction(s) ? null : (s.community || null), takeaways: s.takeaways || [],
    evidence: externalEvidence(s).map(e => ({type: e.kind === 'numeric' ? 'measurable outcome' : 'qualitative', statement: e.statement, number: toNum(e.value), unit: e.unit || null, before: e.before || null, after: e.after || null, period: e.timeframe || null, status: labelOf(EVIDENCE_STATUS, e.status), observedBy: e.observer ? labelOf(OBSERVERS, e.observer) : null, basis: e.basis || null})),
    quotesYouMayUse: (s.quotes || []).filter(q => q.approved).map(q => ({text: q.text, speaker: q.speaker === s.alias && !name ? 'the student' : (q.speaker === s.alias ? name : q.speaker), kind: q.kind})),
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
- ${needsSensitiveCare(s) ? 'Do not mention gang involvement, the justice system, substance use or other sensitive or stigmatizing experiences, even if the story text does; consent to share them is not documented. ' : ''}${name ? 'Refer to the student only as ' + name + '.' : 'Do not name the student; say "a student" or similar.'}${realName ? ' The record may mention the name ' + realName + ' elsewhere; never use it.' : ''} Leave out identifying details.
- Plain text, no Markdown symbols. Warm, specific and professional. Avoid clichés such as "transformative journey".

Record:
${realName ? scrubName(JSON.stringify(record), realName, name || 'the student') : JSON.stringify(record)}`;
}

function reportPrompt(stories, metrics){
  const approved = stories.filter(s => s.status === 'approved');
  const S = approved.map((s, i) => {
    const name = externalName(s);
    const obj = {
      ref: 'S' + (i + 1), title: s.title, student: name || 'a student (no name)', when: fmtEventDate(s.eventDate) || null, program: s.program || null,
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
    if (s.alias && s.alias !== name) json = scrubName(json, s.alias, name || 'the student');
    return json;
  });
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
6. Relevance to stakeholder groups
7. Missing data and recommended follow-ups

Rules:
- Use only the data below. Don't invent numbers, outcomes, names or quotes. No return-on-investment or cost figures.
- Theme counts are numbers of stories that mention a theme. Never present them as percentages of students or outcome rates.
- Section 4 may contain only the verified program metrics (cite [M1], [M2]...) and story evidence whose status is "verified". If there is none, say so plainly.
- Elsewhere, label numbers by status ("reported", "estimated"). Leave out unverified evidence.
- Keep storytelling clearly separate from validated numbers.
- Never add together numbers from different stories; several stories can describe the same student or program.
- Describe outcomes as observed or reported, not as caused by ABG unless a story says so. Pending timeline items are not accomplishments.
- Refer to students only by the name given in each story's "student" field.
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
Approved stories: [${S.join(',')}]`;
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
  const si = opts.studentInfo || {};
  s.overview = Object.assign({}, s.overview, {gender: si.gender || '', demographics: si.demographics || ''});
  if (si.school) s.community = si.school;
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
  d.stakeholderValue = Object.assign({}, d.stakeholderValue || {}); ['schools', 'donors', 'grants'].forEach(k => { if (a.stakeholderValue && a.stakeholderValue[k]) d.stakeholderValue[k] = a.stakeholderValue[k]; });
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
  if (d.status === 'approved') { d.status = 'needs_verification'; d._wasApproved = true; }
  d.analysis = {state: 'done', at: nowISO()};
  return d;
}
function buildReviewDraft(p){
  const {mode, base, analysis, whenHint, approx, me, followupId, answered, entry, studentId, studentName, studentInfo} = p;
  if (mode === 'edit') return base ? Object.assign(blankStory({}), clone(base)) : null;
  if (mode === 'update') {
    if (!base) return null;
    const d = mergeUpdate(base, analysis);
    if (answered) d.followUps = d.followUps.map(f => { const x = answered.find(y => y.id === f.id); return x ? Object.assign({}, f, {status: x.status, answer: x.answer || '', entryId: x.status === 'answered' && entry ? entry.id : null}) : f; });
    if (followupId) d.followUps = d.followUps.map(f => f.id === followupId ? Object.assign({}, f, {status: 'done', answer: analysis.entrySummary || '', entryId: entry ? entry.id : null}) : f);
    return d;
  }
  const d = newStoryFromAnalysis(analysis, {whenHint, approx, me, studentId, studentName, studentInfo});
  if (base) Object.assign(d, {id: base.id, createdAt: base.createdAt, createdBy: base.createdBy, entryCount: base.entryCount || 1, status: base.status || 'draft', drafts: base.drafts || [], links: base.links || [], studentId: base.studentId || null, alias: base.alias || d.alias, publicName: base.publicName || ''});
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
  s.missingMetrics = s.missingMetrics.filter(m => asStr(m.metric));
  s.materials = s.materials.filter(m => asStr(m.description));
  s.takeaways = (s.takeaways || []).map(t => asStr(t)).filter(Boolean);
  s.metrics = cleanMetrics(s.metrics, false); Object.keys(s.metrics).forEach(k => { delete s.metrics[k]._new; });
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
    ['Story ID', s => s.id], ['Student record ID', s => s.studentId], ['Student first name', s => s.alias], ['Public alias', s => s.publicName], ['Title', s => s.title], ['Status', s => labelOf(STATUSES, s.status)], ['Type', s => s.period === 'past' ? 'Historical' : 'Recent'],
    ['When it happened', s => fmtEventDate(s.eventDate)], ['Sort date', s => s.eventDate && s.eventDate.iso], ['Approximate date', s => s.eventDate && s.eventDate.approximate ? 'Yes' : 'No'],
    ['Gender', s => (s.overview || {}).gender ? labelOf(GENDERS, s.overview.gender) : ''], ['Age or grade', s => (s.overview || {}).ageOrGrade], ['Other details', s => (s.overview || {}).demographics], ['Program', s => s.program], ['Metrics known', s => isStudentStory(s) ? metricsKnown(s) + ' of ' + METRIC_FIELDS.length : ''], ['School or community', s => s.community], ['Summary', s => s.summary], ['Impact story', s => s.story],
    ['Key takeaways', s => (s.takeaways || []).join(' | ')], ['Impact categories', s => lbls(CATEGORIES, s.categories)], ['Themes', s => lbls(THEMES, s.themes)], ['Useful for', s => lbls(AUDIENCES, s.audiences)], ['Why it matters to them', s => s.stakeholderWhy],
    ['Journal entries', s => s.entryCount || 1], ['Evidence items', s => (s.evidence || []).length], ['Verified evidence', s => evidenceCounts(s).verified || 0], ['Missing metrics', s => (s.missingMetrics || []).map(m => m.metric).join(' | ')],
    ['Open follow-ups', s => openQuestions(s).length + openTasks(s).length],
    ['Involves a minor', s => (s.privacy || {}).minor], ['Contains identifying info', s => (s.privacy || {}).identifying], ['Permission documented', s => (s.privacy || {}).permission],
    ['Can be used externally', s => (s.privacy || {}).external], ['Details need removal', s => (s.privacy || {}).redact],
    ['Recorded', s => s.createdAt], ['Last updated', s => s.updatedAt],
  ], stories);
}
function evidenceCSV(stories){
  const rows = [];
  stories.forEach(s => { (s.evidence || []).forEach(e => rows.push({s, e})); (s.missingMetrics || []).forEach(m => rows.push({s, e: {id: m.id, category: '', kind: '', statement: m.metric, value: null, unit: '', status: 'missing', basis: m.howToGet ? 'Where to find it: ' + m.howToGet : '', source: {note: m.why}}})); });
  return toCSV([
    ['Story ID', r => r.s.id], ['Story title', r => r.s.title], ['Story status', r => labelOf(STATUSES, r.s.status)], ['Evidence ID', r => r.e.id], ['Category', r => r.e.category ? labelOf(CATEGORIES, r.e.category) : ''],
    ['Type', r => r.e.status === 'missing' ? 'Data gap' : r.e.status === 'future' ? 'Expected, not documented' : (r.e.kind === 'numeric' ? 'Measurable outcome' : 'Qualitative evidence')], ['Statement', r => r.e.statement], ['Value', r => r.e.value], ['Unit', r => r.e.unit],
    ['Metric', r => r.e.metric], ['Impact area', r => r.e.status === 'missing' ? '' : labelOf(DOMAINS, domainOf(r.e))], ['Change', r => r.e.direction ? labelOf(DIRECTIONS, r.e.direction) : ''], ['Evidence level', r => r.e.level || ''],
    ['Before ABG', r => r.e.before], ['After ABG', r => r.e.after], ['Period compared', r => r.e.timeframe], ['Observed by', r => r.e.observer ? labelOf(OBSERVERS, r.e.observer) : ''], ['Evidence label', r => r.e.status === 'missing' ? 'Missing data' : labelOf(EVIDENCE_LABELS, evidenceLabelId(r.e))],
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
    cols.push([d.label + ' outcome', r => r.sc(r.ev.filter(e => e.status !== 'future' && domainOf(e) === d.id).map(e => d.sensitive ? (labelOf(DIRECTIONS, e.direction || 'unclear') + ' [' + labelOf(EVIDENCE_LABELS, evidenceLabelId(e)) + ']') : ((e.metric || e.statement) + (hasComparison(e) ? ': ' + e.before + ' to ' + e.after : (e.after ? ': ' + e.after : '')) + (e.direction && e.direction !== 'unclear' ? ' (' + labelOf(DIRECTIONS, e.direction).toLowerCase() + ')' : '') + ' [' + labelOf(EVIDENCE_LABELS, evidenceLabelId(e)) + ']')).join(' | '))]);
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
      cmp.forEach(e => out.push('| ' + [swap(e.metric || e.statement), swap(e.before), swap(e.after), labelOf(EVIDENCE_LABELS, evidenceLabelId(e))].map(x => String(x || '').replace(/\|/g, '/')).join(' | ') + ' |'));
      out.push('');
    }
    const rest = live.filter(e => !hasComparison(e));
    if (rest.length) { out.push('**Supporting evidence**'); rest.forEach(e => out.push(evLine(e, swap) + ' [' + labelOf(EVIDENCE_LABELS, evidenceLabelId(e)) + ']')); out.push(''); }
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
  const out = ['# ' + s.title, '', 'INTERNAL STUDENT IMPACT REPORT. Contains full transcripts. Status: ' + labelOf(STATUSES, s.status) + '.', ''];
  out.push('## Student overview');
  [['Student', s.alias], ['Gender', ov.gender ? labelOf(GENDERS, ov.gender) : ''], ['Age or grade', ov.ageOrGrade], ['School or community', s.community], ['Other details', ov.demographics], ['Background', ov.background], ['ABG program', s.program], ['When involved', ov.involvementDate || fmtEventDate(s.eventDate)]]
    .filter(r => r[1]).forEach(r => out.push('- **' + r[0] + ':** ' + r[1]));
  out.push('');
  const withPassage = e => evLine(e) + (e.source && e.source.excerpt ? ' (passage: "' + e.source.excerpt + '")' : (e.source && e.source.note ? ' (record: ' + e.source.note + ')' : ''));
  const live = (s.evidence || []).filter(e => e.status !== 'future'), fut = (s.evidence || []).filter(e => e.status === 'future');
  const cmp = live.filter(hasComparison), rest = live.filter(e => !hasComparison(e));
  out.push('## A. Student success story', '', s.story || s.summary || 'Not written yet.', '');
  if ((s.takeaways || []).length) { out.push('**Key impact takeaways**'); s.takeaways.forEach(t => out.push('- ' + t)); out.push(''); }
  out.push('## B. Measurable outcomes', '');
  const msi = storyMilestoneItems(s);
  if (msi.length) { out.push('**Key milestones**'); msi.forEach(x => out.push('- ' + x.label + (x.detail ? ': ' + x.detail : '') + ' [' + (x.e ? labelOf(EVIDENCE_LABELS, evidenceLabelId(x.e)) : labelOf(METRIC_STATUS, x.status)) + ']')); out.push(''); }
  if (cmp.length) { out.push('| Metric | Before ABG | After ABG | Evidence |', '|---|---|---|---|'); cmp.forEach(e => out.push('| ' + [e.metric || e.statement, e.before, e.after, labelOf(EVIDENCE_LABELS, evidenceLabelId(e))].map(x => String(x || '').replace(/\|/g, '/')).join(' | ') + ' |')); out.push(''); }
  else out.push('No before-and-after comparisons recorded yet.', '');
  if (isStudentStory(s)) { out.push('**Student metrics card**'); METRIC_FIELDS.forEach(f => { const m = metricVal(s, f.id); out.push('- ' + f.label + ': ' + (m ? fmtMetric(f, m.value) + ' [' + labelOf(METRIC_STATUS, m.status) + ']' : 'Unknown')); }); out.push(''); }
  out.push('## C. Supporting evidence', '');
  live.forEach(e => out.push(withPassage(e) + ' [' + labelOf(EVIDENCE_LABELS, evidenceLabelId(e)) + '; ' + labelOf(DOMAINS, domainOf(e)) + (e.level ? '; level ' + e.level : '') + ']'));
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
  [['schools', 'School administrators'], ['donors', 'Donors'], ['grants', 'Grant providers']].forEach(([k, l]) => { if (sv[k]) out.push('- **' + l + ':** ' + sv[k]); });
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
function EvLabel({e}){ const l = byId(EVIDENCE_LABELS, evidenceLabelId(e)) || EVIDENCE_LABELS[2]; return html`<${Pill} tone=${l.tone}>${l.label}<//>`; }
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
];
const STORIES_ROUTES = ['library', 'story', 'backlog', 'followups'];
function isCurrent(route, id){ if (id === 'library') return STORIES_ROUTES.includes(route.name); if (id === 'insights') return route.name === 'insights' || route.name === 'reports'; return route.name === id; }
function initialsOf(name){ const p = asStr(name).split(/[\s._-]+/).filter(Boolean); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
function Sidebar(){
  const {route, nav, readOnly, stories, caps} = useApp();
  const due = countDue(stories);
  const me = caps.me || {};
  const shown = asStr(me.name) || firstNameOf(window.__platform && window.__platform.email) || 'Signed in';
  return html`<aside className="sidebar">
    <button className="side-logo" onClick=${() => nav('home')} aria-label="Overview"><${Brand} /></button>
    <nav className="side-nav" aria-label="Main">
      ${NAV.filter(n => !(readOnly && n.id === 'interview')).map(n => html`<button key=${n.id} className="side-link" aria-current=${isCurrent(route, n.id) ? 'page' : undefined} onClick=${() => nav(n.id)}><${Icon} name=${n.icon} /><span>${n.label}</span>${n.id === 'library' && due > 0 ? html`<span className="badge" title=${due + ' follow-ups due'}>${due}</span>` : null}</button>`)}
    </nav>
    <div className="side-bottom">
      <div className="side-user"><span className="avatar tone-teal">${initialsOf(shown)}</span><span className="side-user-text"><strong>${shown}</strong><small>${me.role || (window.__platform && window.__platform.email) || ''}</small></span></div>
      <button className="side-link side-small" aria-current=${route.name === 'settings' ? 'page' : undefined} onClick=${() => nav('settings')}><${Icon} name="gear" size=${18} /><span>Settings</span></button>
      ${window.__platform ? html`<button className="side-link side-small" onClick=${() => window.__platform.signOut()}><${Icon} name="logout" size=${18} /><span>Log out</span></button>` : null}
    </div>
  </aside>`;
}
function TopBar(){
  const {nav} = useApp();
  return html`<header className="topbar">
    <button className="icon-btn topbar-logo" onClick=${() => nav('home')} aria-label="Overview"><${Brand} small=${true} /></button>
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
const INSIGHT_OUTCOMES = [
  {id:'confidence', label:'Increased confidence or creativity', short:'Confidence & Creativity', domains:['confidence', 'artistic'], color:'#2ED3B4', tone:'teal'},
  {id:'academic', label:'Improved academic performance', short:'Academic Performance', domains:['academics'], color:'#A653C9', tone:'purple'},
  {id:'community', label:'Positive community engagement', short:'Community Engagement', domains:['social', 'activities', 'risk', 'behavior'], color:'#F26B6B', tone:'coral'},
  {id:'attendance', label:'Improved school attendance', short:'School Attendance', domains:['attendance'], color:'#2B9FE0', tone:'blue'},
  {id:'higher_ed', label:'Pursued higher education', short:'Higher Education', domains:['higher_ed'], color:'#F59A3C', tone:'orange'},
  {id:'graduation', label:'Graduated high school', short:'Graduated', domains:['graduation'], color:'#F4C542', tone:'yellow'},
  {id:'engagement', label:'More motivated and engaged in school', short:'School Engagement', domains:['engagement'], color:'#4DB6AC', tone:'teal'},
  {id:'career', label:'Career, job or internship', short:'Career', domains:['career', 'pathways'], color:'#5C6BC0', tone:'blue'},
  {id:'returned', label:'Returned to ABG as a mentor or instructor', short:'Returned to ABG', domains:['returned', 'leadership_abg'], color:'#8D6E63', tone:'orange'},
  {id:'arts', label:'Continued art or creative pursuits', short:'Continued Art', domains:['arts_continued'], color:'#EC6FB5', tone:'purple'},
];
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
function storyOutcomes(s){
  const set = new Set();
  (s.evidence || []).forEach(e => { if (e.status === 'future' || ['declined', 'same'].includes(e.direction)) return; const d = domainOf(e); INSIGHT_OUTCOMES.forEach(o => { if (o.domains.includes(d)) set.add(o.id); }); });
  const v = id => { const m = metricVal(s, id); return m ? m.value : ''; };
  if (v('grades') === 'Improved') set.add('academic');
  if (v('schoolAttendance') === 'Improved') set.add('attendance');
  if (v('graduated') === 'Yes') set.add('graduation');
  if (v('returnedToAbg') === 'Yes') set.add('returned');
  if (v('continuedArt') === 'Yes') set.add('arts');
  if (/college|university|degree|vocational|trade/i.test(v('nextStep'))) set.add('higher_ed');
  return set;
}
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
function InsightsOverview({list, filterBar}){
  const {nav, storiesLoaded} = useApp();
  const profiles = useMemo(() => studentProfiles(list), [list]);
  const outcomesN = list.reduce((t, s) => t + outcomeCount(s), 0);
  const places = uniq(list.map(s => asStr(s.program)).concat(list.map(s => asStr(s.community))).map(x => x.toLowerCase())).length;
  const outs = INSIGHT_OUTCOMES.map(o => ({o, n: list.filter(s => storyOutcomes(s).has(o.id)).length})).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);
  const byProgram = {};
  profiles.forEach(p => { const k = asStr(p.latest.program) || 'Other / Not specified'; byProgram[k] = (byProgram[k] || 0) + 1; });
  const progRows = Object.entries(byProgram).filter(([k]) => k !== 'Other / Not specified').sort((a, b) => b[1] - a[1]);
  const colors = ['#2ED3B4', '#A653C9', '#2B9FE0', '#F59A3C', '#F4C542'];
  let donut = progRows.slice(0, 4).map(([label, n], i) => ({label, n, color: colors[i]}));
  const other = progRows.slice(4).reduce((t, r) => t + r[1], 0) + (byProgram['Other / Not specified'] || 0);
  if (other) donut.push({label: 'Other / Not specified', n: other, color: colors[4]});
  const featured = list.slice().sort((a, b) => ((b.status === 'approved') - (a.status === 'approved')) || (outcomeCount(b) - outcomeCount(a)) || (b.createdAt || '').localeCompare(a.createdAt || '')).filter(isStudentStory).slice(0, 3);
  const stat = (icon, tone, value, label, sub) => html`<div className="stat-card ins-stat"><span className=${'stat-ic tone-' + tone}><${Icon} name=${icon} size=${26} /></span><span className="stat-text"><b className="tnum">${storiesLoaded ? value : '–'}</b><span className="stat-label">${label}</span><small className="muted">${sub}</small></span></div>`;
  return html`<div className="view ins-body">
    <div className="ins-stats">
      ${stat('users', 'teal', profiles.length, 'Students featured', 'Unique first names')}
      ${stat('openbook', 'purple', list.length, 'Stories captured', 'Journal entries')}
      ${stat('bars', 'orange', outcomesN, 'Total outcomes', 'Reported across stories')}
      ${stat('cap', 'blue', places, 'Schools & programs', 'Represented')}
    </div>
    <div className="ins-charts">
      <section className="card ins-card">
        <div><h2>Most common reported outcomes</h2><p className="small muted">Number of journal entries mentioning each outcome</p></div>
        ${outs.length === 0 ? html`<p className="empty-note">No outcomes recorded in this view yet.</p>` : html`<div className="obars">${outs.map(x => html`<div className="obar" key=${x.o.id}>
          <span className="obar-label">${x.o.label}</span>
          <span className="obar-track"><span className="obar-fill" style=${{width: Math.max(4, Math.round(100 * x.n / Math.max(1, list.length))) + '%', background: x.o.color}}></span></span>
          <span className="obar-n tnum">${x.n}</span>
        </div>`)}</div>`}
        <p className="tiny muted">Counts of stories in the journal, not rates for all ABG students.</p>
      </section>
      <section className="card ins-card">
        <div><h2>Students by program</h2><p className="small muted">Unique students, by the program in their latest story</p></div>
        ${profiles.length === 0 ? html`<p className="empty-note">No students in this view yet.</p>` : html`<div className="donut-wrap">
          <${Donut} rows=${donut} total=${profiles.length} />
          <ul className="donut-legend">${donut.map(r => html`<li key=${r.label}><span className="dot-sw" style=${{background: r.color}}></span><span className="dl-label">${r.label}</span><span className="dl-n tnum">${r.n} <span className="muted">(${Math.round(100 * r.n / profiles.length)}%)</span></span></li>`)}</ul>
        </div>`}
      </section>
    </div>
    ${filterBar}
    <section className="card ins-card">
      <div className="sec-head"><div><h2>Featured Stories</h2><p className="small muted">Real student experiences that highlight the impact of ABG's work.</p></div><button className="btn btn-quiet btn-sm view-all" onClick=${() => nav('library')}>View all stories <span aria-hidden="true">→</span></button></div>
      ${featured.length === 0 ? html`<p className="empty-note">No student stories in this view yet.</p>` : html`<div className="fs-grid">${featured.map(st => { const ov = st.overview || {}; const tags = INSIGHT_OUTCOMES.filter(o => storyOutcomes(st).has(o.id)).slice(0, 2); return html`<button className="fs-card" key=${st.id} onClick=${() => nav('story', {id: st.id})}>
        ${storyArt(st.id)}
        <span className="fs-main"><strong>${st.alias || st.title}</strong><small className="muted">${[st.program, ov.ageOrGrade || ov.demographics].filter(Boolean).join(' · ')}</small><span className="fs-sum">${st.summary || st.title}</span></span>
        ${tags.length ? html`<span className="fs-tags">${tags.map(o => html`<span className=${'pill tone-' + o.tone} key=${o.id}>${o.short}</span>`)}</span>` : null}
      </button>`; })}</div>`}
    </section>
  </div>`;
}
function DashboardView({tab: initial}){
  const {stories} = useApp();
  const [tab, setTab] = useState(initial || 'overview');
  const [range, setRange] = useState(() => lsGet('abg-ins-range') || '12m');
  const [f, setF] = useState({program: '', grade: '', school: '', outcome: ''});
  const setFilter = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
  useEffect(() => { lsSet('abg-ins-range', range); }, [range]);
  if (tab === 'reports') return html`<div className="view">
    <div className="ins-top"><div><p className="eyebrow">Impact Insights</p><h1>Reports and exports</h1></div><button className="btn btn-ghost btn-sm" onClick=${() => setTab('overview')}><${Icon} name="back" size=${16} /> Back to insights</button></div>
    <${ReportsView} embedded=${true} />
  </div>`;
  const days = (byId(RANGES, range) || {}).days || 0;
  const since = days ? new Date(Date.now() - days * 864e5).toISOString() : '';
  const inRange = stories.filter(s => !since || (s.createdAt || '') >= since);
  const list = inRange.filter(s => (!f.program || s.program === f.program) && (!f.school || s.community === f.school) && (!f.grade || gradeBucket(s) === f.grade) && (!f.outcome || storyOutcomes(s).has(f.outcome)));
  const programs = uniq(stories.map(s => asStr(s.program))).sort();
  const schools = uniq(stories.map(s => asStr(s.community))).sort();
  const active = Object.values(f).some(Boolean);
  const sel = (k, label, opts) => html`<label className="ins-filter"><span className="sr-only">${label}</span><select className="select" aria-label=${label} value=${f[k]} onChange=${e => setFilter(k, e.target.value)}><option value="">${label}</option>${opts.map(o => html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`)}</select></label>`;
  return html`<div className="view insights2">
    <div className="ins-top">
      <header className="ins-hello"><p className="eyebrow">Impact Insights</p><h1>Stories that show what's possible.</h1><p className="lede">Explore key themes and outcomes from your journal entries. These insights highlight the real experiences of ABG students and help demonstrate the impact of our programs.</p></header>
      <div className="ins-controls">
        <label className="range-pick"><${Icon} name="calendar" size=${18} /><select aria-label="Date range" value=${range} onChange=${e => setRange(e.target.value)}>${RANGES.map(r => html`<option key=${r.id} value=${r.id}>${r.label}</option>`)}</select></label>
        <button className="btn btn-ghost btn-sm" onClick=${() => setTab('reports')}><${Icon} name="file" size=${16} /> Reports and exports</button>
      </div>
    </div>
    <${InsightsOverview} list=${list} filterBar=${html`<div className="filter-bar">
      <span className="filter-label">Filter by:</span>
      ${sel('program', 'Program', programs.map(p => [p, p]))}
      ${sel('grade', 'Grade level', GRADE_BUCKETS.map(g => [g.id, g.label]))}
      ${sel('school', 'School', schools.map(p => [p, p]))}
      ${sel('outcome', 'Outcome', INSIGHT_OUTCOMES.map(o => [o.id, o.label]))}
      ${active ? html`<button className="btn btn-quiet btn-sm" onClick=${() => setF({program: '', grade: '', school: '', outcome: ''})}>Clear</button>` : null}
    </div>`} />
    <details className="sec ins-more"><summary><span>Evidence details: milestones, impact by category, evidence quality<span className="count">All stories</span></span><${Icon} name="chev" size=${18} /></summary>
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
  const meta = [ev ? ev + (story.eventDate && story.eventDate.approximate ? ' (approx.)' : '') : '', story.program].filter(Boolean).join(' · ');
  const auds = (story.audiences || []).slice(0, 3).map(a => (byId(AUDIENCES, a) || {}).short || a);
  const open = () => nav('story', {id: story.id});
  return html`<div className="card story-card" role="button" tabIndex="0" onClick=${open} onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
    <div className="sc-top">
      <${StatusPill} status=${story.status} />
      ${story.period === 'past' ? html`<${Pill} tone="orange">Historical<//>` : null}
      ${updates > 0 ? html`<${Pill} tone="blue">${updates} update${updates > 1 ? 's' : ''}<//>` : null}
    </div>
    ${story.alias ? html`<p className="eyebrow">${story.alias}</p>` : null}
    <h3>${story.title || 'Untitled story'}</h3>
    ${meta ? html`<p className="small muted">${meta}</p>` : null}
    ${story.summary ? html`<p className="clamp">${story.summary}</p>` : html`<p className="small muted">Not analyzed yet.</p>`}
    ${why ? html`<p className="why small"><${Icon} name="spark" size=${16} /> <span>${why}</span></p>` : null}
    ${(story.themes || []).length > 0 ? html`<div className="chips">${story.themes.slice(0, 3).map(t => html`<span className="chip static small" key=${t}>${labelOf(THEMES, t)}</span>`)}</div>` : null}
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
  return html`<svg className="hero-art" viewBox="0 0 320 260" aria-hidden="true" focusable="false">
    <path d="M40 40c40-30 120-20 140 30s-30 60 0 90 70 20 50 60-120 50-170 10S0 70 40 40z" fill="var(--blob-1)" opacity=".55"/>
    <path d="M210 10c50-10 110 30 100 90s-60 80-100 60-60-60-50-100 20-45 50-50z" fill="var(--blob-2)" opacity=".7"/>
    <path d="M150 250c-20-45 10-80 45-120s40-95 85-110 70 40 40 90c-12 22-38 28-30 50 8 22 46 16 46 45 0 30-40 45-100 45z" fill="var(--palette)" stroke="#16323a" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="268" cy="58" r="17" fill="#6B3FA0" stroke="#16323a" stroke-width="4"/>
    <circle cx="226" cy="86" r="17" fill="#1E7FC4" stroke="#16323a" stroke-width="4"/>
    <circle cx="200" cy="133" r="17" fill="#F5A03C" stroke="#16323a" stroke-width="4"/>
    <circle cx="178" cy="185" r="17" fill="#E84FB8" stroke="#16323a" stroke-width="4"/>
    <circle cx="290" cy="228" r="24" fill="var(--surface)" stroke="#16323a" stroke-width="4"/>
  </svg>`;
}
const ROW_TONES = ['teal', 'purple', 'orange'];
function outcomeCount(s){ return (s.evidence || []).filter(e => e.status !== 'future').length; }
function RecentStoryRow({story, i}){
  const {nav} = useApp();
  const tone = ROW_TONES[i % ROW_TONES.length];
  const ov = story.overview || {};
  const name = story.alias || story.title || 'Untitled story';
  const meta = [story.program, ov.ageOrGrade || ov.demographics].filter(Boolean).join(' · ');
  const n = outcomeCount(story);
  const open = () => nav('story', {id: story.id});
  return html`<div className="recent-row" role="button" tabIndex="0" onClick=${open} onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
    <span className=${'avatar avatar-lg tone-' + tone}>${initialsOf(name).slice(0, 1)}</span>
    <span className="recent-main"><strong>${name}</strong>${meta ? html`<small className="muted">${meta}</small>` : null}<span className="recent-sum">${story.summary || story.title || 'Not analyzed yet.'}</span></span>
    <span className="recent-side"><small className="muted">${fmtDate(story.createdAt)}</small>${n ? html`<span className=${'pill tone-' + tone}>${n} outcome${n === 1 ? '' : 's'}</span>` : null}</span>
    <${Icon} name="chev" size=${18} />
  </div>`;
}
function HomeView(){
  const {caps, stories, storiesLoaded, nav, readOnly} = useApp();
  const first = firstNameOf(caps.me && caps.me.name) || firstNameOf(window.__platform && window.__platform.email) || firstNameOf(caps.me && caps.me.email);
  const recent = stories.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
  const studentsN = studentProfiles(stories).length;
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
        <p className="hero-text">Share a student experience. We'll guide you through the details and outcomes that matter.</p>
        <button className="btn btn-purple btn-lg" disabled=${readOnly} onClick=${() => nav('interview')}><${Icon} name="plus" size=${20} /> Capture a New Story</button>
      </div>
      <${PaletteArt} />
    </section>
    <div className="stat-row">
      ${stat('openbook', 'purple', 'Stories captured', stories.length, 'Journal entries', 'library')}
      ${stat('users', 'teal', 'Students featured', studentsN, 'Unique first names', 'library')}
      ${stat('bars', 'orange', 'Outcomes recorded', outcomesN, 'Reported outcomes', 'insights')}
    </div>
    <section className="recent">
      <div className="sec-head"><h2>Recent Stories</h2>${stories.length ? html`<button className="btn btn-quiet btn-sm view-all" onClick=${() => nav('library')}>View all <span aria-hidden="true">→</span></button>` : null}</div>
      ${!storiesLoaded ? html`<div className="skeleton"></div>`
        : recent.length ? html`<div className="recent-list">${recent.map((s, i) => html`<${RecentStoryRow} key=${s.id} story=${s} i=${i} />`)}</div>`
        : html`<div className="empty"><h3>No stories yet</h3><p className="muted">Your first story will show up here with its outcomes.</p></div>`}
    </section>
  </div>`;
}

/* ================= recording building blocks ================= */
function FocusHeader({title, sub, onBack}){
  return html`<header className="focus-head"><button className="icon-btn" onClick=${onBack} aria-label="Back"><${Icon} name="back" /></button><div><h1 className="h-focus">${title}</h1>${sub ? html`<p className="small muted">${sub}</p>` : null}</div></header>`;
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
    if (r.stream) r.stream.getTracks().forEach(t => t.stop());
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
    try { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); }
    catch (e) { setErr('Microphone access was blocked. Allow the microphone for this site in your browser settings, or type your answer instead.'); return; }
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
async function saveRawEntry({caps, safeWrite, story, entry, title, whenText, approx, newStudent, studentId, studentName, followupId, backlogId, studentInfo}){
  const db = caps.db; const me = caps.me || {};
  const sid = story ? story.id : uid('s');
  const ed = Object.assign({}, entry, {storyId: sid}); delete ed.id;
  const ok = await safeWrite(async () => {
    if (newStudent) { const sd = Object.assign({}, newStudent); delete sd.id; await db.collection('students').doc(newStudent.id).set(sd); }
    await db.collection('entries').doc(entry.id).set(ed);
    if (story) {
      const patch = {entryCount: (story.entryCount || 1) + 1, updatedAt: nowISO(), updatedBy: me.id || null};
      if (followupId) patch.followUps = clone(story.followUps || []).map(f => f.id === followupId ? Object.assign(f, {status: 'done', entryId: entry.id}) : f);
      await db.collection('stories').doc(sid).update(patch);
    } else {
      const s = blankStory(me);
      s.title = title; s.alias = studentName || ''; s.studentId = studentId || null;
      s.eventDate = {text: whenText || '', iso: '', approximate: !!approx};
      if (studentInfo) { s.overview = Object.assign({}, s.overview, {gender: studentInfo.gender || '', demographics: studentInfo.demographics || ''}); if (studentInfo.school) s.community = studentInfo.school; }
      const sd = Object.assign({}, s); delete sd.id;
      await db.collection('stories').doc(sid).set(sd);
    }
    await markBacklogRecorded(db, backlogId, sid, studentId);
  });
  return ok ? sid : null;
}

/* ================= general story composer (programs, murals, partnerships) ================= */
function ComposerView({params}){
  const {caps, stories, storiesLoaded, nav, readOnly, safeWrite, showToast} = useApp();
  const storyId = params.storyId || null;
  const story = storyId ? stories.find(s => s.id === storyId) : null;
  const draftKey = 'abg-draft:' + (storyId || 'new');
  const initial = useMemo(() => { try { return JSON.parse(lsGet(draftKey) || 'null') || {}; } catch (e) { return {}; } }, [draftKey]);
  const [text, setText] = useState(initial.text || '');
  const [when, setWhen] = useState(initial.when || '');
  const [approx, setApprox] = useState(!!initial.approx);
  const [pIdx, setPIdx] = useState(0);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [clips, setClips] = useState(initial.clips || []);
  const [recBusy, setRecBusy] = useState(false);
  const ctlRef = useRef(null);
  const restored = !!initial.text;
  const basePrompt = params.prompt || (storyId ? UPDATE_PROMPT : PROMPTS[0]);
  const prompt = pIdx === 0 ? basePrompt : PROMPTS[pIdx % PROMPTS.length];
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() || when.trim() || clips.length) lsSet(draftKey, JSON.stringify({text, when, approx, clips, at: Date.now()})); else lsDel(draftKey); }, 350);
    return () => clearTimeout(t);
  }, [text, when, approx, clips, draftKey]);
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
    if (sid) { lsDel(draftKey); showToast(story ? 'Update saved' : 'Story saved'); nav('story', {id: sid}); }
  }
  const back = () => story ? nav('story', {id: story.id}) : nav('home');
  const title = story ? 'Add Story Update' : 'Record a general story';
  if (readOnly) return html`<div className="view"><${FocusHeader} title=${title} onBack=${() => nav('home')} /><p className="notice">You have view-only access to this journal. Ask the person who shared it for Editor access to record stories.</p></div>`;
  if (storyId && !story) return html`<div className="view"><${FocusHeader} title=${title} onBack=${() => nav('library')} />${storiesLoaded ? html`<p className="notice">This story isn't in the journal anymore.</p>` : html`<div className="skeleton"></div>`}</div>`;
  if (busy === 'analyze') return html`<div className="view"><${FocusHeader} title=${title} sub=${story ? story.title : null} onBack=${() => ctlRef.current && ctlRef.current.abort()} /><${Analyzing} onStop=${() => ctlRef.current && ctlRef.current.abort()} /></div>`;
  return html`<div className="view composer">
    <${FocusHeader} title=${title} sub=${story ? story.title : 'For programs, murals, partnerships, and community moments. For a student, start a student story instead.'} onBack=${back} />
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
    ${restored ? html`<p className="small muted">Restored your unsaved draft from this device.</p>` : null}
    <div className="savebar"><div className="inner">
      <button className="btn btn-ghost" onClick=${saveRaw} disabled=${!hasText || !!busy || recBusy}>${busy === 'save' ? 'Saving…' : 'Save without analysis'}</button>
      ${caps.sample ? html`<button className="btn btn-primary" onClick=${analyze} disabled=${!hasText || !!busy || recBusy}><${Icon} name="spark" size=${18} /> Analyze with Claude</button>` : null}
    </div></div>
  </div>`;
}

/* ================= student interview ================= */
function turnsToText(turns){ return turns.map(t => 'Q: ' + t.q + '\nA: ' + (t.status === 'skipped' ? '(skipped)' : t.a)).join('\n\n'); }
function InterviewView({params}){
  const {caps, stories, students, storiesLoaded, settings, nav, readOnly, safeWrite, showToast} = useApp();
  const storyId = params.storyId || null;
  const story = storyId ? stories.find(s => s.id === storyId) : null;
  const mode = storyId ? 'update' : 'new';
  const draftKey = 'abg-interview:' + (storyId || (params.backlogId ? 'bl-' + params.backlogId : 'new'));
  const init = useMemo(() => { try { return JSON.parse(lsGet(draftKey) || 'null') || null; } catch (e) { return null; } }, [draftKey]);
  const fresh = !init || (params.followupId && init.followupId !== params.followupId) || (params.backlogId && init.backlogId !== params.backlogId);
  const I = fresh ? {} : init;
  const [step, setStep] = useState(I.step || (mode === 'update' ? 'interview' : 'name'));
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
  const restored = !fresh && (I.turns || []).length > 0;

  const storyStudent = story && story.studentId ? students.find(x => x.id === story.studentId) : null;
  const name = mode === 'update' ? ((storyStudent && storyStudent.firstName) || (story && story.alias) || 'this student') : ((student && student.firstName) || asStr(first));
  const followupId = params.followupId || I.followupId || null;
  const backlogId = mode === 'new' ? (params.backlogId || I.backlogId || null) : null;
  const memo = backlogId ? asStr(params.memory || I.memo) : '';

  useEffect(() => {
    if (mode === 'update' && story && !current && turns.length === 0) setCurrent({q: params.prompt || UPDATE_OPENING_Q(name), kind: 'opening'});
  }, [story && story.id]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 'name' && !asStr(first)) { lsDel(draftKey); return; }
      lsSet(draftKey, JSON.stringify({step, first, pick, note, when, gender, school, demo, turns, current, answer, target, phase, student, clips, followupId, backlogId, memo, notes, at: Date.now()}));
    }, 350);
    return () => clearTimeout(t);
  }, [step, first, pick, note, when, gender, school, demo, turns, current, answer, target, phase, student, clips, notes]);
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

  const matches = useMemo(() => { const k = norm(first); return k ? students.filter(x => x.nameKey === k) : []; }, [students, first]);
  const storiesFor = sid => stories.filter(s => s.studentId === sid);
  const asked = turns.filter(t => t.kind === 'followup').length;

  function begin(){
    let fn = asStr(first).replace(/\s+/g, ' ');
    if (!fn) return;
    fn = fn.charAt(0).toUpperCase() + fn.slice(1);
    let st;
    const info = {gender, school: asStr(school), demographics: asStr(demo)};
    if (pick && pick !== 'new') { const ex = students.find(x => x.id === pick); st = Object.assign({id: ex.id, firstName: ex.firstName, existing: true}, {gender: info.gender || ex.gender || '', school: info.school || ex.school || '', demographics: info.demographics || ex.demographics || ''}); }
    else st = Object.assign({id: uid('st'), firstName: fn, nameKey: norm(fn), note: asStr(note), createdAt: nowISO(), createdBy: (caps.me && caps.me.id) || null, existing: false}, info);
    setStudent(st); setStep('interview'); setPhase('asking');
    setCurrent({q: OPENING_Q(st.firstName), kind: 'opening'});
  }
  async function fetchNext(nt){
    if (!caps.sample) { setCurrent({q: CLOSING_Q(name), kind: 'closing'}); return; }
    setErr(''); setLoadingQ(true); setCurrent(null);
    const ctl = new AbortController(); qCtl.current = ctl;
    try {
      const ask = avoid => caps.sample.json(interviewPrompt({name, turns: nt, mode, story, memo, info: studentInfo, notes, avoid, asked: nt.filter(t => t.kind === 'followup').length, target}), {modelTier: 'default', cache: false, signal: ctl.signal});
      let r = await ask('');
      let q = asStr(r && r.question);
      if (!q) throw {code: 'invalid_json'};
      const dup = nt.find(t => questionOverlap(t.q, q) >= 0.7);
      if (dup) { try { const r2 = await ask(dup.q); const q2 = asStr(r2 && r2.question); if (q2 && !nt.some(t => questionOverlap(t.q, q2) >= 0.7)) { r = r2; q = q2; } } catch (e2) { if (e2 && e2.code === 'cancelled') throw e2; } }
      if (r.notes && typeof r.notes === 'object') setNotes(r.notes);
      setCurrent({q, kind: 'followup', category: asStr(r.target).slice(0, 40), why: asStr(r.why)});
      if (r.enough === true && nt.filter(t => t.kind === 'followup').length >= 2) setTarget(t => Math.min(t, nt.filter(x => x.kind === 'followup').length + 1));
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
    if (!caps.sample) { setCurrent({q: CLOSING_Q(name), kind: 'closing'}); return; }
    if (n >= target) { setCurrent(null); setPhase('choice'); return; }
    fetchNext(nt);
  }
  function another(){ setPhase('asking'); setTarget(asked + 1); fetchNext(turns); }
  function wrapUp(){ setPhase('asking'); if (qCtl.current) qCtl.current.abort(); setLoadingQ(false); setErr(''); setCurrent({q: CLOSING_Q(name), kind: 'closing'}); }
  function finishNow(){
    let nt = turns;
    if (current && asStr(answer)) { nt = turns.concat([{q: current.q, kind: current.kind, category: current.category || '', a: answer.trim(), status: 'answered', at: nowISO(), audio: clips}]); setTurns(nt); setAnswer(''); setClips([]); }
    if (qCtl.current) qCtl.current.abort();
    setCurrent(null); setPhase('done');
    finish(nt);
  }
  function makeEntry(nt){
    return {id: uid('e'), storyId: story ? story.id : null, recordedAt: (nt[0] && nt[0].at) || nowISO(), eventDateText: asStr(when), eventApprox: false, prompt: nt[0] ? nt[0].q : '',
      transcript: turnsToText(nt), turns: nt, audio: nt.reduce((a, t) => a.concat(t.audio || []), []), transcriptEdited: null, summary: '', takeaways: [], source: mode === 'update' ? 'interview-update' : 'interview', analyzed: false,
      createdBy: (caps.me && caps.me.id) || null};
  }
  async function finish(nt){
    if (!nt.some(t => t.status === 'answered')) { setErr('Answer at least the opening question before finishing.'); setPhase('asking'); setCurrent({q: nt[0] ? nt[0].q : OPENING_Q(name), kind: 'opening'}); setTurns([]); return; }
    if (!caps.sample) return;
    setErr(''); setBusy('analyze');
    const ctl = new AbortController(); aCtl.current = ctl;
    const entry = makeEntry(nt);
    const items = [{id: entry.id, text: entry.transcript, recordedAt: entry.recordedAt}];
    try {
      const analysis = await runAnalysis({sample: caps.sample, mode, story, stories, items, whenHint: asStr(when), studentName: name, memo, studentInfo, signal: ctl.signal});
      aCtl.current = null;
      const ns = student && !student.existing ? Object.assign({}, student) : null;
      if (ns) delete ns.existing;
      nav('review', {mode, storyId: story ? story.id : null, analysis, entry, items, draftKey, whenHint: asStr(when), followupId,
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
    const ns = student && !student.existing ? Object.assign({}, student) : null;
    if (ns) delete ns.existing;
    const sid = await saveRawEntry({caps, safeWrite, story, entry: makeEntry(nt), title: name + "'s story", whenText: asStr(when), newStudent: ns, studentId: student ? student.id : null, studentName: name, followupId, backlogId, studentInfo});
    setBusy(null);
    if (sid) { lsDel(draftKey); showToast('Interview saved'); nav('story', {id: sid}); }
  }
  function startOver(){ lsDel(draftKey); setClips([]); setStep(mode === 'update' ? 'interview' : 'name'); setTurns([]); setAnswer(''); setPhase('asking'); setErr(''); setTarget(mode === 'update' ? 3 : 5); setStudent(null); setFirst(''); setPick(''); setNote(''); setWhen(''); setGender(''); setSchool(''); setDemo(''); setNotes(null);
    setCurrent(mode === 'update' ? {q: params.prompt || UPDATE_OPENING_Q(name), kind: 'opening'} : null); }
  const back = () => story ? nav('story', {id: story.id}) : nav('home');

  if (readOnly) return html`<div className="view"><${FocusHeader} title="Record a Story" onBack=${() => nav('home')} /><p className="notice">You have view-only access to this journal. Ask the person who shared it for Editor access to record stories.</p></div>`;
  if (storyId && !story) return html`<div className="view"><${FocusHeader} title="Add Story Update" onBack=${() => nav('library')} />${storiesLoaded ? html`<p className="notice">This story isn't in the journal anymore.</p>` : html`<div className="skeleton"></div>`}</div>`;

  /* step 1: first name */
  if (step === 'name') {
    const fn = asStr(first);
    const needPick = matches.length > 0 && !pick;
    return html`<div className="view interview">
      <${FocusHeader} title="New Story" sub="Step 1 of 3: Student information" onBack=${backlogId ? () => nav('backlog') : back} />
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
      <p className="small muted">Recording a program or mural instead? <button className="btn btn-quiet btn-sm" onClick=${() => nav('record')}>Record a program or mural story</button></p>
    </div>`;
  }

  /* analysis running */
  if (busy === 'analyze') return html`<div className="view"><${FocusHeader} title=${'Interview: ' + name} onBack=${() => aCtl.current && aCtl.current.abort()} /><${Analyzing} title=${'Claude is writing ' + name + "'s story"} onStop=${() => aCtl.current && aCtl.current.abort()} /></div>`;

  const answeredCount = turns.filter(t => t.status === 'answered').length;
  const stageLabel = !current ? '' : current.kind === 'opening' ? (mode === 'update' ? 'Story update' : 'Opening story') : current.kind === 'closing' ? 'Closing question' : 'Follow-up ' + (asked + 1) + ' of about ' + Math.max(target, asked + 1);
  return html`<div className="view interview">
    <${FocusHeader} title=${(mode === 'update' ? 'Story update: ' : 'Interview: ') + name} sub=${mode === 'update' ? story.title : 'Step 2 of 3: Interview'} onBack=${back} />
    ${restored ? html`<p className="small muted">Restored your unsaved interview from this device. <button className="btn btn-quiet btn-sm" onClick=${startOver}>Start over</button></p>` : null}
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
      <p className="muted">${answeredCount} answers recorded. Claude turns them into ${name}'s Student Impact Report, which you review before anything is saved.</p>
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
      ${current ? html`<${DictationBox} id="iv-answer" value=${answer} onChange=${setAnswer} compact=${current.kind !== 'opening'} label=${current.q} onAudio=${c => setClips(x => x.concat([c]))} onBusy=${setRecBusy} placeholder=${current.kind === 'opening' ? 'Press Record and take your time: background, challenges, how they found ABG, and what has happened since. Or type here.' : 'Press Record to answer, type here, or skip this one.'} />
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
  const p = Object.assign({minor: 'unknown', identifying: 'unknown', permission: 'unknown', external: 'unknown', redact: 'unknown', sensitive: 'unknown', sensitiveConsent: 'unknown'}, value.privacy || {});
  const [pending, setPending] = useState(false);
  const [tick, setTick] = useState(false);
  const [pub, setPub] = useState(value.publicName || '');
  useEffect(() => { if (live) setPub(value.publicName || ''); }, [value.publicName]);
  const pubInput = html`<${Field} label="Public alias" hint=${'Used in external materials instead of ' + (value.alias ? value.alias : 'the first name') + '. The first name appears externally only when publication permission is documented. Leave blank to say "a student".'}>
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
      <select className="select select-sm" aria-label="Verification status" title="Verification status" value=${ev.status} onChange=${e => onChange({status: e.target.value})}>${EVIDENCE_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</select>
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
    </div>
    <div className="row">
      <${Field} label="Before"><input className="input" placeholder="Unknown" value=${ev.before || ''} onChange=${e => onChange({before: e.target.value})} /><//>
      <${Field} label="After"><input className="input" placeholder="Unknown" value=${ev.after || ''} onChange=${e => onChange({after: e.target.value})} /><//>
      <${Field} label="Period compared"><input className="input" placeholder="e.g. 2024 to 2025" value=${ev.timeframe || ''} onChange=${e => onChange({timeframe: e.target.value})} /><//>
    </div>` : null}
    <div className="row">
      <${Field} label="Observed or reported by"><select className="select" value=${ev.observer || ''} onChange=${e => onChange({observer: e.target.value})}><option value="">Not recorded</option>${OBSERVERS.map(o => html`<option key=${o.id} value=${o.id}>${o.label}</option>`)}</select><//>
      <${Field} label="Source" hint="How it's known"><input className="input" placeholder="e.g. Kyle observed directly; teacher told Kyle" value=${ev.basis || ''} onChange=${e => onChange({basis: e.target.value})} /><//>
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
  const trash = (label, fn) => html`<button type="button" className="icon-btn" aria-label=${label} onClick=${() => upd(fn)}><${Icon} name="trash" size=${18} /></button>`;

  return html`<div className="editor">
    ${hasTr ? html`<${Sec} title=${items.length > 1 ? 'Original entries' : 'Interview transcript'} count=${words(items.map(i => i.text).join(' ')) + ' words'} refEl=${trRef}>
      ${items.map(it => html`<div className="tr-block" key=${it.id}>${items.length > 1 ? html`<p className="eyebrow">Recorded ${fmtDate(it.recordedAt)}</p>` : null}<${TranscriptText} text=${it.text} highlight=${hl} /></div>`)}
      <p className="small muted">The original transcript is kept exactly as recorded. You can correct it later from the story page, and the original stays on file.</p>
    <//>` : null}

    <${Sec} title="Student success story" open=${true}>
      <${Field} label="Title"><input id="ed-title" className="input" value=${draft.title} onChange=${val((n, v) => { n.title = v; })} /><//>
      <${Field} label=${'Full impact story (' + words(draft.story) + ' words)'} hint="Aim for 200 to 350 words."><textarea id="ed-story" className="textarea" rows="14" value=${draft.story || ''} onChange=${val((n, v) => { n.story = v; })}></textarea><//>
      <${Field} label="Short summary" hint="Shown on library cards."><textarea id="ed-summary" className="textarea" rows="3" value=${draft.summary} onChange=${val((n, v) => { n.summary = v; })}></textarea><//>
      <div className="field"><span className="field-label">Key impact takeaways</span>
        ${(draft.takeaways || []).map((t, i) => html`<div className="list-row" key=${i}><input className="input" aria-label=${'Takeaway ' + (i + 1)} value=${t} onChange=${val((n, v) => { n.takeaways[i] = v; })} />${trash('Remove takeaway', n => { n.takeaways.splice(i, 1); })}</div>`)}
        ${(draft.takeaways || []).length < 5 ? addBtn('Add takeaway', n => { n.takeaways = (n.takeaways || []).concat(['']); }) : null}
      </div>
    <//>

    <${Sec} title="Student overview" open=${true}>
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
    <//>

    <${Sec} title="Measurable outcomes" count=${(draft.evidence || []).filter(isMeasurable).length + ' items'} open=${true}>
      <p className="small muted">Specific metrics and before-and-after comparisons. ${STATUS_LEGEND} Mark something Verified only after checking it against a record.</p>
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

    <${Sec} title="Stakeholder value" open=${true}>
      <p className="small muted">Why this student's experience matters, without overstating that ABG caused it.</p>
      ${[['schools', 'School administrators', 'How does ABG benefit students at our school?'], ['donors', 'Donors', 'What difference is our contribution making?'], ['grants', 'Grant providers', 'Can ABG demonstrate outcomes that justify continued funding?']].map(([k, l, q]) => html`<${Field} key=${k} label=${l} hint=${q}><textarea className="textarea" rows="2" value=${(draft.stakeholderValue || {})[k] || ''} onChange=${val((n, v) => { n.stakeholderValue = Object.assign({}, n.stakeholderValue, {[k]: v}); })}></textarea><//>`)}
      <${Field} label="Summary" hint="Two or three sentences connecting the outcomes to all three audiences."><textarea id="ed-why" className="textarea" rows="3" value=${draft.stakeholderWhy || ''} onChange=${val((n, v) => { n.stakeholderWhy = v; })}></textarea><//>
      <div className="field"><span className="field-label">Most useful for</span><${ChipGroup} options=${AUDIENCES} value=${draft.audiences} label="Most useful for" onChange=${v => upd(n => { n.audiences = v; })} /></div>
      <div className="field"><span className="field-label">Impact categories</span><${ChipGroup} options=${CATEGORIES} value=${draft.categories} label="Impact categories" onChange=${v => upd(n => { n.categories = v; })} /></div>
      <div className="field"><span className="field-label">Impact themes</span><${ChipGroup} options=${THEMES} value=${draft.themes} label="Impact themes" onChange=${v => upd(n => { n.themes = v; })} /></div>
    <//>

    <${Sec} title="Student impact timeline" count=${(draft.milestones || []).length}>
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
function ReviewView({params}){
  const {caps, stories, students, nav, safeWrite, showToast} = useApp();
  const {mode, storyId, analysis, entry, items, draftKey, whenHint, approx, followupId, answered, analyzedEntryIds, returnTo, studentId, studentName, newStudent, backlogId, studentInfo} = params;
  const base = storyId ? stories.find(s => s.id === storyId) : null;
  const me = caps.me || {};
  const [draft, setDraft] = useState(() => buildReviewDraft({mode, base, analysis, whenHint, approx, me, followupId, answered, entry, studentId, studentName, studentInfo}));
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
    if (ok) { if (draftKey) lsDel(draftKey); showToast(mode === 'edit' ? 'Changes saved' : 'Story saved'); nav('story', {id: s.id}); }
  }
  const title = mode === 'edit' ? 'Edit story' : mode === 'update' ? 'Review the update' : 'Student Impact Report';
  return html`<div className="view review">
    <${FocusHeader} title=${title} sub=${mode === 'update' && base ? base.title : mode === 'new' ? 'Step 3 of 3' + (draft.alias ? ': ' + draft.alias : '') : (draft.alias || null)} onBack=${back} />
    ${mode !== 'edit' ? html`<p className="review-note"><${Icon} name="spark" size=${16} /><span>Claude drafted this from your words. Nothing is saved until you press Save, and nothing is approved for outside use until you approve it.${mode === 'update' ? ' New items are marked with an orange edge.' : ''}</span></p>` : null}
    <${StoryEditor} draft=${draft} setDraft=${setDraft} items=${items || []} mode=${mode} />
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
  const {caps, stories, safeWrite, showToast} = useApp();
  const story = stories.find(s => s.id === storyId);
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
  const {caps, stories, safeWrite, showToast} = useApp();
  const story = stories.find(s => s.id === storyId);
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
  const {caps, stories, safeWrite, showToast} = useApp();
  const numeric = kind !== 'qualitative';
  const [f, setF] = useState({statement: '', category: numeric ? 'reach' : 'personal', value: '', unit: '', before: '', after: '', timeframe: '', observer: 'abg_staff', status: numeric ? 'reported' : 'qualitative', note: '', metric: '', domain: numeric ? 'attendance' : 'confidence', direction: 'improved'});
  const set = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
  async function save(){
    const story = stories.find(s => s.id === storyId);
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
  const {caps, stories, safeWrite, showToast} = useApp();
  const [q, setQ] = useState('');
  const [due, setDue] = useState('');
  async function save(){
    const story = stories.find(s => s.id === storyId);
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
    <p className="small muted">${ev.observer ? 'Observed by: ' + labelOf(OBSERVERS, ev.observer) + ' · ' : ''}Source: ${ev.basis || (src.note ? src.note : (src.excerpt ? "Kyle's account" : 'not recorded'))}</p>
    ${src.excerpt ? html`<button type="button" className="btn btn-quiet btn-sm src-toggle" aria-expanded=${open} onClick=${() => setOpen(o => !o)}>${open ? 'Hide passage' : 'Show passage'}</button>` : null}
    ${open ? html`<div className=${'excerpt' + (!src.found ? ' missing' : '')}>
      <span>“${src.excerpt}”</span>
      ${entry ? html`<span className="small"> From the entry recorded ${fmtDate(entry.recordedAt)}.</span>` : null}
      ${!src.found ? html`<span className="warn-note"> Not found word for word in the transcript.</span>` : null}
    </div>` : null}
  </div>`;
}
function Timeline({milestones}){
  if (!milestones.length) return html`<p className="empty-note">No milestones yet. Add a story update when you learn what happened next.</p>`;
  return html`<ol className="timeline">${milestones.map(m => { const pending = m.phase === 'future' || !m.confirmed; return html`<li key=${m.id} className=${'tl-item phase-' + m.phase + (pending ? ' pending' : '')}>
    <span className="tl-swatch" aria-hidden="true"></span>
    <p className="eyebrow">${labelOf(PHASES, m.phase)} · ${fmtEventDate(m.date) || 'Date unknown'}</p>
    <p>${m.label}</p>
    ${pending ? html`<p className="small muted">${m.phase === 'future' ? 'Pending. Not a documented outcome yet.' : 'Unconfirmed'}</p>` : null}
  </li>`; })}</ol>`;
}
function MaterialSheet({storyId, close}){
  const {caps, stories, safeWrite, showToast} = useApp();
  const [type, setType] = useState('photo');
  const [desc, setDesc] = useState('');
  async function save(){
    const story = stories.find(s => s.id === storyId);
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
  const {caps, stories, students, storiesLoaded, nav, openSheet, safeWrite, showToast, readOnly} = useApp();
  const story = stories.find(s => s.id === id);
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
  const updateTarget = (story.studentId || story.alias) ? 'interview' : 'record';
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
  function exportStory(){ saveFile(caps, showToast, 'abg-story-' + slug(story.title) + '.md', storyMarkdown(story, entries || [])); }
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
    <header className="story-head">
      <div className="chips">
        <${StatusPill} status=${story.status} />
        ${story.period === 'past' ? html`<${Pill} tone="orange">Historical<//>` : null}
        ${updates > 0 ? html`<${Pill} tone="blue">${updates} update${updates > 1 ? 's' : ''}<//>` : null}
        ${yearSpan(story) >= 1 ? html`<${Pill} tone="teal">${yearRange(story)}<//>` : null}
      </div>
      ${story.alias ? html`<p className="eyebrow">${story.alias}${student && student.note ? ' · ' + student.note : ''}</p>` : null}
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

    <section className="card">
      <h2>Student overview</h2>
      <dl className="overview">${overviewRows.map(r => html`<div key=${r[0]}><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`)}</dl>
      ${siblings.length ? html`<p className="small muted">Other stories about this student: ${siblings.map((s, i) => html`<button key=${s.id} className="btn btn-quiet btn-sm" onClick=${() => nav('story', {id: s.id})}>${s.title}</button>`)}</p>` : null}
    </section>

    <section className="card prose">
      <h2>Student success story</h2>
      ${story.story ? story.story.split(/\n{2,}/).map((p, i) => html`<p key=${i}>${p}</p>`) : story.summary ? html`<p>${story.summary}</p>` : html`<p className="muted">No story written yet.</p>`}
      ${(story.takeaways || []).length > 0 ? html`<h3>Key impact takeaways</h3><ul className="takeaways">${story.takeaways.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul>` : null}
      ${(story.themes || []).length > 0 ? html`<div className="chips">${story.themes.map(c => html`<span key=${c} className="chip static">${labelOf(THEMES, c)}</span>`)}</div>` : null}
    </section>

    <section className="card">
      <div className="sec-head"><h2>Measurable outcomes</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${AddEvidenceSheet} storyId=${id} close=${close} kind="numeric" />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      ${milestoneItems.length ? html`<div className="ev-group"><div className="ev-group-head"><h3>Key milestones</h3><span className="count">${milestoneItems.length}</span></div>
        <ul className="ms-list">${milestoneItems.map(x => html`<li key=${x.key}><span className="ms-check" aria-hidden="true">✓</span><span><strong>${x.label}</strong>${x.detail ? html` <span className="muted">· ${x.detail}</span>` : null}</span>${x.e ? html`<${EvLabel} e=${x.e} />` : html`<${MetricPill} status=${x.status} />`}</li>`)}</ul>
      </div>` : null}
      ${comparisons.length ? html`<${OutcomeTable} rows=${comparisons.map(r => r.e)} />` : html`<p className="empty-note small">No before-and-after comparisons yet, such as how the student acted when they started versus now, or a change a teacher mentioned.</p>`}
      ${isStudentStory(story) ? html`<${MetricsCardView} story=${story} readOnly=${readOnly} embedded=${true} onEdit=${editStory} />` : null}
    </section>

    <section className="card">
      <div className="sec-head"><h2>Supporting evidence</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${AddEvidenceSheet} storyId=${id} close=${close} kind="qualitative" />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      <p className="small muted">Every outcome is labeled by source: Staff-reported (Kyle saw it), Teacher/parent-reported, Student-reported, Estimated, or Unverified. Documented / verified is only for items later confirmed against records.</p>
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
      <h2>Stakeholder value</h2>
      ${['schools', 'donors', 'grants'].some(k => (story.stakeholderValue || {})[k]) ? html`<dl className="sv-list">
        ${[['schools', 'School administrators'], ['donors', 'Donors'], ['grants', 'Grant providers']].map(([k, l]) => (story.stakeholderValue || {})[k] ? html`<div key=${k}><dt>${l}</dt><dd>${story.stakeholderValue[k]}</dd></div>` : null)}
      </dl>` : null}
      ${story.stakeholderWhy ? html`<p>${story.stakeholderWhy}</p>` : (!['schools', 'donors', 'grants'].some(k => (story.stakeholderValue || {})[k]) ? html`<p className="muted">Not written yet.</p>` : null)}
      ${primaryAud.length ? html`<p className="small"><strong>Most useful for:</strong> ${primaryAud.map(a => labelOf(AUDIENCES, a)).join(', ')}</p>` : null}
      ${!readOnly ? html`<div><button className="btn btn-ghost btn-sm" onClick=${adapt}><${Icon} name="spark" size=${16} /> Adapt story for audience</button></div>` : null}
    </section>

    <section className="card">
      <h2>Student impact timeline</h2>
      <${Timeline} milestones=${ms} />
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

    <section className="card">
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
    </section>

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
function MetricsCardEdit({metrics, onChange}){
  const m = metrics || {};
  const set = (id, patch) => {
    const cur = Object.assign({value: '', status: 'reported'}, m[id] || {});
    const nx = Object.assign({}, cur, patch); delete nx._new;
    const out = Object.assign({}, m);
    if (!String(nx.value == null ? '' : nx.value).trim()) delete out[id]; else out[id] = nx;
    onChange(out);
  };
  return html`<div className="mc-edit">${METRIC_FIELDS.map(f => {
    const x = m[f.id] || {}; const v = x.value == null ? '' : String(x.value);
    return html`<div className=${'mc-row' + (x._new ? ' is-new' : '')} key=${f.id}>
      <label className="mc-label" htmlFor=${'mc-' + f.id}>${f.label}</label>
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
function MilestonesSection(){
  const {stories, storiesLoaded} = useApp();
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
  const {stories, storiesLoaded} = useApp();
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
  const {stories, nav, storiesLoaded} = useApp();
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
      const hay = norm([s.title, s.summary, s.story, s.alias, s.program, s.community, fmtEventDate(s.eventDate)].concat(s.takeaways || [], (s.themes || []).map(t => labelOf(THEMES, t)), (s.categories || []).map(c => labelOf(CATEGORIES, c)), (s.evidence || []).map(e => e.statement)).join(' '));
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
    <div className="row">${sel('fl-status', 'Status', 'status', STATUSES.map(s => [s.id, s.label]))}${sel('fl-period', 'Historical or recent', 'period', [['past', 'Historical'], ['recent', 'Recent'], ['ongoing', 'Ongoing (has updates)']])}</div>
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
  const {caps, stories, students, storiesLoaded, settings, nav, openSheet, readOnly} = useApp();
  const [q, setQ] = useState('');
  const [f, setF] = useState(() => { try { return JSON.parse(lsGet('abg-lib-f') || '{}') || {}; } catch (e) { return {}; } });
  const [sort, setSort] = useState(() => lsGet('abg-lib-sort') || 'recorded');
  const [ai, setAi] = useState(null);
  const ctlRef = useRef(null);
  useEffect(() => { lsSet('abg-lib-f', JSON.stringify(f)); }, [f]);
  useEffect(() => { lsSet('abg-lib-sort', sort); }, [sort]);
  useEffect(() => () => { if (ctlRef.current) ctlRef.current.abort(); }, []);
  const programs = uniq((settings.programs || []).concat(stories.map(s => s.program)));
  const communities = uniq((settings.communities || []).concat(stories.map(s => s.community)));
  const list = useMemo(() => sortStories(applyFilters(stories, f, q), sort), [stories, f, q, sort]);
  const active = Object.keys(f).filter(k => f[k]).length;
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
    ${embedded ? null : html`<header className="page-head"><h1>Story Library</h1><p className="muted">${stories.length} ${stories.length === 1 ? 'story' : 'stories'} from every period of ABG's work.</p></header>`}
    <form className="search" role="search" onSubmit=${e => { e.preventDefault(); ask(); }}>
      <div className="search-box"><${Icon} name="search" size=${18} /><input id="lib-search" className="search-input" type="search" aria-label="Search stories" placeholder="Search, or ask: students whose attendance improved" value=${q} onChange=${e => { setQ(e.target.value); if (ai) setAi(null); }} /></div>
      ${caps.sample ? html`<button type="submit" className="btn btn-ghost" disabled=${!asStr(q) || !stories.length}><${Icon} name="spark" size=${18} /> Ask Claude</button>` : null}
    </form>
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
  const {stories, metrics, nav, openSheet, readOnly, storiesLoaded} = useApp();
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
function ReportsView({embedded}){
  const {caps, stories, students, metrics, showToast} = useApp();
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
    <section className="card">
      <h2>Generate Impact Report</h2>
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
        ${row('Stories (CSV)', 'Every story with status, dates, program, themes, audiences, and privacy fields. Internal.', dlBtn(() => dl('abg-stories.csv', storiesCSV(stories))))}
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
function SettingsView(){
  const {caps, settings, safeWrite, readOnly, updateMe} = useApp();
  const me = caps.me || {};
  const save = patch => safeWrite(() => caps.db.doc('config/settings').set(Object.assign({programs: settings.programs || [], communities: settings.communities || []}, patch, {updatedAt: nowISO()})));
  const access = readOnly ? 'View only' : (me.canEdit ? 'Editor' : 'Contributor');
  const [pName, setPName] = useState(me.name || '');
  const [pRole, setPRole] = useState(me.role || '');
  const [pSaved, setPSaved] = useState(false);
  async function saveProfile(){ const ok = await safeWrite(() => caps.db.doc('members/' + me.id).update({name: asStr(pName), role: asStr(pRole)})); if (ok) { updateMe({name: asStr(pName), role: asStr(pRole)}); setPSaved(true); setTimeout(() => setPSaved(false), 2000); } }
  const [voiceOn, setVoiceOn] = useState(() => lsGet('abg-voice') !== 'off');
  const setVoice = on => { setVoiceOn(on); lsSet('abg-voice', on ? 'on' : 'off'); if (!on) VOICE.stop(); };
  const [engine, setEngine] = useState(() => lsGet('abg-voice-engine') === 'device' ? 'device' : 'natural');
  const [vname, setVname] = useState(naturalVoiceName);
  const [sampleNote, setSampleNote] = useState('');
  const chooseEngine = e => { setEngine(e); lsSet('abg-voice-engine', e); setSampleNote(''); };
  const chooseName = n => { setVname(n); lsSet('abg-voice-name', n); setSampleNote(''); };
  async function sample(){
    setSampleNote('');
    const used = await VOICE.say("Hi Kyle. Can you walk me through how you first met this student, and what stood out to you?");
    if (engine === 'natural' && used === 'device') setSampleNote(VOICE.naturalState() === 'off' ? "The natural voice isn't set up yet, so this device's voice was used." : VOICE.naturalState() === 'limited' ? "The natural voice reached Groq's free daily limit, so this device's voice is being used for now. It frees up again within a day." : "The natural voice couldn't be reached just now, so this device's voice was used.");
    else if (used === 'blocked') setSampleNote('Tap the button again to hear it.');
  }
  return html`<div className="view settings">
    <header className="page-head"><h1>Settings</h1><p className="muted">Lists that make filling in stories faster, plus how privacy works here.</p></header>
    <${ListEditor} id="set-programs" title="Programs and projects" hint="Offered as suggestions on every story, and used as Story Library filters." items=${settings.programs || []} disabled=${readOnly} placeholder="e.g. School mural program" onChange=${v => save({programs: v})} />
    <${ListEditor} id="set-communities" title="Schools and communities" hint="Partner schools, neighborhoods, and community organizations." items=${settings.communities || []} disabled=${readOnly} placeholder="e.g. a partner school or neighborhood" onChange=${v => save({communities: v})} />
    <section className="card">
      <h2>Your profile</h2>
      <p className="small muted">Shown in the sidebar. The greeting uses your first name.</p>
      <div className="row">
        <${Field} label="Your name"><input id="set-name" className="input" value=${pName} onChange=${e => setPName(e.target.value)} placeholder="e.g. Kyle Martinez" /><//>
        <${Field} label="Role"><input id="set-role" className="input" value=${pRole} onChange=${e => setPRole(e.target.value)} placeholder="e.g. Program Director" /><//>
      </div>
      <div className="row-btns"><button className="btn btn-primary btn-sm" disabled=${!asStr(pName)} onClick=${saveProfile}>${pSaved ? 'Saved' : 'Save profile'}</button></div>
    </section>
    <section className="card">
      <h2>Interview voice</h2>
      ${VOICE.supported ? html`<label className="check voice-setting"><input id="set-voice" type="checkbox" checked=${voiceOn} onChange=${e => setVoice(e.target.checked)} /> <span><strong>Read interview questions aloud</strong><br /><span className="small muted">A voice asks each question as it appears, so the interview feels like a conversation. Only the question is read, and the voice stops when you press Record. These settings are saved on this device.</span></span></label>
        ${voiceOn ? html`<div className="field"><span className="field-label">Voice</span>
          <div className="pick-list">
            <label className=${'pick' + (engine === 'natural' ? ' on' : '')}><input type="radio" name="set-engine" checked=${engine === 'natural'} onChange=${() => chooseEngine('natural')} /><span><strong>Natural voice</strong> (Groq)<br /><span className="small muted">Sounds like a real person. Takes a moment to load each question. Only the question text is sent to Groq to be spoken.</span></span></label>
            <label className=${'pick' + (engine === 'device' ? ' on' : '')}><input type="radio" name="set-engine" checked=${engine === 'device'} onChange=${() => chooseEngine('device')} /><span><strong>This device's voice</strong><br /><span className="small muted">Instant and works offline. Sounds more robotic on some devices.</span></span></label>
          </div></div>
          ${engine === 'natural' ? html`<${Field} label="Natural voice"><select id="set-voice-name" className="select" value=${vname} onChange=${e => chooseName(e.target.value)}>${NATURAL_VOICES.map(v => html`<option key=${v.id} value=${v.id}>${v.label}</option>`)}</select><//>` : null}
          <div className="row-btns"><button type="button" className="btn btn-ghost btn-sm" onClick=${sample}><${Icon} name="volume" size=${16} /> Hear a sample</button></div>
          ${sampleNote ? html`<p className="small warn-note">${sampleNote}</p>` : null}` : null}`
      : html`<p className="small muted">This browser can't read questions aloud.</p>`}
    </section>
    <section className="card">
      <h2>Privacy and AI</h2>
      <ul className="small" style=${{display: 'grid', gap: '8px'}}>
        <li>Students are recorded by first name or pseudonym only. The journal never asks for a last name. Students who share a first name get separate records.</li>
        <li>A first name with a school or event can still identify someone. External exports and audience versions use the first name only when publication permission is documented; otherwise they use the story's public alias or "a student".</li>
        <li>Only people invited to this app can sign in. Stories, transcripts, and recordings are stored privately in ABG's Supabase project.</li>
        <li>Recordings are sent to Groq to be transcribed. Story text is sent to Anthropic's Claude API to choose interview questions, write impact stories, find evidence, answer searches, and draft audience versions, </li>
        <li>AI summaries and drafts are never approved automatically. Only approved stories appear in external exports and reports.</li>
        <li>Original transcripts are never overwritten. Corrections are saved alongside them.</li>
        <li>Interview questions can be read aloud. With the natural voice, only the question text is sent to Groq to be spoken; with this device's voice, nothing is sent anywhere. Turn it on or off under Interview voice, or with the Voice button on each question.</li>
      </ul>
    </section>
    <section className="card">
      <h2>Quick start</h2>
      <p className="small">To open straight to a new interview, add <strong>#record</strong> to the end of this app's link and save it to your phone's home screen (Share, then Add to Home Screen on iPhone).</p>
    </section>
    <section className="card">
      <h2>Your account</h2>
      <p className="small">${window.__platform && window.__platform.email ? 'Signed in as ' + window.__platform.email + '.' : (me.name ? 'Signed in as ' + me.name + '.' : '')}</p>
      <p className="small muted">To add a team member, invite their email from the Supabase dashboard (Authentication, then Users, then Invite user).</p>
      ${window.__platform ? html`<div><button className="btn btn-ghost btn-sm" onClick=${() => window.__platform.signOut()}>Sign out</button></div>` : null}
    </section>
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
  const ok = ['record', 'library', 'insights', 'followups', 'reports', 'backlog'];
  return {name: h === 'record' ? 'interview' : (ok.includes(h) ? h : 'home'), params: {}, key: 1};
}
function App(){
  const [caps, setCaps] = useState({status: 'loading'});
  const [stories, setStories] = useState([]);
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [metrics, setMetrics] = useState([]);
  const [students, setStudents] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [backlogLoaded, setBacklogLoaded] = useState(false);
  const [settings, setSettings] = useState({programs: [], communities: []});
  const [route, setRoute] = useState(initialRoute);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [readOnly, setReadOnly] = useState(false);

  const showToast = useCallback(msg => setToast({msg, k: Date.now()}), []);
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
    const u3 = db.doc('config/settings').onSnapshot(snap => { const d = snap.exists ? (snap.data() || {}) : {}; setSettings({programs: asArr(d.programs), communities: asArr(d.communities)}); }, () => {});
    const u5 = db.collection('backlog').onSnapshot(snap => { setBacklog(snap.docs.map(d => Object.assign({id: d.id}, d.data()))); setBacklogLoaded(true); }, () => setBacklogLoaded(true));
    return () => { u1(); u2(); u3(); u4(); u5(); };
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

  const updateMe = useCallback(patch => setCaps(c => Object.assign({}, c, {me: Object.assign({}, c.me, patch)})), []);
  const ctx = {caps, updateMe, stories, students, backlog, backlogLoaded, storiesLoaded, metrics, settings, route, nav, openSheet, closeSheet, showToast, safeWrite, readOnly};
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
