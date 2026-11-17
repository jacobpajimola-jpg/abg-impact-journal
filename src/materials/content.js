/* Impact Materials content rules: what may appear in an external-facing material, where each field's content comes
 * from, the AI request (consented, name-scrubbed content only), and the accuracy checks run before a document is made.
 *
 * Statistics, quotes, Content Bank text, dates and the reporting period are filled exactly as stored. The AI only writes
 * prose (headline, introduction, story highlight, call to action, program overview), and anything it writes is checked:
 * numbers must come from the selected sources, quotations must be approved quotes, and names must be allowed. */

export const CHANNELS = [
  {id: 'print', label: 'Printed and PDF materials', hint: 'Reports, proposals, one-pagers, packets'},
  {id: 'presentation', label: 'Presentations', hint: 'Slides shown at meetings and events'},
  {id: 'online', label: 'Online and social media', hint: 'Website, newsletters, social posts'},
];
export const VERIFICATION = [
  {id: 'independently_verified', label: 'Independently verified', short: 'Verified', tone: 'good'},
  {id: 'staff_observed', label: 'Staff-observed', short: 'Staff-observed', tone: 'blue'},
  {id: 'self_reported', label: 'Self-reported', short: 'Self-reported', tone: 'warn'},
  {id: 'journal_count', label: 'Count of records in the Impact Journal', short: 'Journal count', tone: 'teal'},
  {id: 'program_records', label: 'From program records (Impact Insights)', short: 'Program records', tone: 'blue'},
];
export const MESSAGING_CATEGORIES = [
  {id: 'mission', label: 'Mission'},
  {id: 'overview', label: 'Organization description'},
  {id: 'program', label: 'Program description'},
  {id: 'audience', label: 'Audience-specific messaging'},
  {id: 'cta', label: 'Call to action'},
  {id: 'other', label: 'Other approved text'},
];
export const FIELD_TYPES = [
  {id: 'text', label: 'Short text'},
  {id: 'paragraph', label: 'Paragraph'},
  {id: 'number', label: 'Number or statistic'},
  {id: 'quote', label: 'Quotation'},
  {id: 'image', label: 'Image'},
  {id: 'date', label: 'Date'},
];
/* content sources for a template field: n is "which one" (1st selected statistic, 2nd story...) */
export const SOURCES = [
  {id: 'ai:title', group: 'AI-written', label: 'Headline (from the audience and period)', ai: true},
  {id: 'ai:intro', group: 'AI-written', label: 'Introduction (from approved core messaging)', ai: true},
  {id: 'ai:story', group: 'AI-written', label: 'Story highlight (from an approved story)', ai: true, n: true},
  {id: 'ai:program', group: 'AI-written', label: 'Program overview (from the Content Bank)', ai: true},
  {id: 'ai:cta', group: 'AI-written', label: 'Call to action (from audience messaging)', ai: true},
  {id: 'ai:custom', group: 'AI-written', label: 'Written to my instructions (selected sources only)', ai: true, instructions: true},
  {id: 'stat:value', group: 'Verified statistics', label: 'Statistic: the number', n: true},
  {id: 'stat:label', group: 'Verified statistics', label: 'Statistic: its label', n: true},
  {id: 'stat:full', group: 'Verified statistics', label: 'Statistic: number and label', n: true},
  {id: 'quote:text', group: 'Approved stories', label: 'Approved quotation', n: true},
  {id: 'quote:attribution', group: 'Approved stories', label: 'Quotation attribution', n: true},
  {id: 'quote:full', group: 'Approved stories', label: 'Quotation with attribution', n: true},
  {id: 'story:title', group: 'Approved stories', label: 'Story title', n: true},
  {id: 'story:name', group: 'Approved stories', label: 'Name allowed for external use', n: true},
  {id: 'bank:mission', group: 'Content Bank (word for word)', label: 'Mission'},
  {id: 'bank:overview', group: 'Content Bank (word for word)', label: 'Organization description'},
  {id: 'bank:program', group: 'Content Bank (word for word)', label: 'Program description'},
  {id: 'bank:audience', group: 'Content Bank (word for word)', label: 'Audience messaging'},
  {id: 'bank:cta', group: 'Content Bank (word for word)', label: 'Call to action'},
  {id: 'image', group: 'Images', label: 'Approved image', n: true},
  {id: 'period', group: 'Other', label: 'Reporting period'},
  {id: 'date', group: 'Other', label: "Today's date"},
  {id: 'audience', group: 'Other', label: 'Audience name'},
  {id: 'static', group: 'Other', label: 'Fixed text (same in every document)'},
  {id: 'manual', group: 'Other', label: 'Typed by staff for each document'},
];
export const sourceById = id => SOURCES.find(s => s.id === id) || null;
export function sourceLabel(f){
  const s = sourceById(f.source); if (!s) return 'Not set';
  return s.label + (s.n ? ' #' + (f.n || 1) : '');
}

