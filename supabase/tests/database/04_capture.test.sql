-- Phase 2: capture, recipes, versions, media, contributor links, consents, audio/scan storage.
begin;
select plan(49);
select tests.seed_two_families();
select set_config('storage.allow_delete_query', 'true', true);

-- Ids created below, readable from any role during the test (rolled back at the end).
create table tests.ids (name text primary key, id uuid, path text);
grant select on tests.ids to anon, authenticated, service_role;
grant insert on tests.ids to service_role;
create function tests.ref(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
create function tests.path(p_name text) returns text language sql stable as $$
  select path from tests.ids where name = p_name;
$$;
grant execute on function tests.ref(text), tests.path(text) to anon, authenticated, service_role;

create function tests.recipe(p_title text, p_ingredients jsonb default null) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'title', p_title, 'servings', 4,
    'ingredients', coalesce(p_ingredients, '[{"original_text": "mutthi bhar besan", "name": "besan",
      "suggested_quantity": 30, "suggested_unit": "g", "confidence": 0.6, "note": null}]'::jsonb),
    'steps', '[{"text": "Mix everything and rest the dough."}]'::jsonb,
    'tips', '["Use fresh methi."]'::jsonb,
    'story', 'Ba made these for every train journey.',
    'language', 'gu',
    'uncertain_fields', '["/ingredients/0/suggested_quantity"]'::jsonb
  );
$$;
grant execute on function tests.recipe(text, jsonb) to service_role;

-- Fixtures, created as the server would --------------------------------------------------
set local role service_role;

insert into tests.ids (name, id)
select 'ba_link', public.create_contributor_link(tests.uid('dhruv'), tests.person('ba'), 'ba-recording-link-token-000001', 2::smallint);
insert into tests.ids (name, id, path)
select 'job_thepla', job_id, storage_path from public.begin_capture('voice', 'audio/webm;codecs=opus', 3000000, 'v1', tests.uid('mom'), tests.person('ba'));
update public.capture_jobs set status = 'ready_for_review', transcript = 'pehla besan...' where id = tests.ref('job_thepla');
insert into tests.ids (name, id)
select 'recipe_thepla', public.confirm_capture(tests.uid('mom'), tests.ref('job_thepla'), tests.recipe('Methi na thepla'));

insert into tests.ids (name, id, path)
select 'job_private', job_id, storage_path from public.begin_capture('handwriting', 'image/jpeg', 2000000, 'v1', tests.uid('dhruv'), tests.person('ba'));
update public.capture_jobs set status = 'ready_for_review' where id = tests.ref('job_private');
insert into tests.ids (name, id)
select 'recipe_private', public.confirm_capture(tests.uid('dhruv'), tests.ref('job_private'), tests.recipe('Dhruv''s draft kadhi'));
update public.recipes set visibility = 'private' where id = tests.ref('recipe_private');

insert into tests.ids (name, id, path)
select 'job_waiting', job_id, storage_path from public.begin_capture('voice', 'audio/mp4', 1000000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id, path)
select 'job_waiting_2', job_id, storage_path from public.begin_capture('voice', 'audio/mp4', 1000000, 'v1', tests.uid('mom'), tests.person('ba'));

insert into tests.ids (name, id, path)
select 'job_patel', job_id, storage_path from public.begin_capture('voice', 'audio/webm', 1000000, 'v1', tests.uid('raj'), tests.person('dada'));
update public.capture_jobs set status = 'ready_for_review' where id = tests.ref('job_patel');
select public.confirm_capture(tests.uid('raj'), tests.ref('job_patel'), tests.recipe('Dada''s dal'));

-- Server rules ---------------------------------------------------------------------------
select throws_ok(
  format($$select * from public.begin_capture('voice', 'audio/webm', 1000, 'v1', %L, %L)$$, tests.uid('cousin'), tests.person('ba')),
  '42501', null, 'A viewer cannot start a capture');
select throws_ok(
  format($$select * from public.begin_capture('voice', 'audio/webm', 1000, 'v1', %L, %L)$$, tests.uid('raj'), tests.person('ba')),
  '42501', null, 'Nobody can capture for a person in another vault');
select throws_ok(
  format($$select * from public.begin_capture('voice', 'image/jpeg', 1000, 'v1', %L, %L)$$, tests.uid('mom'), tests.person('ba')),
  '22023', null, 'A voice capture must be audio');
select throws_ok(
  format($$select * from public.begin_capture('voice', 'audio/webm', 60000000, 'v1', %L, %L)$$, tests.uid('mom'), tests.person('ba')),
  '22023', null, 'Recordings over 50 MB are refused');
select throws_ok(
  format($$select * from public.begin_capture('voice', 'audio/webm', 1000, '', %L, %L)$$, tests.uid('mom'), tests.person('ba')),
  '22023', null, 'No capture without a consent wording version');
