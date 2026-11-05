-- Phase 2, M3: handwriting captures with more than one page, and the readable copy of each page.
--
-- begin_capture() registers one file. A handwritten recipe can run over a few pages, and the page
-- reader (Claude) takes only JPEG, PNG or WebP, at most 5 MB each, while a phone photo is often
-- bigger and may be HEIC. ADR 0009 says the original is kept untouched and a derived, downscaled
-- copy is what gets read. This migration adds:
--
--   * add_capture_media(): registers another page, or the derived copy of a page, on a capture
--     that is still waiting for its files. The organiser's browser makes the copy, then uploads
--     both files to the registered paths by signed URL, as for any other file (ADR 0012).
--   * confirm_upload(), tightened: every registered file of the capture must be in storage at its
--     registered size, and a handwriting page the reader cannot take as it is must have its copy.
--     Before this, only the first file was checked, and an unreadable page failed later, quietly,
--     as "enter it by hand".
--
-- RLS impact: no table, policy or client grant changes. The new function is service-role only and
-- re-checks its actor like the others in ADR 0010. The organiser who started the capture is the
-- only one who can add to it, and only while it is awaiting its upload.

create function public.add_capture_media(
  p_actor uuid,
  p_job_id uuid,
  p_mime_type text,
  p_byte_size bigint,
  p_derived_from_media_id uuid default null,
  p_width integer default null,
  p_height integer default null
) returns table (media_id uuid, storage_bucket text, storage_path text)
language plpgsql security definer set search_path = '' as $$
declare
  v_mime text := lower(btrim(split_part(p_mime_type, ';', 1)));
  v_job public.capture_jobs;
  v_original public.media;
  v_kind public.media_kind;
  v_extension text;
  v_media_id uuid := gen_random_uuid();
  v_path text;
begin
  select * into v_job from public.capture_jobs cj where cj.id = p_job_id for update;
  if v_job.id is null or v_job.created_by is distinct from p_actor
    or not private.actor_can(p_actor, v_job.family_id, '{owner,admin,member}')
  then
    raise exception 'Capture not found or not yours to add to' using errcode = '42501';
  end if;
  if v_job.status <> 'awaiting_upload' then
    raise exception 'This capture can no longer take files (status %)', v_job.status using errcode = '22023';
  end if;
  -- A recording is one file. Only handwritten pages come in several parts.
  if v_job.source_type <> 'handwriting' then
    raise exception 'Only a handwriting capture takes more than one file' using errcode = '22023';
  end if;
  if v_mime not like 'image/%' then
    raise exception 'A page must be an image' using errcode = '22023';
  end if;
  v_extension := private.extension_for(v_mime);
  if v_extension is null then
    raise exception 'Unsupported file type %', v_mime using errcode = '22023';
  end if;
  if p_width is not null and p_width <= 0 or p_height is not null and p_height <= 0 then
    raise exception 'Image size is not valid' using errcode = '22023';
  end if;

  if p_derived_from_media_id is not null then
    -- The copy the reader takes: JPEG, PNG or WebP, within the reader's per-image limit.
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp')
      or p_byte_size is null or p_byte_size <= 0 or p_byte_size > 5242880
    then
      raise exception 'The readable copy must be a JPEG, PNG or WebP of at most 5 MB' using errcode = '22023';
    end if;
    select * into v_original from public.media m
    where m.id = p_derived_from_media_id and m.capture_job_id = v_job.id
      and m.kind = 'handwriting_scan' and m.derived_from_media_id is null and m.removed_at is null;
    if v_original.id is null then
      raise exception 'That page is not part of this capture' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.media d where d.derived_from_media_id = v_original.id and d.removed_at is null
    ) then
      raise exception 'That page already has its readable copy' using errcode = '22023';
    end if;
    v_kind := 'derived_scan';
  else
    if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 20971520 then
      raise exception 'File is empty or too large' using errcode = '22023';
    end if;
    if (
      select count(*) from public.media m
      where m.capture_job_id = v_job.id and m.derived_from_media_id is null and m.removed_at is null
    ) >= 4 then
      raise exception 'A capture holds at most 4 pages' using errcode = '22023';
    end if;
    v_kind := 'handwriting_scan';
  end if;

  v_path := v_job.family_id || '/capture/' || v_job.id || '/' || v_media_id || '.' || v_extension;
  insert into public.media (
    id, family_id, kind, capture_job_id, derived_from_media_id, storage_bucket, storage_path,
    mime_type, byte_size, width, height, uploaded_by
  ) values (
    v_media_id, v_job.family_id, v_kind, v_job.id, p_derived_from_media_id, 'vault-scans', v_path,
    v_mime, p_byte_size, p_width, p_height, p_actor
  );

  return query select v_media_id, 'vault-scans'::text, v_path;
end;
$$;

revoke all on function public.add_capture_media(uuid, uuid, text, bigint, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.add_capture_media(uuid, uuid, text, bigint, uuid, integer, integer) to service_role;

-- confirm_upload(), same signature and callers as before (migration confirm_upload), now checking
-- every registered file and that a handwriting page the reader cannot take has its copy.
create or replace function public.confirm_upload(
  p_job_id uuid,
  p_actor uuid default null,
  p_contributor_token text default null
) returns public.capture_status
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.capture_jobs;
  v_link public.contributor_links;
begin
  if num_nonnulls(p_actor, p_contributor_token) <> 1 then
    raise exception 'Pass either an actor or a contributor token' using errcode = '22023';
  end if;

  select * into v_job from public.capture_jobs cj where cj.id = p_job_id for update;

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

  if not exists (
    select 1 from public.media m where m.capture_job_id = v_job.id and m.removed_at is null
  ) or exists (
    select 1 from public.media m
    where m.capture_job_id = v_job.id and m.removed_at is null
      and not exists (
        select 1 from storage.objects o
        where o.bucket_id = m.storage_bucket and o.name = m.storage_path
          and (o.metadata ->> 'size')::bigint = m.byte_size
      )
  ) then
    raise exception 'The files have not arrived in full' using errcode = '22023';
  end if;

  if v_job.source_type = 'handwriting' and exists (
    select 1 from public.media p
    where p.capture_job_id = v_job.id and p.derived_from_media_id is null and p.removed_at is null
      and (p.byte_size > 5242880 or p.mime_type not in ('image/jpeg', 'image/png', 'image/webp'))
      and not exists (
        select 1 from public.media d where d.derived_from_media_id = p.id and d.removed_at is null
      )
  ) then
    raise exception 'A page the reader cannot take as it is has no readable copy' using errcode = '22023';
  end if;

  update public.capture_jobs set status = 'uploaded' where id = v_job.id;
  return 'uploaded'::public.capture_status;
end;
$$;
