// Community Story Collection Portal: the only way the public reaches the journal's data.
// Contributors never get a Supabase account. Each submission is identified by a long random private link
// token (only its SHA-256 hash is stored), so a contributor can reach their own submission and nothing else.
// The server builds every AI prompt itself, so this function can't be used as a general AI proxy.
// Minors: anyone under 18 can only take part through an individual invitation link that an ABG administrator
// created after recording guardian consent. Voice recordings are transcribed and discarded, never stored.
// Bundled with src/core/shared.js into index.ts by scripts/build-community.mjs.
import { RELATIONSHIPS, PERSPECTIVES, SUBJECTS, communityStoryType, communityOpeningQ, communityInterviewPrompt, communityAnalysisPrompt, COMMUNITY_CLOSING_Q } from '../../../src/core/shared.js';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...CORS, 'Content-Type': 'application/json'}});
const fail = (status: number, code: string, error: string) => json({error, code}, status);

export const LIMITS = {startsPerHourPerIp: 6, followUps: 7, targetFollowUps: 5, aiCalls: 24, answerChars: 6000, clips: 40, clipBytes: 15 * 1024 * 1024, draftDays: 14, rejectedDays: 180};
const STATUS_TEXT: Record<string, string> = {
  in_progress: 'Not submitted yet',
  pending_review: 'Received. Waiting for ABG to review it',
  needs_clarification: 'ABG has a question for you',
  approved: "Reviewed and included in ABG's impact records",
  rejected: "Reviewed. It won't be used in ABG's reporting",
  removal_requested: 'Removal requested. ABG will delete it',
};

// deno-lint-ignore no-explicit-any
type Any = any;
export interface Deps {
  db: Any;                                            // Supabase client with the service key
  claude: (prompt: string, opts: {json?: boolean; quick?: boolean}) => Promise<string>;
  transcribe: (bytes: Uint8Array, mime: string) => Promise<string>;
  now?: () => Date;
  ip?: string;
}

