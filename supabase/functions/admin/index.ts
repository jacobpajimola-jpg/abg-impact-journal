// Supabase Edge Function: admin
// User management for ABG Impact Journal administrators: list users, invite, resend invitations,
// change roles, deactivate or reactivate, and remove access. Every change is written to public.audit_log.
// The caller's identity comes from their sign-in token (authenticated email, never a display name),
// and their role is read from public.user_roles on the server. Only administrators can make changes.
// Uses the project's built-in SUPABASE_URL and service key. Optional secret: SITE_URL (where invitations lead).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...CORS, 'Content-Type': 'application/json'}});

function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || '';
  try { const v = JSON.parse(raw); const first = typeof v === 'string' ? v : Object.values(v)[0]; if (first) return String(first); } catch { /* not JSON */ }
  return raw;
}

const ROLES = ['admin', 'user'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FAR = '876000h'; // deactivation: a ban that lasts about 100 years

// deno-lint-ignore no-explicit-any
export async function handle(req: Request, admin: any, site: string): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'Use POST'}, 405);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({error: 'Not signed in', code: 'session_expired'}, 401);
  const {data: who, error: whoErr} = await admin.auth.getUser(token);
  if (whoErr || !who || !who.user || !who.user.email) return json({error: 'Not signed in', code: 'session_expired'}, 401);
  const me = String(who.user.email).toLowerCase();

  let body: {action?: string; email?: string; role?: string} = {};
  try { body = await req.json(); } catch { return json({error: 'Invalid request body'}, 400); }
  const action = String(body.action || '');

  const roleRows = async (): Promise<{email: string; role: string; updated_at?: string}[]> => {
    const {data, error} = await admin.from('user_roles').select('email, role, updated_at');
    if (error) throw new Error('roles: ' + error.message);
    return data || [];
  };
  const rows = await roleRows();
  const roleOf = (email: string) => (rows.find(r => r.email === email) || {role: 'user'}).role;
  const myRole = roleOf(me);
  if (action === 'me') return json({email: me, role: myRole});
  if (myRole !== 'admin') return json({error: 'Only administrators can manage users.', code: 'forbidden'}, 403);

  const audit = async (what: string, target: string | null, details: Record<string, unknown> = {}) => {
    await admin.from('audit_log').insert({actor_email: me, action: what, target_email: target, details});
  };
  // deno-lint-ignore no-explicit-any
  const allUsers = async (): Promise<any[]> => {
    // deno-lint-ignore no-explicit-any
    const out: any[] = [];
    for (let page = 1; page < 50; page++) {
      const {data, error} = await admin.auth.admin.listUsers({page, perPage: 200});
      if (error) throw new Error('users: ' + error.message);
      const list = (data && data.users) || [];
      out.push(...list);
      if (list.length < 200) break;
    }
    return out;
  };
  // deno-lint-ignore no-explicit-any
  const isBanned = (u: any) => !!(u.banned_until && new Date(u.banned_until).getTime() > Date.now());
  // deno-lint-ignore no-explicit-any
  const statusOf = (u: any) => isBanned(u) ? 'deactivated' : (u.email_confirmed_at || u.confirmed_at || u.last_sign_in_at) ? 'active' : 'invited';
  // administrators who can still act: confirmed, not deactivated
  // deno-lint-ignore no-explicit-any
  const activeAdmins = (users: any[]) => users.filter(u => roleOf(String(u.email || '').toLowerCase()) === 'admin' && statusOf(u) === 'active').map(u => String(u.email).toLowerCase());
  const target = String(body.email || '').trim().toLowerCase();
  const needTarget = () => { if (!EMAIL_RE.test(target)) throw Object.assign(new Error('Enter a valid email address.'), {status: 400}); };
  const notSelf = (what: string) => { if (target === me) throw Object.assign(new Error('You can\'t ' + what + ' your own account. Ask another administrator.'), {status: 400}); };
  const keepAnAdmin = (users: unknown[]) => {
    // deno-lint-ignore no-explicit-any
    const others = activeAdmins(users as any[]).filter(e => e !== target);
    if (roleOf(target) === 'admin' && others.length === 0) throw Object.assign(new Error('This is the last active administrator. Make someone else an administrator first.'), {status: 409});
  };
  const setRole = async (email: string, role: string) => {
    const {error} = await admin.from('user_roles').upsert({email, role, updated_at: new Date().toISOString(), updated_by: me});
    if (error) throw new Error(error.message);
  };
  const invite = async (email: string) => {
    const {error} = await admin.auth.admin.inviteUserByEmail(email, {redirectTo: site});
    if (error) {
      const m = String(error.message || '');
      throw Object.assign(new Error(/rate|too many/i.test(m) ? 'Too many emails were sent recently. Wait a few minutes and try again.' : 'The invitation could not be sent: ' + m), {status: /rate|too many/i.test(m) ? 429 : 502});
    }
  };

  try {
    if (action === 'list') {
      const users = await allUsers();
      const known = new Set(users.map(u => String(u.email || '').toLowerCase()));
      const list = users.map(u => {
        const email = String(u.email || '').toLowerCase();
        return {id: u.id, email, role: roleOf(email), status: statusOf(u), invitedAt: u.invited_at || null, confirmedAt: u.email_confirmed_at || u.confirmed_at || null, lastSignIn: u.last_sign_in_at || null, createdAt: u.created_at || null};
      }).concat(rows.filter(r => !known.has(r.email)).map(r => ({id: null, email: r.email, role: r.role, status: 'not_invited', invitedAt: null, confirmedAt: null, lastSignIn: null, createdAt: null})));
      const {data: log} = await admin.from('audit_log').select('at, actor_email, action, target_email, details').order('at', {ascending: false}).limit(60);
      return json({me, users: list, audit: log || []});
    }
    if (action === 'invite') {
      needTarget();
      const role = ROLES.includes(String(body.role)) ? String(body.role) : 'user';
      if (role === 'admin' || roleOf(target) === 'admin') notSelf('change the role of');
      const users = await allUsers();
      const u = users.find(x => String(x.email || '').toLowerCase() === target);
      if (u && statusOf(u) === 'active') return json({error: target + ' already has access. Change their role in the list instead.', code: 'exists'}, 409);
      if (u && statusOf(u) === 'deactivated') return json({error: target + ' is deactivated. Reactivate them in the list instead.', code: 'deactivated'}, 409);
      if (roleOf(target) === 'admin' && role !== 'admin') keepAnAdmin(users);
      await invite(target);
      await setRole(target, role);
      await audit(u ? 'invite_resent' : 'invited', target, {role});
      return json({ok: true});
    }
    if (action === 'resend') {
      needTarget();
      const users = await allUsers();
      const u = users.find(x => String(x.email || '').toLowerCase() === target);
      if (!u) return json({error: 'No invitation found for ' + target + '. Use the invite form instead.', code: 'missing'}, 404);
      if (statusOf(u) !== 'invited') return json({error: target + ' has already accepted. They can sign in from the journal\'s sign-in page.', code: 'accepted'}, 409);
      await invite(target);
      await audit('invite_resent', target, {});
      return json({ok: true});
    }
    if (action === 'set_role') {
      needTarget(); notSelf('change the role of');
      const role = String(body.role);
      if (!ROLES.includes(role)) return json({error: 'Unknown role'}, 400);
      const from = roleOf(target);
      if (from === role) return json({ok: true});
      if (from === 'admin') keepAnAdmin(await allUsers());
      await setRole(target, role);
      await audit('role_changed', target, {from, to: role});
      return json({ok: true});
    }
    if (action === 'deactivate' || action === 'reactivate') {
      needTarget(); notSelf(action);
      const users = await allUsers();
      const u = users.find(x => String(x.email || '').toLowerCase() === target);
      if (!u) return json({error: 'No account found for ' + target, code: 'missing'}, 404);
      if (action === 'deactivate') keepAnAdmin(users);
      const {error} = await admin.auth.admin.updateUserById(u.id, {ban_duration: action === 'deactivate' ? FAR : 'none'});
      if (error) throw new Error(error.message);
      await audit(action === 'deactivate' ? 'deactivated' : 'reactivated', target, {});
      return json({ok: true});
    }
    if (action === 'remove') {
      needTarget(); notSelf('remove');
      const users = await allUsers();
      keepAnAdmin(users);
      const u = users.find(x => String(x.email || '').toLowerCase() === target);
      if (u) {
        const {error} = await admin.auth.admin.deleteUser(u.id);
        if (error) throw new Error(error.message);
        await admin.from('docs').delete().eq('path', 'members/' + u.id);
      }
      if (rows.some(r => r.email === target)) {
        const {error} = await admin.from('user_roles').delete().eq('email', target);
        if (error) throw new Error(error.message);
      }
      await audit('removed', target, {role: roleOf(target)});
      return json({ok: true});
    }
    return json({error: 'Unknown action'}, 400);
  } catch (e) {
    const err = e as {message?: string; status?: number};
    const msg = String(err.message || 'Something went wrong');
    if (!err.status) console.error('admin action failed', action, msg);
    return json({error: /at least one administrator/i.test(msg) ? 'The journal must keep at least one administrator.' : msg}, err.status || 500);
  }
}

if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve(req => handle(req, createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {auth: {persistSession: false}}), Deno.env.get('SITE_URL') || 'https://abg-impact-journal.pages.dev'));
}