const str = v => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const norm = s => String(s || '').toLowerCase().replace(/[‘’“”]/g, "'").replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = d => { const x = d ? new Date(d) : new Date(); return MONTHS[x.getMonth()] + ' ' + x.getDate() + ', ' + x.getFullYear(); };

/* ---------- consent ---------- */
/* h: helpers from the journal so these rules use exactly the same definitions as the rest of the app:
 * {isTest, isCommunity, reportable, externalName, externalEvidence, needsSensitiveCare, scrubName, needsRedaction} */
export function storyUse(h, s, channel){
  const p = s.privacy || {};
  const blocks = [], warnings = [];
  if (h.isTest(s)) blocks.push('Test story from Preview Mode');
  if (s.demo) blocks.push('Fictional demo story');
  if (h.isCommunity(s) && !h.reportable(s)) blocks.push('Community story that is not approved (or was withdrawn)');
  if (s.status !== 'approved') blocks.push('Not approved for external use');
  if (p.external === 'no') blocks.push('Marked as not usable externally');
  if (h.isCommunity(s)) {
    const pub = s.publication || {};
    if (!pub.choice || pub.choice === 'internal') blocks.push('The contributor asked to keep it within ABG');
    else if (!pub.confirmed) blocks.push("The contributor's sharing choice hasn't been confirmed by an administrator");
  }
  if (p.minor === 'yes' && p.permission !== 'yes') blocks.push('Involves a minor without documented publication permission');
  const uses = (s.materialsUse && Array.isArray(s.materialsUse.channels)) ? s.materialsUse.channels : null;
  if (!uses) blocks.push('Permitted uses not recorded');
  else if (channel && !uses.includes(channel)) blocks.push('Not permitted for ' + ((CHANNELS.find(c => c.id === channel) || {}).label || channel).toLowerCase());
  if (h.needsSensitiveCare(s)) warnings.push('Sensitive experiences are left out (consent to share them is not documented)');
  const name = h.externalName(s);
  if (!name) warnings.push('No name will be used (permission for the first name is not documented)');
  const quotes = (s.quotes || []).filter(q => q.approved);
  return {allowed: blocks.length === 0, blocks, warnings, name, quotes: quotes.length, fixable: blocks.length === 1 && blocks[0] === 'Permitted uses not recorded'};
}
export function mediaUse(m, channel){
  const blocks = [];
  if (m.status !== 'approved') blocks.push('Not approved in the Content Bank');
  if (!(m.permitted_uses || []).includes(channel)) blocks.push('Not permitted for ' + ((CHANNELS.find(c => c.id === channel) || {}).label || channel).toLowerCase());
  if (m.identifiable && m.consent !== 'documented') blocks.push(m.minors ? 'Shows an identifiable minor without documented consent' : 'Shows an identifiable person without documented consent');
  if (m.identifiable == null) blocks.push('Not recorded whether people can be identified');
  return {allowed: blocks.length === 0, blocks};
}
export function statInfo(st){
  const ver = VERIFICATION.find(v => v.id === st.verification) || {label: 'Not stated', short: 'Unverified', tone: 'bad'};
  const warnings = [];
  if (st.status && st.status !== 'approved') warnings.push('Not approved in the Content Bank');
  if (st.verification === 'self_reported') warnings.push('Self-reported: present it as reported, not verified');
  if (!st.verification) warnings.push('Verification level not recorded');
  return {ver, warnings};
}

