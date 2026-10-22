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
  {id:'qualitative', label:'Observation', tone:'teal'},
  {id:'unverified', label:'Unverified', tone:'bad'},
  {id:'future', label:'Not yet documented', tone:'outline'},
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
const QUESTION_BANK = `A. Background and context (only what helps explain ABG's impact): where they grew up; approximate age when they started; school or community; whether the school is Title I or under-resourced; challenges or barriers before ABG; art opportunities available beforehand; how they found ABG; attitude toward art or school before joining.
B. ABG's involvement: which program or project; how long; how often they attended; activities; how they first responded; a memorable interaction or turning point; what ABG offered they otherwise wouldn't have had; challenges during the program and how they responded.
C. Development and personal impact: changes in confidence or self-expression; willingness to participate or engage with others; behavior or attitude; new artistic, communication or leadership skills; relationships with students, artists or mentors; the moment Kyle realized it made a difference; changes teachers or family reported outside ABG; the most meaningful outcome.
D. Quantifiable impact: whether school attendance changed; attendance before and after; classroom participation; documented changes in grades or behavior; how many students in the program; how many workshops or sessions; program length; continuing voluntarily beyond the program; completed projects or artworks; surveys, attendance records, teacher evaluations or feedback collected; approximate numbers that could be verified later; outcomes ABG can't currently measure.
E. Long-term impact: what happened after; continued art or creative interests; influence on later education or opportunities; ongoing relationship with ABG; returning as volunteer, mentor or participant; updates from teachers, family or the student; lasting influence; developments worth following up on.
F. Community and stakeholder impact: impact beyond the student; classmates, teachers, families or community involved; encouraging others to join arts programming; lasting public artwork such as a mural; volunteers, schools, businesses or organizations involved; what resources or funding made it possible; what the story shows about investing in ABG; what more ABG could do with more resources.
G. Supporting evidence: photos, artwork or video; teacher testimonials or feedback; attendance records or program documents; whether Kyle observed it directly or someone else reported it; a memorable quote; details or numbers still to verify; whether permission to share publicly is documented.`;
const METRIC_SUGGESTIONS = ['Students served','Schools reached','Workshops completed','Murals or projects completed','Volunteer hours','Volunteers','Families attending events','Program sessions held'];

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
function titleFromText(t){ const w = String(t || '').trim().split(/\s+/).slice(0, 8).join(' '); return w ? w + '…' : 'Untitled story'; }

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
    missingMetrics: [], materials: [], stakeholderWhy: '', period: 'recent', eventDate: {text: '', iso: '', approximate: false}, program: '', community: '',
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

function interviewPrompt({name, turns, mode, story, asked, target}){
  const convo = turns.map(t => 'Q (' + t.kind + '): ' + t.q + '\nA: ' + (t.status === 'skipped' ? '[Kyle skipped this question]' : t.a)).join('\n\n');
  const existing = story ? {summary: story.summary, timeline: (story.milestones || []).map(m => (fmtEventDate(m.date) || 'undated') + ': ' + m.label), missingMetrics: (story.missingMetrics || []).map(m => m.metric)} : null;
  return `${ABG_CONTEXT}

You are a thoughtful interviewer helping Kyle tell the story of a student named ${name}. Story first, evidence second, stakeholder value third.
${mode === 'update' ? 'This is an UPDATE interview about a story already in the journal. Focus on what is new since it was recorded. Existing record: ' + JSON.stringify(existing) : ''}

Choose the single best NEXT follow-up question.

How to choose:
- Move through these stages in order, going on once a stage is reasonably covered: narrative (missing story details, what helped, a turning point), outcomes (what specifically changed, for things Kyle mentioned), metrics (attendance, participation, program size, records that could verify a claim), long_term (what happened later), evidence (materials, who observed it, permission to share).
- Build on something specific Kyle said, and refer to it, e.g. "You mentioned ${name} was hesitant at first. What helped?"
- Never ask about something already answered, and never re-ask a skipped question.
- Don't lead with assumed positive outcomes. Don't assume school attendance improved because program participation did. Allow uncertainty, and don't press for numbers he doesn't know.
- Ask only for background that helps explain ABG's impact. Never ask for a last name, address, or other identifying details.
- When choosing metric questions, think about who the story could serve: schools (attendance, classroom engagement, confidence, communication, retention, access to arts), donors (students served, reach, outcomes, continued participation, what support made possible), corporate partners (volunteer involvement and hours, completed projects), community groups (youth and family engagement, murals, partnerships), artists and volunteers (collaboration, artistic development).
- Use ${name}'s first name naturally. Warm and conversational, not formal. One question, under 35 words, no preamble or praise.

Question bank to draw from (adapt to the conversation, never read it verbatim):
${QUESTION_BANK}

Follow-up questions asked so far: ${asked}. Aim for about ${target}. Set "enough" to true when the story, its outcomes and its supporting evidence are covered well enough to write a strong impact story.

Conversation so far:
${convo}

Reply with only JSON: {"question": "the question", "category": "A, B, C, D, E, F or G", "stage": "narrative | outcomes | metrics | long_term | evidence", "why": "a few words on what this adds", "enough": false}`;
}

const ANALYSIS_SHAPE = `{
  "title": "4 to 8 word title in sentence case, e.g. From hesitant painter to mural lead",
  "summary": "2 or 3 sentences for library cards",
  "story": "the full impact story, 200 to 350 words: the student's background, initial challenges or circumstances, introduction to ABG, important experiences, a meaningful moment or turning point, observable outcomes, and long-term developments if known. Warm, engaging and authentic, for a nonprofit impact report. No generic praise, exaggeration or unsupported claims. Leave out any part the interview didn't cover.",
  "entrySummary": "1 or 2 sentences on what this specific interview adds",
  "alias": "the student's first name as given, or null",
  "overview": {"ageOrGrade": "approximate age or grade when involved, or null", "background": "1 or 2 sentences of background relevant to ABG's impact, or null", "involvementDate": "when they were involved with ABG, in Kyle's words, or null"},
  "isMinor": "yes | no | unknown",
  "period": "past (months or years ago) | recent",
  "eventDate": {"text": "when the original experience happened, in Kyle's words, or null", "iso": "YYYY, YYYY-MM or YYYY-MM-DD, or null", "approximate": true},
  "program": "ABG program or project, or null",
  "community": "school or community, or null",
  "takeaways": ["3 to 5 takeaways drawn from what Kyle actually said"],
  "structure": {"character": "text or null", "circumstances": "text or null", "involvement": "text or null", "events": "text or null", "outcomes": "text or null", "longTerm": "text or null"},
  "categories": ["category ids"],
  "themes": ["theme ids"],
  "stakeholders": {"primary": ["up to 3 audience ids, most relevant first"], "why": "1 or 2 sentences on why this story matters to them"},
  "evidence": [{"category": "category id", "kind": "qualitative | numeric", "statement": "what the evidence shows", "value": null, "unit": "students, sessions, hours... or null", "status": "reported | estimate | qualitative | unverified | future", "basis": "who observed or reported it, e.g. Kyle observed directly; teacher report relayed by Kyle; program records Kyle mentioned", "excerpt": "short passage copied word for word from the interview"}],
  "missingMetrics": [{"metric": "information that would strengthen the story but isn't available yet", "why": "how it would help", "howToGet": "where it might come from"}],
  "quotes": [{"text": "the words", "speaker": "first name or role, or Narrator", "kind": "exact | remembered | paraphrase"}],
  "milestones": [{"date": {"text": "when, or null", "iso": "YYYY or YYYY-MM, or null"}, "label": "what happened", "phase": "circumstances | involvement | immediate | short_term | long_term | future", "confirmed": true}],
  "materials": [{"type": "photo | artwork | video | testimonial | record | survey | other", "description": "what exists and where, as Kyle described it"}],
  "recommendedFollowUps": ["up to 5 concrete actions, e.g. Verify attendance information with the school"],
  "followUpQuestions": ["up to 2 questions still open for Kyle, if any"],
  "possibleLinks": [{"storyId": "id from the other-stories list", "type": "link type id", "reason": "short reason"}],
  "containsIdentifying": false
}`;

