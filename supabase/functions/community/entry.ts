// Deployed entry point for the community Edge Function (bundled into index.ts).
// Secrets (Edge Functions > Secrets): ANTHROPIC_API_KEY and GROQ_API_KEY (the same ones the ai and transcribe
// functions use). Optional: ANTHROPIC_MODEL, ANTHROPIC_MODEL_FAST, ANTHROPIC_WORKSPACE_ID, GROQ_WHISPER_MODEL.
// Deploy with "Verify JWT" turned OFF: the public calls it without signing in, and it does its own checks.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.ts';

function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || '';
  try { const v = JSON.parse(raw); const first = typeof v === 'string' ? v : Object.values(v)[0]; if (first) return String(first); } catch { /* not JSON */ }
  return raw;
}
async function claude(prompt: string, opts: {json?: boolean; quick?: boolean}): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const model = opts.quick ? (Deno.env.get('ANTHROPIC_MODEL_FAST') || 'claude-haiku-5-5') : (Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5');
  const headers: Record<string, string> = {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'};
  const ws = (Deno.env.get('ANTHROPIC_WORKSPACE_ID') || '').trim(); if (ws) headers['anthropic-workspace-id'] = ws;
  const system = 'You support Arts Bridging the Gap, a Los Angeles youth arts nonprofit, in documenting its impact accurately. Never invent facts, numbers, names or quotes.' + (opts.json ? ' Reply with only the JSON value requested, with no Markdown fences or commentary.' : '');
  const res = await fetch('https://api.anthropic.com/v1/messages', {method: 'POST', headers, body: JSON.stringify({model, max_tokens: 8000, system, messages: [{role: 'user', content: prompt}]})});
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Claude API ' + res.status + ' ' + ((data && data.error && data.error.message) || ''));
  return (data.content || []).filter((b: {type: string}) => b.type === 'text').map((b: {text: string}) => b.text).join('');
}
async function transcribe(bytes: Uint8Array, mime: string): Promise<string> {
  const groq = Deno.env.get('GROQ_API_KEY');
  if (!groq) throw new Error('GROQ_API_KEY is not set');
  const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new File([bytes], 'answer.' + ext, {type: mime}));
  form.append('model', Deno.env.get('GROQ_WHISPER_MODEL') || 'whisper-large-v3');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', 'A community member describing their experience with Arts Bridging the Gap (ABG), an arts education nonprofit.');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {method: 'POST', headers: {Authorization: `Bearer ${groq}`}, body: form});
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Groq ' + res.status);
  return (data && data.text) || '';
}
Deno.serve(req => {
  const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '';
  return handle(req, {db: createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {auth: {persistSession: false}}), claude, transcribe, ip});
});
