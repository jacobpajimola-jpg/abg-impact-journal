-- ABG Impact Journal: database and storage setup.
-- Run once in Supabase: SQL Editor > New query > paste all of this > Run.
-- Safe to run again; it skips anything that already exists.

-- 1. Journal data: one JSON document per row (stories, entries, students, metrics, settings, members).
create table if not exists public.docs (
  path        text primary key,
  collection  text not null,
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists docs_collection_idx on public.docs (collection);
create index if not exists docs_story_idx on public.docs ((data->>'storyId')) where collection = 'entries';

-- Only signed-in users can read or write. New sign-ups are turned off in
-- Authentication settings, so "signed in" means someone you invited.
alter table public.docs enable row level security;
drop policy if exists "Invited users can read" on public.docs;
drop policy if exists "Invited users can add" on public.docs;
drop policy if exists "Invited users can edit" on public.docs;
drop policy if exists "Invited users can delete" on public.docs;
create policy "Invited users can read"   on public.docs for select to authenticated using (true);
create policy "Invited users can add"    on public.docs for insert to authenticated with check (true);
create policy "Invited users can edit"   on public.docs for update to authenticated using (true) with check (true);
create policy "Invited users can delete" on public.docs for delete to authenticated using (true);

-- Live updates when someone else saves a story.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 2. Private storage for recordings (never public).
insert into storage.buckets (id, name, public, file_size_limit)
values ('recordings', 'recordings', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "Invited users can listen" on storage.objects;
drop policy if exists "Invited users can upload" on storage.objects;
drop policy if exists "Invited users can delete recordings" on storage.objects;
create policy "Invited users can listen" on storage.objects for select to authenticated using (bucket_id = 'recordings');
create policy "Invited users can upload" on storage.objects for insert to authenticated with check (bucket_id = 'recordings');
create policy "Invited users can delete recordings" on storage.objects for delete to authenticated using (bucket_id = 'recordings');

-- 3. Administrators, roles and audit history: run supabase/admin-roles.sql next (it replaces the
--    open write rules above with role-aware ones and sets up the first administrators).