/* ---------- source snapshots (what is saved with a material, and the only things the AI sees) ---------- */
export function storySnapshot(h, s, i, channel){
  const name = h.externalName(s);
  const who = s.storyType === 'staff' ? 'staff member' : 'student';
  const real = str(s.alias) && norm(s.alias) !== norm(name) ? s.alias : '';
  const scrub = t => (real ? h.scrubName(t, real, name || 'the ' + who) : str(t));
  const evidence = h.externalEvidence(s).map(e => ({statement: scrub(e.statement), status: e.status === 'verified' ? 'independently verified' : e.status === 'reported' ? 'reported' : e.status === 'estimate' ? 'estimate' : 'qualitative', observedBy: h.observerLabel ? h.observerLabel(e) || null : null, number: e.value != null && e.value !== '' ? String(e.value) : null, unit: e.unit || null, before: e.before || null, after: e.after || null, period: e.timeframe || null}));
  return {
    ref: 'S' + (i + 1), id: s.id, title: scrub(s.title || ''), name: name || '', who, program: s.program || '', when: h.whenText ? h.whenText(s) : '',
    source: h.isCommunity(s) ? 'community submission (' + (h.sourceLabel ? h.sourceLabel(s) : 'community member') + '; their own account, not checked by ABG staff)' : 'ABG staff interview',
    summary: scrub(String(s.story || s.summary || '').slice(0, 1600)), takeaways: (s.takeaways || []).map(scrub).slice(0, 5), evidence,
    quotes: (s.quotes || []).filter(q => q.approved).map(q => ({text: scrub(q.text), speaker: q.speaker && norm(q.speaker) === norm(s.alias) ? (name || 'an ABG ' + who) : scrub(q.speaker || ''), kind: q.kind || ''})),
    sensitiveAllowed: !h.needsSensitiveCare(s), realName: real, channel,
  };
}
export function statSnapshot(st, i){
  return {ref: 'T' + (i + 1), id: st.id || '', title: str(st.title), label: str(st.body || st.title), value: str(st.stat_value != null ? st.stat_value : st.value), unit: str(st.stat_unit || st.unit),
    source: str(st.stat_source || st.source), period: str(st.stat_period || st.period), verification: st.verification || '', status: st.status || 'approved', origin: st.origin || 'bank'};
}
export function bankSnapshot(m, i){ return {ref: 'M' + (i + 1), id: m.id, category: m.category || 'other', title: str(m.title), text: str(m.body), program: m.program || ''}; }
export function mediaSnapshot(m, i){ return {ref: 'I' + (i + 1), id: m.id, title: str(m.title), path: m.media_path, alt: str(m.media_alt)}; }

export function statText(t, part){
  if (!t) return '';
  const unit = t.unit === '%' ? '%' : '';
  const num = t.value + unit;
  if (part === 'value') return num;
  if (part === 'label') return t.label;
  return num + ' ' + (t.unit && t.unit !== '%' && !norm(t.label).startsWith(norm(t.unit)) ? t.unit + ' ' : '') + t.label;
}
function quoteParts(sel, n){
  const all = [];
  (sel.stories || []).forEach(s => (s.quotes || []).forEach(q => all.push({q, s})));
  return all[(n || 1) - 1] || null;
}
function bankText(sel, cat){
  const list = (sel.messaging || []).filter(m => m.category === cat);
  if (cat === 'program' && (sel.programs || []).length) { const p = list.find(m => (sel.programs || []).includes(m.program)); if (p) return p; }
  return list[0] || null;
}

