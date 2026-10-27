/*
 * Platform layer: gives the journal the same small interface it used inside Claude
 * (db, user, sample, downloads) but backed by Supabase, the Claude API and Groq.
 *
 *   db        -> Supabase table `docs` (one JSON document per row), live via Realtime
 *   user      -> the signed-in Supabase user
 *   sample    -> Supabase Edge Function `ai` (calls the Claude API server-side)
 *   downloads -> a normal browser download
 *   audio     -> Supabase Storage bucket `recordings` + Edge Function `transcribe` (Groq Whisper)
 */

const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const META = {fromCache: false, hasPendingWrites: false};

function isPlainObject(v){ return v && typeof v === 'object' && !Array.isArray(v); }
function merge(a, b){
  const out = Object.assign({}, a);
  for (const k of Object.keys(b)) out[k] = isPlainObject(b[k]) && isPlainObject(a[k]) ? merge(a[k], b[k]) : b[k];
  return out;
}
function dbError(e){
  const msg = (e && e.message) || '';
  if (e && (e.code === '42501' || /row-level security|permission/i.test(msg))) return {code: 'invalid_argument', message: msg};
  if (e && e.code === '54000') return {code: 'quota_exceeded', message: msg};
  return {code: 'unavailable', message: msg || 'Network error'};
}

export function makeDb(sb){
  const listeners = new Set();
  let timer = null;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(() => listeners.forEach(l => l.run()), 150); };

  sb.channel('docs-changes').on('postgres_changes', {event: '*', schema: 'public', table: 'docs'}, refresh).subscribe();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(refresh, 60000);

  const snapDoc = (id, data) => ({id, exists: data != null, data: () => (data == null ? undefined : clone(data)), metadata: META});
  const snapQuery = rows => { const docs = rows.map(r => snapDoc(r.id, r.data)); return {docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: META}; };

  async function readDoc(path){
    const {data, error} = await sb.from('docs').select('id,data').eq('path', path).maybeSingle();
    if (error) throw dbError(error);
    return data;
  }
  function listen(run, next, onErr){
    const l = {run: async () => { try { next(await run()); } catch (e) { if (onErr) onErr(e && e.code ? e : dbError(e)); } }};
    listeners.add(l); l.run();
    return () => listeners.delete(l);
  }
  function docRef(path){
    const parts = path.split('/');
    if (parts.length % 2 !== 0) throw new TypeError('A document path needs an even number of segments: ' + path);
    const id = parts[parts.length - 1];
    const collection = parts.slice(0, -1).join('/');
    const get = async () => { const r = await readDoc(path); return snapDoc(id, r ? r.data : null); };
    return {
      id, path, get,
      async set(data){
        const {error} = await sb.from('docs').upsert({path, collection, id, data: clone(data), updated_at: new Date().toISOString()});
        if (error) throw dbError(error);
        refresh();
      },
      async update(patch){
        const cur = await readDoc(path);
        if (!cur) throw {code: 'invalid_argument', message: 'Document does not exist: ' + path};
        const {error} = await sb.from('docs').update({data: merge(cur.data, clone(patch)), updated_at: new Date().toISOString()}).eq('path', path);
        if (error) throw dbError(error);
        refresh();
      },
      async delete(){
        const {error} = await sb.from('docs').delete().eq('path', path);
        if (error) throw dbError(error);
        refresh();
      },
      onSnapshot: (next, onErr) => listen(get, next, onErr),
      collection: sub => colRef(path + '/' + sub),
    };
  }
  function query(collection, filters){
    const run = async () => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        let q = sb.from('docs').select('id,data').eq('collection', collection);
        for (const f of filters) q = q.eq('data->>' + f.field, String(f.value));
        const {data, error} = await q.order('id').range(from, from + 999);
        if (error) throw dbError(error);
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return snapQuery(rows);
    };
    return {
      where: (field, op, value) => query(collection, filters.concat([{field, value}])),
      orderBy: () => query(collection, filters),
      limit: () => query(collection, filters),
      get: run,
      onSnapshot: (next, onErr) => listen(run, next, onErr),
    };
  }
  function colRef(collection){
    const parts = collection.split('/');
    if (parts.length % 2 !== 1) throw new TypeError('A collection path needs an odd number of segments: ' + collection);
    return Object.assign(query(collection, []), {
      path: collection,
      doc: id => docRef(collection + '/' + (id || crypto.randomUUID())),
      add: async data => { const r = docRef(collection + '/' + crypto.randomUUID()); await r.set(data); return r; },
    });
  }
  return Object.freeze({doc: docRef, collection: colRef});
}

