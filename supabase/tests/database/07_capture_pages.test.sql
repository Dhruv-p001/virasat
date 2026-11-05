-- Phase 2 M3: add_capture_media() registers more pages and the readable copy of a page, only for
-- the organiser who started the capture. confirm_upload() then checks every registered file, and
-- that a page the reader cannot take as it is has its copy.
begin;
select plan(29);
select tests.seed_two_families();

create table tests.ids (name text primary key, id uuid, path text);
grant select on tests.ids to anon, authenticated, service_role;
grant insert on tests.ids to service_role;
create function tests.ref(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
grant execute on function tests.ref(text) to anon, authenticated, service_role;

-- Puts every registered file of a capture into storage at its registered size, as a finished upload would.
create function tests.arrive(p_job text) returns void language sql as $$
  insert into storage.objects (bucket_id, name, metadata)
  select m.storage_bucket, m.storage_path, jsonb_build_object('size', m.byte_size)
  from public.media m
  where m.capture_job_id = tests.ref(p_job)
    and not exists (select 1 from storage.objects o where o.bucket_id = m.storage_bucket and o.name = m.storage_path);
$$;

set local role service_role;

-- Captures: a three-page diary job, an oversized page, a HEIC page, a full job, a recording ----
insert into tests.ids (name, id)
select 'h', job_id from public.begin_capture('handwriting', 'image/jpeg', 8000000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'k', job_id from public.begin_capture('handwriting', 'image/jpeg', 8000000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'm', job_id from public.begin_capture('handwriting', 'image/heic', 3000000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'l', job_id from public.begin_capture('handwriting', 'image/jpeg', 1000000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'n', job_id from public.begin_capture('handwriting', 'image/jpeg', 1000000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'v', job_id from public.begin_capture('voice', 'audio/webm', 5000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'h_page1', id from public.media where capture_job_id = tests.ref('h');
insert into tests.ids (name, id)
select 'k_page1', id from public.media where capture_job_id = tests.ref('k');
insert into tests.ids (name, id)
select 'm_page1', id from public.media where capture_job_id = tests.ref('m');

-- A second page, then the readable copy of the first -----------------------------------------
insert into tests.ids (name, id, path)
select 'h_page2', media_id, storage_path
from public.add_capture_media(tests.uid('mom'), tests.ref('h'), 'image/jpeg', 1000000);
select is((select count(*)::int from public.media where capture_job_id = tests.ref('h')), 2,
  'The organiser who started a capture adds a second page');
select ok((select m.storage_path like (select family_id from public.capture_jobs where id = tests.ref('h')) || '/capture/' || tests.ref('h') || '/%'
  and m.storage_bucket = 'vault-scans' from public.media m where m.id = tests.ref('h_page2')),
  'The page is registered under the capture''s own folder in the scans bucket');

insert into tests.ids (name, id)
select 'h_copy', media_id from public.add_capture_media(tests.uid('mom'), tests.ref('h'), 'image/jpeg', 900000, tests.ref('h_page1'), 1600, 1200);
select is((select kind::text from public.media where id = tests.ref('h_copy')), 'derived_scan',
  'The readable copy is stored as a derived scan');
select is((select derived_from_media_id from public.media where id = tests.ref('h_copy')), tests.ref('h_page1'),
  'It points back at the original page, which is not touched');

-- Refused: copies ----------------------------------------------------------------------------
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 800000, %L)$$, tests.uid('mom'), tests.ref('h'), tests.ref('h_page1')),
  '22023', null, 'A page has only one readable copy');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 6000000, %L)$$, tests.uid('mom'), tests.ref('h'), tests.ref('h_page2')),
  '22023', null, 'A readable copy over the reader''s 5 MB limit is refused');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/heic', 800000, %L)$$, tests.uid('mom'), tests.ref('h'), tests.ref('h_page2')),
  '22023', null, 'A readable copy in a format the reader cannot take is refused');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 800000, %L)$$, tests.uid('mom'), tests.ref('h'), tests.ref('k_page1')),
  '22023', null, 'A copy cannot be made of a page from another capture');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 800000, %L)$$, tests.uid('mom'), tests.ref('h'), tests.ref('h_copy')),
  '22023', null, 'A copy of a copy is refused');

-- Refused: pages -----------------------------------------------------------------------------
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'audio/webm', 1000)$$, tests.uid('mom'), tests.ref('h')),
  '22023', null, 'A page must be an image');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 20971521)$$, tests.uid('mom'), tests.ref('h')),
  '22023', null, 'A page over 20 MB is refused');

