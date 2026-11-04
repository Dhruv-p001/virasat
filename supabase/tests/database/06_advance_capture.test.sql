-- Phase 2 M2: advance_capture() is the pipeline's only door into capture_jobs, and it only opens
-- along the state machine.
begin;
select plan(20);
select tests.seed_two_families();

create table tests.ids (name text primary key, id uuid);
grant select on tests.ids to anon, authenticated, service_role;
grant insert on tests.ids to service_role;
create function tests.ref(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
grant execute on function tests.ref(text) to anon, authenticated, service_role;

set local role service_role;
insert into tests.ids (name, id)
select 'voice', job_id from public.begin_capture('voice', 'audio/webm', 5000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'scan', job_id from public.begin_capture('handwriting', 'image/jpeg', 5000, 'v1', tests.uid('mom'), tests.person('ba'));
insert into tests.ids (name, id)
select 'other', job_id from public.begin_capture('voice', 'audio/webm', 5000, 'v1', tests.uid('mom'), tests.person('ba'));
reset role;
update public.capture_jobs set status = 'uploaded' where id in (tests.ref('voice'), tests.ref('scan'), tests.ref('other'));
set local role service_role;

-- Refused moves ------------------------------------------------------------------------------
select throws_ok($$select public.advance_capture(tests.ref('voice'), 'ready_for_review', p_ai_output => '{}')$$,
  '22023', null, 'A capture cannot skip from uploaded to ready_for_review');
select throws_ok($$select public.advance_capture(tests.ref('voice'), 'structuring')$$,
  '22023', null, 'A voice capture cannot skip transcription');
select throws_ok($$select public.advance_capture(tests.ref('scan'), 'transcribing')$$,
  '22023', null, 'A handwriting capture has no transcription step');
select throws_ok($$select public.advance_capture(tests.ref('voice'), 'failed')$$,
  '22023', null, 'A failure needs a reason');
select throws_ok(format($$select public.advance_capture(%L, 'failed', p_error => repeat('x', 201))$$, tests.ref('voice')),
  '22023', null, 'The failure reason must stay short: it is a code, not content');
select throws_ok($$select public.advance_capture('00000000-0000-4000-8000-0000000000ff', 'transcribing')$$,
  'P0002', null, 'An unknown capture is refused');

-- The voice path -----------------------------------------------------------------------------
select is(public.advance_capture(tests.ref('voice'), 'transcribing', p_provider_meta => '{"stt": "mock"}'),
  'transcribing'::public.capture_status, 'uploaded moves to transcribing');
select is(public.advance_capture(tests.ref('voice'), 'transcribing'),
  'transcribing'::public.capture_status, 'Repeating a step changes nothing');
select is(public.advance_capture(tests.ref('voice'), 'structuring', p_transcript => 'ek mutthi besan', p_detected_language => 'gu',
    p_provider_meta => '{"structurer": "mock"}'),
  'structuring'::public.capture_status, 'transcribing moves to structuring and stores the transcript');
select is((select transcript || '/' || detected_language from public.capture_jobs where id = tests.ref('voice')),
  'ek mutthi besan/gu', 'The transcript and language were saved');
select throws_ok($$select public.advance_capture(tests.ref('voice'), 'ready_for_review')$$,
  '22023', null, 'Ready for review needs the AI output');
select is(public.advance_capture(tests.ref('voice'), 'ready_for_review', p_ai_output => '{"title": "Besan"}'),
  'ready_for_review'::public.capture_status, 'structuring moves to ready_for_review');
select is((select provider_meta from public.capture_jobs where id = tests.ref('voice')),
  '{"stt": "mock", "structurer": "mock"}'::jsonb, 'Provider details from every step are kept');
select throws_ok($$select public.advance_capture(tests.ref('voice'), 'transcribing')$$,
  '22023', null, 'A job ready for review cannot be rewound');

-- The handwriting path and failure -----------------------------------------------------------
select is(public.advance_capture(tests.ref('scan'), 'structuring'),
  'structuring'::public.capture_status, 'A handwriting capture goes straight to structuring');
select is(public.advance_capture(tests.ref('other'), 'failed', p_error => 'provider_error', p_transcript => 'half a transcript'),
  'failed'::public.capture_status, 'Any stage can fail, keeping the transcript so far');
select is((select error || '/' || transcript from public.capture_jobs where id = tests.ref('other')),
  'provider_error/half a transcript', 'The reason and transcript were saved');

-- A person already confirmed it: the pipeline cannot touch it ---------------------------------
reset role;
update public.capture_jobs set status = 'confirmed' where id = tests.ref('scan');
set local role service_role;
select throws_ok($$select public.advance_capture(tests.ref('scan'), 'failed', p_error => 'late')$$,
  '22023', null, 'A confirmed capture cannot be failed by a late pipeline step');

-- Clients ------------------------------------------------------------------------------------
reset role;
select tests.authenticate_as('mom');
select throws_ok($$select public.advance_capture(tests.ref('other'), 'structuring')$$,
  '42501', null, 'Signed-in clients cannot call advance_capture, even for their own capture');
select tests.as_anon();
select throws_ok($$select public.advance_capture(tests.ref('other'), 'structuring')$$,
  '42501', null, 'Anonymous visitors cannot call advance_capture');

select * from finish();
rollback;
