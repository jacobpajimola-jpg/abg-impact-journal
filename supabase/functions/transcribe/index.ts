// Supabase Edge Function: transcribe
// Downloads a recording from the private `recordings` bucket and transcribes it with Groq Whisper.
// Secrets required (Edge Functions > Secrets): GROQ_API_KEY
// Optional: GROQ_WHISPER_MODEL (default whisper-large-v3)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically.
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

  const groq = Deno.env.get('GROQ_API_KEY');
  if (!groq) return json({error: 'GROQ_API_KEY is not set in Edge Function secrets'}, 500);

  let path = '';
  try { path = String((await req.json()).path || ''); } catch { return json({error: 'Invalid request body'}, 400); }
  if (!path || path.includes('..')) return json({error: 'Missing or invalid path'}, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {auth: {persistSession: false}});
  const {data: file, error} = await admin.storage.from('recordings').download(path);
  if (error || !file) return json({error: 'Recording not found'}, 404);
  if (file.size > 25 * 1024 * 1024) return json({error: 'Recording is larger than 25 MB'}, 413);

  const name = path.split('/').pop() || 'audio.webm';
  const form = new FormData();
  form.append('file', new File([file], name, {type: file.type || 'audio/webm'}));
  form.append('model', Deno.env.get('GROQ_WHISPER_MODEL') || 'whisper-large-v3');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', 'Arts Bridging the Gap (ABG) staff describing students, murals, workshops and arts programs.');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {method: 'POST', headers: {Authorization: `Bearer ${groq}`}, body: form});
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('Groq error', res.status, data);
    return json({error: (data && data.error && data.error.message) || 'Transcription failed', code: res.status === 429 ? 'rate_limited' : 'upstream_error'}, res.status === 429 ? 429 : 502);
  }
  return json({text: (data && data.text) || ''});
});