select is((select count(*)::int from public.consents where person_id = tests.person('ba') and given_via = 'organiser' and wording_version = 'v1'),
  2, 'Organiser capture records voice and third-party consent once, not per recording');

-- Contributor links
select results_eq(
  $$select person_display_name, relation_label, uploads_left from public.contributor_link_info('ba-recording-link-token-000001')$$,
  $$values ('Kantaben'::text, 'Ba'::text, 2)$$,
  'The recording page learns only the elder''s name, photo and uploads left');
select lives_ok($$select * from public.begin_capture('voice', 'audio/webm', 1000, 'v1', p_contributor_token => 'ba-recording-link-token-000001')$$,
  'An elder can upload through their link without an account');
select is((select count(*)::int from public.consents where person_id = tests.person('ba') and given_via = 'contributor_link'),
  2, 'Consent given on the recording page is recorded against the link');
select lives_ok($$select * from public.begin_capture('voice', 'audio/webm', 1000, 'v1', p_contributor_token => 'ba-recording-link-token-000001')$$,
  'A second upload within the limit works');
select throws_ok($$select * from public.begin_capture('voice', 'audio/webm', 1000, 'v1', p_contributor_token => 'ba-recording-link-token-000001')$$,
  'P0002', null, 'A link stops after its upload limit');
select is_empty($$select * from public.contributor_link_info('ba-recording-link-token-000001')$$,
  'A used-up link reveals nothing');
select public.create_contributor_link(tests.uid('mom'), tests.person('ba'), 'revoked-link-token-0000000001');
select public.revoke_contributor_link(tests.uid('mom'), (select id from public.contributor_links where created_by = tests.uid('mom')));
select throws_ok($$select * from public.begin_capture('voice', 'audio/webm', 1000, 'v1', p_contributor_token => 'revoked-link-token-0000000001')$$,
  'P0002', null, 'A revoked link is refused');
select throws_ok(
  format($$select public.create_contributor_link(%L, %L, 'viewer-link-token-00000000001')$$, tests.uid('cousin'), tests.person('ba')),
  '42501', null, 'A viewer cannot create recording links');

-- Confirming and correcting
select throws_ok(format($$select public.confirm_capture(%L, %L, tests.recipe('x'))$$, tests.uid('cousin'), tests.ref('job_waiting')),
  '42501', null, 'A viewer cannot confirm a recipe');
select throws_ok(format($$select public.confirm_capture(%L, %L, tests.recipe('x'))$$, tests.uid('mom'), tests.ref('job_waiting')),
  '22023', null, 'A capture still waiting for its upload cannot be confirmed');
select throws_ok(format($$select public.confirm_capture(%L, %L, tests.recipe('x'))$$, tests.uid('mom'), tests.ref('job_thepla')),
  '22023', null, 'A capture is confirmed only once');
update public.capture_jobs set status = 'failed' where id = tests.ref('job_waiting_2');
select throws_ok(
  format($$select public.confirm_capture(%L, %L, tests.recipe('x', '[{"name": "besan"}]'))$$, tests.uid('mom'), tests.ref('job_waiting_2')),
  '23514', null, 'Every ingredient must keep the speaker''s own words');
select ok((select recipe_version_id is not null from public.media where capture_job_id = tests.ref('job_thepla')),
  'Confirming attaches the original recording to the version');

select throws_ok(format($$select public.publish_correction(%L, %L, tests.recipe('Methi thepla'), 'ajwain not jeera')$$, tests.uid('mom'), tests.ref('recipe_thepla')),
  '42501', null, 'A member cannot correct the original');
select throws_ok(format($$select public.publish_correction(%L, %L, tests.recipe('Methi thepla'), '  ')$$, tests.uid('aunt'), tests.ref('recipe_thepla')),
  '22023', null, 'A correction must say what changed');
insert into tests.ids (name, id)
select 'correction', public.publish_correction(tests.uid('aunt'), tests.ref('recipe_thepla'), tests.recipe('Methi na thepla (corrected)'), 'AI heard jeera; Ba said ajwain');
select is((select current_version_id from public.recipes where id = tests.ref('recipe_thepla')), tests.ref('correction'),
  'The correction becomes the current version');
select isnt((select root_version_id from public.recipes where id = tests.ref('recipe_thepla')), tests.ref('correction'),
  'The original stays the root');

reset role;
select throws_ok(format($$update public.recipe_versions set title = 'Edited' where id = %L$$, tests.ref('correction')),
  '23514', null, 'Confirmed versions never change, even for the server');
select throws_ok(format($$delete from public.recipe_versions where recipe_id = %L$$, tests.ref('recipe_thepla')),
  '23514', null, 'Confirmed versions cannot be deleted on their own');

