-- Phase 2: capture (contributor links, consents, capture jobs, media) and recipes (recipes,
-- immutable versions with a correction chain). Design: docs/schema.md.
--
-- Clients only read these tables. Every write goes through a server function (service role)
-- that checks the acting user, so a recipe can only come from a reviewed capture and an
-- original can only change through a correction.

create type public.recipe_visibility as enum ('private', 'family', 'link', 'public');
create type public.source_type as enum ('voice', 'handwriting', 'typed', 'whatsapp');
create type public.version_kind as enum ('original', 'correction', 'fork');
create type public.version_status as enum ('draft', 'confirmed');
create type public.capture_status as enum (
  'awaiting_upload', 'uploaded', 'transcribing', 'structuring', 'ready_for_review', 'failed', 'confirmed'
);
create type public.media_kind as enum (
  'original_audio', 'handwriting_scan', 'dish_photo', 'family_photo', 'derived_audio', 'derived_scan'
);
create type public.consent_kind as enum ('voice_recording', 'third_party_processing');
create type public.consent_via as enum ('organiser', 'contributor_link');

-- ---------------------------------------------------------------------------
-- Validation helpers (used by check constraints)
-- ---------------------------------------------------------------------------

-- Every ingredient keeps the speaker's own words: a non-empty original_text (brief decision 2).
create function private.valid_ingredients(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and not exists (
    select 1 from jsonb_array_elements(p) as item
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'original_text') is distinct from 'string'
      or btrim(item ->> 'original_text') = ''
  );
$$;

create function private.valid_steps(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and not exists (
    select 1 from jsonb_array_elements(p) as item
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'text') is distinct from 'string'
      or btrim(item ->> 'text') = ''
  );
$$;

create function private.is_string_array(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array'
    and not exists (select 1 from jsonb_array_elements(p) as item where jsonb_typeof(item) <> 'string');
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.contributor_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references public.profiles (id) on delete set null,
  max_uploads smallint not null default 10 check (max_uploads between 1 and 50),
  upload_count smallint not null default 0 check (upload_count >= 0 and upload_count <= max_uploads),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '90 days')
);
comment on table public.contributor_links is
  'Zero-install recording links for elders. They can upload into their own capture jobs and read nothing.';
create index contributor_links_person_id_idx on public.contributor_links (person_id);
create index contributor_links_family_id_idx on public.contributor_links (family_id);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  kind public.consent_kind not null,
  wording_version text not null check (char_length(btrim(wording_version)) between 1 and 40),
  given_via public.consent_via not null,
  given_by_profile_id uuid references public.profiles (id) on delete set null,
  contributor_link_id uuid references public.contributor_links (id) on delete set null,
  given_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
comment on table public.consents is 'Proof of consent per person, kept even after withdrawal.';
create index consents_person_id_idx on public.consents (person_id);
create index consents_family_id_idx on public.consents (family_id);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  origin_person_id uuid references public.people (id) on delete set null,
  visibility public.recipe_visibility not null default 'family',
  root_version_id uuid,
  current_version_id uuid,
  -- Set on the copy when a recipe is handed into another vault (v2 UI; ADR 0005).
  origin_recipe_id uuid references public.recipes (id) on delete set null,
  cover_media_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index recipes_family_id_idx on public.recipes (family_id);
create index recipes_origin_person_id_idx on public.recipes (origin_person_id);

