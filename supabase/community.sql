-- ABG Impact Journal: Community Story Collection Portal.
-- Run once in Supabase: SQL Editor > New query > paste all of this > Run. Safe to run again.
-- Requires admin-roles.sql (it uses public.is_admin() and public.is_active_user()).
--
-- Community contributors never get a Supabase account and have NO direct access to any table here:
-- everything they do goes through the "community" Edge Function, which uses the service key and checks
-- their private link token. Signed-in, active journal users (staff) can read submissions; only
-- administrators can review, change or delete them. Every status or review change is logged.

-- 1. Individual invitation links (only a SHA-256 hash of each link token is stored)
create table if not exists public.community_invites (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  label         text,
  relationship  text,
  minor_consent boolean not null default false,  -- an administrator confirmed guardian consent is on file
  note          text,
  created_by    text not null default lower(coalesce(auth.jwt()->>'email', '')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days',
  max_uses      int not null default 1 check (max_uses between 1 and 100),
  uses          int not null default 0,
  revoked_at    timestamptz
);
alter table public.community_invites enable row level security;
drop policy if exists "Staff see invitations" on public.community_invites;
drop policy if exists "Staff create invitations" on public.community_invites;
drop policy if exists "Staff revoke invitations" on public.community_invites;
create policy "Staff see invitations" on public.community_invites for select to authenticated using (public.is_active_user());
-- anyone on staff can create an ordinary invitation; only administrators can record guardian consent for a minor
create policy "Staff create invitations" on public.community_invites for insert to authenticated
  with check (public.is_active_user() and created_by = lower(coalesce(auth.jwt()->>'email', '')) and uses = 0 and revoked_at is null and (minor_consent = false or public.is_admin()));
create policy "Staff revoke invitations" on public.community_invites for update to authenticated
  using (public.is_active_user()) with check (public.is_active_user() and (minor_consent = false or public.is_admin()));

-- 2. Community submissions
create table if not exists public.community_submissions (
  id                   uuid primary key default gen_random_uuid(),
  token_hash           text not null unique,
  invite_id            uuid references public.community_invites(id) on delete set null,
  status               text not null default 'in_progress' check (status in ('in_progress', 'pending_review', 'needs_clarification', 'approved', 'rejected', 'removal_requested')),
  relationship         text not null,
  perspective          text not null check (perspective in ('self', 'witnessed')),
  story_type           text not null check (story_type in ('student', 'staff', 'general')),
  is_minor             boolean not null default false,
  intake               jsonb not null default '{}'::jsonb,
  turns                jsonb not null default '[]'::jsonb,
  data                 jsonb not null default '{}'::jsonb,
  analysis             jsonb,
  contributor_edits    jsonb not null default '{}'::jsonb,
  clarifications       jsonb not null default '[]'::jsonb,
  publication_consent  text not null default 'internal' check (publication_consent in ('public_name', 'anonymous', 'internal')),
  recording_consent    boolean not null default false,
  review               jsonb not null default '{}'::jsonb,
  story_id             text,
  ip_hash              text,
  ai_calls             int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  submitted_at         timestamptz,
  removal_requested_at timestamptz
);
create index if not exists community_submissions_status on public.community_submissions (status, submitted_at desc);
create index if not exists community_submissions_ip on public.community_submissions (ip_hash, created_at);
alter table public.community_submissions enable row level security;
drop policy if exists "Staff read submitted stories" on public.community_submissions;
drop policy if exists "Admins review submissions" on public.community_submissions;
drop policy if exists "Admins delete submissions" on public.community_submissions;
-- unfinished drafts stay private to the contributor; staff see a story once it has been submitted
create policy "Staff read submitted stories" on public.community_submissions for select to authenticated using (public.is_active_user() and status <> 'in_progress');
create policy "Admins review submissions" on public.community_submissions for update to authenticated
  using (public.is_admin() and public.is_active_user() and status <> 'in_progress')
  with check (public.is_admin() and public.is_active_user() and status <> 'in_progress');
create policy "Admins delete submissions" on public.community_submissions for delete to authenticated using (public.is_admin() and public.is_active_user());
-- no insert policy: only the community Edge Function (service key) creates submissions

-- 2b. Preview Mode (test submissions). An authorized consultant can switch to the Share Your Story page and
-- complete the whole interview as a test. Only the community Edge Function can mark a submission as a test,
-- and only after checking the caller's real sign-in against the list below. Test submissions never count in
-- reporting; the journal labels them "Test" and keeps them out of every total, chart and export.
alter table public.community_submissions add column if not exists is_test boolean not null default false;
alter table public.community_submissions add column if not exists test_by text;
create table if not exists public.portal_preview_users (
  email     text primary key check (email = lower(email)),
  note      text,
  added_at  timestamptz not null default now()
);
alter table public.portal_preview_users enable row level security;
-- no policies: nobody can read or change this list from the browser. To add someone, insert their email here
-- in the SQL Editor; they must also be an active administrator.
insert into public.portal_preview_users (email, note) values ('jacob.pajimola@pepperdine.edu', 'Consultant (Seas the Day Consulting): portal switching and Preview Mode')
  on conflict (email) do nothing;
-- used by the journal to decide whether to show Settings > Portal Access (the Edge Function repeats the check)
create or replace function public.can_preview_portal() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() and public.is_active_user()
    and exists (select 1 from public.portal_preview_users where email = lower(coalesce(auth.jwt()->>'email', '')));
$$;
revoke all on function public.can_preview_portal() from public;
grant execute on function public.can_preview_portal() to authenticated;

-- 3. Review history (kept even after a submission is deleted)
create table if not exists public.submission_events (
  id             bigserial primary key,
  submission_id  uuid,
  at             timestamptz not null default now(),
  actor          text,
  action         text not null,
  details        jsonb not null default '{}'::jsonb
);
create index if not exists submission_events_sub on public.submission_events (submission_id, at);
alter table public.submission_events enable row level security;
drop policy if exists "Staff read review history" on public.submission_events;
create policy "Staff read review history" on public.submission_events for select to authenticated using (public.is_active_user());
-- no insert policy: written by the triggers below and by the Edge Function

create or replace function public.log_submission_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(nullif(lower(auth.jwt()->>'email'), ''), 'contributor');
begin
  if tg_op = 'DELETE' then
    insert into public.submission_events (submission_id, actor, action, details) values (old.id, who, 'deleted', jsonb_build_object('status', old.status));
    return old;
  end if;
  -- a test stays a test (and a real story stays real): only the server sets this when the story is started
  if (new.is_test is distinct from old.is_test or new.test_by is distinct from old.test_by)
     and auth.uid() is not null and coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Only the server can mark a submission as a test';
  end if;
  new.updated_at := now();
  if new.status is distinct from old.status then
    insert into public.submission_events (submission_id, actor, action, details)
    values (new.id, who, 'status:' || new.status, jsonb_build_object('from', old.status, 'to', new.status, 'note', new.review->>'note'));
  elsif new.review is distinct from old.review or new.publication_consent is distinct from old.publication_consent or new.story_id is distinct from old.story_id then
    insert into public.submission_events (submission_id, actor, action, details)
    values (new.id, who, 'review_updated', jsonb_build_object('note', new.review->>'note', 'publication', new.publication_consent, 'story', new.story_id));
  end if;
  return new;
end $$;
drop trigger if exists log_submission_change on public.community_submissions;
create trigger log_submission_change before update or delete on public.community_submissions
  for each row execute function public.log_submission_change();
