-- Phase 2, M1: the step between "the browser uploaded the file" and "the pipeline may start".
--
-- begin_capture() leaves a job in awaiting_upload. Nothing marked it uploaded, and the server
-- must not simply trust the browser's word. confirm_upload() checks that the registered file
-- really is in storage at the size that was registered, then moves the job to uploaded.
--
-- RLS impact: no table, policy or client grant changes. One new service-role-only function that
-- re-checks its actor (organiser) or its token (elder's recording link) itself, like the others
-- in ADR 0010.

create function public.confirm_upload(
  p_job_id uuid,
  p_actor uuid default null,
  p_contributor_token text default null
) returns public.capture_status
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.capture_jobs;
  v_media public.media;
  v_link public.contributor_links;
  v_size bigint;
begin
  if num_nonnulls(p_actor, p_contributor_token) <> 1 then
    raise exception 'Pass either an actor or a contributor token' using errcode = '22023';
  end if;

  select * into v_job from public.capture_jobs where id = p_job_id for update;

  if p_contributor_token is not null then
    -- The token must be the very link this capture came in through, and not revoked.
    -- Not checked for uploads left: the last allowed upload is this one.
    select * into v_link from public.contributor_links
    where token_hash = encode(extensions.digest(p_contributor_token, 'sha256'), 'hex');
    if v_job.id is null or v_link.id is null or v_job.contributor_link_id is distinct from v_link.id
      or v_link.revoked_at is not null
    then
      raise exception 'Capture not found or not yours to confirm' using errcode = '42501';
    end if;
  elsif v_job.id is null or v_job.created_by is distinct from p_actor
    or not private.actor_can(p_actor, v_job.family_id, '{owner,admin,member}')
  then
    raise exception 'Capture not found or not yours to confirm' using errcode = '42501';
  end if;

  -- Retrying a confirmation that already went through is harmless.
  if v_job.status in ('uploaded', 'transcribing', 'structuring', 'ready_for_review') then
    return v_job.status;
  end if;
  if v_job.status <> 'awaiting_upload' then
    raise exception 'This capture can no longer take an upload (status %)', v_job.status using errcode = '22023';
  end if;

  select * into v_media from public.media
  where capture_job_id = v_job.id and derived_from_media_id is null and removed_at is null
  order by created_at limit 1;
  select (o.metadata ->> 'size')::bigint into v_size from storage.objects o
  where o.bucket_id = v_media.storage_bucket and o.name = v_media.storage_path;
  if v_size is null or v_size <> v_media.byte_size then
    raise exception 'The file has not arrived in full' using errcode = '22023';
  end if;

  update public.capture_jobs set status = 'uploaded' where id = v_job.id;
  return 'uploaded';
end;
$$;

revoke all on function public.confirm_upload(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_upload(uuid, uuid, text) to service_role;
