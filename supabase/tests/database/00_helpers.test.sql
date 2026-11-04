-- Shared test helpers and fixtures. Runs first (files run in name order) and commits, so the
-- other test files can use them. Every other file runs inside a transaction and rolls back.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Fixed ids so failures are readable.
create or replace function tests.uid(p_name text) returns uuid language sql immutable as $$
  select case p_name
    when 'dhruv'    then '11111111-1111-4111-8111-111111111111'  -- Shah owner
    when 'aunt'     then '22222222-2222-4222-8222-222222222222'  -- Shah admin
    when 'mom'      then '33333333-3333-4333-8333-333333333333'  -- Shah member
    when 'cousin'   then '44444444-4444-4444-8444-444444444444'  -- Shah viewer
    when 'raj'      then '55555555-5555-4555-8555-555555555555'  -- Patel owner
    when 'outsider' then '66666666-6666-4666-8666-666666666666'  -- no vault
    when 'newbie'   then '77777777-7777-4777-8777-777777777777'  -- joins by invite
  end::uuid;
$$;

create or replace function tests.family(p_name text) returns uuid language sql immutable as $$
  select case p_name
    when 'shah'  then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    when 'patel' then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  end::uuid;
$$;

create or replace function tests.person(p_name text) returns uuid language sql immutable as $$
  select case p_name
    when 'ba'      then 'c0000000-0000-4000-8000-000000000001'  -- Shah, no account
    when 'mom'     then 'c0000000-0000-4000-8000-000000000002'  -- Shah, linked to mom
    when 'newbie'  then 'c0000000-0000-4000-8000-000000000003'  -- Shah, no account yet
    when 'dada'    then 'd0000000-0000-4000-8000-000000000001'  -- Patel, no account
  end::uuid;
$$;

create or replace function tests.create_user(p_name text, p_email text, p_phone text default null)
returns void language sql as $$
  insert into auth.users (id, email, phone, raw_user_meta_data, aud, role)
  values (tests.uid(p_name), p_email, p_phone, jsonb_build_object('display_name', initcap(p_name)),
          'authenticated', 'authenticated');
$$;

-- Two unrelated families, as they would look after create_family() and accepted invites.
create or replace function tests.seed_two_families() returns void language plpgsql as $$
begin
  perform tests.create_user('dhruv', 'dhruv@tests.invalid');
  perform tests.create_user('aunt', 'aunt@tests.invalid');
  perform tests.create_user('mom', 'mom@tests.invalid');
  perform tests.create_user('cousin', 'cousin@tests.invalid');
  perform tests.create_user('raj', 'raj@tests.invalid');
  perform tests.create_user('outsider', 'outsider@tests.invalid');
  perform tests.create_user('newbie', 'Newbie@Tests.Invalid', '447700900123');

  insert into public.families (id, name, created_by) values
    (tests.family('shah'), 'Shah family', tests.uid('dhruv')),
    (tests.family('patel'), 'Patel family', tests.uid('raj'));

  insert into public.family_members (family_id, profile_id, role) values
    (tests.family('shah'), tests.uid('dhruv'), 'owner'),
    (tests.family('shah'), tests.uid('aunt'), 'admin'),
    (tests.family('shah'), tests.uid('mom'), 'member'),
    (tests.family('shah'), tests.uid('cousin'), 'viewer'),
    (tests.family('patel'), tests.uid('raj'), 'owner');

  insert into public.people (id, family_id, display_name, relation_label, profile_id) values
    (tests.person('ba'), tests.family('shah'), 'Kantaben', 'Ba', null),
    (tests.person('mom'), tests.family('shah'), 'Meena', 'Mom', tests.uid('mom')),
    (tests.person('newbie'), tests.family('shah'), 'Nikhil', 'Cousin', null),
    (tests.person('dada'), tests.family('patel'), 'Ramesh', 'Dada', null);

  perform public.create_invite(tests.uid('dhruv'), tests.family('shah'), 'shah-invite-token-0000000001', 'member', 'link');
  perform public.create_invite(tests.uid('raj'), tests.family('patel'), 'patel-invite-token-000000001', 'member', 'link');

  insert into storage.objects (bucket_id, name) values
    ('vault-images', tests.family('shah') || '/people/' || tests.person('ba') || '/photo.jpg'),
    ('vault-images', tests.family('patel') || '/people/' || tests.person('dada') || '/photo.jpg');
end;
$$;

-- Act as a signed-in user, the way PostgREST does for a request with that user's JWT.
create or replace function tests.authenticate_as(p_name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
end;
$$;

create or replace function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

create or replace function tests.as_superuser() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Rows changed by a statement, run as the current role (so RLS applies).
create or replace function tests.affected(p_sql text) returns integer language plpgsql as $$
declare
  v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(1);
select pass('test helpers installed');
select * from finish();
commit;
