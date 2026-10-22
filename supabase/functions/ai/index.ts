// Supabase Edge Function: ai
// Calls the Claude API on the server so the API key never reaches the browser.
// Secrets required (Edge Functions > Secrets): ANTHROPIC_API_KEY
// Optional: ANTHROPIC_MODEL (default claude-sonnet-5-5), ANTHROPIC_MODEL_FAST (default claude-haiku-5-5)
// Keep "Verify JWT" ON for this function so only signed-in journal users can call it.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...CORS, 'Content-Type': 'application/json'}});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'Use POST'}, 405);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({error: 'ANTHROPIC_API_KEY is not set in Edge Function secrets', code: 'sampling_disabled'}, 500);

  let body: {input?: unknown; tier?: string; json?: boolean};
  try { body = await req.json(); } catch { return json({error: 'Invalid request body'}, 400); }

  const input = body.input;
  let messages: {role: string; content: string}[];
  if (typeof input === 'string' && input.trim()) messages = [{role: 'user', content: input}];
  else if (Array.isArray(input) && input.length) messages = input.map((m: {role?: string; content?: unknown}) => ({role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '')}));
  else return json({error: 'Missing input'}, 400);
  if (JSON.stringify(messages).length > 300000) return json({error: 'Input too large', code: 'prompt_too_large'}, 413);

  const quick = body.tier === 'quick';
  const model = quick ? (Deno.env.get('ANTHROPIC_MODEL_FAST') || 'claude-haiku-5-5') : (Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5');
  const system = 'You support Arts Bridging the Gap, a Los Angeles youth arts nonprofit, in documenting its impact accurately. Never invent facts, numbers, names or quotes.' +
    (body.json ? ' Your reply will be parsed by a program: reply with only the JSON value requested, with no Markdown fences or commentary.' : '');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
    body: JSON.stringify({model, max_tokens: quick ? 800 : 6000, system, messages}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const status = res.status === 429 || res.status === 529 ? 429 : 502;
    console.error('Claude API error', res.status, data);
    return json({error: (data && data.error && data.error.message) || 'Claude API error', code: status === 429 ? 'rate_limited' : 'upstream_error'}, status);
  }
  const text = (data.content || []).filter((b: {type: string}) => b.type === 'text').map((b: {text: string}) => b.text).join('');
  return json({text, truncated: data.stop_reason === 'max_tokens', refused: data.stop_reason === 'refusal'});
});
