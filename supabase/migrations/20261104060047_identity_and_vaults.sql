-- Phase 1: accounts, vaults, members, people, invites, and the vault-images bucket.
-- Design: docs/schema.md. Every policy here has allowed and denied tests in supabase/tests/database.

-- Helpers live in a schema PostgREST does not expose.
create schema private;
grant usage on schema private to authenticated, service_role;

create type public.family_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.unit_system as enum ('metric', 'us_customary', 'cups_spoons');
create type public.invite_channel as enum ('link', 'phone', 'email');

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  preferred_language text not null default 'en'
    check (preferred_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  unit_system public.unit_system not null default 'metric',
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One per account. Phone and email stay in auth.users so family members never see them.';

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.families is 'A family vault.';

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.family_role not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, profile_id)
);
create index family_members_profile_id_idx on public.family_members (profile_id);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  relation_label text check (char_length(btrim(relation_label)) between 1 and 40),
  profile_id uuid references public.profiles (id) on delete set null,
  photo_path text,
  birth_year smallint check (birth_year between 1850 and 2100),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, profile_id)
);
comment on table public.people is 'Everyone in a vault, with or without an account (Ba never signs up).';
create index people_family_id_idx on public.people (family_id);
create index people_profile_id_idx on public.people (profile_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  role public.family_role not null check (role <> 'owner'),
  channel public.invite_channel not null,
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  person_id uuid references public.people (id) on delete set null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((channel = 'phone') = (phone is not null)),
  check ((channel = 'email') = (email is not null)),
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
comment on column public.invites.token_hash is 'SHA-256 hex of the invite token. The token itself is never stored.';
create index invites_family_id_idx on public.invites (family_id);
create index invites_person_id_idx on public.invites (person_id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger families_updated_at before update on public.families
  for each row execute function private.set_updated_at();
create trigger family_members_updated_at before update on public.family_members
  for each row execute function private.set_updated_at();
create trigger people_updated_at before update on public.people
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create function private.has_role(p_family_id uuid, p_roles public.family_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.family_members m
    join public.families f on f.id = m.family_id
    where m.family_id = p_family_id
      and m.profile_id = (select auth.uid())
      and m.role = any (p_roles)
      and f.deleted_at is null
  );
$$;

create function private.is_member(p_family_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select private.has_role(p_family_id, '{owner,admin,member,viewer}');
$$;

create function private.can_write(p_family_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select private.has_role(p_family_id, '{owner,admin,member}');
$$;

create function private.can_manage(p_family_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select private.has_role(p_family_id, '{owner,admin}');
$$;

create function private.shares_family(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.family_members mine
    join public.family_members theirs on theirs.family_id = mine.family_id
    join public.families f on f.id = mine.family_id
    where mine.profile_id = (select auth.uid())
      and theirs.profile_id = p_profile_id
      and f.deleted_at is null
  );
$$;

-- Leading {family_id} folder of a storage path, or null if it is not a UUID.
create function private.path_family_id(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile. Metadata is client-supplied, so it is validated, never trusted.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_lang text := coalesce(new.raw_user_meta_data ->> 'preferred_language', '');
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    left(coalesce(nullif(v_name, ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New member'), 80),
    case when v_lang ~ '^[a-z]{2,3}(-[A-Z]{2})?$' then v_lang else 'en' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- A vault always keeps at least one owner. Skipped when the vault itself is being deleted.
create function private.keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
    and (tg_op = 'DELETE' or new.role <> 'owner')
    and exists (select 1 from public.families f where f.id = old.family_id)
    and not exists (
      select 1 from public.family_members m
      where m.family_id = old.family_id and m.role = 'owner' and m.profile_id <> old.profile_id
    )
  then
    raise exception 'A vault must keep at least one owner. Make someone else an owner first.'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger family_members_keep_an_owner before update or delete on public.family_members
  for each row execute function private.keep_an_owner();

-- Columns clients may never change. These run as the caller, so server functions and the
-- service role (current_user <> 'authenticated') are not restricted.
create function private.guard_family_members() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
    and (new.family_id <> old.family_id or new.profile_id <> old.profile_id or new.joined_at <> old.joined_at)
  then
    raise exception 'Only the role of a membership can change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger family_members_guard before update on public.family_members
  for each row execute function private.guard_family_members();

create function private.guard_families() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
    and (new.created_by is distinct from old.created_by
      or new.created_at <> old.created_at
      or new.deleted_at is distinct from old.deleted_at)
  then
    raise exception 'Deleting a vault happens through the server, after export' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger families_guard before update on public.families
  for each row execute function private.guard_families();

create function private.guard_people() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.profile_id is not null then
      raise exception 'A person is linked to an account only by accepting an invite' using errcode = '42501';
    end if;
    new.created_by := (select auth.uid());
    new.deleted_at := null;
    return new;
  end if;

  if new.family_id <> old.family_id then
    raise exception 'People cannot move between vaults' using errcode = '42501';
  end if;
  if new.profile_id is distinct from old.profile_id then
    raise exception 'A person is linked to an account only by accepting an invite' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    raise exception 'created_by and created_at cannot change' using errcode = '42501';
  end if;
  -- Postgres refuses an update that hides the row from its own read policy, so removal is a
  -- function rather than a column write.
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'Remove people with remove_person()' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger people_guard before insert or update on public.people
  for each row execute function private.guard_people();

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.people enable row level security;
alter table public.invites enable row level security;

-- profiles: yourself, and people you share a vault with.
create policy "profiles: read self and co-members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_family(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- families: members read; owners and admins rename and set the cover. Created via create_family().
create policy "families: members read" on public.families
  for select to authenticated
  using (deleted_at is null and private.is_member(id));
create policy "families: managers update" on public.families
  for update to authenticated
  using (private.can_manage(id))
  with check (private.can_manage(id));

-- family_members: members see the member list. Rows are created only by create_family() and
-- accept_invite(). Owners manage everyone; admins manage members and viewers; anyone can leave.
create policy "family_members: members read" on public.family_members
  for select to authenticated
  using (private.is_member(family_id));
create policy "family_members: change roles" on public.family_members
  for update to authenticated
  using (
    private.has_role(family_id, '{owner}')
    or (private.has_role(family_id, '{admin}') and role in ('member', 'viewer'))
  )
  with check (
    private.has_role(family_id, '{owner}')
    or (private.has_role(family_id, '{admin}') and role in ('admin', 'member', 'viewer'))
  );
create policy "family_members: leave or remove" on public.family_members
  for delete to authenticated
  using (
    profile_id = (select auth.uid())
    or private.has_role(family_id, '{owner}')
    or (private.has_role(family_id, '{admin}') and role in ('member', 'viewer'))
  );

-- people: members read; owners, admins and members add and edit; viewers only read.
create policy "people: members read" on public.people
  for select to authenticated
  using (deleted_at is null and private.is_member(family_id));
create policy "people: writers add" on public.people
  for insert to authenticated
  with check (private.can_write(family_id));
create policy "people: writers edit" on public.people
  for update to authenticated
  using (deleted_at is null and private.can_write(family_id))
  with check (private.can_write(family_id));

-- invites: owners and admins can list them. Creating, accepting and revoking go through the
-- server functions below. token_hash is never readable by clients.
create policy "invites: managers read" on public.invites
  for select to authenticated
  using (private.can_manage(family_id));

revoke all on public.invites from anon, authenticated;
grant select (
  id, family_id, role, channel, phone, email, person_id, invited_by,
  expires_at, accepted_at, accepted_by, revoked_at, created_at
) on public.invites to authenticated;

-- Clients only ever touch these tables through RLS as `authenticated`; `anon` gets nothing.
revoke all on public.profiles, public.families, public.family_members, public.people from anon;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke insert, delete, truncate on public.families from authenticated;
revoke insert, truncate on public.family_members from authenticated;
revoke delete, truncate on public.people from authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Create a vault and make the caller its owner, atomically.
create function public.create_family(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_family_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to create a vault' using errcode = '42501';
  end if;
  insert into public.families (name, created_by) values (p_name, v_uid) returning id into v_family_id;
  insert into public.family_members (family_id, profile_id, role) values (v_family_id, v_uid, 'owner');
  return v_family_id;
end;
$$;

-- Soft-remove a person from a vault. Owners and admins only.
create function public.remove_person(p_person_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id from public.people where id = p_person_id and deleted_at is null;
  if v_family_id is null or not private.can_manage(v_family_id) then
    raise exception 'Only owners and admins can remove people' using errcode = '42501';
  end if;
  update public.people set deleted_at = now() where id = p_person_id;
end;
$$;

-- Server only (service role): the API route generates the token and verifies the session.
create function public.create_invite(
  p_actor uuid,
  p_family_id uuid,
  p_token text,
  p_role public.family_role,
  p_channel public.invite_channel,
  p_phone text default null,
  p_email text default null,
  p_person_id uuid default null,
  p_expires_in interval default interval '14 days'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite_id uuid;
begin
  if not exists (
    select 1 from public.family_members m join public.families f on f.id = m.family_id
    where m.family_id = p_family_id and m.profile_id = p_actor and m.role in ('owner', 'admin')
      and f.deleted_at is null
  ) then
    raise exception 'Only owners and admins can invite' using errcode = '42501';
  end if;
  if char_length(coalesce(p_token, '')) < 22 then
    raise exception 'Invite token is too short' using errcode = '22023';
  end if;
  if p_person_id is not null and not exists (
    select 1 from public.people p
    where p.id = p_person_id and p.family_id = p_family_id and p.deleted_at is null and p.profile_id is null
  ) then
    raise exception 'That person is not in this vault or already has an account' using errcode = '22023';
  end if;

  insert into public.invites (
    family_id, role, channel, phone, email, person_id, token_hash, invited_by, expires_at
  ) values (
    p_family_id, p_role, p_channel, p_phone, lower(p_email), p_person_id,
    encode(extensions.digest(p_token, 'sha256'), 'hex'), p_actor, now() + p_expires_in
  )
  returning id into v_invite_id;
  return v_invite_id;
end;
$$;

-- Server only (service role). Phone and email invites must be accepted by that phone or email.
create function public.accept_invite(p_profile_id uuid, p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites;
  v_user auth.users;
begin
  select * into v_invite from public.invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if v_invite.id is null or v_invite.revoked_at is not null or v_invite.accepted_at is not null
    or v_invite.expires_at <= now()
    or not exists (select 1 from public.families f where f.id = v_invite.family_id and f.deleted_at is null)
  then
    raise exception 'This invite is no longer valid. Ask for a new one.' using errcode = 'P0002';
  end if;

  select * into v_user from auth.users where id = p_profile_id;
  if v_invite.channel = 'phone'
    and regexp_replace(coalesce(v_user.phone, ''), '\D', '', 'g') <> regexp_replace(v_invite.phone, '\D', '', 'g')
  then
    raise exception 'This invite was sent to a different phone number' using errcode = '42501';
  end if;
  if v_invite.channel = 'email' and lower(coalesce(v_user.email, '')) <> v_invite.email then
    raise exception 'This invite was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.family_members (family_id, profile_id, role)
  values (v_invite.family_id, p_profile_id, v_invite.role)
  on conflict (family_id, profile_id) do nothing;

  if v_invite.person_id is not null then
    update public.people set profile_id = p_profile_id
    where id = v_invite.person_id and profile_id is null and deleted_at is null
      and not exists (
        select 1 from public.people other
        where other.family_id = v_invite.family_id and other.profile_id = p_profile_id
      );
  end if;

  update public.invites set accepted_at = now(), accepted_by = p_profile_id where id = v_invite.id;
  return v_invite.family_id;
end;
$$;

-- Server only (service role).
create function public.revoke_invite(p_actor uuid, p_invite_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.invites i set revoked_at = now()
  where i.id = p_invite_id and i.revoked_at is null and i.accepted_at is null
    and exists (
      select 1 from public.family_members m
      where m.family_id = i.family_id and m.profile_id = p_actor and m.role in ('owner', 'admin')
    );
  if not found then
    raise exception 'Invite not found, already used, or not yours to revoke' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.create_family(text) from public, anon;
revoke all on function public.remove_person(uuid) from public, anon;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.remove_person(uuid) to authenticated;

revoke all on function public.create_invite(uuid, uuid, text, public.family_role, public.invite_channel, text, text, uuid, interval) from public, anon, authenticated;
revoke all on function public.accept_invite(uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_invite(uuid, uuid, text, public.family_role, public.invite_channel, text, text, uuid, interval) to service_role;
grant execute on function public.accept_invite(uuid, text) to service_role;
grant execute on function public.revoke_invite(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: vault-images (people photos, vault covers)
-- Paths: {family_id}/people/{person_id}/{file} and {family_id}/cover/{file}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vault-images', 'vault-images', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

create policy "vault-images: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'vault-images' and private.is_member(private.path_family_id(name)));

create policy "vault-images: writers upload people photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vault-images'
    and (storage.foldername(name))[2] = 'people'
    and private.can_write(private.path_family_id(name))
  );

create policy "vault-images: managers upload covers" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vault-images'
    and (storage.foldername(name))[2] = 'cover'
    and private.can_manage(private.path_family_id(name))
  );

create policy "vault-images: writers remove people photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vault-images'
    and (storage.foldername(name))[2] = 'people'
    and private.can_write(private.path_family_id(name))
  );

create policy "vault-images: managers remove covers" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vault-images'
    and (storage.foldername(name))[2] = 'cover'
    and private.can_manage(private.path_family_id(name))
  );