/* ---------- AI request ---------- */
const BRIEFS = {
  'ai:title': 'a short, warm headline for the document (no more than 8 words) suited to the audience and reporting period. No numbers unless they come from a selected statistic.',
  'ai:intro': 'an opening paragraph introducing ABG and why this material matters to this audience, based only on the approved core messaging (mission and organization description).',
  'ai:story': 'a short highlight of the indicated approved story: what changed for the person and how ABG was involved. Refer to the person only by the allowed name, or without a name if none is given.',
  'ai:program': 'a short overview of the selected program(s) based only on the approved program descriptions.',
  'ai:cta': 'a closing call to action for this audience based on the approved audience messaging and call to action text.',
  'ai:custom': 'text following the field instructions, using only the selected sources.',
};
export function aiFields(fields){ return fields.filter(f => (sourceById(f.source) || {}).ai); }
export function materialPrompt({fields, sel, context, emphasis}){
  const wanted = aiFields(fields).map(f => ({id: f.id, label: f.label || f.id, write: BRIEFS[f.source] + (f.source === 'ai:story' ? ' Use story S' + (f.n || 1) + '.' : '') + (f.instructions ? ' Instructions: ' + f.instructions : ''), maxCharacters: f.maxChars || null, maxLines: f.maxLines || null}));
  const stories = (sel.stories || []).map(s => ({ref: s.ref, title: s.title, person: s.name ? s.name : 'not named (do not use any name)', who: s.who, program: s.program || null, when: s.when || null, source: s.source, summary: s.summary, takeaways: s.takeaways,
    evidence: s.evidence, sensitiveDetailsAllowed: s.sensitiveAllowed}));
  const stats = (sel.stats || []).map(t => ({ref: t.ref, statistic: statText(t, 'full'), verification: (VERIFICATION.find(v => v.id === t.verification) || {}).label || 'not stated', source: t.source, period: t.period || null}));
  const messaging = (sel.messaging || []).map(m => ({ref: m.ref, kind: (MESSAGING_CATEGORIES.find(c => c.id === m.category) || {}).label || m.category, program: m.program || undefined, text: m.text}));
  return `Write content for a ${context.materialType} for ${context.audience} from Arts Bridging the Gap (ABG), a Los Angeles nonprofit that empowers youth through healing arts programs.${sel.period ? ' Reporting period: ' + sel.period + '.' : ''}${emphasis ? ' For this audience, emphasize: ' + emphasis + '.' : ''}

Write these template fields:
${JSON.stringify(wanted)}

Rules:
- Use only the sources below. Never add facts, numbers, names, places, dates, quotations or outcomes that aren't in them. If the sources don't support a field, return an empty string for it.
- Use no numbers except those that appear in the sources. Never add numbers together or turn counts into percentages.
- Present outcomes the way their source labels them: self-reported or community accounts as reported, staff observations as observed by ABG staff, and only independently verified figures as verified.
- Don't claim ABG caused an outcome unless a source says so.
- Don't use quotation marks or quote anyone: approved quotations are placed in the document separately.
- Refer to people only by the name given in "person", never by any other name; if it says not named, don't name them.
- Where sensitiveDetailsAllowed is false, never mention gang involvement, the justice system, substance use or other sensitive experiences.
- Respect maxCharacters and maxLines (count characters, including spaces). Plain text only, no Markdown. Warm, specific and professional; avoid clichés such as "transformative journey".
- For each field, list the refs of the sources you used.
${sel.instructions ? '- Staff instructions (follow them unless they conflict with these rules): ' + sel.instructions + '\n' : ''}
Reply with JSON only: {"fields": {"<field id>": {"text": "...", "sources": ["S1", "M1"]}}}

Approved stories: ${JSON.stringify(stories)}
Statistics: ${JSON.stringify(stats)}
Approved messaging (Content Bank): ${JSON.stringify(messaging)}`;
}

/* ---------- filling every field ---------- */
/* Returns {fieldId: {text | imageRef, sources: [refs], origin, note}}. ai: the parsed AI reply (or {} before it exists). */
export function resolveContent(fields, sel, ai, manual){
  const out = {};
  const aiF = (ai && ai.fields) || {};
  for (const f of fields) {
    const s = f.source || 'manual'; const n = f.n || 1;
    let v = {text: '', sources: [], origin: s};
    if (s.startsWith('ai:')) { const a = aiF[f.id] || {}; v = {text: str(a.text), sources: Array.isArray(a.sources) ? a.sources.map(String) : [], origin: 'ai'}; }
    else if (s.startsWith('stat:')) { const t = (sel.stats || [])[n - 1]; v = t ? {text: statText(t, s.slice(5)), sources: [t.ref], origin: 'statistic'} : {text: '', sources: [], origin: 'statistic', missing: 'Select statistic #' + n}; }
    else if (s.startsWith('quote:')) {
      const qp = quoteParts(sel, n);
      if (!qp) v = {text: '', sources: [], origin: 'quote', missing: 'No approved quotation #' + n + ' in the selected stories'};
      else { const att = qp.q.speaker ? qp.q.speaker : 'an ABG ' + qp.s.who; const qt = '“' + qp.q.text.replace(/^["“]|["”]$/g, '') + '”';
        v = {text: s === 'quote:text' ? qt : s === 'quote:attribution' ? '— ' + att : qt + ' — ' + att, sources: [qp.s.ref], origin: 'quote'}; }
    }
    else if (s.startsWith('story:')) { const st = (sel.stories || [])[n - 1]; v = st ? {text: s === 'story:title' ? st.title : st.name, sources: [st.ref], origin: 'story'} : {text: '', sources: [], origin: 'story', missing: 'Select story #' + n}; }
    else if (s.startsWith('bank:')) { const m = bankText(sel, s.slice(5)); v = m ? {text: m.text, sources: [m.ref], origin: 'bank'} : {text: '', sources: [], origin: 'bank', missing: 'No approved ' + ((MESSAGING_CATEGORIES.find(c => c.id === s.slice(5)) || {}).label || '').toLowerCase() + ' in the Content Bank'}; }
    else if (s === 'image') { const im = (sel.images || [])[n - 1]; v = im ? {image: im.path, alt: im.alt, sources: [im.ref], origin: 'image'} : {image: null, sources: [], origin: 'image', missing: 'Select image #' + n}; }
    else if (s === 'period') v = {text: str(sel.period), sources: [], origin: 'period'};
    else if (s === 'date') v = {text: longDate(), sources: [], origin: 'date'};
    else if (s === 'audience') v = {text: str(sel.audienceName), sources: [], origin: 'audience'};
    else if (s === 'static') v = {text: str(f.text), sources: [], origin: 'static'};
    else v = {text: str((manual || {})[f.id]), sources: [], origin: 'manual'};
    out[f.id] = v;
  }
  return out;
}

