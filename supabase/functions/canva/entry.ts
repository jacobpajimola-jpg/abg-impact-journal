// Deployed entry point for the canva Edge Function (bundled into index.ts by scripts/build-canva.mjs).
// Secrets (Edge Functions > Secrets):
//   CANVA_CLIENT_ID, CANVA_CLIENT_SECRET   from your Canva integration (canva.com/developers > Your integrations)
//   CANVA_TOKEN_KEY                        any long random text; used to encrypt the stored Canva tokens
//   SITE_URL                               the journal's address, e.g. https://abg-impact-journal.pages.dev
// In the Canva integration, set the redirect URL to: <your Supabase project URL>/functions/v1/canva/callback
// Deploy with "Verify JWT" turned OFF: Canva's redirect arrives without a sign-in token. The function checks the
// caller's sign-in itself for every other request.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.ts';

function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || '';
  try { const v = JSON.parse(raw); const first = typeof v === 'string' ? v : Object.values(v)[0]; if (first) return String(first); } catch { /* not JSON */ }
  return raw;
}
Deno.serve(req => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {auth: {persistSession: false, autoRefreshToken: false}});
  const env = {
    clientId: Deno.env.get('CANVA_CLIENT_ID') || '', clientSecret: Deno.env.get('CANVA_CLIENT_SECRET') || '', tokenKey: Deno.env.get('CANVA_TOKEN_KEY') || '',
    redirectUri: (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '') + '/functions/v1/canva/callback',
    siteUrl: Deno.env.get('SITE_URL') || 'https://abg-impact-journal.pages.dev',
  };
  const getUser = async (jwt: string) => {
    const {data, error} = await db.auth.getUser(jwt);
    const u = data && data.user;
    if (error || !u || !u.email) return null;
    return {email: String(u.email), banned: !!(u.banned_until && new Date(u.banned_until).getTime() > Date.now())};
  };
  return handle(req, {db, env, fetch, getUser});
});
