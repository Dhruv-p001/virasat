-- Phase 2 M1: confirm_upload() moves a capture to "uploaded" only for the right caller, only
-- once the registered file has arrived in full.
begin;
select plan(14);
select tests.seed_two_families();

create table tests.ids (name text primary key, id uuid, path text);
grant select on tests.ids to anon, authenticated, service_role;
grant insert on tests.ids to service_role;
create function tests.ref(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
grant execute on function tests.ref(text) to anon, authenticated, service_role;

set local role service_role;
select public.create_contributor_link(tests.uid('dhruv'), tests.person('ba'), 'link-a-token-000000000000001', 5::smallint);
select public.create_contributor_link(tests.uid('dhruv'), tests.person('ba'), 'link-b-token-000000000000002', 5::smallint);
insert into tests.ids (name, id, path)
select 'elder_job', job_id, storage_path from public.begin_capture('voice', 'audio/webm', 5000, 'v1', p_contributor_token => 'link-a-token-000000000000001');
insert into tests.ids (name, id, path)
select 'organiser_job', job_id, storage_path from public.begin_capture('voice', 'audio/webm', 7000, 'v1', tests.uid('mom'), tests.person('ba'));

-- The file has not arrived -------------------------------------------------------------------
select throws_ok(
  $$select public.confirm_upload(tests.ref('elder_job'), p_contributor_token => 'link-a-token-000000000000001')$$,
  '22023', null, 'A capture cannot be confirmed before its file is in storage');

reset role;
insert into storage.objects (bucket_id, name, metadata)
select 'vault-audio', path, '{"size": 4999}'::jsonb from tests.ids where name = 'elder_job';
set local role service_role;
select throws_ok(
  $$select public.confirm_upload(tests.ref('elder_job'), p_contributor_token => 'link-a-token-000000000000001')$$,
  '22023', null, 'A partial file of the wrong size is refused');

reset role;
update storage.objects set metadata = '{"size": 5000}'::jsonb where name = (select path from tests.ids where name = 'elder_job');
insert into storage.objects (bucket_id, name, metadata)
select 'vault-audio', path, '{"size": 7000}'::jsonb from tests.ids where name = 'organiser_job';
set local role service_role;

-- Wrong callers ------------------------------------------------------------------------------
select throws_ok(
  $$select public.confirm_upload(tests.ref('elder_job'), p_contributor_token => 'link-b-token-000000000000002')$$,
  '42501', null, 'Another recording link cannot confirm this elder capture');
select throws_ok(
  $$select public.confirm_upload(tests.ref('elder_job'), p_contributor_token => 'not-a-real-link-token-000000')$$,
  '42501', null, 'An unknown token cannot confirm a capture');
select throws_ok(
  format($$select public.confirm_upload(%L, %L)$$, tests.ref('organiser_job'), tests.uid('raj')),
  '42501', null, 'Another family cannot confirm a capture');
select throws_ok(
  format($$select public.confirm_upload(%L, %L)$$, tests.ref('organiser_job'), tests.uid('cousin')),
  '42501', null, 'A viewer cannot confirm a capture');
select throws_ok(
  format($$select public.confirm_upload(%L, %L, 'link-a-token-000000000000001')$$, tests.ref('elder_job'), tests.uid('mom')),
  '22023', null, 'Exactly one of actor and token is required');

-- Allowed ------------------------------------------------------------------------------------
select is(public.confirm_upload(tests.ref('elder_job'), p_contributor_token => 'link-a-token-000000000000001'),
  'uploaded'::public.capture_status, 'The elder own link confirms a complete upload');
select is(public.confirm_upload(tests.ref('elder_job'), p_contributor_token => 'link-a-token-000000000000001'),
  'uploaded'::public.capture_status, 'Confirming again is harmless');
select is(public.confirm_upload(tests.ref('organiser_job'), tests.uid('mom')),
  'uploaded'::public.capture_status, 'The organiser who started a capture confirms it');

-- A revoked link stops mid-flight uploads ----------------------------------------------------
insert into tests.ids (name, id)
select 'revoked_job', job_id from public.begin_capture('voice', 'audio/webm', 100, 'v1', p_contributor_token => 'link-b-token-000000000000002');
select public.revoke_contributor_link(tests.uid('dhruv'), (select id from public.contributor_links where upload_count = 1 and revoked_at is null and token_hash = encode(extensions.digest('link-b-token-000000000000002', 'sha256'), 'hex')));
select throws_ok(
  $$select public.confirm_upload(tests.ref('revoked_job'), p_contributor_token => 'link-b-token-000000000000002')$$,
  '42501', null, 'A revoked link cannot confirm');

update public.capture_jobs set status = 'confirmed' where id = tests.ref('elder_job');
select throws_ok(
  $$select public.confirm_upload(tests.ref('elder_job'), p_contributor_token => 'link-a-token-000000000000001')$$,
  '22023', null, 'A capture already confirmed as a recipe takes no more uploads');

-- Clients ------------------------------------------------------------------------------------
reset role;
select tests.authenticate_as('mom');
select throws_ok(format($$select public.confirm_upload(%L, %L)$$, tests.ref('organiser_job'), tests.uid('mom')),
  '42501', null, 'Signed-in clients cannot call confirm_upload');
select tests.as_anon();
select throws_ok($$select public.confirm_upload(tests.ref('organiser_job'), p_contributor_token => 'x')$$,
  '42501', null, 'Anonymous visitors cannot call confirm_upload');

select * from finish();
rollback;