/* ---------- checks ---------- */
const NUM_RE = /\d[\d,]*(?:\.\d+)?%?/g;
const numKey = s => s.replace(/,/g, '').replace(/%$/, '').replace(/\.0+$/, '');
const WORD_NUMS = {one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', twelve: '12', twenty: '20', hundred: '100'};
function allowedNumbers(sel){
  const set = new Set();
  const add = t => { (String(t || '').match(NUM_RE) || []).forEach(x => set.add(numKey(x))); String(t || '').toLowerCase().split(/[^a-z]+/).forEach(w => { if (WORD_NUMS[w]) set.add(WORD_NUMS[w]); }); };
  add(sel.period); add(longDate());
  (sel.stats || []).forEach(t => { add(t.value); add(t.label); add(t.period); });
  (sel.messaging || []).forEach(m => add(m.text));
  (sel.stories || []).forEach(s => { add(s.title); add(s.summary); add(s.when); (s.takeaways || []).forEach(add); (s.evidence || []).forEach(e => { add(e.statement); add(e.number); add(e.before); add(e.after); add(e.period); }); (s.quotes || []).forEach(q => add(q.text)); });
  return set;
}
/* problems: {field, level: 'error' | 'warning', text}. Errors stop the document from being generated until fixed. */
export function checkContent(fields, content, sel, opts){
  const o = opts || {};
  const problems = [];
  const nums = allowedNumbers(sel);
  const quotes = [];
  (sel.stories || []).forEach(s => (s.quotes || []).forEach(q => quotes.push(norm(q.text))));
  const usedStats = new Set();
  for (const f of fields) {
    const v = content[f.id] || {};
    const label = f.label || f.id;
    const text = str(v.text);
    if (f.type === 'image') {
      if (!v.image && f.required) problems.push({field: f.id, level: f.fallback === 'keep' ? 'warning' : 'error', text: label + ': ' + (v.missing || 'no image selected') + (f.fallback === 'keep' ? '. The template image stays.' : '.')});
      continue;
    }
    if (!text) {
      if (v.missing || f.required) problems.push({field: f.id, level: f.required && f.fallback !== 'keep' ? 'error' : 'warning', text: label + ': ' + (v.missing || 'empty') + (f.fallback === 'keep' ? '. The template text stays.' : f.required ? '.' : '. It will be left blank.')});
      continue;
    }
    if (f.maxChars && text.length > f.maxChars) problems.push({field: f.id, level: 'error', text: label + ': ' + text.length + ' characters; the template allows ' + f.maxChars + '.'});
    if (v.origin === 'ai' || v.origin === 'manual' || v.edited) {
      const bad = (text.match(NUM_RE) || []).map(numKey).filter(x => !nums.has(x));
      if (bad.length) problems.push({field: f.id, level: 'error', text: label + ': ' + [...new Set(bad)].join(', ') + " isn't in the selected sources. Remove it or select the statistic or story it comes from."});
      const quoted = text.match(/[“"]([^”"]{12,})[”"]/g) || [];
      quoted.forEach(qq => { const inner = norm(qq.slice(1, -1)); if (!quotes.some(a => a.includes(inner) || inner.includes(a))) problems.push({field: f.id, level: 'error', text: label + ': a quotation that is not one of the approved quotes. Quotations must be used word for word from an approved story.'}); });
    }
    (sel.stories || []).forEach(s => {
      if (s.realName && new RegExp('(^|[^\\p{L}])' + s.realName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}]|$)', 'iu').test(text)) problems.push({field: f.id, level: 'error', text: label + ': uses the name ' + s.realName + ', which may not appear in external materials for story ' + s.ref + (s.name ? ' (use ' + s.name + ')' : '') + '.'});
    });
    (v.sources || []).forEach(r => { if (/^T\d+$/.test(r)) usedStats.add(r); });
  }
  (sel.stats || []).filter(t => usedStats.has(t.ref) || fields.some(f => (f.source || '').startsWith('stat:') && (sel.stats || [])[(f.n || 1) - 1] === t)).forEach(t => {
    statInfo(t).warnings.forEach(w => problems.push({field: '', level: 'warning', text: 'Statistic "' + statText(t, 'full') + '": ' + w + '.'}));
  });
  (sel.blocked || []).forEach(b => problems.push({field: '', level: 'error', text: b}));
  if (o.unverifiedOnly && !(sel.stats || []).some(t => t.verification === 'independently_verified')) problems.push({field: '', level: 'warning', text: 'None of the selected statistics is independently verified.'});
  return problems;
}

/* sample content used by Test Template: clearly fake, sized to each field's limits */
export function sampleContent(fields){
  const LOREM = 'Sample text for testing this template. It shows how a paragraph of approved content will wrap inside this area once real stories and statistics are used. ';
  const out = {};
  for (const f of fields) {
    if (f.type === 'image') { out[f.id] = {image: 'sample', sources: [], origin: 'sample'}; continue; }
    let t = f.example || ({text: 'Sample headline text', paragraph: LOREM + LOREM, number: '128', quote: '“A sample quotation for testing.”', date: longDate()})[f.type] || 'Sample text';
    if (f.source === 'quote:attribution') t = '— Sample Name, ABG student';
    if (f.source === 'stat:label') t = 'students engaged';
    if (f.maxChars) t = t.slice(0, f.maxChars).replace(/\s+\S*$/, '').trim() || t.slice(0, f.maxChars);
    out[f.id] = {text: t, sources: [], origin: 'sample'};
  }
  return out;
}
/* field mapping is complete enough to test: every field has an id, a target and a source; ids unique */
export function checkMapping(fields, kind){
  const errs = [];
  const ids = new Set();
  if (!fields.length) errs.push('Add at least one field.');
  for (const f of fields) {
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(f.id || '')) errs.push('Field "' + (f.label || f.id || '?') + '": the field ID must start with a letter and use only lowercase letters, numbers and _.');
    if (ids.has(f.id)) errs.push('Field ID "' + f.id + '" is used twice.'); ids.add(f.id);
    if (!f.source) errs.push('Field "' + (f.label || f.id) + '": choose where its content comes from.');
    if (f.source === 'static' && !str(f.text)) errs.push('Field "' + (f.label || f.id) + '": enter the fixed text.');
    if (f.source === 'image' && f.type !== 'image') errs.push('Field "' + (f.label || f.id) + '": an approved image needs an image field.');
    if (f.type === 'image' && f.source !== 'image') errs.push('Field "' + (f.label || f.id) + '": image fields take an approved image.');
    const t = f.target || {};
    if (kind === 'pptx' && t.kind !== 'pptx_shape') errs.push('Field "' + (f.label || f.id) + '": pick the text box or picture on the slide.');
    if (kind === 'pdf' && t.kind !== 'pdf_region' && t.kind !== 'pdf_field') errs.push('Field "' + (f.label || f.id) + '": draw its area on the page or pick a form field.');
    if (kind === 'pdf' && t.kind === 'pdf_field' && f.type === 'image') errs.push('Field "' + (f.label || f.id) + '": images go in a drawn area, not a form field.');
    if (kind === 'canva' && t.kind !== 'canva_field') errs.push('Field "' + (f.label || f.id) + '": choose the Canva data field.');
    if (kind === 'canva' && t.kind === 'canva_field' && t.canvaType === 'image' && f.type !== 'image') errs.push('Field "' + (f.label || f.id) + '": the Canva field ' + t.name + ' is an image field.');
    if (kind === 'canva' && t.kind === 'canva_field' && t.canvaType === 'chart') errs.push('Field "' + (f.label || f.id) + '": chart fields are not supported yet; remove it from the mapping (the chart stays as designed).');
  }
  return errs;
}
