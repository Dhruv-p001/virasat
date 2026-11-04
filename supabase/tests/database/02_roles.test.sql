-- Inside one vault: what each role can and cannot do. Every policy, allowed and denied.
begin;
select plan(43);
select tests.seed_two_families();
-- The Storage API sets this before deleting objects, with RLS still applied to the caller.
select set_config('storage.allow_delete_query', 'true', true);

-- people ---------------------------------------------------------------------------
select tests.authenticate_as('mom');
select lives_ok(
  format('insert into public.people (family_id, display_name, relation_label) values (%L, %L, %L)',
    tests.family('shah'), 'Sarla', 'Masi'),
  'Member can add a person');
select is(tests.affected(format('update public.people set notes = %L where id = %L', 'Makes the best kadhi', tests.person('ba'))),
  1, 'Member can edit a person');
select throws_ok(
  format('select public.remove_person(%L)', tests.person('ba')),
  '42501', null, 'Member cannot remove a person');
select throws_ok(
  format('insert into public.people (family_id, display_name, profile_id) values (%L, %L, %L)',
    tests.family('shah'), 'Fake', tests.uid('outsider')),
  '42501', null, 'Nobody can link a person to an account on insert');
select throws_ok(
  format('update public.people set profile_id = %L where id = %L', tests.uid('mom'), tests.person('ba')),
  '42501', null, 'Nobody can link a person to an account on update');
select throws_ok(
  format('update public.people set family_id = %L where id = %L', tests.family('patel'), tests.person('ba')),
  '42501', null, 'People cannot move between vaults');

select tests.authenticate_as('cousin');
select throws_ok(
  format('insert into public.people (family_id, display_name) values (%L, %L)', tests.family('shah'), 'Nope'),
  '42501', null, 'Viewer cannot add a person');
select is(tests.affected(format('update public.people set notes = %L where id = %L', 'x', tests.person('ba'))),
  0, 'Viewer cannot edit a person');
select isnt_empty('select 1 from public.people', 'Viewer can read people');

select tests.authenticate_as('aunt');
select throws_ok(
  format('update public.people set deleted_at = now() where id = %L', tests.person('newbie')),
  '42501', null, 'Nobody sets deleted_at directly; removal goes through remove_person()');
select lives_ok(format('select public.remove_person(%L)', tests.person('newbie')),
  'Admin can remove a person');
select tests.authenticate_as('raj');
select throws_ok(format('select public.remove_person(%L)', tests.person('ba')),
  '42501', null, 'An owner of another vault cannot remove your people');
select tests.authenticate_as('mom');
select is_empty(format('select 1 from public.people where id = %L', tests.person('newbie')),
  'Removed people disappear for members');

-- storage: vault-images (before any role changes below) ---------------------------------
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('shah') || '/people/' || tests.person('ba') || '/member.jpg'),
  'Member can upload a person''s photo');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('shah') || '/cover/member.jpg'),
  '42501', null, 'Member cannot change the vault cover');
select tests.authenticate_as('cousin');
select isnt_empty($$select 1 from storage.objects where bucket_id = 'vault-images'$$, 'Viewer can see vault photos');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('shah') || '/people/' || tests.person('ba') || '/viewer.jpg'),
  '42501', null, 'Viewer cannot upload photos');
select is(tests.affected($$delete from storage.objects where bucket_id = 'vault-images'$$),
  0, 'Viewer cannot delete photos');
select tests.authenticate_as('aunt');
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vault-images', %L)$$,
    tests.family('shah') || '/cover/cover.jpg'),
  'Admin can upload a vault cover');
select tests.authenticate_as('mom');
select is(tests.affected(format($$delete from storage.objects where name = %L$$,
    tests.family('shah') || '/people/' || tests.person('ba') || '/member.jpg')),
  1, 'Member can remove a person''s photo');

-- families -------------------------------------------------------------------------
select is(tests.affected(format('update public.families set name = %L where id = %L', 'Mom''s rename', tests.family('shah'))),
  0, 'Member cannot rename the vault');