create table public.capture_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  source_type public.source_type not null check (source_type in ('voice', 'handwriting')),
  created_by uuid references public.profiles (id) on delete set null,
  contributor_link_id uuid references public.contributor_links (id) on delete set null,
  status public.capture_status not null default 'awaiting_upload',
  transcript text,
  detected_language text,
  ai_output jsonb,
  error text,
  provider_meta jsonb,
  recipe_id uuid references public.recipes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(created_by, contributor_link_id) <= 1)
);
create index capture_jobs_family_id_idx on public.capture_jobs (family_id);
create index capture_jobs_person_id_idx on public.capture_jobs (person_id);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  kind public.version_kind not null,
  parent_version_id uuid references public.recipe_versions (id) on delete restrict,
  author_person_id uuid references public.people (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  servings smallint check (servings between 1 and 500),
  ingredients jsonb not null check (private.valid_ingredients(ingredients)),
  steps jsonb not null check (private.valid_steps(steps)),
  tips jsonb not null default '[]' check (private.is_string_array(tips)),
  story text check (char_length(story) <= 10000),
  language text not null check (language ~ '^[a-z]{2,3}$'),
  source_type public.source_type not null,
  status public.version_status not null default 'draft',
  uncertain_fields jsonb not null default '[]' check (private.is_string_array(uncertain_fields)),
  change_note text check (char_length(change_note) <= 1000),
  capture_job_id uuid references public.capture_jobs (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check ((kind = 'original') = (parent_version_id is null)),
  check ((status = 'confirmed') = (confirmed_at is not null))
);
create index recipe_versions_recipe_id_idx on public.recipe_versions (recipe_id);
create index recipe_versions_family_id_idx on public.recipe_versions (family_id);
create index recipe_versions_parent_version_id_idx on public.recipe_versions (parent_version_id);

alter table public.recipes
  add constraint recipes_root_version_id_fkey foreign key (root_version_id)
    references public.recipe_versions (id) on delete set null,
  add constraint recipes_current_version_id_fkey foreign key (current_version_id)
    references public.recipe_versions (id) on delete set null;

create table public.media (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind public.media_kind not null,
  capture_job_id uuid references public.capture_jobs (id) on delete set null,
  recipe_version_id uuid references public.recipe_versions (id) on delete set null,
  derived_from_media_id uuid references public.media (id) on delete set null,
  storage_bucket text not null check (storage_bucket in ('vault-audio', 'vault-scans', 'vault-images')),
  storage_path text not null,
  mime_type text not null check (mime_type ~ '^(audio|image)/[a-z0-9.+-]+$'),
  byte_size bigint check (byte_size > 0),
  duration_ms integer check (duration_ms > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  caption text check (char_length(caption) <= 500),
  uploaded_by uuid references public.profiles (id) on delete set null,
  contributor_link_id uuid references public.contributor_links (id) on delete set null,
  -- Consent withdrawal: the storage object is hard-deleted; the row stays so the recipe can say
  -- "original recording removed" (ADR 0005).
  removed_at timestamptz,
  removed_reason text check (char_length(removed_reason) <= 200),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  check (num_nonnulls(uploaded_by, contributor_link_id) <= 1),
  check (storage_path like family_id::text || '/%'),
  check (
    (kind in ('original_audio', 'derived_audio') and storage_bucket = 'vault-audio')
    or (kind in ('handwriting_scan', 'derived_scan') and storage_bucket = 'vault-scans')
    or (kind in ('dish_photo', 'family_photo') and storage_bucket = 'vault-images')
  )
);
comment on table public.media is 'Every uploaded file, raw and derived. Raw media is never overwritten.';
create index media_family_id_idx on public.media (family_id);
create index media_capture_job_id_idx on public.media (capture_job_id);
create index media_recipe_version_id_idx on public.media (recipe_version_id);

alter table public.recipes
  add constraint recipes_cover_media_id_fkey foreign key (cover_media_id)
    references public.media (id) on delete set null;

create trigger recipes_updated_at before update on public.recipes
  for each row execute function private.set_updated_at();
create trigger capture_jobs_updated_at before update on public.capture_jobs
  for each row execute function private.set_updated_at();
create trigger recipe_versions_updated_at before update on public.recipe_versions
  for each row execute function private.set_updated_at();

-- Confirmed versions never change, for anyone. A fix is a new correction version.
-- Deleting is allowed only when the whole recipe is being deleted (cascade).
create function private.freeze_confirmed_versions() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'confirmed' then
    if tg_op = 'DELETE' and not exists (select 1 from public.recipes r where r.id = old.recipe_id) then
      return old;
    end if;
    raise exception 'Confirmed recipe versions never change. Publish a correction instead.'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger recipe_versions_frozen before update or delete on public.recipe_versions
  for each row execute function private.freeze_confirmed_versions();

-- ---------------------------------------------------------------------------
-- Read helpers
-- ---------------------------------------------------------------------------

-- A recipe is readable by vault members, except "private" ones, which only their creator sees.
create function private.can_read_recipe(p_recipe_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id
      and r.deleted_at is null
      and private.is_member(r.family_id)
      and (r.visibility <> 'private' or r.created_by = (select auth.uid()))
  );
$$;

create function private.can_read_version(p_version_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recipe_versions v
    where v.id = p_version_id
      and private.can_read_recipe(v.recipe_id)
      and (v.status = 'confirmed' or private.can_write(v.family_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security: read-only for clients
-- ---------------------------------------------------------------------------

alter table public.contributor_links enable row level security;
alter table public.consents enable row level security;
alter table public.recipes enable row level security;
alter table public.capture_jobs enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.media enable row level security;

create policy "contributor_links: writers read" on public.contributor_links
  for select to authenticated using (private.can_write(family_id));

create policy "consents: members read" on public.consents
  for select to authenticated using (private.is_member(family_id));

create policy "recipes: readable recipes" on public.recipes
  for select to authenticated using (private.can_read_recipe(id));

-- Unreviewed AI output and raw transcripts: owners, admins and members only.
create policy "capture_jobs: writers read" on public.capture_jobs
  for select to authenticated using (private.can_write(family_id));

create policy "recipe_versions: readable versions" on public.recipe_versions
  for select to authenticated using (private.can_read_version(id));

-- Media of a confirmed recipe follows the recipe; media still in capture is for writers only.
create policy "media: readable media" on public.media
  for select to authenticated
  using (
    private.can_write(family_id)
    or (recipe_version_id is not null and private.can_read_version(recipe_version_id))
  );

revoke all on public.contributor_links, public.consents, public.recipes, public.capture_jobs,
  public.recipe_versions, public.media from anon, authenticated;
grant select on public.consents, public.recipes, public.capture_jobs, public.recipe_versions,
  public.media to authenticated;
grant select (
  id, family_id, person_id, created_by, max_uploads, upload_count, expires_at, revoked_at, created_at
) on public.contributor_links to authenticated;

-- ---------------------------------------------------------------------------
-- Server functions (service role only; the API route verifies the session and passes the actor)
-- ---------------------------------------------------------------------------

-- Role check for an explicit actor (server functions can't rely on auth.uid()).
create function private.actor_can(p_actor uuid, p_family_id uuid, p_roles public.family_role[])
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    join public.families f on f.id = m.family_id
    where m.family_id = p_family_id and m.profile_id = p_actor and m.role = any (p_roles)
      and f.deleted_at is null
  );
$$;

create function private.extension_for(p_mime text) returns text
language sql immutable set search_path = '' as $$
  select case p_mime
    when 'audio/webm' then 'webm' when 'audio/ogg' then 'ogg' when 'audio/mp4' then 'm4a'
    when 'audio/x-m4a' then 'm4a' when 'audio/aac' then 'aac' when 'audio/mpeg' then 'mp3'
    when 'audio/wav' then 'wav' when 'audio/x-wav' then 'wav'
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp'
    when 'image/heic' then 'heic' when 'image/heif' then 'heif'
  end;
$$;

-- Records consent once per person, kind, wording version and source (idempotent). Consent the
-- elder gives on their own recording link is kept separately from the organiser's.
create function private.ensure_consent(
  p_family_id uuid, p_person_id uuid, p_kinds public.consent_kind[], p_wording_version text,
  p_actor uuid, p_link_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.consent_kind;
begin
  if char_length(btrim(coalesce(p_wording_version, ''))) = 0 then
    raise exception 'Consent wording version is required' using errcode = '22023';
  end if;
  foreach v_kind in array p_kinds loop
    if not exists (
      select 1 from public.consents c
      where c.person_id = p_person_id and c.kind = v_kind
        and c.wording_version = p_wording_version and c.withdrawn_at is null
        and c.contributor_link_id is not distinct from p_link_id
    ) then
      insert into public.consents (
        family_id, person_id, kind, wording_version, given_via, given_by_profile_id, contributor_link_id
      ) values (
        p_family_id, p_person_id, v_kind, p_wording_version,
        case when p_link_id is null then 'organiser' else 'contributor_link' end::public.consent_via,
        p_actor, p_link_id
      );
    end if;
  end loop;
end;
$$;

-- Content -> confirmed version. Shape is enforced by the table's check constraints.
create function private.insert_confirmed_version(
  p_recipe_id uuid, p_family_id uuid, p_kind public.version_kind, p_parent_id uuid,
  p_author_person_id uuid, p_source public.source_type, p_capture_job_id uuid, p_actor uuid,
  p_content jsonb, p_change_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_version_id uuid;
begin
  insert into public.recipe_versions (
    recipe_id, family_id, kind, parent_version_id, author_person_id, title, servings, ingredients,
    steps, tips, story, language, source_type, status, uncertain_fields, change_note,
    capture_job_id, created_by, confirmed_at
  ) values (
    p_recipe_id, p_family_id, p_kind, p_parent_id, p_author_person_id,
    btrim(p_content ->> 'title'),
    (p_content ->> 'servings')::smallint,
    p_content -> 'ingredients',
    p_content -> 'steps',
    coalesce(p_content -> 'tips', '[]'::jsonb),
    nullif(btrim(p_content ->> 'story'), ''),
    p_content ->> 'language',
    p_source, 'confirmed',
    coalesce(p_content -> 'uncertain_fields', '[]'::jsonb),
    nullif(btrim(p_change_note), ''),
    p_capture_job_id, p_actor, now()
  )
  returning id into v_version_id;
  return v_version_id;
end;
$$;

-- An organiser creates a recording link for an elder. Owners, admins and members.
create function public.create_contributor_link(
  p_actor uuid,
  p_person_id uuid,
  p_token text,
  p_max_uploads smallint default 10,
  p_expires_in interval default interval '30 days'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_family_id uuid;
  v_link_id uuid;
begin
  select family_id into v_family_id from public.people where id = p_person_id and deleted_at is null;
  if v_family_id is null or not private.actor_can(p_actor, v_family_id, '{owner,admin,member}') then
    raise exception 'Only family members who can add recipes can create recording links'
      using errcode = '42501';
  end if;
  if char_length(coalesce(p_token, '')) < 22 then
    raise exception 'Link token is too short' using errcode = '22023';
  end if;
  insert into public.contributor_links (family_id, person_id, token_hash, created_by, max_uploads, expires_at)
  values (
    v_family_id, p_person_id, encode(extensions.digest(p_token, 'sha256'), 'hex'), p_actor,
    p_max_uploads, now() + p_expires_in
  )
  returning id into v_link_id;
  return v_link_id;
end;
$$;

create function public.revoke_contributor_link(p_actor uuid, p_link_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.contributor_links l set revoked_at = now()
  where l.id = p_link_id and l.revoked_at is null
    and private.actor_can(p_actor, l.family_id, '{owner,admin,member}');
  if not found then
    raise exception 'Link not found, already revoked, or not yours to revoke' using errcode = '42501';
  end if;
end;
$$;

-- What the elder's recording page shows: their name and photo, and how many recordings are left.
-- Nothing else in the vault is reachable through a contributor link.
create function public.contributor_link_info(p_token text)
returns table (family_id uuid, person_display_name text, relation_label text, photo_path text, uploads_left integer)
language sql stable security definer set search_path = '' as $$
  select l.family_id, p.display_name, p.relation_label, p.photo_path, l.max_uploads - l.upload_count
  from public.contributor_links l
  join public.people p on p.id = l.person_id and p.deleted_at is null
  join public.families f on f.id = l.family_id and f.deleted_at is null
  where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and l.revoked_at is null and l.expires_at > now() and l.upload_count < l.max_uploads;
$$;

-- Starts a capture: records consent, creates the job and registers the upload path.
-- Called either for a signed-in organiser (p_actor + p_person_id) or for an elder's recording
-- link (p_contributor_token). Returns where the file must be uploaded.
create function public.begin_capture(
  p_source public.source_type,
  p_mime_type text,
  p_byte_size bigint,
  p_consent_wording_version text,
  p_actor uuid default null,
  p_person_id uuid default null,
  p_contributor_token text default null
) returns table (job_id uuid, media_id uuid, storage_bucket text, storage_path text)
language plpgsql security definer set search_path = '' as $$
declare
  v_mime text := lower(btrim(split_part(p_mime_type, ';', 1)));
  v_link public.contributor_links;
  v_person public.people;
  v_kind public.media_kind;
  v_bucket text;
  v_max_bytes bigint;
  v_extension text;
  v_job_id uuid;
  v_media_id uuid := gen_random_uuid();
  v_path text;
begin
  if num_nonnulls(p_actor, p_contributor_token) <> 1 then
    raise exception 'Pass either an actor or a contributor token' using errcode = '22023';
  end if;

  if p_source = 'voice' and v_mime like 'audio/%' then
    v_kind := 'original_audio'; v_bucket := 'vault-audio'; v_max_bytes := 52428800;
  elsif p_source = 'handwriting' and v_mime like 'image/%' then
    v_kind := 'handwriting_scan'; v_bucket := 'vault-scans'; v_max_bytes := 20971520;
  else
    raise exception 'Unsupported capture: % as %', v_mime, p_source using errcode = '22023';
  end if;
  v_extension := private.extension_for(v_mime);
  if v_extension is null then
    raise exception 'Unsupported file type %', v_mime using errcode = '22023';
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > v_max_bytes then
    raise exception 'File is empty or too large' using errcode = '22023';
  end if;

  if p_contributor_token is not null then
    select * into v_link from public.contributor_links
    where token_hash = encode(extensions.digest(p_contributor_token, 'sha256'), 'hex')
    for update;
    if v_link.id is null or v_link.revoked_at is not null or v_link.expires_at <= now()
      or v_link.upload_count >= v_link.max_uploads
      or not exists (select 1 from public.families f where f.id = v_link.family_id and f.deleted_at is null)
    then
      raise exception 'This recording link is no longer valid' using errcode = 'P0002';
    end if;
    update public.contributor_links set upload_count = upload_count + 1 where id = v_link.id;
    select * into v_person from public.people where id = v_link.person_id and deleted_at is null;
  else
    select * into v_person from public.people where id = p_person_id and deleted_at is null;
    if v_person.id is not null
      and not private.actor_can(p_actor, v_person.family_id, '{owner,admin,member}')
    then
      raise exception 'Only family members who can add recipes can capture' using errcode = '42501';
    end if;
  end if;
  if v_person.id is null then
    raise exception 'That person is not in a vault you can capture for' using errcode = '42501';
  end if;

  perform private.ensure_consent(
    v_person.family_id, v_person.id,
    case when p_source = 'voice'
      then array['voice_recording', 'third_party_processing']::public.consent_kind[]
      else array['third_party_processing']::public.consent_kind[]
    end,
    p_consent_wording_version, p_actor, v_link.id
  );

  insert into public.capture_jobs (family_id, person_id, source_type, created_by, contributor_link_id)
  values (v_person.family_id, v_person.id, p_source, p_actor, v_link.id)
  returning id into v_job_id;

  v_path := v_person.family_id || '/capture/' || v_job_id || '/' || v_media_id || '.' || v_extension;
  insert into public.media (
    id, family_id, kind, capture_job_id, storage_bucket, storage_path, mime_type, byte_size,
    uploaded_by, contributor_link_id
  ) values (
    v_media_id, v_person.family_id, v_kind, v_job_id, v_bucket, v_path, v_mime, p_byte_size,
    p_actor, v_link.id
  );

  return query select v_job_id, v_media_id, v_bucket, v_path;
end;
$$;

-- The organiser confirms the reviewed recipe. Only now does a recipe exist (brief flow B).
create function public.confirm_capture(p_actor uuid, p_job_id uuid, p_content jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.capture_jobs;
  v_recipe_id uuid;
  v_version_id uuid;
begin
  select * into v_job from public.capture_jobs where id = p_job_id for update;
  if v_job.id is null or not private.actor_can(p_actor, v_job.family_id, '{owner,admin,member}') then
    raise exception 'Capture not found or not yours to confirm' using errcode = '42501';
  end if;
  -- "failed" is allowed: the organiser can type the recipe in by hand (brief section 3).
  if v_job.status not in ('ready_for_review', 'failed') then
    raise exception 'This capture is not ready to confirm (status %)', v_job.status using errcode = '22023';
  end if;

  insert into public.recipes (family_id, title, origin_person_id, created_by)
  values (v_job.family_id, btrim(p_content ->> 'title'), v_job.person_id, p_actor)
  returning id into v_recipe_id;

  v_version_id := private.insert_confirmed_version(
    v_recipe_id, v_job.family_id, 'original', null, v_job.person_id, v_job.source_type, v_job.id,
    p_actor, p_content, null
  );

  update public.recipes set root_version_id = v_version_id, current_version_id = v_version_id
  where id = v_recipe_id;
  update public.media set recipe_version_id = v_version_id where capture_job_id = v_job.id;
  update public.capture_jobs set status = 'confirmed', recipe_id = v_recipe_id where id = v_job.id;
  return v_recipe_id;
end;
$$;

-- Fix the original without forking it (ADR 0005): owners and admins publish a correction that
-- becomes the current version. Every earlier version stays readable in history.
create function public.publish_correction(
  p_actor uuid, p_recipe_id uuid, p_content jsonb, p_change_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_recipe public.recipes;
  v_parent public.recipe_versions;
  v_version_id uuid;
begin
  select * into v_recipe from public.recipes where id = p_recipe_id and deleted_at is null for update;
  if v_recipe.id is null or not private.actor_can(p_actor, v_recipe.family_id, '{owner,admin}') then
    raise exception 'Only owners and admins can correct a recipe' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_change_note, ''))) = 0 then
    raise exception 'Say what was corrected' using errcode = '22023';
  end if;
  select * into v_parent from public.recipe_versions where id = v_recipe.current_version_id;

  v_version_id := private.insert_confirmed_version(
    v_recipe.id, v_recipe.family_id, 'correction', v_parent.id, v_parent.author_person_id,
    v_parent.source_type, v_parent.capture_job_id, p_actor, p_content, p_change_note
  );
  update public.recipes set current_version_id = v_version_id, title = btrim(p_content ->> 'title')
  where id = v_recipe.id;
  return v_version_id;
end;
$$;

revoke all on function public.create_contributor_link(uuid, uuid, text, smallint, interval) from public, anon, authenticated;
revoke all on function public.revoke_contributor_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.contributor_link_info(text) from public, anon, authenticated;
revoke all on function public.begin_capture(public.source_type, text, bigint, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_capture(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.publish_correction(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_contributor_link(uuid, uuid, text, smallint, interval) to service_role;
grant execute on function public.revoke_contributor_link(uuid, uuid) to service_role;
grant execute on function public.contributor_link_info(text) to service_role;
grant execute on function public.begin_capture(public.source_type, text, bigint, text, uuid, uuid, text) to service_role;
grant execute on function public.confirm_capture(uuid, uuid, jsonb) to service_role;
grant execute on function public.publish_correction(uuid, uuid, jsonb, text) to service_role;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: vault-audio (recordings) and vault-scans (handwriting)
-- Path: {family_id}/capture/{job_id}/{media_id}.{ext}, registered by begin_capture().
-- A file is readable exactly when its media row is (RLS on public.media). Clients can upload
-- only to a path registered for them, once. No client can overwrite or delete raw media.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vault-audio', 'vault-audio', false, 52428800,
   array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/x-wav']),
  ('vault-scans', 'vault-scans', false, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

create policy "capture media: readable with its media row" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('vault-audio', 'vault-scans')
    and exists (
      select 1 from public.media m
      where m.storage_bucket = bucket_id and m.storage_path = name and m.removed_at is null
    )
  );

create policy "capture media: upload to your registered path" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('vault-audio', 'vault-scans')
    and exists (
      select 1 from public.media m
      where m.storage_bucket = bucket_id and m.storage_path = name
        and m.uploaded_by = (select auth.uid()) and m.removed_at is null
        and m.created_at > now() - interval '1 day'
    )
  );