-- Refused: callers ---------------------------------------------------------------------------
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('raj'), tests.ref('h')),
  '42501', null, 'Another family cannot add to a capture');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('cousin'), tests.ref('h')),
  '42501', null, 'A viewer cannot add to a capture');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('dhruv'), tests.ref('h')),
  '42501', null, 'Not even another writer in the family can add to a capture they did not start');
select throws_ok(
  format($$select public.add_capture_media(%L, gen_random_uuid(), 'image/jpeg', 1000)$$, tests.uid('mom')),
  '42501', null, 'An unknown capture is not found');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('mom'), tests.ref('v')),
  '22023', null, 'A recording is one file: pages are for handwriting only');

-- At most four pages -------------------------------------------------------------------------
select public.add_capture_media(tests.uid('mom'), tests.ref('l'), 'image/jpeg', 1000);
select public.add_capture_media(tests.uid('mom'), tests.ref('l'), 'image/jpeg', 1000);
select public.add_capture_media(tests.uid('mom'), tests.ref('l'), 'image/jpeg', 1000);
select is((select count(*)::int from public.media where capture_job_id = tests.ref('l')), 4,
  'Four pages fit in one capture');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('mom'), tests.ref('l')),
  '22023', null, 'A fifth page is refused');

-- confirm_upload checks every registered file ------------------------------------------------
select throws_ok(
  format($$select public.confirm_upload(%L, %L)$$, tests.ref('h'), tests.uid('mom')),
  '22023', null, 'Nothing is confirmed while the files are not in storage');

reset role;
select tests.arrive('h');
set local role service_role;
select is(public.confirm_upload(tests.ref('h'), tests.uid('mom')), 'uploaded'::public.capture_status,
  'Two pages and the copy of the big one, all in storage, are confirmed');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('mom'), tests.ref('h')),
  '22023', null, 'A confirmed capture takes no more files');

-- A big page needs its copy -------------------------------------------------------------------
reset role;
select tests.arrive('k');
set local role service_role;
select throws_ok(
  format($$select public.confirm_upload(%L, %L)$$, tests.ref('k'), tests.uid('mom')),
  '22023', null, 'A page over the reader''s limit is not confirmed without its copy');
select public.add_capture_media(tests.uid('mom'), tests.ref('k'), 'image/jpeg', 700000, tests.ref('k_page1'));
reset role;
select tests.arrive('k');
set local role service_role;
select is(public.confirm_upload(tests.ref('k'), tests.uid('mom')), 'uploaded'::public.capture_status,
  'With its copy in storage, the same capture is confirmed');

reset role;
select tests.arrive('m');
set local role service_role;
select throws_ok(
  format($$select public.confirm_upload(%L, %L)$$, tests.ref('m'), tests.uid('mom')),
  '22023', null, 'A HEIC page is not confirmed without a readable copy');
select public.add_capture_media(tests.uid('mom'), tests.ref('m'), 'image/jpeg', 500000, tests.ref('m_page1'));
reset role;
select tests.arrive('m');
set local role service_role;
select is(public.confirm_upload(tests.ref('m'), tests.uid('mom')), 'uploaded'::public.capture_status,
  'With a JPEG copy of it, the HEIC page is confirmed');

-- Every registered file must have arrived, not only the first --------------------------------
reset role;
select tests.arrive('n');
set local role service_role;
select public.add_capture_media(tests.uid('mom'), tests.ref('n'), 'image/jpeg', 500000);
select throws_ok(
  format($$select public.confirm_upload(%L, %L)$$, tests.ref('n'), tests.uid('mom')),
  '22023', null, 'A second page that has not arrived keeps the capture from being confirmed');
reset role;
select tests.arrive('n');
set local role service_role;
select is(public.confirm_upload(tests.ref('n'), tests.uid('mom')), 'uploaded'::public.capture_status,
  'Once every page has arrived it is confirmed');

-- Clients ------------------------------------------------------------------------------------
reset role;
select tests.authenticate_as('mom');
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('mom'), tests.ref('l')),
  '42501', null, 'Signed-in clients cannot call add_capture_media');
select tests.as_anon();
select throws_ok(
  format($$select public.add_capture_media(%L, %L, 'image/jpeg', 1000)$$, tests.uid('mom'), tests.ref('l')),
  '42501', null, 'Anonymous visitors cannot call add_capture_media');

select * from finish();
rollback;
