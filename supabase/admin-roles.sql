-- ABG Impact Journal: administrators, user roles and audit history.
-- Run once in Supabase: SQL Editor > New query > paste all of this > Run. Safe to run again.
--
-- Roles: 'admin' (manage users, settings and everything else) or 'user' (standard user: record and
-- work with stories). Roles are stored in public.user_roles, keyed by the person's authenticated email.
-- Nobody can change roles from the browser: only the "admin" Edge Function (which checks that the caller
-- is an administrator) writes this table, and every change is recorded in public.audit_log.

-- 1. Roles
create table if not exists public.user_roles (
  email       text primary key check (email = lower(email)),
  role        text not null check (role in ('admin', 'user')),
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.user_roles enable row level security;
-- read policy is created below, after the helper function exists.
-- no insert, update or delete policies: only the Edge Function (service role) can change roles

-- 2. Audit history
create table if not exists public.audit_log (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  actor_email   text,
  action        text not null,
  target_email  text,
  details       jsonb not null default '{}'::jsonb
);
alter table public.audit_log enable row level security;
drop policy if exists "Admins can read the audit log" on public.audit_log;

-- 3. Helper checks used by the access rules (security definer so they can read roles and account status)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where email = lower(coalesce(auth.jwt()->>'email', '')) and role = 'admin');
$$;
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select banned_until is null or banned_until < now() from auth.users where id = auth.uid()), false);
$$;
-- (the roles policy above references is_admin; recreate it now that the function exists)
drop policy if exists "See own role, admins see all" on public.user_roles;
create policy "See own role, admins see all" on public.user_roles for select to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email', '')) or public.is_admin());
create policy "Admins can read the audit log" on public.audit_log for select to authenticated using (public.is_admin());

-- 4. Never leave the journal without an administrator
create or replace function public.keep_one_admin() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'The journal must keep at least one administrator.';
  end if;
  return null;
end $$;
drop trigger if exists keep_one_admin on public.user_roles;
create constraint trigger keep_one_admin after update or delete on public.user_roles
  deferrable initially deferred for each row execute function public.keep_one_admin();

-- 5. Journal data rules, enforced on the server:
--    signed-in, active (not deactivated) users can read and write stories;
--    application settings (config/...) can be changed only by administrators;
--    each person can change only their own profile record (members/<their id>).
drop policy if exists "Invited users can read"   on public.docs;
drop policy if exists "Invited users can add"    on public.docs;
drop policy if exists "Invited users can edit"   on public.docs;
drop policy if exists "Invited users can delete" on public.docs;
create policy "Invited users can read" on public.docs for select to authenticated using (public.is_active_user());
create policy "Invited users can add" on public.docs for insert to authenticated
  with check (public.is_active_user()
    and (path not like 'config/%' or public.is_admin())
    and (path not like 'members/%' or path = 'members/' || auth.uid()::text));
create policy "Invited users can edit" on public.docs for update to authenticated
  using (public.is_active_user()
    and (path not like 'config/%' or public.is_admin())
    and (path not like 'members/%' or path = 'members/' || auth.uid()::text))
  with check (public.is_active_user()
    and (path not like 'config/%' or public.is_admin())
    and (path not like 'members/%' or path = 'members/' || auth.uid()::text));
create policy "Invited users can delete" on public.docs for delete to authenticated
  using (public.is_active_user()
    and (path not like 'config/%' or public.is_admin())
    and (path not like 'members/%' or path = 'members/' || auth.uid()::text));

drop policy if exists "Invited users can listen" on storage.objects;
drop policy if exists "Invited users can upload" on storage.objects;
drop policy if exists "Invited users can delete recordings" on storage.objects;
create policy "Invited users can listen" on storage.objects for select to authenticated using (bucket_id = 'recordings' and public.is_active_user());
create policy "Invited users can upload" on storage.objects for insert to authenticated with check (bucket_id = 'recordings' and public.is_active_user());
create policy "Invited users can delete recordings" on storage.objects for delete to authenticated using (bucket_id = 'recordings' and public.is_active_user());

-- an earlier optional roles experiment, no longer used
drop function if exists public.journal_role();

-- 6. One-time setup of the five administrators (matched by authenticated email).
--    Kyle Denman, ABG Director: kyle@artsbridgingthegap.org. Takes effect when he signs in with that address.
insert into public.user_roles (email, role, updated_by) values
  ('kyle@artsbridgingthegap.org', 'admin', 'setup'),
  ('jacob.pajimola@pepperdine.edu', 'admin', 'setup'),
  ('amanda.sun@pepperdine.edu', 'admin', 'setup'),
  ('ryan.graves@pepperdine.edu', 'admin', 'setup'),
  ('amanda.mola@pepperdine.edu', 'admin', 'setup')
on conflict (email) do nothing;
insert into public.audit_log (actor_email, action, target_email, details)
select 'setup', 'admin_granted', r.email, '{"source": "one-time setup"}'::jsonb
from public.user_roles r
where r.updated_by = 'setup' and not exists (select 1 from public.audit_log a where a.action = 'admin_granted' and a.target_email = r.email and a.actor_email = 'setup');