const clean = (v: unknown, max = 300) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const firstName = (v: unknown) => clean(v, 40).replace(/[^\p{L}\p{M}'’-]+/gu, ' ').trim().split(/\s+/)[0] || '';
const year = (v: unknown) => { const m = String(v || '').match(/(19|20)\d{2}/); return m ? m[0] : ''; };
const pick = (v: unknown, list: {id: string}[]) => list.some(x => x.id === v) ? String(v) : '';
export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function newToken(): string {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function parseJson(text: string): Any {
  const t = String(text || '').trim().replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* not JSON */ } }
  return null;
}
function overlap(a: string, b: string){
  const w = (t: string) => new Set(String(t).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(x => x.length > 3));
  const A = w(a), B = w(b); if (!A.size || !B.size) return 0;
  let n = 0; A.forEach(x => { if (B.has(x)) n++; });
  return n / Math.min(A.size, B.size);
}
/* the intake as the server accepts it: known values only, short strings, nothing else */
export function cleanIntake(raw: Any){
  const r = raw && typeof raw === 'object' ? raw : {};
  const relationship = pick(r.relationship, RELATIONSHIPS), perspective = pick(r.perspective, PERSPECTIVES);
  const i: Any = {relationship, perspective, adult: r.adult === true ? true : r.adult === false ? false : null, firstName: firstName(r.firstName),
    programs: clean(r.programs, 160), yearsInvolved: clean(r.yearsInvolved, 60), background: clean(r.background, 300),
    method: r.method === 'voice' ? 'voice' : 'written'};
  if (perspective === 'witnessed') {
    i.subject = pick(r.subject, SUBJECTS) || 'student';
    i.subjectFirstName = firstName(r.subjectFirstName);
    i.subjectMinor = ['yes', 'no', 'unknown'].includes(r.subjectMinor) ? r.subjectMinor : 'unknown';
    i.subjectAware = ['yes', 'no', 'unknown'].includes(r.subjectAware) ? r.subjectAware : 'unknown';
  }
  if (relationship === 'staff' && perspective === 'self') {
    i.staffRole = clean(r.staffRole, 80);
    i.staffStatus = ['current', 'former'].includes(r.staffStatus) ? r.staffStatus : '';
    i.formerStudent = ['yes', 'no', 'unknown'].includes(r.formerStudent) ? r.formerStudent : 'unknown';
    if (i.formerStudent === 'yes') { i.firstParticipatedYear = year(r.firstParticipatedYear); i.studentPrograms = clean(r.studentPrograms, 160); i.transitionYear = year(r.transitionYear); }
  }
  return i;
}
/* what the contributor can see of their own submission: never another submission, never internal review notes */
function view(sub: Any){
  const a = sub.analysis || {};
  const ed = sub.contributor_edits || {};
  const removed = new Set((ed.removed || []).map(Number));
  const outcomes = (Array.isArray(a.evidence) ? a.evidence : []).map((e: Any, i: number) => ({i, statement: clean(e && e.statement, 400)})).filter((x: Any) => x.statement);
  const clar = (sub.clarifications || []).filter((c: Any) => c && c.from === 'abg');
  return {
    status: sub.status, statusText: STATUS_TEXT[sub.status] || sub.status, submittedAt: sub.submitted_at || null, type: sub.story_type,
    title: clean(a.title, 200), story: typeof ed.story === 'string' ? ed.story : clean(a.story, 6000), takeaways: (Array.isArray(a.takeaways) ? a.takeaways : []).map((t: unknown) => clean(t, 300)).slice(0, 5),
    outcomes: outcomes.map((o: Any) => Object.assign(o, {removed: removed.has(o.i)})), note: clean(ed.note, 2000),
    publication: sub.publication_consent, publicationOptions: publicationOptions(sub.intake || {}),
    question: sub.status === 'needs_clarification' && clar.length ? clean(clar[clar.length - 1].text, 1000) : '',
    replies: (sub.clarifications || []).map((c: Any) => ({from: c.from === 'abg' ? 'ABG' : 'You', text: clean(c.text, 2000), at: c.at})),
    canEdit: sub.status === 'pending_review' || sub.status === 'needs_clarification',
    reviewing: sub.status === 'in_progress', analysisFailed: !!(sub.data && sub.data.analysisFailed),
  };
}
/* identifiable public use only for adults telling their own story; minors and witnessed stories: no names */
export function publicationOptions(intake: Any){
  const named = intake.perspective === 'self' && intake.adult === true;
  return (named ? ['public_name'] : []).concat(['anonymous', 'internal']);
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return fail(405, 'method', 'Use POST');
  const raw = await req.text();
  if (raw.length > 22 * 1024 * 1024) return fail(413, 'too_large', 'That request is too large.');
  let body: Any; try { body = JSON.parse(raw || '{}'); } catch { return fail(400, 'bad_request', 'Invalid request body'); }
  const db = deps.db; const now = deps.now ? deps.now() : new Date();
  const action = String(body.action || '');

  const findInvite = async (token: unknown) => {
    if (!token) return null;
    const {data} = await db.from('community_invites').select('*').eq('token_hash', await sha256(String(token))).maybeSingle();
    if (!data) return {valid: false, reason: 'not_found'};
    if (data.revoked_at) return {valid: false, reason: 'revoked', row: data};
    if (new Date(data.expires_at).getTime() < now.getTime()) return {valid: false, reason: 'expired', row: data};
    if ((data.uses || 0) >= (data.max_uses || 1)) return {valid: false, reason: 'used', row: data};
    return {valid: true, row: data};
  };
  const loadSub = async () => {
    const t = String(body.token || '');
    if (t.length < 30) return null;
    const {data} = await db.from('community_submissions').select('*').eq('token_hash', await sha256(t)).maybeSingle();
    return data || null;
  };
  const save = async (id: string, patch: Any) => {
    const {error} = await db.from('community_submissions').update(Object.assign({}, patch, {updated_at: now.toISOString()})).eq('id', id);
    if (error) throw new Error(error.message);
  };
  const logEvent = async (id: string, what: string, details: Any = {}) => { try { await db.from('submission_events').insert({submission_id: id, actor: 'contributor', action: what, details}); } catch { /* best effort */ } };

  try {
    if (action === 'invite') {
      const r = await findInvite(body.invite);
      if (!r) return json({valid: false, reason: 'missing'});
      return json({valid: r.valid, reason: r.reason || null, firstName: r.valid ? clean(r.row.label, 40) : '', relationship: r.valid ? (r.row.relationship || '') : '', guardianConsent: r.valid ? !!r.row.minor_consent : false});
    }

    if (action === 'start') {
      const intake = cleanIntake(body.intake);
      if (!intake.relationship || !intake.perspective) return fail(400, 'intake', 'Choose how you are connected to ABG and whose experience you are sharing.');
      if (intake.adult === null) return fail(400, 'age', 'Tell us whether you are 18 or older.');
      if (body.privacyAccepted !== true) return fail(400, 'privacy', 'Please read and accept how ABG will use your story.');
      if (intake.method === 'voice' && body.recordingConsent !== true) return fail(400, 'recording_consent', 'Please agree to the voice recording terms, or choose a written interview.');
      const inv = body.invite ? await findInvite(body.invite) : null;
      if (body.invite && (!inv || !inv.valid)) return fail(403, 'invite_invalid', 'This invitation link is no longer valid. Ask ABG for a new one.');
      // minors: only with an individual invitation that records guardian consent
      if (intake.adult === false && !(inv && inv.valid && inv.row.minor_consent)) return fail(403, 'guardian_required', 'Because you are under 18, ABG needs permission from your parent or guardian first.');
      const ipHash = deps.ip ? await sha256('ip:' + deps.ip) : null;
      if (ipHash && !inv) {
        const since = new Date(now.getTime() - 3600e3).toISOString();
        const {count} = await db.from('community_submissions').select('id', {count: 'exact', head: true}).eq('ip_hash', ipHash).gte('created_at', since);
        if ((count || 0) >= LIMITS.startsPerHourPerIp) return fail(429, 'rate_limited', 'Too many stories were started from this connection. Please try again in an hour.');
      }
      // retention: unfinished drafts and long-rejected submissions are deleted
      await db.from('community_submissions').delete().eq('status', 'in_progress').lt('updated_at', new Date(now.getTime() - LIMITS.draftDays * 864e5).toISOString());
      await db.from('community_submissions').delete().eq('status', 'rejected').lt('updated_at', new Date(now.getTime() - LIMITS.rejectedDays * 864e5).toISOString());
      const token = newToken();
      const type = communityStoryType(intake);
      const q = communityOpeningQ(intake);
      const row = {token_hash: await sha256(token), invite_id: inv && inv.valid ? inv.row.id : null, status: 'in_progress', relationship: intake.relationship, perspective: intake.perspective, story_type: type,
        is_minor: intake.adult === false || (intake.perspective === 'witnessed' && intake.subjectMinor === 'yes'), intake, turns: [], data: {current: {q, kind: 'opening'}, notes: null},
        recording_consent: intake.method === 'voice' && body.recordingConsent === true, publication_consent: 'internal', ip_hash: ipHash, created_at: now.toISOString(), updated_at: now.toISOString()};
      const {error} = await db.from('community_submissions').insert(row);
      if (error) throw new Error(error.message);
      if (inv && inv.valid) await db.from('community_invites').update({uses: (inv.row.uses || 0) + 1}).eq('id', inv.row.id);
      return json({token, type, question: q, kind: 'opening'});
    }

    const sub = await loadSub();
    if (!sub) return fail(404, 'not_found', "We couldn't find that story. Check that you used the full private link.");

    if (action === 'status') return json(view(sub));

    if (action === 'transcribe') {
      if (!['in_progress', 'needs_clarification'].includes(sub.status)) return fail(409, 'closed', 'This story has already been submitted.');
      if (!sub.recording_consent) return fail(403, 'recording_consent', 'Voice recording was not agreed to for this story.');
      const clips = (sub.data && sub.data.clips) || 0;
      if (clips >= LIMITS.clips) return fail(429, 'limit', 'This story has reached the recording limit. Please type the rest.');
      const b64 = String(body.audio || '');
      if (!b64) return fail(400, 'bad_request', 'No recording received.');
      const bin = atob(b64); if (bin.length > LIMITS.clipBytes) return fail(413, 'too_large', 'That recording is too long. Try shorter answers.');
      const bytes = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      const text = await deps.transcribe(bytes, clean(body.mime, 60) || 'audio/webm');   // audio is not stored anywhere
      await save(sub.id, {data: Object.assign({}, sub.data, {clips: clips + 1})});
      return json({text: clean(text, LIMITS.answerChars)});
    }

    if (action === 'ask') {
      if (sub.status !== 'in_progress' || (sub.data && sub.data.stage === 'review')) return fail(409, 'closed', 'The interview part of this story is finished.');
      const d = Object.assign({}, sub.data || {});
      const cur = d.current || {q: communityOpeningQ(sub.intake), kind: 'opening'};
      const skipped = body.skip === true;
      const answer = clean(body.answer, LIMITS.answerChars);
      if (!skipped && !answer && !body.finish) return fail(400, 'empty', 'Type or record an answer, or skip this question.');
      if (cur.kind === 'opening' && skipped) return fail(400, 'empty', 'Please answer the first question in your own words.');
      const turns = (sub.turns || []).slice();
      if (answer || skipped) turns.push({q: cur.q, kind: cur.kind, a: skipped ? '' : answer, status: skipped ? 'skipped' : 'answered', at: now.toISOString(), voice: body.voice === true});
      const asked = turns.filter((t: Any) => t.kind === 'followup').length;
      if (body.finish || cur.kind === 'closing') {
        if (!turns.some((t: Any) => t.status === 'answered')) return fail(400, 'empty', 'Please answer at least the first question.');
        d.current = null; d.stage = 'answered';
        await save(sub.id, {turns, data: d});
        return json({done: true});
      }
      let next = {q: COMMUNITY_CLOSING_Q, kind: 'closing'} as Any;
      if (asked < LIMITS.followUps && (sub.ai_calls || 0) < LIMITS.aiCalls && !(d.enough && asked >= 3)) {
        const prompt = (avoid: string) => communityInterviewPrompt({intake: sub.intake, turns, notes: d.notes, asked, target: LIMITS.targetFollowUps, type: sub.story_type, avoid});
        let calls = 0;
        try {
          calls++; let r = parseJson(await deps.claude(prompt(''), {json: true}));
          let q = clean(r && r.question, 300);
          const dup = q && turns.find((t: Any) => overlap(t.q, q) >= 0.7);
          if (dup) { calls++; const r2 = parseJson(await deps.claude(prompt(dup.q), {json: true})); const q2 = clean(r2 && r2.question, 300); if (q2 && !turns.some((t: Any) => overlap(t.q, q2) >= 0.7)) { r = r2; q = q2; } }
          if (q && asked < LIMITS.targetFollowUps + 2) { next = {q, kind: 'followup', why: clean(r.why, 120)}; d.notes = r.notes && typeof r.notes === 'object' ? r.notes : d.notes; d.enough = r.enough === true; }
        } catch (e) { console.error('community interview question failed', String((e as Error).message || e)); }
        await save(sub.id, {ai_calls: (sub.ai_calls || 0) + calls});
      }
      if (next.kind === 'followup' && asked >= LIMITS.targetFollowUps && d.enough) next = {q: COMMUNITY_CLOSING_Q, kind: 'closing'};
      d.current = next;
      await save(sub.id, {turns, data: d});
      return json({question: next.q, kind: next.kind, asked: asked + (next.kind === 'followup' ? 1 : 0)});
    }

    if (action === 'finish') {
      if (sub.status !== 'in_progress') return fail(409, 'closed', 'This story has already been submitted.');
      const turns = sub.turns || [];
      if (!turns.some((t: Any) => t.status === 'answered')) return fail(400, 'empty', 'Please answer at least the first question.');
      const transcript = turns.map((t: Any) => 'Q: ' + t.q + '\nA: ' + (t.status === 'skipped' ? '(skipped)' : t.a)).join('\n\n');
      const d = Object.assign({}, sub.data || {}, {stage: 'review', current: null});
      let analysis = null, calls = 0;
      if ((sub.ai_calls || 0) < LIMITS.aiCalls + 4) {
        const prompt = communityAnalysisPrompt({intake: sub.intake, transcript, type: sub.story_type, today: now.toISOString().slice(0, 10)});
        try { calls++; analysis = parseJson(await deps.claude(prompt, {json: true})); if (!analysis) { calls++; analysis = parseJson(await deps.claude(prompt + '\n\nYour previous reply could not be read as JSON. Reply with only the JSON object.', {json: true})); } }
        catch (e) { console.error('community analysis failed', String((e as Error).message || e)); }
      }
      d.analysisFailed = !analysis;
      await save(sub.id, {analysis, data: d, ai_calls: (sub.ai_calls || 0) + calls});
      return json(view(Object.assign({}, sub, {analysis, data: d})));
    }

    const edits = (b: Any) => {
      const e = b && typeof b === 'object' ? b : {};
      const out: Any = {};
      if (typeof e.story === 'string') out.story = clean(e.story, 8000);
      if (Array.isArray(e.removed)) out.removed = e.removed.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n < 60).slice(0, 60);
      if (typeof e.note === 'string') out.note = clean(e.note, 2000);
      return out;
    };
    const pub = (p: unknown) => publicationOptions(sub.intake || {}).includes(String(p)) ? String(p) : null;

    if (action === 'submit') {
      if (sub.status !== 'in_progress') return fail(409, 'closed', 'This story has already been submitted.');
      if (!(sub.turns || []).some((t: Any) => t.status === 'answered')) return fail(400, 'empty', 'Please answer at least the first question.');
      if (!sub.data || sub.data.stage !== 'review') return fail(409, 'review_first', 'Please finish the interview and check your story before sending it.');
      const p = pub(body.publication); if (!p) return fail(400, 'publication', 'Choose how ABG may use your story.');
      const patch = {status: 'pending_review', submitted_at: now.toISOString(), contributor_edits: edits(body.edits), publication_consent: p, data: Object.assign({}, sub.data, {stage: 'submitted'})};
      await save(sub.id, patch);
      return json(view(Object.assign({}, sub, patch)));
    }
    if (action === 'update') {
      if (!['pending_review', 'needs_clarification'].includes(sub.status)) return fail(409, 'closed', "This story can't be changed now. You can still request its removal.");
      const ce = Object.assign({}, sub.contributor_edits || {}, edits(body.edits));
      const patch: Any = {contributor_edits: ce};
      if (body.publication != null) { const p = pub(body.publication); if (!p) return fail(400, 'publication', 'Choose how ABG may use your story.'); patch.publication_consent = p; }
      await save(sub.id, patch); await logEvent(sub.id, 'contributor_edited', {fields: Object.keys(edits(body.edits)).concat(patch.publication_consent ? ['publication'] : [])});
      return json(view(Object.assign({}, sub, patch)));
    }
    if (action === 'reply') {
      if (sub.status !== 'needs_clarification') return fail(409, 'closed', 'ABG has no open question about this story.');
      const text = clean(body.text, 2000); if (!text) return fail(400, 'empty', 'Type your answer first.');
      const patch = {clarifications: (sub.clarifications || []).concat([{from: 'contributor', text, at: now.toISOString()}]), status: 'pending_review'};
      await save(sub.id, patch);
      return json(view(Object.assign({}, sub, patch)));
    }
    if (action === 'remove') {
      if (sub.status === 'removal_requested') return json(view(sub));
      const patch = {status: 'removal_requested', removal_requested_at: now.toISOString()};
      await save(sub.id, patch);
      // an approved story leaves reporting immediately; ABG then deletes it
      if (sub.story_id) {
        const path = 'stories/' + sub.story_id;
        const {data: doc} = await db.from('docs').select('data').eq('path', path).maybeSingle();
        if (doc && doc.data) await db.from('docs').update({data: Object.assign({}, doc.data, {review: Object.assign({}, doc.data.review || {}, {status: 'withdrawn', at: now.toISOString(), by: 'contributor'})}), updated_at: now.toISOString()}).eq('path', path);
      }
      return json(view(Object.assign({}, sub, patch)));
    }
    return fail(400, 'unknown', 'Unknown action');
  } catch (e) {
    console.error('community action failed', action, String((e as Error).message || e));
    return fail(500, 'server', 'Something went wrong on our side. Your answers are saved; please try again.');
  }
}
