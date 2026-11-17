-- ABG Impact Hub: Impact Materials (templates, generated materials, Content Bank, Canva connection).
-- Run once in Supabase: SQL Editor > New query > paste all of this > Run. Safe to run again.
-- Requires admin-roles.sql (it uses public.is_admin() and public.is_active_user()).
--
-- Nothing here copies story, student or outcome records: materials point at stories by their journal id and keep
-- a snapshot of exactly what was used, so a finished document can always be traced back to its sources.
--
-- Who can do what (enforced here, not only in the app):
--   active staff     read templates, the Content Bank and materials; create drafts; edit their own drafts;
--                    download files; record exports
--   administrators   manage audiences, material types, templates and versions, the Content Bank and the Canva
--                    connection; approve materials for external use; archive
--   nobody           changes an approved template version (a new design is always a new version) or an approved
--                    material (it can only be archived); deletes master template files
--   contributors     (Share Your Story) have no access to any of this

-- 1. Audiences (a tree: "Donor Materials" > "Individual Donors") and material types
create table if not exists public.mat_audiences (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.mat_audiences(id) on delete restrict,
  name         text not null check (length(trim(name)) between 1 and 120),
  description  text,
  sort         int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists public.mat_types (
  id                 uuid primary key default gen_random_uuid(),
  audience_id        uuid not null references public.mat_audiences(id) on delete restrict,
  name               text not null check (length(trim(name)) between 1 and 120),
  description        text,
  -- where finished pieces of this type are used; a story or image must be permitted for this use
  channel            text not null default 'print' check (channel in ('print', 'presentation', 'online')),
  default_family_id  uuid,
  sort               int not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 2. Templates: a family is one design line for a material type ("Donor Impact Summary, teal"); each new design
--    uploaded or connected for it is a new numbered version. A material type's default template is its default
--    family's current version. A variation is another family under the same material type.
create table if not exists public.mat_template_families (
  id                  uuid primary key default gen_random_uuid(),
  material_type_id    uuid not null references public.mat_types(id) on delete restrict,
  name                text not null check (length(trim(name)) between 1 and 160),
  description         text,
  current_version_id  uuid,
  status              text not null default 'active' check (status in ('active', 'archived')),
  created_by          text not null default lower(coalesce(auth.jwt()->>'email', '')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create table if not exists public.mat_template_versions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.mat_template_families(id) on delete restrict,
  version_no      int not null check (version_no >= 1),
  source_type     text not null check (source_type in ('canva', 'pptx', 'pdf')),
  source_path     text,                       -- templates bucket (PDF or PowerPoint master file)
  source_name     text,
  canva_design_id text,                       -- Canva master design (never changed: copies are filled)
  canva_url       text,
  inspection      jsonb not null default '{}'::jsonb,   -- what the file or design offers: pages, shapes, form fields, Canva data fields
  fields          jsonb not null default '[]'::jsonb,   -- field mapping: where each piece of content goes and where it comes from
  options         jsonb not null default '{}'::jsonb,   -- e.g. PDF fonts, flatten form fields
  config_status   text not null default 'draft' check (config_status in ('draft', 'tested', 'approved')),
  preview_path    text,
  change_notes    text,
  created_by      text not null default lower(coalesce(auth.jwt()->>'email', '')),
  created_at      timestamptz not null default now(),
  tested_at       timestamptz,
  approved_by     text,
  approved_at     timestamptz,
  archived_at     timestamptz,
  unique (family_id, version_no),
  check (source_type = 'canva' and canva_design_id is not null or source_type <> 'canva' and source_path is not null)
);
do $$ begin
  alter table public.mat_types add constraint mat_types_default_family_fk foreign key (default_family_id) references public.mat_template_families(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.mat_template_families add constraint mat_families_current_version_fk foreign key (current_version_id) references public.mat_template_versions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- 3. Generated materials. Each one records the exact template version it was made with, the content of every
--    field and the sources behind it. Regenerating or duplicating makes a new material; the original stays.
create table if not exists public.mat_materials (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null check (length(trim(title)) between 1 and 200),
  audience_id          uuid not null references public.mat_audiences(id) on delete restrict,
  material_type_id     uuid not null references public.mat_types(id) on delete restrict,
  family_id            uuid not null references public.mat_template_families(id) on delete restrict,
  template_version_id  uuid not null references public.mat_template_versions(id) on delete restrict,
  settings             jsonb not null default '{}'::jsonb,   -- reporting period, programs, instructions
  sources              jsonb not null default '{}'::jsonb,   -- snapshot of the approved stories, statistics, messaging and images used
  content              jsonb not null default '{}'::jsonb,   -- final text (or image) for each template field, with its source references
  warnings             jsonb not null default '[]'::jsonb,
  output               jsonb not null default '{}'::jsonb,   -- generated files (materials bucket) or the generated Canva design
  status               text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'archived')),
  regenerated_from     uuid references public.mat_materials(id) on delete set null,
  duplicated_from      uuid references public.mat_materials(id) on delete set null,
  created_by           text not null default lower(coalesce(auth.jwt()->>'email', '')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  approved_by          text,
  approved_at          timestamptz
);
create index if not exists mat_materials_created on public.mat_materials (created_at desc);
create index if not exists mat_materials_version on public.mat_materials (template_version_id);

-- 4. Activity (written by the triggers below, plus "exported" and "generated" from the app)
create table if not exists public.mat_activity (
  id                   bigserial primary key,
  at                   timestamptz not null default now(),
  actor                text not null default lower(coalesce(auth.jwt()->>'email', '')),
  action               text not null check (action in ('created', 'generated', 'edited', 'submitted', 'approved', 'returned', 'archived', 'exported', 'regenerated', 'duplicated', 'template_added', 'template_updated', 'template_approved', 'default_changed', 'template_archived')),
  material_id          uuid,
  family_id            uuid,
  template_version_id  uuid,
  details              jsonb not null default '{}'::jsonb
);
create index if not exists mat_activity_at on public.mat_activity (at desc);

-- 5. Content Bank: approved messaging, program descriptions, verified statistics and approved media
create table if not exists public.mat_content (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('messaging', 'statistic', 'media')),
  category       text,                         -- messaging: mission, overview, program, audience, cta, other
  title          text not null check (length(trim(title)) between 1 and 200),
  body           text,                         -- messaging text, or a statistic's label ("students served")
  audience_ids   uuid[] not null default '{}', -- empty: any audience
  program        text,
  stat_value     text,
  stat_unit      text,
  stat_source    text,
  stat_period    text,
  verification   text check (verification in ('self_reported', 'staff_observed', 'independently_verified')),
  media_path     text,                         -- materials bucket, under media/
  media_alt      text,
  identifiable   boolean,                      -- media: shows a recognizable person
  minors         boolean,
  consent        text check (consent in ('documented', 'not_needed', 'missing')),
  permitted_uses text[] not null default '{}', -- print, presentation, online
  status         text not null default 'pending' check (status in ('approved', 'pending', 'archived')),
  created_by     text not null default lower(coalesce(auth.jwt()->>'email', '')),
  created_at     timestamptz not null default now(),
  updated_by     text,
  updated_at     timestamptz not null default now(),
  check (kind <> 'statistic' or (stat_value is not null and stat_source is not null and verification is not null)),
  check (kind <> 'media' or media_path is not null)
);

-- 6. Canva connection (one per organization). Tokens are encrypted by the canva Edge Function and readable only
--    with the service key: no policies, so nobody can read them from the browser.
create table if not exists public.canva_connection (
  id               int primary key default 1 check (id = 1),
  access_token     text not null,
  refresh_token    text not null,
  expires_at       timestamptz not null,
  scopes           text,
  canva_user       text,
  connected_by     text not null,
  connected_at     timestamptz not null default now()
);
create table if not exists public.canva_oauth_states (
  state        text primary key,
  verifier     text not null,
  email        text not null,
  return_to    text,
  created_at   timestamptz not null default now()
);
alter table public.canva_connection enable row level security;
alter table public.canva_oauth_states enable row level security;

-- 7. Access rules
alter table public.mat_audiences enable row level security;
alter table public.mat_types enable row level security;
alter table public.mat_template_families enable row level security;
alter table public.mat_template_versions enable row level security;
alter table public.mat_materials enable row level security;
alter table public.mat_activity enable row level security;
alter table public.mat_content enable row level security;

do $$ declare t text; begin
  foreach t in array array['mat_audiences', 'mat_types', 'mat_template_families', 'mat_template_versions', 'mat_content'] loop
    execute format('drop policy if exists "Staff read" on public.%I', t);
    execute format('drop policy if exists "Admins add" on public.%I', t);
    execute format('drop policy if exists "Admins change" on public.%I', t);
    execute format('drop policy if exists "Admins delete" on public.%I', t);
    execute format('create policy "Staff read" on public.%I for select to authenticated using (public.is_active_user())', t);
    execute format('create policy "Admins add" on public.%I for insert to authenticated with check (public.is_admin() and public.is_active_user())', t);
    execute format('create policy "Admins change" on public.%I for update to authenticated using (public.is_admin() and public.is_active_user()) with check (public.is_admin() and public.is_active_user())', t);
  end loop;
end $$;
-- only unused, unapproved draft versions and empty categories can be deleted (in-use rows are protected by foreign keys)
create policy "Admins delete" on public.mat_template_versions for delete to authenticated using (public.is_admin() and public.is_active_user() and config_status = 'draft');
create policy "Admins delete" on public.mat_content for delete to authenticated using (public.is_admin() and public.is_active_user());
create policy "Admins delete" on public.mat_audiences for delete to authenticated using (public.is_admin() and public.is_active_user());
create policy "Admins delete" on public.mat_types for delete to authenticated using (public.is_admin() and public.is_active_user());
create policy "Admins delete" on public.mat_template_families for delete to authenticated using (public.is_admin() and public.is_active_user() and current_version_id is null);

drop policy if exists "Staff read materials" on public.mat_materials;
drop policy if exists "Staff create drafts" on public.mat_materials;
drop policy if exists "Owners and admins edit" on public.mat_materials;
drop policy if exists "Admins delete drafts" on public.mat_materials;
create policy "Staff read materials" on public.mat_materials for select to authenticated using (public.is_active_user());
create policy "Staff create drafts" on public.mat_materials for insert to authenticated
  with check (public.is_active_user() and created_by = lower(coalesce(auth.jwt()->>'email', '')) and status in ('draft', 'in_review') and approved_at is null);
create policy "Owners and admins edit" on public.mat_materials for update to authenticated
  using (public.is_active_user() and (public.is_admin() or created_by = lower(coalesce(auth.jwt()->>'email', ''))))
  with check (public.is_active_user() and (public.is_admin() or created_by = lower(coalesce(auth.jwt()->>'email', ''))));
create policy "Admins delete drafts" on public.mat_materials for delete to authenticated using (public.is_admin() and public.is_active_user() and status = 'draft');

drop policy if exists "Staff read activity" on public.mat_activity;
drop policy if exists "Staff record exports" on public.mat_activity;
create policy "Staff read activity" on public.mat_activity for select to authenticated using (public.is_active_user());
create policy "Staff record exports" on public.mat_activity for insert to authenticated
  with check (public.is_active_user() and actor = lower(coalesce(auth.jwt()->>'email', '')) and action in ('exported', 'generated'));

-- 8. Guards and history (triggers run for every change, whatever made it)
create or replace function public.mat_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['mat_audiences', 'mat_types', 'mat_template_families', 'mat_materials'] loop
    execute format('drop trigger if exists mat_touch on public.%I', t);
    execute format('create trigger mat_touch before update on public.%I for each row execute function public.mat_touch()', t);
  end loop;
end $$;

-- an approved template version never changes: a new design is a new version. Only archiving is allowed.
create or replace function public.mat_version_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(nullif(lower(auth.jwt()->>'email'), ''), 'system');
begin
  if tg_op = 'INSERT' then
    new.approved_by := null; new.approved_at := null; new.archived_at := null;
    if new.config_status = 'approved' then new.config_status := 'tested'; end if;
    insert into public.mat_activity (actor, action, family_id, template_version_id, details)
    values (who, case when new.version_no = 1 then 'template_added' else 'template_updated' end, new.family_id, new.id,
            jsonb_build_object('version', new.version_no, 'source', new.source_type, 'notes', new.change_notes));
    return new;
  end if;
  if old.config_status = 'approved' then
    if new.source_type is distinct from old.source_type or new.source_path is distinct from old.source_path
       or new.canva_design_id is distinct from old.canva_design_id or new.fields is distinct from old.fields
       or new.inspection is distinct from old.inspection or new.options is distinct from old.options
       or new.config_status is distinct from old.config_status or new.version_no is distinct from old.version_no
       or new.family_id is distinct from old.family_id then
      raise exception 'An approved template version cannot be changed. Upload or connect the new design as a new version.';
    end if;
  elsif new.config_status = 'approved' then
    if new.tested_at is null then raise exception 'Test the template before approving it.'; end if;
    new.approved_by := who; new.approved_at := now();
    insert into public.mat_activity (actor, action, family_id, template_version_id, details)
    values (who, 'template_approved', new.family_id, new.id, jsonb_build_object('version', new.version_no));
  end if;
  if new.archived_at is not null and old.archived_at is null then
    insert into public.mat_activity (actor, action, family_id, template_version_id, details) values (who, 'template_archived', new.family_id, new.id, jsonb_build_object('version', new.version_no));
  end if;
  return new;
end $$;
drop trigger if exists mat_version_guard on public.mat_template_versions;
create trigger mat_version_guard before insert or update on public.mat_template_versions for each row execute function public.mat_version_guard();

-- a family's current version must be one of its own approved versions; a material type's default must be one of its families
create or replace function public.mat_family_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(nullif(lower(auth.jwt()->>'email'), ''), 'system');
begin
  if new.current_version_id is not null and (tg_op = 'INSERT' or new.current_version_id is distinct from old.current_version_id) then
    if not exists (select 1 from public.mat_template_versions v where v.id = new.current_version_id and v.family_id = new.id and v.config_status = 'approved' and v.archived_at is null) then
      raise exception 'Only an approved version of this template can be made current.';
    end if;
    if tg_op = 'UPDATE' then
      insert into public.mat_activity (actor, action, family_id, template_version_id, details) values (who, 'default_changed', new.id, new.current_version_id, jsonb_build_object('from', old.current_version_id));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mat_family_guard on public.mat_template_families;
create trigger mat_family_guard before insert or update on public.mat_template_families for each row execute function public.mat_family_guard();

create or replace function public.mat_type_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.default_family_id is not null and (tg_op = 'INSERT' or new.default_family_id is distinct from old.default_family_id) then
    if not exists (select 1 from public.mat_template_families f where f.id = new.default_family_id and f.material_type_id = new.id and f.status = 'active') then
      raise exception 'The default template must be an active template of this material type.';
    end if;
    if tg_op = 'UPDATE' then
      insert into public.mat_activity (action, family_id, details) values ('default_changed', new.default_family_id, jsonb_build_object('material_type', new.id, 'from_family', old.default_family_id));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mat_type_guard on public.mat_types;
create trigger mat_type_guard before insert or update on public.mat_types for each row execute function public.mat_type_guard();

-- materials: a new draft must use an approved template version; only administrators approve; an approved material is
-- kept exactly as it is (it can only be archived); every change is recorded
create or replace function public.mat_material_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(nullif(lower(auth.jwt()->>'email'), ''), 'system');
declare is_service boolean := coalesce(auth.jwt()->>'role', '') = 'service_role' or auth.uid() is null;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Only drafts can be deleted. Archive it instead.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.mat_template_versions v join public.mat_template_families f on f.id = v.family_id
                   where v.id = new.template_version_id and v.family_id = new.family_id and v.config_status = 'approved' and v.archived_at is null
                   and f.material_type_id = new.material_type_id) then
      raise exception 'Materials can only be made with an approved, current template version of this material type.';
    end if;
    if not exists (select 1 from public.mat_types t where t.id = new.material_type_id and t.audience_id = new.audience_id) then
      raise exception 'The material type does not belong to this audience.';
    end if;
    new.approved_by := null; new.approved_at := null;
    insert into public.mat_activity (actor, action, material_id, family_id, template_version_id, details)
    values (who, case when new.regenerated_from is not null then 'regenerated' when new.duplicated_from is not null then 'duplicated' else 'created' end,
            new.id, new.family_id, new.template_version_id, jsonb_build_object('title', new.title, 'from', coalesce(new.regenerated_from, new.duplicated_from)));
    return new;
  end if;
  -- UPDATE
  if new.template_version_id is distinct from old.template_version_id or new.family_id is distinct from old.family_id
     or new.material_type_id is distinct from old.material_type_id or new.audience_id is distinct from old.audience_id
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'A material keeps its template and category. Regenerate it to use another template; the original stays as it is.';
  end if;
  if old.status = 'approved' then
    if new.status = 'archived' and new.title = old.title and new.content = old.content and new.sources = old.sources and new.output = old.output and new.settings = old.settings and new.warnings = old.warnings then
      if not (public.is_admin() or is_service) then raise exception 'Only an administrator can archive an approved material.'; end if;
      insert into public.mat_activity (actor, action, material_id, details) values (who, 'archived', new.id, '{}'::jsonb);
      return new;
    end if;
    raise exception 'This material is approved and preserved as it is. Duplicate or regenerate it to make changes.';
  end if;
  if new.status = 'approved' and old.status <> 'approved' then
    if not (public.is_admin() or is_service) then raise exception 'Only an administrator can approve materials for external use.'; end if;
    if coalesce(jsonb_array_length(new.output->'files'), 0) = 0 and new.output->'canva' is null then raise exception 'Generate the document before approving it.'; end if;
    new.approved_by := who; new.approved_at := now();
    insert into public.mat_activity (actor, action, material_id, details) values (who, 'approved', new.id, '{}'::jsonb);
  else
    new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    if new.status is distinct from old.status then
      insert into public.mat_activity (actor, action, material_id, details)
      values (who, case new.status when 'in_review' then 'submitted' when 'archived' then 'archived' else 'returned' end, new.id, jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.content is distinct from old.content or new.title is distinct from old.title then
      insert into public.mat_activity (actor, action, material_id, details) values (who, 'edited', new.id, jsonb_build_object('title', new.title));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mat_material_guard on public.mat_materials;
create trigger mat_material_guard before insert or update or delete on public.mat_materials for each row execute function public.mat_material_guard();

-- 9. Private file storage: master templates, their preview images and brand fonts (admins upload; never replaced or deleted) and generated files and approved
--    media (staff upload generated files; only administrators upload media or delete anything)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('templates', 'templates', false, 52428800, array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/png', 'image/jpeg', 'font/ttf', 'font/otf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800, array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff read templates" on storage.objects;
drop policy if exists "Admins upload templates" on storage.objects;
drop policy if exists "Staff read materials files" on storage.objects;
drop policy if exists "Staff upload generated files" on storage.objects;
drop policy if exists "Admins upload media" on storage.objects;
drop policy if exists "Admins delete materials files" on storage.objects;
create policy "Staff read templates" on storage.objects for select to authenticated using (bucket_id = 'templates' and public.is_active_user());
create policy "Admins upload templates" on storage.objects for insert to authenticated with check (bucket_id = 'templates' and public.is_admin() and public.is_active_user());
create policy "Staff read materials files" on storage.objects for select to authenticated using (bucket_id = 'materials' and public.is_active_user());
create policy "Staff upload generated files" on storage.objects for insert to authenticated with check (bucket_id = 'materials' and public.is_active_user() and (storage.foldername(name))[1] = 'generated');
create policy "Admins upload media" on storage.objects for insert to authenticated with check (bucket_id = 'materials' and public.is_admin() and public.is_active_user() and (storage.foldername(name))[1] = 'media');
create policy "Admins delete materials files" on storage.objects for delete to authenticated using (bucket_id = 'materials' and public.is_admin() and public.is_active_user() and (storage.foldername(name))[1] = 'media');

-- 10. Starting categories (only on a fresh install; administrators rename, add or archive them in the app)
do $$
declare donor uuid; ind uuid; maj uuid; fnd uuid; corp uuid; sch uuid; com uuid; gen uuid;
begin
  if exists (select 1 from public.mat_audiences) then return; end if;
  insert into public.mat_audiences (name, description, sort) values ('Donor Materials', 'Individual donors, major donors and grant funders', 1) returning id into donor;
  insert into public.mat_audiences (parent_id, name, sort) values (donor, 'Individual Donors', 1) returning id into ind;
  insert into public.mat_audiences (parent_id, name, sort) values (donor, 'Major Donors', 2) returning id into maj;
  insert into public.mat_audiences (parent_id, name, sort) values (donor, 'Foundations & Grant Funders', 3) returning id into fnd;
  insert into public.mat_audiences (name, sort) values ('Corporate Partners', 2) returning id into corp;
  insert into public.mat_audiences (name, sort) values ('Schools & Teachers', 3) returning id into sch;
  insert into public.mat_audiences (name, sort) values ('Community Stakeholders', 4) returning id into com;
  insert into public.mat_audiences (name, sort) values ('General ABG Materials', 5) returning id into gen;
  insert into public.mat_types (audience_id, name, channel, sort) values
    (ind, 'Donor Impact Summary', 'print', 1), (ind, 'Donation Appeal', 'print', 2), (ind, 'Donor Thank-You Material', 'print', 3),
    (maj, 'Personalized Impact Report', 'print', 1), (maj, 'Major Gift Proposal', 'print', 2), (maj, 'Annual Giving Summary', 'print', 3),
    (fnd, 'Grant Impact Report', 'print', 1), (fnd, 'Grant Renewal Summary', 'print', 2), (fnd, 'Funding Proposal', 'print', 3),
    (corp, 'Corporate Partnership Proposal', 'print', 1), (corp, 'Sponsorship Packet', 'print', 2), (corp, 'Partnership Impact Report', 'print', 3),
    (sch, 'Program Overview', 'print', 1), (sch, 'School Partnership Packet', 'print', 2), (sch, 'Student Impact Summary', 'print', 3),
    (com, 'Community Impact Report', 'print', 1), (com, 'Neighborhood Council Presentation', 'presentation', 2), (com, 'Community Project One-Pager', 'print', 3),
    (gen, 'Organization Overview', 'print', 1), (gen, 'Annual Impact Report', 'print', 2), (gen, 'Presentation Deck', 'presentation', 3), (gen, 'Program One-Pager', 'print', 4);
end $$;