select tests.authenticate_as('aunt');
select is(tests.affected(format('update public.families set name = %L where id = %L', 'Shah parivar', tests.family('shah'))),
  1, 'Admin can rename the vault');
select tests.authenticate_as('dhruv');
select is(tests.affected(format('update public.families set name = %L where id = %L', 'Shah family', tests.family('shah'))),
  1, 'Owner can rename the vault');
select throws_ok(
  format('update public.families set deleted_at = now() where id = %L', tests.family('shah')),
  '42501', null, 'Even the owner cannot delete a vault directly (server does it after export)');

-- family_members -------------------------------------------------------------------
select throws_ok(
  format('insert into public.family_members (family_id, profile_id, role) values (%L, %L, %L)',
    tests.family('shah'), tests.uid('outsider'), 'member'),
  '42501', null, 'Nobody can add a member directly (only invites)');
select throws_ok(
  format('update public.family_members set profile_id = %L where profile_id = %L and family_id = %L',
    tests.uid('outsider'), tests.uid('cousin'), tests.family('shah')),
  '42501', null, 'A membership cannot be reassigned to another account');

select tests.authenticate_as('mom');
select is(tests.affected(format('update public.family_members set role = %L where profile_id = %L', 'member', tests.uid('cousin'))),
  0, 'Member cannot change roles');

select tests.authenticate_as('aunt');
select is(tests.affected(format('update public.family_members set role = %L where profile_id = %L', 'member', tests.uid('cousin'))),
  1, 'Admin can change a viewer to member');
select is(tests.affected(format('update public.family_members set role = %L where profile_id = %L', 'viewer', tests.uid('dhruv'))),
  0, 'Admin cannot change the owner''s role');
select throws_ok(
  format('update public.family_members set role = %L where profile_id = %L', 'owner', tests.uid('cousin')),
  '42501', null, 'Admin cannot make someone an owner');
select is(tests.affected(format('delete from public.family_members where profile_id = %L and family_id = %L', tests.uid('dhruv'), tests.family('shah'))),
  0, 'Admin cannot remove the owner');

select tests.authenticate_as('dhruv');
select throws_ok(
  format('update public.family_members set role = %L where profile_id = %L', 'admin', tests.uid('dhruv')),
  '23514', null, 'The last owner cannot step down');
select throws_ok(
  format('delete from public.family_members where profile_id = %L and family_id = %L', tests.uid('dhruv'), tests.family('shah')),
  '23514', null, 'The last owner cannot leave');
select is(tests.affected(format('update public.family_members set role = %L where profile_id = %L', 'owner', tests.uid('aunt'))),
  1, 'Owner can make an admin a co-owner');
select is(tests.affected(format('delete from public.family_members where profile_id = %L and family_id = %L', tests.uid('dhruv'), tests.family('shah'))),
  1, 'An owner can leave once there is another owner');

select tests.authenticate_as('mom');
select is(tests.affected(format('delete from public.family_members where profile_id = %L', tests.uid('mom'))),
  1, 'A member can leave a vault');
select is_empty('select 1 from public.families', 'After leaving, the vault is no longer visible');

-- invites --------------------------------------------------------------------------
select tests.authenticate_as('cousin');
select is_empty('select 1 from public.invites', 'Non-managers cannot see invites');
select tests.authenticate_as('aunt');
select isnt_empty('select 1 from public.invites', 'Owners and admins can see invites');
select throws_ok('select token_hash from public.invites', '42501', null, 'Nobody can read invite token hashes');
select throws_ok(
  format($$insert into public.invites (family_id, role, channel, token_hash, expires_at) values (%L, 'member', 'link', %L, now() + interval '1 day')$$,
    tests.family('shah'), repeat('a', 64)),
  '42501', null, 'Clients cannot create invites directly');

-- profiles -------------------------------------------------------------------------
select is(tests.affected(format('update public.profiles set display_name = %L where id = %L', 'Aunty', tests.uid('aunt'))),
  1, 'You can edit your own profile');
select is(tests.affected(format('update public.profiles set display_name = %L where id = %L', 'Hacked', tests.uid('cousin'))),
  0, 'You cannot edit a co-member''s profile');

select * from finish();
rollback;