function analysisPrompt({mode, story, items, others, whenHint, studentName}){
  const entriesText = items.map((it, i) => '--- Entry ' + (i + 1) + ' (recorded ' + (fmtDate(it.recordedAt) || 'today') + ') ---\n' + it.text).join('\n\n');
  const existing = story ? {
    title: story.title, story: story.story || story.summary, student: story.alias || null, overview: story.overview || {}, when: fmtEventDate(story.eventDate) || null,
    program: story.program || null, community: story.community || null,
    timeline: (story.milestones || []).map(m => ({when: fmtEventDate(m.date) || null, what: m.label, phase: m.phase})),
    evidence: (story.evidence || []).map(e => e.statement), missingMetrics: (story.missingMetrics || []).map(m => m.metric),
    questionsAlreadyAsked: (story.followUps || []).filter(f => f.kind === 'question').map(f => f.question),
  } : null;
  return [
    ABG_CONTEXT + " Kyle (or another ABG adult) narrated the journal " + (items.length > 1 ? 'entries' : 'entry') + " below, usually by voice dictation, often as interview answers (Q/A), so expect missing punctuation and small transcription slips. Turn it into a structured Student Impact Report. Today is " + todayLocal() + ".",
    studentName ? "The student's first name is " + studentName + ". Use only the first name." : '',
    mode === 'update' ? "This is an UPDATE to a story already in the journal. Treat the existing record as true context and keep its facts.\nEXISTING RECORD:\n" + JSON.stringify(existing) : '',
    whenHint ? "Kyle says the experience happened: " + whenHint : '',
    `RULES
- Story first, evidence second, stakeholder value third. Preserve the human element; don't reduce the story to statistics.
- Use only what the entries${mode === 'update' ? ' and existing record' : ''} say. Never invent names, numbers, dates, outcomes, percentages, survey results or quotes. Use null or an empty list when information isn't there.
- Never add a last name or other identifying details.
- Describe outcomes as observed or reported. Don't say ABG caused an outcome unless Kyle says so. Don't infer attendance changes from participation.
- Setbacks, challenges and unmet needs are valid evidence. Don't spin them positive.
- Don't treat a reported change (more confidence, for example) as a measured increase.
- Every evidence item needs "excerpt": a short passage copied word for word from the entries that supports it, and "basis": who observed or reported it.
- Evidence status: "reported" for numbers or facts Kyle states plainly; "estimate" for approximate numbers ("about", "around", "maybe"); "qualitative" for non-numeric observations; "unverified" for secondhand or uncertain claims; "future" for hoped-for or expected outcomes. Never use "verified": only ABG staff verify evidence, against records.
- Numeric evidence: put the number in "value" only when Kyle states it.
- missingMetrics: information that would make the story more credible for stakeholders but isn't documented yet (attendance records, program size, teacher feedback...). Only ones relevant to this story.
- Quotes: "exact" for words that appear word for word in the entries and were clearly said, including Kyle's own quotable statements (speaker "Narrator"); "remembered" when Kyle recalls what someone said; "paraphrase" for statements put in other words. Copy exact and remembered quotes exactly as they appear. Never create a quote.
- Milestones fill the student's timeline. Use phase "future" only for possible developments worth checking on, with confirmed false. Never present anticipated impact as accomplished.`,
    mode === 'update' ? `FOR THIS UPDATE: "story" and "summary" are the full updated versions combining the existing record with the new information. "takeaways" and "stakeholders" cover the whole story. "missingMetrics" is the complete current list. "evidence", "quotes", "milestones", "materials" and "recommendedFollowUps" contain ONLY new items from the new entries. In "structure", give updated text only for parts the new entries change and null for the rest. "eventDate" is when the new development happened.` : '',
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
    return { id: uid('ev'), category: pickEnum(e.category, CATEGORIES, 'engagement'), kind: (value != null || e.kind === 'numeric') ? 'numeric' : 'qualitative',
      statement: asStr(e.statement), value: value, unit: nul(e.unit), status: status, basis: nul(e.basis), source: {entryId: loc.entryId, excerpt: excerpt, found: loc.found, note: ''}, observed: '' };
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
    evidence, quotes, milestones, followUps, missingMetrics, materials, links,
    containsIdentifying: r.containsIdentifying === true,
  };
}

async function runAnalysis({sample, mode, story, stories, items, whenHint, studentName, signal}){
  const others = stories.filter(s => !story || s.id !== story.id)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 80)
    .map(s => ({id: s.id, title: s.title || null, student: s.alias || null, program: s.program || null, community: s.community || null, summary: trunc(s.summary, 220) || null}));
  const prompt = analysisPrompt({mode, story, items, others, whenHint, studentName: studentName || (story && story.alias) || ''});
  const raw = await sample.json(prompt, {modelTier: 'default', signal});
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
    evidence: (s.evidence || []).filter(e => e.status !== 'unverified').map(e => ({statement: e.statement, number: toNum(e.value), unit: e.unit || null, status: labelOf(EVIDENCE_STATUS, e.status), basis: e.basis || null})),
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
- ${name ? 'Refer to the student only as ' + name + '.' : 'Do not name the student; say "a student" or similar.'}${realName ? ' The record may mention the name ' + realName + ' elsewhere; never use it.' : ''} Leave out identifying details.
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
      evidence: (s.evidence || []).map(e => ({statement: e.statement, number: toNum(e.value), unit: e.unit || null, status: e.status, basis: e.basis || null})),
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
- Cite stories as [S1], [S2] after each claim drawn from them. Use only approvedQuotes, word for word, with the speaker.
- 700 to 1,000 words. Start with "# ABG Impact Report" and a one-line note that this is a draft for review.