-- Clients: server-only functions and no direct writes --------------------------------------
select tests.authenticate_as('dhruv');
select throws_ok($$select * from public.begin_capture('voice', 'audio/webm', 1000, 'v1', p_contributor_token => 'x')$$,
  '42501', null, 'Clients cannot call begin_capture');
select throws_ok(format($$select public.confirm_capture(%L, %L, '{}')$$, tests.uid('dhruv'), tests.ref('job_waiting')),
  '42501', null, 'Clients cannot call confirm_capture');
select throws_ok($$select * from public.contributor_link_info('ba-recording-link-token-000001')$$,
  '42501', null, 'Clients cannot call contributor_link_info');
select throws_ok(format($$insert into public.recipes (family_id, title) values (%L, 'Sneaky')$$, tests.family('shah')),
  '42501', null, 'Clients cannot create recipes directly');
select throws_ok(format($$update public.capture_jobs set status = 'confirmed' where id = %L$$, tests.ref('job_waiting')),
  '42501', null, 'Clients cannot change capture jobs');
select throws_ok(format($$insert into public.media (family_id, kind, storage_bucket, storage_path, mime_type) values (%L, 'original_audio', 'vault-audio', %L, 'audio/webm')$$,
    tests.family('shah'), tests.family('shah') || '/capture/x/y.webm'),
  '42501', null, 'Clients cannot register media directly');
select throws_ok('select token_hash from public.contributor_links', '42501', null, 'Nobody can read link token hashes');

-- Reads ------------------------------------------------------------------------------------
select is((select count(*)::int from public.recipe_versions where recipe_id = tests.ref('recipe_thepla')), 2,
  'Version history (original and correction) is readable');
select isnt_empty(format('select 1 from public.recipes where id = %L', tests.ref('recipe_private')),
  'The creator sees their private recipe');

select tests.authenticate_as('mom');
select is_empty(format('select 1 from public.recipes where id = %L', tests.ref('recipe_private')),
  'Other members do not see a private recipe');
select is_empty(format('select 1 from public.recipe_versions where recipe_id = %L', tests.ref('recipe_private')),
  '... or its versions');
select isnt_empty('select 1 from public.contributor_links', 'Members can see recording links');

select tests.authenticate_as('cousin');
select isnt_empty(format('select 1 from public.recipes where id = %L', tests.ref('recipe_thepla')),
  'A viewer can read family recipes');
select is_empty('select 1 from public.capture_jobs', 'A viewer cannot see unreviewed captures');
select isnt_empty(format('select 1 from public.media where capture_job_id = %L', tests.ref('job_thepla')),
  'A viewer can see the media of a confirmed recipe');
select is_empty(format('select 1 from public.media where capture_job_id = %L', tests.ref('job_waiting')),
  'A viewer cannot see media still in capture');
select is_empty('select 1 from public.contributor_links', 'A viewer cannot see recording links');

select tests.authenticate_as('raj');
select results_eq(
  format($$select
    (select count(*)::int from public.recipes where family_id = %1$L)
    + (select count(*)::int from public.recipe_versions where family_id = %1$L)
    + (select count(*)::int from public.capture_jobs where family_id = %1$L)
    + (select count(*)::int from public.media where family_id = %1$L)
    + (select count(*)::int from public.consents where family_id = %1$L)
    + (select count(*)::int from public.contributor_links where family_id = %1$L)$$, tests.family('shah')),
  array[0], 'Another family sees none of the Shah recipes, versions, captures, media, consents or links');

-- Storage: vault-audio / vault-scans ---------------------------------------------------------
select tests.as_superuser();
insert into storage.objects (bucket_id, name) values ('vault-audio', tests.path('job_thepla'));

select tests.authenticate_as('cousin');
select isnt_empty(format($$select 1 from storage.objects where name = %L$$, tests.path('job_thepla')),
  'A viewer can play the original recording of a confirmed recipe');
select tests.authenticate_as('raj');
select is_empty(format($$select 1 from storage.objects where name = %L$$, tests.path('job_thepla')),
  'Another family cannot reach the recording');

select tests.authenticate_as('mom');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('vault-audio', %L)$$, tests.path('job_waiting')),
  'A member uploads to the path registered for her capture');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('vault-audio', %L)$$, tests.family('shah') || '/capture/unregistered/file.webm'),
  '42501', null, 'Uploads to unregistered paths are refused');
select is(tests.affected(format($$delete from storage.objects where name = %L$$, tests.path('job_waiting'))),
  0, 'Nobody can delete a raw recording from the client');

select tests.authenticate_as('dhruv');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('vault-audio', %L)$$, tests.path('job_waiting_2')),
  '42501', null, 'Even the owner cannot upload into someone else''s registered path');

select * from finish();
rollback;