export function makeUser(sb, authUser, db){
  const name = (authUser.user_metadata && (authUser.user_metadata.full_name || authUser.user_metadata.name)) || (authUser.email || '').split('@')[0];
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  const me = {id: authUser.id, name: pretty, role: '', email: authUser.email || null, avatarUrl: '', color: '#2A726D', isOwner: true, canEdit: true};
  /* keep a name and role the person set in Settings; otherwise start from the account name */
  const ref = db.doc('members/' + authUser.id);
  const loaded = ref.get().then(snap => {
    const d = snap.exists ? (snap.data() || {}) : null;
    if (d && d.name) { me.name = d.name; me.role = d.role || ''; me.firstName = d.firstName || ''; me.lastName = d.lastName || ''; me.phone = d.phone || ''; me.photo = d.photo || ''; const now = new Date().toISOString(); return ref.update(Object.assign({email: authUser.email || '', lastSeen: now}, d.joinedAt ? {} : {joinedAt: d.lastSeen || now})); }
    const now = new Date().toISOString();
    return ref.set(Object.assign({}, d || {}, {name: pretty, role: (d && d.role) || '', email: authUser.email || '', lastSeen: now, joinedAt: (d && d.joinedAt) || now}));
  }).catch(() => {});
  return Object.freeze({
    me: async () => { await loaded; return me; },
    id: async () => me.id,
    name: async () => me.name,
    email: async () => me.email,
    isOwner: async () => true,
    canEdit: async () => true,
    can: async () => true,
    profiles: async ids => {
      const list = Array.isArray(ids) ? ids : [ids];
      const out = {};
      await Promise.all(list.map(async id => {
        let n = '';
        try { const s = await db.doc('members/' + id).get(); n = s.exists ? (s.data().name || '') : ''; } catch (e) {}
        out[id] = {id, name: n, avatarUrl: '', color: '#2A726D', email: null, isMe: id === me.id, guest: false};
      }));
      return out;
    },
    search: async () => [],
  });
}

async function authHeaders(sb, anonKey){
  const {data} = await sb.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw {code: 'session_expired', message: 'Not signed in'};
  return {Authorization: 'Bearer ' + token, apikey: anonKey, 'Content-Type': 'application/json'};
}
async function callFunction(sb, url, anonKey, name, body, signal){
  let res;
  try {
    res = await fetch(url + '/functions/v1/' + name, {method: 'POST', headers: await authHeaders(sb, anonKey), body: JSON.stringify(body), signal});
  } catch (e) {
    if (e && e.code) throw e;
    if (e && e.name === 'AbortError') throw {code: 'cancelled', message: 'Stopped'};
    throw {code: 'upstream_error', message: 'Network error'};
  }
  let payload = null;
  try { payload = await res.json(); } catch (e) {}
  if (!res.ok) {
    const code = res.status === 429 ? 'rate_limited' : res.status === 401 ? 'session_expired' : (payload && payload.code) || 'upstream_error';
    throw {code, message: (payload && payload.error) || ('Request failed (' + res.status + ')')};
  }
  return payload || {};
}
/* models sometimes put raw line breaks or tabs inside JSON strings; escape them so the JSON parses */
function repairJson(s){
  let out = '', inStr = false, esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === '\\') { esc = true; out += ch; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
    } else { if (ch === '"') inStr = true; out += ch; }
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}
function parseJsonLoose(text){
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) {}
  try { return JSON.parse(repairJson(t)); } catch (e) {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} try { return JSON.parse(repairJson(fence[1])); } catch (e) {} }
  const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { const mid = t.slice(a, b + 1); try { return JSON.parse(mid); } catch (e) {} try { return JSON.parse(repairJson(mid)); } catch (e) {} }
  throw {code: 'invalid_json', message: 'The reply was not valid JSON', text: t};
}
export function makeSample(sb, url, anonKey){
  async function run(input, opts, json){
    opts = opts || {};
    const r = await callFunction(sb, url, anonKey, 'ai', {input, tier: opts.modelTier || 'default', json: !!json}, opts.signal);
    if (r.refused) throw {code: 'refused', message: 'Claude declined this request'};
    const text = String(r.text || '');
    if (!text.trim()) throw {code: 'empty_completion', message: 'Empty reply'};
    if (opts.onText) { try { opts.onText({text, delta: text}); } catch (e) {} }
    return {text, truncated: !!r.truncated, modelTierApplied: opts.modelTier || 'default'};
  }
  const sample = (input, opts) => run(input, opts, false);
  sample.json = async (input, opts) => {
    const r = await run(input, opts, true);
    if (r.truncated) throw {code: 'invalid_json', message: 'The reply was cut short', text: r.text};
    return parseJsonLoose(r.text);
  };
  sample.limits = async () => ({maxPromptBytes: 262144});
  return sample;
}

