// Supabase Edge Function: speak
// Turns an interview question into natural speech.
// Default: Groq (Orpheus voices), using the GROQ_API_KEY secret already set for transcription.
//   Orpheus accepts about 200 characters per request, so longer questions are split and returned as several clips.
// Optional: set TTS_PROVIDER=google and GOOGLE_TTS_API_KEY to use Google Cloud Text-to-Speech (Chirp 3 HD) instead.
// The function checks the caller's sign-in itself, so it works whether or not "Verify JWT" is on.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...CORS, 'Content-Type': 'application/json'}});

// Works with both legacy keys (SUPABASE_SERVICE_ROLE_KEY) and the newer secret keys (SUPABASE_SECRET_KEYS).
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || '';
  try { const v = JSON.parse(raw); const first = typeof v === 'string' ? v : Object.values(v)[0]; if (first) return String(first); } catch { /* not JSON */ }
  return raw;
}
// Only signed-in journal users may call this function.
async function signedInUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {auth: {persistSession: false}});
  const {data, error} = await sb.auth.getUser(token);
  return error ? null : data.user;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'Use POST'}, 405);
  if (!(await signedInUser(req))) return json({error: 'Not signed in', code: 'session_expired'}, 401);

  let body: {text?: unknown; voice?: unknown};
  try { body = await req.json(); } catch { return json({error: 'Invalid request body'}, 400); }
  const text = String(body.text ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return json({error: 'Missing text'}, 400);
  if (text.length > 1200) return json({error: 'Text too long'}, 413);
  const asked = String(body.voice ?? '');

  if ((Deno.env.get('TTS_PROVIDER') || '').toLowerCase() === 'google') return google(text, asked);
  return groq(text, asked);
});

const GROQ_VOICES = new Set(['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy']);
// split at sentence, then comma, then word boundaries so each piece stays under the model's limit
function pieces(text: string, max = 190): string[] {
  const out: string[] = [];
  const push = (t: string) => { t = t.trim(); if (t) out.push(t); };
  for (const sentence of text.split(/(?<=[.?!])\s+/)) {
    if (sentence.length <= max) { push(sentence); continue; }
    let cur = '';
    for (const part of sentence.split(/(?<=[,;:])\s+|\s+/)) {
      if (cur && (cur + ' ' + part).length > max) { push(cur); cur = part; } else cur = cur ? cur + ' ' + part : part;
    }
    push(cur);
  }
  // join short neighbours back together to keep the number of requests low
  const merged: string[] = [];
  for (const p of out) { const last = merged[merged.length - 1]; if (last && (last + ' ' + p).length <= max) merged[merged.length - 1] = last + ' ' + p; else merged.push(p); }
  return merged;
}
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
/* spoken pieces are cached in private storage, so repeated wording never costs Groq tokens twice */
const CACHE_BUCKET = 'recordings';
async function cacheKey(model: string, voice: string, input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(model + '|' + voice + '|' + input));
  return 'tts-cache/' + voice + '/' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('') + '.wav';
}
async function groq(text: string, asked: string) {
  const key = (Deno.env.get('GROQ_API_KEY') || '').trim();
  if (!key) return json({error: 'GROQ_API_KEY is not set in Edge Function secrets', code: 'tts_not_configured'}, 500);
  const voice = GROQ_VOICES.has(asked) ? asked : (Deno.env.get('GROQ_TTS_VOICE') || 'hannah');
  const model = Deno.env.get('GROQ_TTS_MODEL') || 'canopylabs/orpheus-v1-english';
  const store = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {auth: {persistSession: false}}).storage.from(CACHE_BUCKET);
  const audios: string[] = [];
  for (const input of pieces(text)) {
    const path = await cacheKey(model, voice, input);
    try { const {data: hit} = await store.download(path); if (hit && hit.size > 100) { audios.push(toBase64(await hit.arrayBuffer())); continue; } } catch { /* not cached yet */ }
    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model, input, voice, response_format: 'wav'}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error('Groq TTS error', res.status, data);
      const msg = String((data && data.error && data.error.message) || 'Text-to-speech failed');
      const code = res.status === 429 ? 'rate_limited' : /terms/i.test(msg) ? 'tts_terms' : 'tts_error';
      return json({error: msg, code}, res.status === 429 ? 429 : 502);
    }
    const buf = await res.arrayBuffer();
    audios.push(toBase64(buf));
    try { await store.upload(path, new Blob([buf], {type: 'audio/wav'}), {upsert: true, contentType: 'audio/wav'}); } catch { /* caching is best effort */ }
  }
  return json({audios, type: 'audio/wav', voice});
}
async function google(text: string, asked: string) {
  const key = (Deno.env.get('GOOGLE_TTS_API_KEY') || '').trim();
  if (!key) return json({error: 'GOOGLE_TTS_API_KEY is not set in Edge Function secrets', code: 'tts_not_configured'}, 500);
  const voice = /^en-US-Chirp3-HD-[A-Za-z]+$/.test(asked) ? asked : (Deno.env.get('GOOGLE_TTS_VOICE') || 'en-US-Chirp3-HD-Leda');
  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {'X-Goog-Api-Key': key, 'Content-Type': 'application/json'},
    body: JSON.stringify({input: {text}, voice: {languageCode: 'en-US', name: voice}, audioConfig: {audioEncoding: 'MP3', speakingRate: 0.97}}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.audioContent) {
    console.error('Google TTS error', res.status, data);
    return json({error: (data && data.error && data.error.message) || 'Text-to-speech failed', code: res.status === 429 ? 'rate_limited' : 'tts_error'}, res.status === 429 ? 429 : 502);
  }
  return json({audios: [data.audioContent], type: 'audio/mpeg', voice});
}
