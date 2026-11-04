-- Phase 2, M2: the pipeline's only way to move a capture job along.
--
-- The Inngest functions (service role) transcribe and structure a recording, then report each
-- step here. Nothing else writes to capture_jobs once a capture has begun: this function owns the
-- state machine, so a retried or duplicated pipeline step can never skip a stage, rewind a job,
-- or touch a capture that a person has already confirmed.
--
--   uploaded ──► transcribing ──► structuring ──► ready_for_review
--        │              │              │
--        └──────────────┴──────────────┴──────► failed
--
-- A handwriting capture has no transcription stage: uploaded goes straight to structuring.
-- ready_for_review and failed are final for the pipeline. A person takes it from there
-- (confirm_capture accepts both).
--
-- RLS impact: no table, policy or client grant changes. One new service-role-only function. It has
-- no actor to re-check, because the pipeline is not a person: instead it refuses every move the
-- machine above does not allow. Clients keep read-only access to capture_jobs.

create function public.advance_capture(
  p_job_id uuid,
  p_to public.capture_status,
  p_transcript text default null,
  p_detected_language text default null,
  p_ai_output jsonb default null,
  p_error text default null,
  p_provider_meta jsonb default null
) returns public.capture_status
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.capture_jobs;
begin
  select * into v_job from public.capture_jobs where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Capture not found' using errcode = 'P0002';
  end if;

  -- A step that already happened (a retried event, a duplicate delivery) changes nothing.
  if v_job.status = p_to then
    return v_job.status;
  end if;

  if not (
    (v_job.status = 'uploaded' and p_to in ('transcribing', 'structuring', 'failed'))
    or (v_job.status = 'transcribing' and p_to in ('structuring', 'failed'))
    or (v_job.status = 'structuring' and p_to in ('ready_for_review', 'failed'))
  ) then
    raise exception 'A capture in status % cannot move to %', v_job.status, p_to using errcode = '22023';
  end if;

  -- Handwriting never passes through transcribing; voice never skips it.
  if v_job.source_type = 'handwriting' and p_to = 'transcribing' then
    raise exception 'A handwriting capture has no transcription step' using errcode = '22023';
  end if;
  if v_job.source_type = 'voice' and v_job.status = 'uploaded' and p_to = 'structuring' then
    raise exception 'A voice capture must be transcribed first' using errcode = '22023';
  end if;

  if p_to = 'ready_for_review' and jsonb_typeof(p_ai_output) is distinct from 'object' then
    raise exception 'A capture ready for review needs the AI output' using errcode = '22023';
  end if;
  if p_to = 'failed' and char_length(btrim(coalesce(p_error, ''))) = 0 then
    raise exception 'A failed capture needs a reason' using errcode = '22023';
  end if;
  -- The reason is a short code, never recipe content (brief section 9).
  if char_length(p_error) > 200 then
    raise exception 'The failure reason is too long' using errcode = '22023';
  end if;
  if p_provider_meta is not null and jsonb_typeof(p_provider_meta) <> 'object' then
    raise exception 'Provider details must be an object' using errcode = '22023';
  end if;

  update public.capture_jobs set
    status = p_to,
    transcript = coalesce(p_transcript, transcript),
    detected_language = coalesce(p_detected_language, detected_language),
    ai_output = coalesce(p_ai_output, ai_output),
    error = case when p_to = 'failed' then p_error else error end,
    provider_meta = coalesce(provider_meta, '{}'::jsonb) || coalesce(p_provider_meta, '{}'::jsonb)
  where id = v_job.id;
  return p_to;
end;
$$;

revoke all on function public.advance_capture(uuid, public.capture_status, text, text, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.advance_capture(uuid, public.capture_status, text, text, jsonb, text, jsonb)
  to service_role;