Totals: ${JSON.stringify(totals)}
Theme counts (all stories): ${JSON.stringify(themeCounts)}
Approved stories relevant to each audience: ${JSON.stringify(audienceCounts)}
Documentation gaps (all stories): ${JSON.stringify(gaps)}
Verified program metrics: ${JSON.stringify(M)}
Approved stories: [${S.join(',')}]`;
}

/* ================= draft building ================= */
function newStoryFromAnalysis(a, opts){
  const s = blankStory(opts.me);
  Object.assign(s, {
    title: a.title || 'Untitled story', summary: a.summary, story: a.story, alias: opts.studentName || a.alias, studentId: opts.studentId || null,
    overview: a.overview, period: a.period,
    eventDate: {text: a.eventDate.text || opts.whenHint || '', iso: a.eventDate.iso, approximate: !!(opts.approx || a.eventDate.approximate)},
    program: a.program, community: a.community, categories: a.categories, themes: a.themes, audiences: a.audiences, stakeholderWhy: a.stakeholderWhy,
    takeaways: a.takeaways, structure: a.structure, evidence: a.evidence, missingMetrics: a.missingMetrics, quotes: a.quotes, milestones: a.milestones,
    materials: a.materials, followUps: a.followUps, analysis: {state: 'done', at: nowISO()},
  });
  s._suggest = a.links;
  s.privacy = {minor: a.isMinor, identifying: a.containsIdentifying ? 'yes' : 'unknown', permission: 'unknown', external: 'unknown', redact: a.containsIdentifying ? 'yes' : 'unknown'};
  return s;
}
function mergeUpdate(base, a){
  const d = Object.assign(blankStory({}), clone(base));
  d._suggest = a.links.filter(l => !(d.links || []).some(x => x.storyId === l.storyId));
  if (a.summary) d.summary = a.summary;
  if (a.story) d.story = a.story;
  if (a.takeaways.length) d.takeaways = a.takeaways;
  if (a.stakeholderWhy) d.stakeholderWhy = a.stakeholderWhy;
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
  const mark = x => Object.assign({}, x, {_new: true});
  if (a.missingMetrics.length) d.missingMetrics = a.missingMetrics.map(mark);
  d.evidence = (d.evidence || []).concat(a.evidence.map(mark));
  d.quotes = (d.quotes || []).concat(a.quotes.map(mark));
  d.milestones = (d.milestones || []).concat(a.milestones.map(mark));
  d.materials = (d.materials || []).concat(a.materials.map(mark));
  const seen = new Set((d.followUps || []).map(f => norm(f.question)));
  d.followUps = (d.followUps || []).concat(a.followUps.filter(f => !seen.has(norm(f.question))).map(mark));
  if (d.status === 'approved') { d.status = 'needs_verification'; d._wasApproved = true; }
  d.analysis = {state: 'done', at: nowISO()};
  return d;
}
function buildReviewDraft(p){
  const {mode, base, analysis, whenHint, approx, me, followupId, answered, entry, studentId, studentName} = p;
  if (mode === 'edit') return base ? Object.assign(blankStory({}), clone(base)) : null;
  if (mode === 'update') {
    if (!base) return null;
    const d = mergeUpdate(base, analysis);
    if (answered) d.followUps = d.followUps.map(f => { const x = answered.find(y => y.id === f.id); return x ? Object.assign({}, f, {status: x.status, answer: x.answer || '', entryId: x.status === 'answered' && entry ? entry.id : null}) : f; });
    if (followupId) d.followUps = d.followUps.map(f => f.id === followupId ? Object.assign({}, f, {status: 'done', answer: analysis.entrySummary || '', entryId: entry ? entry.id : null}) : f);
    return d;
  }
  const d = newStoryFromAnalysis(analysis, {whenHint, approx, me, studentId, studentName});
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
    ['Age or grade', s => (s.overview || {}).ageOrGrade], ['Program', s => s.program], ['School or community', s => s.community], ['Summary', s => s.summary], ['Impact story', s => s.story],
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
    ['Type', r => r.e.status === 'missing' ? 'Missing metric' : (r.e.kind === 'numeric' ? 'Numeric' : 'Qualitative')], ['Statement', r => r.e.statement], ['Value', r => r.e.value], ['Unit', r => r.e.unit],
    ['Verification status', r => r.e.status === 'missing' ? 'Missing' : labelOf(EVIDENCE_STATUS, r.e.status)], ['Source', r => r.e.basis], ['Source entry ID', r => r.e.source && r.e.source.entryId], ['Source passage', r => r.e.source && r.e.source.excerpt],
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
    if (s.story || s.summary) out.push(swap(s.story || s.summary), '');
    if ((s.takeaways || []).length) { out.push('**Key impact takeaways**'); s.takeaways.forEach(t => out.push('- ' + swap(t))); out.push(''); }
    const ev = (s.evidence || []).filter(e => e.status !== 'unverified');
    if (ev.length) { out.push('**Supporting evidence**'); ev.forEach(e => out.push('- ' + (e.value != null ? fmtNum(e.value) + (e.unit ? ' ' + e.unit : '') + ': ' : '') + swap(e.statement) + ' (' + labelOf(EVIDENCE_STATUS, e.status) + (e.basis ? '; ' + swap(e.basis) : '') + ')')); out.push(''); }
    if (s.stakeholderWhy) out.push('**Why it matters:** ' + swap(s.stakeholderWhy), '');
    const q = (s.quotes || []).filter(x => x.approved);
    if (q.length) { out.push('**Approved quotes**'); q.forEach(x => out.push('> "' + swap(x.text) + '" (' + (x.speaker === s.alias ? (name || 'a student') : (x.speaker || 'unknown speaker')) + ', ' + labelOf(QUOTE_KINDS, x.kind).toLowerCase() + ')')); out.push(''); }
    const dr = (s.drafts || []).filter(x => x.approved && (!audience || x.audience === audience));
    if (dr.length) { out.push('**Approved audience versions**'); dr.forEach(x => out.push('', '*' + labelOf(FORMATS, x.format) + ', ' + labelOf(AUDIENCES, x.audience) + '*', '', x.text)); out.push(''); }
  });
  return out.join('\n');
}
function storyMarkdown(s, entries){
  const ov = s.overview || {};
  const out = ['# ' + s.title, '', 'INTERNAL STUDENT IMPACT REPORT. Contains full transcripts. Status: ' + labelOf(STATUSES, s.status) + '.', ''];
  out.push('## Student overview');
  [['Student', s.alias], ['Age or grade', ov.ageOrGrade], ['School or community', s.community], ['Background', ov.background], ['ABG program', s.program], ['When involved', ov.involvementDate || fmtEventDate(s.eventDate)]]
    .filter(r => r[1]).forEach(r => out.push('- **' + r[0] + ':** ' + r[1]));
  out.push('');
  if (s.story) out.push('## Impact story', '', s.story, '');
  else if (s.summary) out.push('## Summary', '', s.summary, '');
  if ((s.takeaways || []).length) { out.push('## Key impact takeaways'); s.takeaways.forEach(t => out.push('- ' + t)); out.push(''); }
  if ((s.evidence || []).length) { out.push('## Supporting metrics and evidence'); s.evidence.forEach(e => out.push('- [' + labelOf(EVIDENCE_STATUS, e.status) + '] ' + labelOf(CATEGORIES, e.category) + ': ' + (e.value != null ? fmtNum(e.value) + (e.unit ? ' ' + e.unit : '') + ', ' : '') + e.statement + (e.basis ? ' (source: ' + e.basis + ')' : '') + (e.source && e.source.excerpt ? ' (passage: "' + e.source.excerpt + '")' : (e.source && e.source.note ? ' (record: ' + e.source.note + ')' : '')))); out.push(''); }
  if ((s.missingMetrics || []).length) { out.push('## Missing metrics'); s.missingMetrics.forEach(m => out.push('- ' + m.metric + (m.why ? ': ' + m.why : '') + (m.howToGet ? ' (where to find it: ' + m.howToGet + ')' : ''))); out.push(''); }
  if ((s.audiences || []).length) out.push('## Stakeholder relevance', '', '**Primary audiences:** ' + s.audiences.map(a => labelOf(AUDIENCES, a)).join(', '), '', s.stakeholderWhy ? '**Why this story matters:** ' + s.stakeholderWhy : '', '');
  if ((s.followUps || []).length) { out.push('## Recommended follow-up'); s.followUps.forEach(f => out.push('- ' + f.question + ' [' + f.status + ']' + (f.answer ? ': ' + f.answer : ''))); out.push(''); }
  if ((s.milestones || []).length) { out.push('## Student impact timeline'); sortMilestones(s.milestones).forEach(m => out.push('- ' + labelOf(PHASES, m.phase) + ' · ' + (fmtEventDate(m.date) || 'Date unknown') + ': ' + m.label + (m.phase === 'future' ? ' (pending)' : ''))); out.push(''); }
  if ((s.quotes || []).length) { out.push('## Quotes'); s.quotes.forEach(q => out.push('> "' + q.text + '" (' + (q.speaker || 'unknown') + ', ' + labelOf(QUOTE_KINDS, q.kind).toLowerCase() + (q.approved ? ', approved' : '') + ')')); out.push(''); }
  if ((s.materials || []).length) { out.push('## Supporting materials'); s.materials.forEach(m => out.push('- ' + labelOf(MATERIAL_TYPES, m.type) + ': ' + m.description)); out.push(''); }
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
};
function Icon({name, size}){ const s = size || 20; return html`<svg className="ic" width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML=${{__html: ICONS[name] || ''}}></svg>`; }

/* ================= context ================= */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* ================= small components ================= */
function Pill({tone, dot, children}){ return html`<span className=${'pill tone-' + (tone || 'neutral')}>${dot ? html`<span className="dot"></span>` : null}${children}</span>`; }
function StatusPill({status}){ const s = byId(STATUSES, status) || STATUSES[0]; return html`<${Pill} tone=${s.tone} dot=${true}>${s.label}<//>`; }
function EvPill({status}){ const s = byId(EVIDENCE_STATUS, status) || EVIDENCE_STATUS[3]; return html`<${Pill} tone=${s.tone}>${s.label}<//>`; }
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
function Brand(){
  return html`<div className="brand"><svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path className="bm-1" d="M16 3c6.5 0 12.5 4.6 12.5 11.4 0 7.6-6.4 14.6-13.6 14.6C8.4 29 3.5 23.7 3.5 17.2 3.5 9.7 9 3 16 3z"/><circle className="bm-2" cx="21.5" cy="11" r="3.4"/><circle className="bm-3" cx="11.5" cy="20" r="2.3"/></svg><span className="brand-text"><strong>ABG</strong> Impact Journal</span></div>`;
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
  {id: 'home', label: 'Home', icon: 'home'},
  {id: 'library', label: 'Story Library', short: 'Library', icon: 'book'},
  {id: 'followups', label: 'Follow-Ups', short: 'Follow-ups', icon: 'flag'},
  {id: 'insights', label: 'Impact Dashboard', short: 'Insights', icon: 'chart'},
  {id: 'reports', label: 'Impact Reports', icon: 'file'},
  {id: 'settings', label: 'Settings', icon: 'gear'},
];
function isCurrent(route, id){ return route.name === id || (id === 'library' && route.name === 'story'); }
function Sidebar(){
  const {route, nav, readOnly, stories} = useApp();
  const due = countDue(stories);
  return html`<aside className="sidebar">
    <${Brand} />
    ${!readOnly ? html`<button className="btn side-rec" onClick=${() => nav('interview')}><${Icon} name="mic" /> Record a Story</button>` : null}
    <nav className="side-nav" aria-label="Main">
      ${NAV.map(n => html`<button key=${n.id} className="side-link" aria-current=${isCurrent(route, n.id) ? 'page' : undefined} onClick=${() => nav(n.id)}><${Icon} name=${n.icon} /><span>${n.label}</span>${n.id === 'followups' && due > 0 ? html`<span className="badge">${due}</span>` : null}</button>`)}
    </nav>
    <p className="side-foot small muted">Arts Bridging the Gap · Los Angeles</p>
  </aside>`;
}
function TopBar(){
  const {route, nav} = useApp();
  return html`<header className="topbar">
    <button className="icon-btn" style=${{width: 'auto', borderRadius: '10px', padding: '0 4px'}} onClick=${() => nav('home')} aria-label="Home"><${Brand} /></button>
    <div className="topbar-actions">
      <button className="icon-btn" aria-label="Impact Reports" aria-current=${route.name === 'reports' ? 'page' : undefined} onClick=${() => nav('reports')}><${Icon} name="file" /></button>
      <button className="icon-btn" aria-label="Settings" aria-current=${route.name === 'settings' ? 'page' : undefined} onClick=${() => nav('settings')}><${Icon} name="gear" /></button>
    </div>
  </header>`;
}
function TabBar(){
  const {route, nav, stories, readOnly} = useApp();
  const due = countDue(stories);
  const tab = (id, label, icon) => html`<button key=${id} className="tab" aria-current=${isCurrent(route, id) ? 'page' : undefined} onClick=${() => nav(id)}><${Icon} name=${icon} size=${22} /><span>${label}</span>${id === 'followups' && due > 0 ? html`<span className="badge">${due}</span>` : null}</button>`;
  return html`<nav className="tabbar" aria-label="Main">
    ${tab('home', 'Home', 'home')}
    ${tab('library', 'Library', 'book')}
    <button className="tab tab-rec" onClick=${() => nav('interview')} disabled=${readOnly} aria-label="Record a Story"><span className="tab-blob"><${Icon} name="mic" size=${24} /></span><span>Record</span></button>
    ${tab('followups', 'Follow-ups', 'flag')}
    ${tab('insights', 'Insights', 'chart')}
  </nav>`;
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
function HomeView(){
  const {caps, stories, storiesLoaded, nav, readOnly} = useApp();
  const first = caps.me && caps.me.name ? caps.me.name.split(' ')[0] : '';
  const recent = stories.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 4);
  const ongoing = stories.filter(isOngoing).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 4);
  const today = todayLocal();
  const due = allTasks(stories).filter(x => x.t.status === 'open' && x.t.due).sort(byDue).slice(0, 3);
  return html`<div className="view home">
    <header className="hello">
      <p className="eyebrow">ABG Impact Journal</p>
      <h1>${first ? 'Welcome back, ' + first : 'Welcome to ABG Impact Journal'}</h1>
      <p className="lede">Every story matters. Capture the moments that show the impact of art.</p>
    </header>
    ${readOnly ? html`<p className="notice small"><strong>View-only access.</strong> Ask the person who shared this journal for Editor access to add stories.</p>` : null}
    <section className="record-hero" aria-label="Record a Story">
      <button className="blob-btn" onClick=${() => nav('interview')} disabled=${readOnly}>
        <span className="blob" aria-hidden="true"></span>
        <span className="blob-inner"><${Icon} name="mic" size=${40} /><span className="blob-label">Begin</span></span>
      </button>
      <div className="record-copy">
        <h2>Record a Story</h2>
        <p className="muted">Start with a student's first name. Tell their story in your own words, answer a few follow-up questions, and Claude writes the impact story with its supporting evidence.</p>
        <div className="row-btns" style=${{justifyContent: 'inherit'}}>
          <button className="btn btn-primary" disabled=${readOnly} onClick=${() => nav('interview')}><${Icon} name="mic" size=${18} /> Start a student story</button>
          <button className="btn btn-quiet btn-sm" disabled=${readOnly} onClick=${() => nav('record')}>Record a program or mural story</button>
        </div>
      </div>
    </section>
    <div className="action-row">
      <button className="action-card" onClick=${() => nav('library')}>
        <span className="ac-ic tone-teal"><${Icon} name="book" size=${22} /></span>
        <span className="txt"><strong>Explore Story Library</strong><small>${stories.length} ${stories.length === 1 ? 'story' : 'stories'} recorded</small></span>
        <${Icon} name="chev" size=${18} />
      </button>
      <button className="action-card" onClick=${() => nav('insights')}>
        <span className="ac-ic tone-blue"><${Icon} name="chart" size=${22} /></span>
        <span className="txt"><strong>View Impact Insights</strong><small>Themes, evidence, and what's missing</small></span>
        <${Icon} name="chev" size=${18} />
      </button>
    </div>
    ${due.length > 0 ? html`<section className="card">
      <div className="sec-head"><h2>Check back on</h2><button className="btn btn-quiet btn-sm" onClick=${() => nav('followups')}>All follow-ups</button></div>
      ${due.map(x => html`<div className="task" key=${x.t.id}><div><p>${x.t.question}</p><p className="small muted">${x.s.title}${x.t.due ? ' · ' + (x.t.due < today ? 'Overdue since ' : 'By ') + fmtDay(x.t.due) : ''}</p></div>
        <button className="btn btn-ghost btn-sm" onClick=${() => nav('story', {id: x.s.id})}>Open story</button></div>`)}
    </section>` : null}
    <section className="view" style=${{gap: '12px'}}>
      <div className="sec-head"><h2>Recent stories</h2>${stories.length > 0 ? html`<button className="btn btn-quiet btn-sm" onClick=${() => nav('library')}>See all</button>` : null}</div>
      ${!storiesLoaded ? html`<div className="grid"><div className="skeleton"></div><div className="skeleton"></div></div>`
        : recent.length ? html`<div className="grid">${recent.map(s => html`<${StoryCard} key=${s.id} story=${s} />`)}</div>`
        : html`<div className="empty"><h3>No stories yet</h3><p className="muted">The first story you record shows up here with its impact story, themes, and evidence. Start with a student you worked with recently, or one you still think about from years ago.</p>${!readOnly ? html`<button className="btn btn-primary" onClick=${() => nav('interview')}><${Icon} name="mic" size=${18} /> Start the first story</button>` : null}</div>`}
    </section>
    ${ongoing.length > 0 ? html`<section className="view" style=${{gap: '12px'}}>
      <div className="sec-head"><h2>Ongoing stories</h2></div>
      <p className="small muted">Stories that have received updates since they were first recorded.</p>
      <div className="grid">${ongoing.map(s => html`<${StoryCard} key=${s.id} story=${s} />`)}</div>
    </section>` : null}
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
async function saveRawEntry({caps, safeWrite, story, entry, title, whenText, approx, newStudent, studentId, studentName, followupId}){
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
      const sd = Object.assign({}, s); delete sd.id;
      await db.collection('stories').doc(sid).set(sd);
    }
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
  const {caps, stories, students, storiesLoaded, nav, readOnly, safeWrite, showToast} = useApp();
  const storyId = params.storyId || null;
  const story = storyId ? stories.find(s => s.id === storyId) : null;
  const mode = storyId ? 'update' : 'new';
  const draftKey = 'abg-interview:' + (storyId || 'new');
  const init = useMemo(() => { try { return JSON.parse(lsGet(draftKey) || 'null') || null; } catch (e) { return null; } }, [draftKey]);
  const fresh = !init || (params.followupId && init.followupId !== params.followupId);
  const I = fresh ? {} : init;
  const [step, setStep] = useState(I.step || (mode === 'update' ? 'interview' : 'name'));
  const [first, setFirst] = useState(I.first || '');
  const [pick, setPick] = useState(I.pick || '');
  const [note, setNote] = useState(I.note || '');
  const [when, setWhen] = useState(I.when || '');
  const [turns, setTurns] = useState(I.turns || []);
  const [current, setCurrent] = useState(I.current || null);
  const [answer, setAnswer] = useState(I.answer || '');
  const [target, setTarget] = useState(I.target || (mode === 'update' ? 2 : 4));
  const [phase, setPhase] = useState(I.phase || 'asking');
  const [student, setStudent] = useState(I.student || null);
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

  useEffect(() => {
    if (mode === 'update' && story && !current && turns.length === 0) setCurrent({q: params.prompt || UPDATE_OPENING_Q(name), kind: 'opening'});
  }, [story && story.id]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 'name' && !asStr(first)) { lsDel(draftKey); return; }
      lsSet(draftKey, JSON.stringify({step, first, pick, note, when, turns, current, answer, target, phase, student, clips, followupId, at: Date.now()}));
    }, 350);
    return () => clearTimeout(t);
  }, [step, first, pick, note, when, turns, current, answer, target, phase, student, clips]);
  useEffect(() => () => { if (qCtl.current) qCtl.current.abort(); if (aCtl.current) aCtl.current.abort(); }, []);

  const matches = useMemo(() => { const k = norm(first); return k ? students.filter(x => x.nameKey === k) : []; }, [students, first]);
  const storiesFor = sid => stories.filter(s => s.studentId === sid);
  const asked = turns.filter(t => t.kind === 'followup').length;

  function begin(){
    let fn = asStr(first).replace(/\s+/g, ' ');
    if (!fn) return;
    fn = fn.charAt(0).toUpperCase() + fn.slice(1);
    let st;
    if (pick && pick !== 'new') { const ex = students.find(x => x.id === pick); st = {id: ex.id, firstName: ex.firstName, existing: true}; }
    else st = {id: uid('st'), firstName: fn, nameKey: norm(fn), note: asStr(note), createdAt: nowISO(), createdBy: (caps.me && caps.me.id) || null, existing: false};
    setStudent(st); setStep('interview'); setPhase('asking');
    setCurrent({q: OPENING_Q(st.firstName), kind: 'opening'});
  }
  async function fetchNext(nt){
    if (!caps.sample) { setCurrent({q: CLOSING_Q(name), kind: 'closing'}); return; }
    setErr(''); setLoadingQ(true); setCurrent(null);
    const ctl = new AbortController(); qCtl.current = ctl;
    try {
      const r = await caps.sample.json(interviewPrompt({name, turns: nt, mode, story, asked: nt.filter(t => t.kind === 'followup').length, target}), {modelTier: 'quick', cache: false, signal: ctl.signal});
      const q = asStr(r && r.question);
      if (!q) throw {code: 'invalid_json'};
      setCurrent({q, kind: 'followup', category: asStr(r.category).slice(0, 1).toUpperCase(), why: asStr(r.why)});
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
      const analysis = await runAnalysis({sample: caps.sample, mode, story, stories, items, whenHint: asStr(when), studentName: name, signal: ctl.signal});
      aCtl.current = null;
      const ns = student && !student.existing ? Object.assign({}, student) : null;
      if (ns) delete ns.existing;
      nav('review', {mode, storyId: story ? story.id : null, analysis, entry, items, draftKey, whenHint: asStr(when), followupId,
        studentId: mode === 'new' ? student.id : (story.studentId || null), studentName: name, newStudent: ns, returnTo: {name: 'interview', params}});
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
    const sid = await saveRawEntry({caps, safeWrite, story, entry: makeEntry(nt), title: name + "'s story", whenText: asStr(when), newStudent: ns, studentId: student ? student.id : null, studentName: name, followupId});
    setBusy(null);
    if (sid) { lsDel(draftKey); showToast('Interview saved'); nav('story', {id: sid}); }
  }
  function startOver(){ lsDel(draftKey); setClips([]); setStep(mode === 'update' ? 'interview' : 'name'); setTurns([]); setAnswer(''); setPhase('asking'); setErr(''); setTarget(mode === 'update' ? 2 : 4); setStudent(null); setFirst(''); setPick(''); setNote(''); setWhen('');
    setCurrent(mode === 'update' ? {q: params.prompt || UPDATE_OPENING_Q(name), kind: 'opening'} : null); }
  const back = () => story ? nav('story', {id: story.id}) : nav('home');

  if (readOnly) return html`<div className="view"><${FocusHeader} title="Record a Story" onBack=${() => nav('home')} /><p className="notice">You have view-only access to this journal. Ask the person who shared it for Editor access to record stories.</p></div>`;
  if (storyId && !story) return html`<div className="view"><${FocusHeader} title="Add Story Update" onBack=${() => nav('library')} />${storiesLoaded ? html`<p className="notice">This story isn't in the journal anymore.</p>` : html`<div className="skeleton"></div>`}</div>`;

  /* step 1: first name */
  if (step === 'name') {
    const fn = asStr(first);
    const needPick = matches.length > 0 && !pick;
    return html`<div className="view interview">
      <${FocusHeader} title="Record a Story" sub="Step 1 of 2: who is this story about?" onBack=${back} />
      <section className="card name-card">
        <${Field} label="Student's First Name"><input id="iv-first" className="input input-lg" autoComplete="off" placeholder="Enter student's first name" value=${first} onChange=${e => { setFirst(e.target.value.replace(/\s{2,}/g, ' ')); setPick(''); }} /><//>
        <p className="small muted"><${Icon} name="lock" size=${14} /> Only a first name is needed. Please do not enter a last name or other identifying information. A nickname or pseudonym is fine.</p>
        ${matches.length > 0 ? html`<div className="field"><span className="field-label">There ${matches.length === 1 ? 'is already a student' : 'are already students'} named ${fn} in the journal. Is this the same person?</span>
          <div className="pick-list">
            ${matches.map(m => { const ss = storiesFor(m.id); return html`<label key=${m.id} className=${'pick' + (pick === m.id ? ' on' : '')}><input type="radio" name="iv-pick" checked=${pick === m.id} onChange=${() => setPick(m.id)} /><span><strong>${m.firstName}</strong>${m.note ? ' · ' + m.note : ''}<br /><span className="small muted">${ss.length ? ss.map(s => s.title).slice(0, 2).join('; ') : 'No stories yet'}</span></span></label>`; })}
            <label className=${'pick' + (pick === 'new' ? ' on' : '')}><input type="radio" name="iv-pick" checked=${pick === 'new'} onChange=${() => setPick('new')} /><span><strong>A different student named ${fn}</strong><br /><span className="small muted">Kept as a separate record so their stories never get combined.</span></span></label>
          </div>
          ${pick && pick !== 'new' ? html`<p className="small muted">To add to one of their existing stories instead, open it and choose Add Story Update. Continuing starts a new story about the same student.</p>` : null}
        </div>` : null}
        ${pick === 'new' ? html`<${Field} label="How to tell them apart (internal only)" hint="e.g. mural program 2018. Never shown in external materials."><input id="iv-note" className="input" value=${note} onChange=${e => setNote(e.target.value)} /><//>` : null}
        <${Field} label=${'Roughly when was ' + (fn || 'the student') + ' involved with ABG? (optional)'}><input id="iv-when" className="input" placeholder="e.g. 2018 to 2020, or this fall" value=${when} onChange=${e => setWhen(e.target.value)} /><//>
        <button className="btn btn-primary btn-lg" disabled=${!fn || needPick} onClick=${begin}><${Icon} name="mic" size=${20} /> Begin Interview</button>
      </section>
      <p className="small muted">Not about one student? <button className="btn btn-quiet btn-sm" onClick=${() => nav('record')}>Record a program or mural story</button></p>
    </div>`;
  }

  /* analysis running */
  if (busy === 'analyze') return html`<div className="view"><${FocusHeader} title=${'Interview: ' + name} onBack=${() => aCtl.current && aCtl.current.abort()} /><${Analyzing} title=${'Claude is writing ' + name + "'s story"} onStop=${() => aCtl.current && aCtl.current.abort()} /></div>`;

  const answeredCount = turns.filter(t => t.status === 'answered').length;
  const stageLabel = !current ? '' : current.kind === 'opening' ? (mode === 'update' ? 'Story update' : 'Opening story') : current.kind === 'closing' ? 'Closing question' : 'Follow-up ' + (asked + 1) + ' of about ' + Math.max(target, asked + 1);
  return html`<div className="view interview">
    <${FocusHeader} title=${(mode === 'update' ? 'Story update: ' : 'Interview: ') + name} sub=${mode === 'update' ? story.title : 'Step 2 of 2: tell the story, then answer a few follow-ups'} onBack=${back} />
    ${restored ? html`<p className="small muted">Restored your unsaved interview from this device. <button className="btn btn-quiet btn-sm" onClick=${startOver}>Start over</button></p>` : null}
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
        <p className="eyebrow">${loadingQ ? 'Next question' : stageLabel}</p>
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
  const p = Object.assign({minor: 'unknown', identifying: 'unknown', permission: 'unknown', external: 'unknown', redact: 'unknown'}, value.privacy || {});
  const [pending, setPending] = useState(false);
  const [tick, setTick] = useState(false);
  const [pub, setPub] = useState(value.publicName || '');
  useEffect(() => { if (live) setPub(value.publicName || ''); }, [value.publicName]);
  const pubInput = html`<${Field} label="Public alias" hint=${'Used in external materials instead of ' + (value.alias ? value.alias : 'the first name') + '. The first name appears externally only when publication permission is documented. Leave blank to say "a student".'}>
    <input id="pv-alias" className="input" disabled=${disabled} placeholder="e.g. Student A, or a pseudonym" value=${pub}
      onChange=${e => { setPub(e.target.value); if (!live) onChange({publicName: e.target.value}); }}
      onBlur=${() => { if (live && asStr(pub) !== asStr(value.publicName)) onChange({publicName: asStr(pub)}); }} /><//>`;
  const blocked = p.external === 'no';
  const direct = !blocked && (p.permission === 'yes' || (p.identifying === 'no' && p.redact !== 'yes'));
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
      <p className="small">Publication permission isn't documented for this story. Approve it only if permission is on file or identifying details have been removed.</p>
      <label className="check"><input type="checkbox" checked=${tick} onChange=${e => setTick(e.target.checked)} /> Permission is documented, or identifying details are removed</label>
      <div className="row-btns"><button type="button" className="btn btn-primary btn-sm" disabled=${!tick} onClick=${approve}>Approve for external use</button><button type="button" className="btn btn-ghost btn-sm" onClick=${() => setPending(false)}>Cancel</button></div>
    </div>` : null}
    <p className="small muted">Only stories approved for external use appear in external exports, impact reports, and audience drafts. AI summaries are never approved automatically.</p>
  </div>`;
}
function EvidenceEdit({ev, onChange, onRemove, onShow}){
  const src = ev.source || {};
  return html`<div className=${'ev-edit' + (ev._new ? ' is-new' : '')}>
    <div className="ev-edit-top">
      <select className="select select-sm" aria-label="Impact category" value=${ev.category} onChange=${e => onChange({category: e.target.value})}>${CATEGORIES.map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}</select>
      <select className="select select-sm" aria-label="Verification status" value=${ev.status} onChange=${e => onChange({status: e.target.value})}>${EVIDENCE_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</select>
      <button type="button" className="icon-btn" aria-label="Remove evidence" onClick=${onRemove}><${Icon} name="trash" size=${18} /></button>
    </div>
    <textarea className="textarea" rows="2" aria-label="What the evidence shows" placeholder="What does this show?" value=${ev.statement} onChange=${e => onChange({statement: e.target.value})}></textarea>
    <div className="row">
      <${Field} label="Number, if one was given"><input className="input" inputMode="decimal" value=${ev.value == null ? '' : ev.value} onChange=${e => onChange({value: e.target.value})} /><//>
      <${Field} label="Unit"><input className="input" placeholder="students, sessions, hours" value=${ev.unit || ''} onChange=${e => onChange({unit: e.target.value})} /><//>
    </div>
    <${Field} label="Source" hint="Who observed or reported it"><input className="input" placeholder="e.g. Kyle observed directly; teacher report" value=${ev.basis || ''} onChange=${e => onChange({basis: e.target.value})} /><//>
    ${src.excerpt
      ? html`<div className=${'excerpt' + (src.found ? '' : ' missing')}><span>“${src.excerpt}”</span>${!src.found ? html`<span className="warn-note"> Not found word for word in the transcript. Check it before relying on it.</span>` : null}${onShow ? html` <button type="button" className="btn btn-quiet btn-sm" onClick=${onShow}>Show in transcript</button>` : null}</div>`
      : html`<${Field} label="Supporting record" hint="e.g. attendance sheet or school report"><input className="input" value=${src.note || ''} onChange=${e => onChange({source: Object.assign({}, src, {note: e.target.value})})} /><//>`}
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

    <${Sec} title="Impact story" open=${true}>
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

    <${Sec} title="Supporting metrics and evidence" count=${(draft.evidence || []).length} open=${true}>
      <p className="small muted">Each item shows its source and the words it came from. Mark something Verified only after checking it against documentation.</p>
      ${(draft.evidence || []).length === 0 ? html`<p className="empty-note">No evidence found in this interview.</p>` : null}
      ${(draft.evidence || []).map((ev, i) => html`<${EvidenceEdit} key=${ev.id} ev=${ev}
          onChange=${patch => upd(n => { Object.assign(n.evidence[i], patch); })}
          onRemove=${() => upd(n => { n.evidence.splice(i, 1); })}
          onShow=${hasTr && ev.source && ev.source.found ? () => showIn(ev.source.excerpt) : null} />`)}
      ${addBtn('Add evidence', n => { n.evidence = (n.evidence || []).concat([{id: uid('ev'), category: 'reach', kind: 'numeric', statement: '', value: '', unit: '', status: 'reported', basis: '', source: {entryId: null, excerpt: '', found: false, note: ''}, observed: '', _new: mode === 'update'}]); })}
      <div className="field" style=${{marginTop: '8px'}}><span className="field-label">Missing metrics</span>
        <p className="small muted">Information that would strengthen the story but isn't available yet.</p>
        ${(draft.missingMetrics || []).map((m, i) => html`<div className=${'ms-edit' + (m._new ? ' is-new' : '')} key=${m.id}>
          <div className="list-row"><input className="input" aria-label="Missing metric" value=${m.metric} onChange=${val((n, v) => { n.missingMetrics[i].metric = v; })} />${trash('Remove missing metric', n => { n.missingMetrics.splice(i, 1); })}</div>
          <div className="row">
            <${Field} label="Why it matters"><input className="input" value=${m.why || ''} onChange=${val((n, v) => { n.missingMetrics[i].why = v; })} /><//>
            <${Field} label="Where to find it"><input className="input" value=${m.howToGet || ''} onChange=${val((n, v) => { n.missingMetrics[i].howToGet = v; })} /><//>
          </div>
        </div>`)}
        ${addBtn('Add missing metric', n => { n.missingMetrics = (n.missingMetrics || []).concat([{id: uid('mm'), metric: '', why: '', howToGet: ''}]); })}
      </div>
    <//>

    <${Sec} title="Stakeholder relevance" open=${true}>
      <div className="field"><span className="field-label">Most useful for</span><${ChipGroup} options=${AUDIENCES} value=${draft.audiences} label="Most useful for" onChange=${v => upd(n => { n.audiences = v; })} /></div>
      <${Field} label="Why this story matters to them"><textarea id="ed-why" className="textarea" rows="2" value=${draft.stakeholderWhy || ''} onChange=${val((n, v) => { n.stakeholderWhy = v; })}></textarea><//>
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

    <${Sec} title="Quotes" count=${(draft.quotes || []).length}>
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
    <//>

    <${Sec} title="Supporting materials" count=${(draft.materials || []).length}>
      <p className="small muted">Photos, artwork, videos, testimonials, or records that back up the story, and where they are.</p>
      ${(draft.materials || []).map((m, i) => html`<div className=${'list-row' + (m._new ? ' is-new' : '')} key=${m.id}>
        <select className="select select-sm" aria-label="Material type" value=${m.type} onChange=${val((n, v) => { n.materials[i].type = v; })}>${MATERIAL_TYPES.map(t => html`<option key=${t.id} value=${t.id}>${t.label}</option>`)}</select>
        <input className="input" aria-label="Description and location" value=${m.description} onChange=${val((n, v) => { n.materials[i].description = v; })} />
        ${trash('Remove material', n => { n.materials.splice(i, 1); })}
      </div>`)}
      ${addBtn('Add material', n => { n.materials = (n.materials || []).concat([{id: uid('mat'), type: 'photo', description: ''}]); })}
    <//>

    <${Sec} title="Story structure">
      <p className="small muted">Filled in only where the interview gives the detail. Leave blanks blank.</p>
      ${STRUCTURE.map(f => html`<${Field} key=${f.id} label=${f.label} hint=${f.hint}><textarea className="textarea" rows="2" value=${(draft.structure || {})[f.id] || ''} onChange=${val((n, v) => { n.structure = n.structure || {}; n.structure[f.id] = v; })}></textarea><//>`)}
    <//>

    ${mode !== 'edit' ? html`<${Sec} title="Recommended follow-up" count=${fuCount} open=${fuCount > 0}>
      <p className="small muted">Actions that would make the story more valuable. They show up in Follow-Ups until you mark them done.</p>
      ${(draft.followUps || []).map((f, i) => showT(f) ? html`<div className=${'ms-edit' + (f._new ? ' is-new' : '')} key=${f.id}>
          <div className="list-row"><input className="input" aria-label="Follow-up action" value=${f.question} onChange=${val((n, v) => { n.followUps[i].question = v; })} />${trash('Remove follow-up', n => { n.followUps.splice(i, 1); })}</div>
          <${Field} label="Follow-up date (optional)"><input className="input" type="date" value=${f.due || ''} onChange=${val((n, v) => { n.followUps[i].due = v; })} /><//>
        </div>` : showQ(f) ? html`<div className="list-row" key=${f.id}>
          <span className="pill tone-teal">Question</span>
          <input className="input" aria-label="Open question" value=${f.question} onChange=${val((n, v) => { n.followUps[i].question = v; })} />
          ${trash('Remove question', n => { n.followUps.splice(i, 1); })}
        </div>` : null)}
      ${addBtn('Add follow-up', n => { n.followUps = (n.followUps || []).concat([{id: uid('f'), kind: 'task', question: '', due: '', status: 'open', answer: '', entryId: null}]); })}
    <//>` : null}

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
  const {mode, storyId, analysis, entry, items, draftKey, whenHint, approx, followupId, answered, analyzedEntryIds, returnTo, studentId, studentName, newStudent} = params;
  const base = storyId ? stories.find(s => s.id === storyId) : null;
  const me = caps.me || {};
  const [draft, setDraft] = useState(() => buildReviewDraft({mode, base, analysis, whenHint, approx, me, followupId, answered, entry, studentId, studentName}));
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
    });
    setSaving(false);
    if (ok) { if (draftKey) lsDel(draftKey); showToast(mode === 'edit' ? 'Changes saved' : 'Story saved'); nav('story', {id: s.id}); }
  }
  const title = mode === 'edit' ? 'Edit story' : mode === 'update' ? 'Review the update' : 'Student Impact Report';
  return html`<div className="view review">
    <${FocusHeader} title=${title} sub=${mode === 'update' && base ? base.title : (draft.alias ? draft.alias : null)} onBack=${back} />
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
function AddEvidenceSheet({storyId, close}){
  const {caps, stories, safeWrite, showToast} = useApp();
  const [f, setF] = useState({statement: '', category: 'reach', value: '', unit: '', status: 'verified', note: ''});
  const set = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
  async function save(){
    const story = stories.find(s => s.id === storyId);
    if (!story || !asStr(f.statement)) return;
    const v = toNum(f.value);
    const ev = clone(story.evidence || []);
    ev.push({id: uid('ev'), category: f.category, kind: v != null ? 'numeric' : 'qualitative', statement: asStr(f.statement), value: v, unit: asStr(f.unit), status: f.status, source: {entryId: null, excerpt: '', found: false, note: asStr(f.note)}, observed: todayLocal()});
    const ok = await safeWrite(() => caps.db.collection('stories').doc(storyId).update({evidence: ev, updatedAt: nowISO()}));
    if (ok) { showToast('Evidence added'); close(); }
  }
  return html`<div className="view" style=${{gap: '12px'}}>
    <${SheetHead} title="Add evidence" close=${close} />
    <p className="small muted">For facts from a record, such as an attendance sheet, a school report, or a volunteer log.</p>
    <${Field} label="What it shows"><textarea id="ae-statement" className="textarea" rows="2" value=${f.statement} onChange=${e => set('statement', e.target.value)}></textarea><//>
    <div className="row">
      <${Field} label="Number (optional)"><input id="ae-value" className="input" inputMode="decimal" value=${f.value} onChange=${e => set('value', e.target.value)} /><//>
      <${Field} label="Unit"><input id="ae-unit" className="input" placeholder="students, hours" value=${f.unit} onChange=${e => set('unit', e.target.value)} /><//>
    </div>
    <div className="row">
      <${Field} label="Category"><select id="ae-cat" className="select" value=${f.category} onChange=${e => set('category', e.target.value)}>${CATEGORIES.map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}</select><//>
      <${Field} label="Status"><select id="ae-status" className="select" value=${f.status} onChange=${e => set('status', e.target.value)}>${EVIDENCE_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</select><//>
    </div>
    <${Field} label="Source"><input id="ae-source" className="input" placeholder="e.g. Spring 2026 attendance sheets" value=${f.note} onChange=${e => set('note', e.target.value)} /><//>
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
    <p className="eyebrow">${labelOf(CATEGORIES, ev.category)}</p>
    <div className="ev-head">
      <p className="ev-statement">${ev.value != null && ev.value !== '' ? html`<span className="ev-num tnum">${fmtNum(ev.value)}${ev.unit ? ' ' + ev.unit : ''}</span>` : null}${ev.statement}</p>
      ${readOnly ? html`<${EvPill} status=${ev.status} />` : html`<select className=${'status-select tone-' + tone} aria-label="Verification status" value=${ev.status} onChange=${e => onStatus(e.target.value)}>${EVIDENCE_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</select>`}
    </div>
    <p className="small muted">Source: ${ev.basis || (src.note ? src.note : (src.excerpt ? "Kyle's account" : 'not recorded'))}</p>
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
  const groups = [
    {id: 'verified', label: 'Verified metrics', hint: 'Supported by reliable documentation.', rows: evAll.filter(x => x.e.status === 'verified')},
    {id: 'reported', label: 'Reported metrics', hint: 'Numbers from the interview that still need verification.', rows: evAll.filter(x => x.e.status !== 'verified' && x.e.status !== 'future' && x.e.kind === 'numeric')},
    {id: 'qual', label: 'Qualitative evidence', hint: 'Observed changes, experiences, and testimonials.', rows: evAll.filter(x => x.e.status !== 'verified' && x.e.status !== 'future' && x.e.kind !== 'numeric')},
    {id: 'future', label: 'Not yet documented', hint: 'Expected or hoped-for outcomes. Not accomplishments.', rows: evAll.filter(x => x.e.status === 'future')},
  ];
  const ms = sortMilestones(story.milestones || []);
  const ov = story.overview || {};
  const ev = fmtEventDate(story.eventDate);
  const updates = Math.max(0, (story.entryCount || 1) - 1);
  const filledStructure = STRUCTURE.filter(f => (story.structure || {})[f.id]);
  const primaryAud = (story.audiences || []).slice(0, 3);
  const updateTarget = (story.studentId || story.alias) ? 'interview' : 'record';
  const overviewRows = [
    ['Student', (story.alias || 'Not recorded') + (student && student.note ? ' (' + student.note + ')' : '')],
    ['Age or grade', ov.ageOrGrade], ['School or community', story.community], ['Background', ov.background], ['ABG program', story.program],
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
      <h2>Impact story</h2>
      ${story.story ? story.story.split(/\n{2,}/).map((p, i) => html`<p key=${i}>${p}</p>`) : story.summary ? html`<p>${story.summary}</p>` : html`<p className="muted">No story written yet.</p>`}
      ${(story.takeaways || []).length > 0 ? html`<h3>Key impact takeaways</h3><ul className="takeaways">${story.takeaways.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul>` : null}
      ${(story.themes || []).length > 0 ? html`<div className="chips">${story.themes.map(c => html`<span key=${c} className="chip static">${labelOf(THEMES, c)}</span>`)}</div>` : null}
    </section>

    <section className="card">
      <div className="sec-head"><h2>Supporting metrics and evidence</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${AddEvidenceSheet} storyId=${id} close=${close} />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      ${groups.map(g => (g.rows.length || g.id !== 'future') ? html`<div className="ev-group" key=${g.id}>
        <div className="ev-group-head"><h3>${g.label}</h3><span className="count">${g.rows.length}</span></div>
        <p className="small muted">${g.hint}</p>
        ${g.rows.length === 0 ? html`<p className="empty-note small">${g.id === 'verified' ? 'None yet. Mark evidence Verified once it is checked against a record, or add verified evidence.' : 'None recorded.'}</p>` : g.rows.map(r => html`<${EvidenceRow} key=${r.e.id} ev=${r.e} entries=${entries} readOnly=${readOnly} onStatus=${v => setEvStatus(r.i, v)} />`)}
      </div>` : null)}
      <div className="ev-group">
        <div className="ev-group-head"><h3>Missing metrics</h3><span className="count">${(story.missingMetrics || []).length}</span></div>
        <p className="small muted">Information that would strengthen the story but isn't available yet.</p>
        ${(story.missingMetrics || []).length === 0 ? html`<p className="empty-note small">None identified.</p>` : story.missingMetrics.map(m => html`<div className="ev" key=${m.id}>
          <div className="ev-head"><p className="ev-statement"><strong>${m.metric}</strong></p>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => removeMissing(m.id)}>Found or not needed</button>` : null}</div>
          ${m.why ? html`<p className="small">${m.why}</p>` : null}
          ${m.howToGet ? html`<p className="small muted">Where to find it: ${m.howToGet}</p>` : null}
        </div>`)}
      </div>
    </section>

    <section className="card">
      <h2>Stakeholder relevance</h2>
      ${primaryAud.length ? html`<p><strong>Primary audiences:</strong> ${primaryAud.map(a => labelOf(AUDIENCES, a)).join(' and ')}</p>` : html`<p className="muted">No audiences chosen yet.</p>`}
      ${story.stakeholderWhy ? html`<p><strong>Why this story matters:</strong> ${story.stakeholderWhy}</p>` : null}
      ${!readOnly ? html`<div><button className="btn btn-ghost btn-sm" onClick=${adapt}><${Icon} name="spark" size=${16} /> Adapt story for audience</button></div>` : null}
    </section>

    <section className="card">
      <div className="sec-head"><h2>Recommended follow-up</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${AddTaskSheet} storyId=${id} close=${close} />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      ${tasks.length === 0 && doneQs.length === 0 ? html`<p className="empty-note">Nothing to follow up on.</p>` : null}
      ${tasks.map(t => html`<div className=${'task' + (t.status !== 'open' ? ' done' : '')} key=${t.id}>
        <div><p>${t.question}</p><p className="small muted">${t.status === 'open' ? (t.due ? 'By ' + fmtDay(t.due) : 'No date set') + ' · Awaiting update' : 'Done' + (t.answer ? ': ' + t.answer : '')}</p></div>
        ${t.status === 'open' && !readOnly ? html`<div className="row-btns"><button className="btn btn-ghost btn-sm" onClick=${() => nav(updateTarget, {storyId: id, prompt: t.question, followupId: t.id})}>Record what happened</button><button className="btn btn-quiet btn-sm" onClick=${() => setTask(t.id, {status: 'done'})}>Mark done</button></div>` : null}
      </div>`)}
      ${doneQs.length > 0 ? html`<details><summary className="small muted" style=${{cursor: 'pointer'}}>${doneQs.length} answered or skipped question${doneQs.length > 1 ? 's' : ''}</summary>
        <ul className="small" style=${{marginTop: '8px', display: 'grid', gap: '6px'}}>${doneQs.map(q => html`<li key=${q.id}>${q.question} <span className="muted">(${q.status === 'answered' ? 'answered' + (q.answer ? ': ' + q.answer : '') : q.status})</span></li>`)}</ul>
      </details>` : null}
    </section>

    <section className="card">
      <h2>Student impact timeline</h2>
      <${Timeline} milestones=${ms} />
    </section>

    ${(story.quotes || []).length > 0 ? html`<section className="card">
      <h2>Quotes</h2>
      ${story.quotes.map((q, i) => { const usable = q.kind !== 'paraphrase' && q.found; return html`<figure className="quote" key=${q.id}>
        <blockquote>“${q.text}”</blockquote>
        <figcaption className="small muted">${q.speaker || 'Unknown speaker'} · ${labelOf(QUOTE_KINDS, q.kind)}${q.kind !== 'paraphrase' && !q.found ? ' · not found word for word in the transcript' : ''}</figcaption>
        ${!readOnly ? html`<label className="check small"><input type="checkbox" checked=${!!q.approved} disabled=${!usable && !q.approved} onChange=${e => setQuote(i, e.target.checked)} /> Approved for external use${!usable ? ' (only exact or remembered quotes found in the transcript)' : ''}</label>` : (q.approved ? html`<${Pill} tone="good">Approved<//>` : null)}
      </figure>`; })}
    </section>` : null}

    <section className="card">
      <div className="sec-head"><h2>Supporting materials</h2>${!readOnly ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${MaterialSheet} storyId=${id} close=${close} />`)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
      ${(story.materials || []).length === 0 ? html`<p className="empty-note">No photos, artwork, testimonials, or records noted yet.</p>` : story.materials.map(m => html`<div className="linked" key=${m.id}>
        <div style=${{minWidth: 0}}><${Pill} tone="neutral">${labelOf(MATERIAL_TYPES, m.type)}<//> <span>${m.description}</span></div>
        ${!readOnly ? html`<button className="icon-btn" aria-label="Remove material" onClick=${() => removeMaterial(m.id)}><${Icon} name="close" size=${18} /></button>` : null}
      </div>`)}
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
function LibraryView(){
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
    <header className="page-head"><h1>Story Library</h1><p className="muted">${stories.length} ${stories.length === 1 ? 'story' : 'stories'} from every period of ABG's work.</p></header>
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
function InsightsView(){
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
    <header className="page-head"><h1>Impact Insights</h1><p className="muted">What the journal has documented so far. Story counts describe what's been recorded, not outcomes for every student.</p></header>
    <section className="view" style=${{gap: '10px'}}>
      <h2>Story documentation</h2>
      <div className="stats stats-6">${tiles.map(t => html`<div className="stat" key=${t[0]}><b>${storiesLoaded ? t[1] : '–'}</b><span>${t[0]}</span></div>`)}</div>
    </section>
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
function FollowupsView(){
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
    <header className="page-head"><h1>Follow-Ups</h1><p className="muted">Stories that may develop further. These are possibilities to check on, not documented impact.</p></header>
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
function ReportsView(){
  const {caps, stories, metrics, showToast} = useApp();
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
    <header className="page-head"><h1>Impact Reports</h1><p className="muted">Turn approved stories and verified evidence into fundraising materials, grant applications, partnership packets, newsletters, and annual impact summaries.</p></header>
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
        ${row('Stories (CSV)', 'Every story with status, dates, program, themes, audiences, and privacy fields. Internal.', dlBtn(() => dl('abg-stories.csv', storiesCSV(stories))))}
        ${row('Supporting metrics and evidence (CSV)', 'Each piece of evidence with its source, verification status, and transcript passage, plus missing metrics.', dlBtn(() => dl('abg-evidence.csv', evidenceCSV(stories))))}
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
  const {caps, settings, safeWrite, readOnly} = useApp();
  const me = caps.me || {};
  const save = patch => safeWrite(() => caps.db.doc('config/settings').set(Object.assign({programs: settings.programs || [], communities: settings.communities || []}, patch, {updatedAt: nowISO()})));
  const access = readOnly ? 'View only' : (me.canEdit ? 'Editor' : 'Contributor');
  return html`<div className="view settings">
    <header className="page-head"><h1>Settings</h1><p className="muted">Lists that make filling in stories faster, plus how privacy works here.</p></header>
    <${ListEditor} id="set-programs" title="Programs and projects" hint="Offered as suggestions on every story, and used as Story Library filters." items=${settings.programs || []} disabled=${readOnly} placeholder="e.g. School mural program" onChange=${v => save({programs: v})} />
    <${ListEditor} id="set-communities" title="Schools and communities" hint="Partner schools, neighborhoods, and community organizations." items=${settings.communities || []} disabled=${readOnly} placeholder="e.g. a partner school or neighborhood" onChange=${v => save({communities: v})} />
    <section className="card">
      <h2>Privacy and AI</h2>
      <ul className="small" style=${{display: 'grid', gap: '8px'}}>
        <li>Students are recorded by first name or pseudonym only. The journal never asks for a last name. Students who share a first name get separate records.</li>
        <li>A first name with a school or event can still identify someone. External exports and audience versions use the first name only when publication permission is documented; otherwise they use the story's public alias or "a student".</li>
        <li>Only people invited to this app can sign in. Stories, transcripts, and recordings are stored privately in ABG's Supabase project.</li>
        <li>Recordings are sent to Groq to be transcribed. Story text is sent to Anthropic's Claude API to choose interview questions, write impact stories, find evidence, answer searches, and draft audience versions, </li>
        <li>AI summaries and drafts are never approved automatically. Only approved stories appear in external exports and reports.</li>
        <li>Original transcripts are never overwritten. Corrections are saved alongside them.</li>
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
  const ok = ['record', 'library', 'insights', 'followups', 'reports'];
  return {name: h === 'record' ? 'interview' : (ok.includes(h) ? h : 'home'), params: {}, key: 1};
}
function App(){
  const [caps, setCaps] = useState({status: 'loading'});
  const [stories, setStories] = useState([]);
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [metrics, setMetrics] = useState([]);
  const [students, setStudents] = useState([]);
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
    return () => { u1(); u2(); u3(); u4(); };
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

  const ctx = {caps, stories, students, storiesLoaded, metrics, settings, route, nav, openSheet, closeSheet, showToast, safeWrite, readOnly};
  const focus = caps.status === 'ready' && (route.name === 'record' || route.name === 'review' || route.name === 'interview');
  let content;
  if (caps.status === 'loading') content = html`<div className="boot"><div className="boot-mark"></div><p>Opening ABG Impact Journal…</p></div>`;
  else if (caps.status === 'nodb') content = html`<div className="view"><div className="empty" style=${{marginTop: '24px'}}><${Brand} /><h2>The journal can't open here</h2><p className="muted">Sign in to Claude and open this journal's link again. If you're already signed in, ask the person who shared it to give you Contributor or Editor access.</p></div></div>`;
  else {
    const p = route.params || {};
    switch (route.name) {
      case 'library': content = html`<${LibraryView} key=${route.key} />`; break;
      case 'story': content = html`<${StoryView} key=${p.id} id=${p.id} />`; break;
      case 'record': content = html`<${ComposerView} key=${route.key} params=${p} />`; break;
      case 'interview': content = html`<${InterviewView} key=${route.key} params=${p} />`; break;
      case 'review': content = html`<${ReviewView} key=${route.key} params=${p} />`; break;
      case 'insights': content = html`<${InsightsView} />`; break;
      case 'followups': content = html`<${FollowupsView} />`; break;
      case 'reports': content = html`<${ReportsView} />`; break;
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
