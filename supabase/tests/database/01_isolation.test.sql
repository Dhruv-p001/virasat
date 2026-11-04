-- Phase 1 done criterion: two families cannot see each other's data under any query.
begin;
select plan(24);
select tests.seed_two_families();
-- The Storage API sets this before deleting objects, with RLS still applied to the caller.
select set_config('storage.allow_delete_query', 'true', true);

-- Dhruv (owner of the Shah vault) ------------------------------------------
select tests.authenticate_as('dhruv');

select results_eq('select id from public.families', array[tests.family('shah')],
  'Shah owner sees only the Shah vault');
select results_eq('select distinct family_id from public.people', array[tests.family('shah')],
  'Shah owner sees only Shah people');
select results_eq('select distinct family_id from public.family_members', array[tests.family('shah')],
  'Shah owner sees only Shah members');
select results_eq('select distinct family_id from public.invites', array[tests.family('shah')],
  'Shah owner sees only Shah invites');
select results_eq('select id from public.profiles order by id',
  array[tests.uid('dhruv'), tests.uid('aunt'), tests.uid('mom'), tests.uid('cousin')],
  'Profiles visible: self and Shah co-members only');
select results_eq($$select name from storage.objects where bucket_id = 'vault-images'$$,
  array[tests.family('shah') || '/people/' || tests.person('ba') || '/photo.jpg'],
  'Shah owner sees only Shah photos');

select throws_ok(
  format('insert into public.people (family_id, display_name) values (%L, %L)', tests.family('patel'), 'Intruder'),
  '42501', null, 'Cannot add a person to another vault');
select is(tests.affected(format('update public.families set name = %L where id = %L', 'Hacked', tests.family('patel'))),
  0, 'Cannot rename another vault');
select is(tests.affected(format('update public.people set notes = %L where family_id = %L', 'x', tests.family('patel'))),
  0, 'Cannot edit people in another vault');
select is(tests.affected(format('update public.family_members set role = %L where family_id = %L', 'viewer', tests.family('patel'))),
  0, 'Cannot change roles in another vault');
select is(tests.affected(format('delete from public.family_members where family_id = %L', tests.family('patel'))),
  0, 'Cannot remove members of another vault');
select is(tests.affected(format('update public.profiles set display_name = %L where id = %L', 'Hacked', tests.uid('raj'))),
  0, 'Cannot edit a profile outside your vaults');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('patel') || '/people/' || tests.person('dada') || '/evil.jpg'),
  '42501', null, 'Cannot upload into another vault''s folder');
select is(tests.affected(format($$delete from storage.objects where name like %L$$, tests.family('patel') || '/%')),
  0, 'Cannot delete another vault''s photos');

-- Raj (owner of the Patel vault): the mirror image ----------------------------
select tests.authenticate_as('raj');

select results_eq('select id from public.families', array[tests.family('patel')],
  'Patel owner sees only the Patel vault');
select results_eq('select distinct family_id from public.people', array[tests.family('patel')],
  'Patel owner sees only Patel people');
select results_eq('select id from public.profiles', array[tests.uid('raj')],
  'Patel owner sees no Shah profiles');

-- Someone with an account but no vault ----------------------------------------
select tests.authenticate_as('outsider');

select is_empty('select 1 from public.families', 'Outsider sees no vaults');
select is_empty('select 1 from public.people', 'Outsider sees no people');
select is_empty('select 1 from public.family_members', 'Outsider sees no memberships');
select results_eq('select id from public.profiles', array[tests.uid('outsider')],
  'Outsider sees only their own profile');

-- Not signed in ------------------------------------------------------------------
select tests.as_anon();

select throws_ok('select 1 from public.families', '42501', null, 'Anonymous visitors cannot query vaults');
select throws_ok('select 1 from public.people', '42501', null, 'Anonymous visitors cannot query people');
select throws_ok($$select public.create_family('Anon family')$$, '42501', null,
  'Anonymous visitors cannot create a vault');

select * from finish();
rollback;
