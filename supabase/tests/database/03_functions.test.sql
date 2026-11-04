-- Server functions: vault creation, invites, sign-up profile trigger.
begin;
select plan(25);
select tests.seed_two_families();

-- Profile created on sign-up ------------------------------------------------------
select is((select display_name from public.profiles where id = tests.uid('dhruv')), 'Dhruv',
  'Sign-up creates a profile with the display name from metadata');

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('88888888-8888-4888-8888-888888888888', 'priya.k@example.test',
   '{"preferred_language": "en; drop table x", "display_name": "  "}', 'authenticated', 'authenticated');
select is((select display_name from public.profiles where id = '88888888-8888-4888-8888-888888888888'), 'priya.k',
  'Blank display names fall back to the email name');
select is((select preferred_language from public.profiles where id = '88888888-8888-4888-8888-888888888888'), 'en',
  'Invalid language metadata falls back to English');

-- create_family ---------------------------------------------------------------------
select tests.authenticate_as('outsider');
select isnt(public.create_family('Outsider family'), null, 'A signed-in user can create a vault');
select results_eq($$select role::text from public.family_members where profile_id = tests.uid('outsider')$$,
  array['owner'], 'The creator becomes the owner');
select throws_ok($$select public.create_family('   ')$$, '23514', null, 'A vault needs a name');

-- Server-only functions are not callable by clients -----------------------------------
select throws_ok(
  format($$select public.create_invite(%L, %L, 'client-made-token-0000000001', 'member', 'link')$$,
    tests.uid('outsider'), tests.family('shah')),
  '42501', null, 'Clients cannot call create_invite');
select throws_ok($$select public.accept_invite(tests.uid('outsider'), 'shah-invite-token-0000000001')$$,
  '42501', null, 'Clients cannot call accept_invite');
select throws_ok(
  format($$select public.revoke_invite(%L, gen_random_uuid())$$, tests.uid('outsider')),
  '42501', null, 'Clients cannot call revoke_invite');

-- The rest runs as the server (service role) -------------------------------------------
select tests.as_superuser();
set local role service_role;

select throws_ok(
  format($$select public.create_invite(%L, %L, 'member-made-token-0000000001', 'member', 'link')$$,
    tests.uid('mom'), tests.family('shah')),
  '42501', null, 'Members cannot invite');
select throws_ok(
  format($$select public.create_invite(%L, %L, 'owner-role-token-00000000001', 'owner', 'link')$$,
    tests.uid('dhruv'), tests.family('shah')),
  '23514', null, 'Invites can never grant ownership');
select throws_ok(
  format($$select public.create_invite(%L, %L, 'cross-vault-token-0000000001', 'member', 'link', null, null, %L)$$,
    tests.uid('dhruv'), tests.family('shah'), tests.person('dada')),
  '22023', null, 'An invite cannot point at a person from another vault');
select throws_ok(
  format($$select public.create_invite(%L, %L, 'short', 'member', 'link')$$, tests.uid('dhruv'), tests.family('shah')),
  '22023', null, 'Invite tokens must be long enough');

-- Link invite tied to an existing person: Nikhil joins and becomes "Cousin"
select lives_ok(
  format($$select public.create_invite(%L, %L, 'nikhil-link-token-0000000001', 'viewer', 'link', null, null, %L)$$,
    tests.uid('aunt'), tests.family('shah'), tests.person('newbie')),
  'An admin can invite, linked to an existing person');
select is(public.accept_invite(tests.uid('newbie'), 'nikhil-link-token-0000000001'), tests.family('shah'),
  'Accepting returns the vault');
select results_eq(
  format($$select role::text from public.family_members where profile_id = %L and family_id = %L$$, tests.uid('newbie'), tests.family('shah')),
  array['viewer'], 'The joiner gets the invited role');
select is((select profile_id from public.people where id = tests.person('newbie')), tests.uid('newbie'),
  'The joiner is linked to their person record');
select throws_ok($$select public.accept_invite(tests.uid('outsider'), 'nikhil-link-token-0000000001')$$,
  'P0002', null, 'An invite works only once');

-- Expired and revoked invites
select public.create_invite(tests.uid('dhruv'), tests.family('shah'), 'expired-token-0000000000001', 'member', 'link');
update public.invites set created_at = now() - interval '3 days', expires_at = now() - interval '1 day'
  where token_hash = encode(extensions.digest('expired-token-0000000000001', 'sha256'), 'hex');
select throws_ok($$select public.accept_invite(tests.uid('outsider'), 'expired-token-0000000000001')$$,
  'P0002', null, 'Expired invites are refused');

select throws_ok(
  format($$select public.revoke_invite(%L, (select id from public.invites where family_id = %L and accepted_at is null and revoked_at is null and channel = 'link' limit 1))$$,
    tests.uid('mom'), tests.family('shah')),
  '42501', null, 'Members cannot revoke invites');
select lives_ok(
  format($$select public.revoke_invite(%L, (select id from public.invites where token_hash = encode(extensions.digest('shah-invite-token-0000000001', 'sha256'), 'hex')))$$,
    tests.uid('dhruv')),
  'The owner can revoke an invite');
select throws_ok($$select public.accept_invite(tests.uid('outsider'), 'shah-invite-token-0000000001')$$,
  'P0002', null, 'Revoked invites are refused');

-- Email and phone invites only work for that address or number
select public.create_invite(tests.uid('raj'), tests.family('patel'), 'email-invite-token-000000001', 'member', 'email', null, 'newbie@tests.invalid');
select throws_ok($$select public.accept_invite(tests.uid('outsider'), 'email-invite-token-000000001')$$,
  '42501', null, 'An email invite cannot be used by a different email');
select lives_ok($$select public.accept_invite(tests.uid('newbie'), 'email-invite-token-000000001')$$,
  'An email invite works for that email, ignoring case');

select public.create_invite(tests.uid('dhruv'), tests.family('shah'), 'phone-invite-token-000000001', 'member', 'phone', '+447700900123');
select lives_ok($$select public.accept_invite(tests.uid('newbie'), 'phone-invite-token-000000001')$$,
  'A phone invite works for that number (auth stores it without the +)');

select * from finish();
rollback;
