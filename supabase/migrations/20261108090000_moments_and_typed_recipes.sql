-- Phase 2.5: family moments ("I cooked it") and recipes typed in by hand.
-- Plan: docs/plans/phase-2.5-design-first-run.md. Every rule has pgTAP tests (08_moments_and_typed).
--
-- Moments are a family member's own casual content, so they use ordinary RLS writes (unlike
-- capture and recipe tables, ADR 0010). Typed recipes are recipes, so they go through a
-- service-role function like every other way a recipe comes into existence.

-- {family_id}/{folder}/{uuid}/... -> the uuid at position p_index, or null.
create function private.path_uuid(p_name text, p_index integer) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(p_name, '/', p_index) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', p_index)::uuid
  end;
$$;

-- ---------------------------------------------------------------------------
-- Moments (the brief's v2 "attempts", moved into v1)
-- ---------------------------------------------------------------------------

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- The version cooked from, when known (e.g. a correction or a personal version later).
  version_id uuid references public.recipe_versions (id) on delete set null,
  author_profile_id uuid references public.profiles (id) on delete set null,
  note text check (char_length(note) <= 1000),
  rating smallint check (rating between 1 and 5),
  cooked_on date not null default current_date check (cooked_on >= date '1900-01-01'),
  -- One photo per moment: {family_id}/moments/{attempt_id}/{file} in vault-images.
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (photo_path is null or photo_path like family_id::text || '/moments/' || id::text || '/%')
);
comment on table public.attempts is
  'Family moments: "I cooked it", with a note, rating and photo. Visible to whoever can read the recipe.';
create index attempts_family_id_idx on public.attempts (family_id, cooked_on desc);
create index attempts_recipe_id_idx on public.attempts (recipe_id);
create index attempts_author_profile_id_idx on public.attempts (author_profile_id);

create trigger attempts_updated_at before update on public.attempts
  for each row execute function private.set_updated_at();

-- Integrity checks read the real rows, not the caller's RLS view, so a recipe the caller cannot
-- see is refused by RLS (42501) rather than misreported as "not in this vault".
create function private.recipe_family_id(p_recipe_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.recipes where id = p_recipe_id;
$$;

create function private.version_recipe_id(p_version_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select recipe_id from public.recipe_versions where id = p_version_id;
$$;

-- Integrity for every role; column immutability for clients (server code is not restricted).
create function private.guard_attempts() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.cooked_on > current_date + 1 then
    raise exception 'A moment cannot be dated in the future' using errcode = '23514';
  end if;
  if private.recipe_family_id(new.recipe_id) is distinct from new.family_id then
    raise exception 'The recipe is not in this vault' using errcode = '23514';
  end if;
  if new.version_id is not null
    and private.version_recipe_id(new.version_id) is distinct from new.recipe_id
  then
    raise exception 'That version belongs to another recipe' using errcode = '23514';
  end if;

  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.author_profile_id := (select auth.uid());
    new.deleted_at := null;
    return new;
  end if;
  if new.family_id <> old.family_id or new.recipe_id <> old.recipe_id
    or new.author_profile_id is distinct from old.author_profile_id
    or new.created_at <> old.created_at
  then
    raise exception 'Only the note, rating, date, version and photo of a moment can change'
      using errcode = '42501';
  end if;
  -- Postgres refuses an update that hides the row from its own read policy: use remove_moment().
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'Remove moments with remove_moment()' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger attempts_guard before insert or update on public.attempts
  for each row execute function private.guard_attempts();

alter table public.attempts enable row level security;

-- Whoever can read the recipe sees its moments (private recipes stay private).
create policy "attempts: readable with the recipe" on public.attempts
  for select to authenticated
  using (deleted_at is null and private.can_read_recipe(recipe_id));

-- Owners, admins and members add moments, as themselves, to recipes they can read.
create policy "attempts: writers add their own" on public.attempts
  for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and private.can_write(family_id)
    and private.can_read_recipe(recipe_id)
  );

create policy "attempts: authors edit their own" on public.attempts
  for update to authenticated
  using (author_profile_id = (select auth.uid()) and deleted_at is null)
  with check (author_profile_id = (select auth.uid()));

revoke all on public.attempts from anon;
revoke delete, truncate on public.attempts from authenticated;

-- The author, or an owner or admin of the vault, removes a moment.
create function public.remove_moment(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.attempts;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id and deleted_at is null;
  if v_attempt.id is null
    or not (
      v_attempt.author_profile_id = (select auth.uid())
      or private.can_manage(v_attempt.family_id)
    )
  then
    raise exception 'Moment not found or not yours to remove' using errcode = '42501';
  end if;
  update public.attempts set deleted_at = now() where id = p_attempt_id;
end;
$$;

revoke all on function public.remove_moment(uuid) from public, anon;
grant execute on function public.remove_moment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Typed recipes: the two-minute first recipe, no recording needed
-- ---------------------------------------------------------------------------

-- Server only (service role). Same content contract and checks as confirm_capture().
create function public.create_typed_recipe(
  p_actor uuid,
  p_family_id uuid,
  p_content jsonb,
  p_origin_person_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_recipe_id uuid;
  v_version_id uuid;
begin
  if not private.actor_can(p_actor, p_family_id, '{owner,admin,member}') then
    raise exception 'Only family members who can add recipes can do this' using errcode = '42501';
  end if;
  if p_origin_person_id is not null and not exists (
    select 1 from public.people p
    where p.id = p_origin_person_id and p.family_id = p_family_id and p.deleted_at is null
  ) then
    raise exception 'That person is not in this vault' using errcode = '42501';
  end if;

  insert into public.recipes (family_id, title, origin_person_id, created_by)
  values (p_family_id, btrim(p_content ->> 'title'), p_origin_person_id, p_actor)
  returning id into v_recipe_id;

  v_version_id := private.insert_confirmed_version(
    v_recipe_id, p_family_id, 'original', null, p_origin_person_id, 'typed', null, p_actor,
    p_content - 'uncertain_fields', null
  );
  update public.recipes set root_version_id = v_version_id, current_version_id = v_version_id
  where id = v_recipe_id;
  return v_recipe_id;
end;
$$;

revoke all on function public.create_typed_recipe(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_typed_recipe(uuid, uuid, jsonb, uuid) to service_role;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: moment photos in vault-images at {family_id}/moments/{attempt_id}/{file}
-- Reading is covered by the existing "vault-images: members read" policy.
-- ---------------------------------------------------------------------------

create policy "vault-images: authors upload moment photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vault-images'
    and (storage.foldername(name))[2] = 'moments'
    and exists (
      select 1 from public.attempts a
      where a.id = private.path_uuid(name, 3)
        and a.family_id = private.path_family_id(name)
        and a.author_profile_id = (select auth.uid())
    )
  );

create policy "vault-images: authors remove moment photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vault-images'
    and (storage.foldername(name))[2] = 'moments'
    and exists (
      select 1 from public.attempts a
      where a.id = private.path_uuid(name, 3)
        and a.family_id = private.path_family_id(name)
        and a.author_profile_id = (select auth.uid())
    )
  );