const MIME = {csv: 'text/csv;charset=utf-8', md: 'text/markdown;charset=utf-8', txt: 'text/plain;charset=utf-8', json: 'application/json'};
export const downloads = Object.freeze({
  save: async ({filename, data}) => {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const blob = data instanceof Blob ? data : new Blob([data], {type: MIME[ext] || 'application/octet-stream'});
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    return {status: 'saved'};
  },
});

/* natural voice: the speak function returns MP3 audio for a short piece of text */
export function makeSpeech(sb, url, anonKey){
  return Object.freeze({
    /* returns one or more audio clip URLs to play in order */
    async synth(text, voice, signal){
      const r = await callFunction(sb, url, anonKey, 'speak', {text, voice}, signal);
      const list = Array.isArray(r.audios) ? r.audios : (r.audio ? [r.audio] : []);
      if (!list.length) throw {code: 'tts_error', message: 'No audio returned'};
      return list.map(b64 => {
        const bin = atob(b64); const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], {type: r.type || 'audio/wav'}));
      });
    },
  });
}

export function makeAudio(sb, url, anonKey){
  const BUCKET = 'recordings';
  return Object.freeze({
    maxBytes: 25 * 1024 * 1024,
    async upload(blob){
      const type = blob.type || 'audio/webm';
      const ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /mpeg|mp3/.test(type) ? 'mp3' : /wav/.test(type) ? 'wav' : /ogg/.test(type) ? 'ogg' : 'webm';
      const d = new Date();
      const path = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + crypto.randomUUID() + '.' + ext;
      const {error} = await sb.storage.from(BUCKET).upload(path, blob, {contentType: type.split(';')[0], upsert: false});
      if (error) throw {code: 'upload_failed', message: error.message};
      return path;
    },
    async transcribe(path, signal){
      const r = await callFunction(sb, url, anonKey, 'transcribe', {path}, signal);
      return String(r.text || '').trim();
    },
    async url(path){
      const {data, error} = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    async remove(paths){
      const list = (paths || []).filter(Boolean);
      if (list.length) await sb.storage.from(BUCKET).remove(list);
    },
  });
}

/* administrator actions, carried out by the "admin" Edge Function, which checks the caller's role on the server */
export function makeAdmin(sb, url, anonKey){
  return async (action, payload) => {
    const headers = await authHeaders(sb, anonKey);
    let res;
    try { res = await fetch(url + '/functions/v1/admin', {method: 'POST', headers, body: JSON.stringify(Object.assign({action}, payload || {}))}); }
    catch (e) { throw {message: "Couldn't reach the journal. Check your connection and try again."}; }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw {message: (data && data.error) || (res.status === 404 ? 'User management is not set up on the server yet.' : "That didn't work. Try again."), code: data && data.code, status: res.status};
    return data;
  };
}
/* this person's role, from the server-side roles table (standard user unless an administrator assigned otherwise) */
export function makeRole(sb, email){
  return async () => {
    const e = String(email || '').toLowerCase();
    const {data, error} = await sb.from('user_roles').select('role').eq('email', e).maybeSingle();
    if (error) return 'user';
    return (data && data.role) || 'user';
  };
}
