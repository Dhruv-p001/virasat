# 0010. Capture and recipe data model

Status: Accepted · 2026-11-04

## Context

Phase 2 turns an elder's recording or handwritten page into a reviewed recipe. Brief rules that shape this phase:

- The AI never publishes on its own.
- Raw media is never overwritten.
- Every ingredient keeps the speaker's words.
- Contributor links can upload but never read the vault.

ADR 0005 adds two more: the original changes only through a correction chain, and withdrawing consent hard-deletes the audio but keeps the text.

## Decision

**Clients only read.**

- `recipes`, `recipe_versions`, `capture_jobs`, `media`, `consents` and `contributor_links` have SELECT policies and no client write grants.
- Every write is a SQL function executable only by the service role. The Next.js route verifies the session and passes the actor, and each function re-checks the actor's role itself.
- This means a recipe can only exist through `confirm_capture()`, after human review.

**The flow:**

1. `begin_capture(source, mime, size, consent_wording_version, actor+person | contributor_token)` does four things:
   - validates the type and size (audio up to 50 MB, scans up to 20 MB)
   - records consent
   - creates a `capture_jobs` row (`awaiting_upload`)
   - registers one `media` row at `{family_id}/capture/{job_id}/{media_id}.{ext}`
2. The file is uploaded to exactly that path:
   - A signed-in organiser uploads directly, which allows resumable TUS uploads. The storage INSERT policy allows only that user's registered path, once, within a day.
   - An elder's upload goes through a server-issued signed upload URL.
3. The pipeline (service role) moves the job through `uploaded → transcribing → structuring → ready_for_review`, or `failed`.
4. `confirm_capture(actor, job, content)` creates the recipe and its confirmed original version, and attaches the media. A `failed` job can still be confirmed with hand-typed content.
5. `publish_correction(actor, recipe, content, note)` is for owners and admins. It makes the correction the current version; the root stays the original.

**Integrity in the database, not just the app:**

- **Ingredients:** every element must be an object with a non-empty `original_text`, so Ba's words can't be dropped.
- **Steps:** every element must have non-empty `text`.
- **Tips and `uncertain_fields`:** both must be string arrays.
- **Frozen versions:** a trigger blocks every update and delete of confirmed versions, even by the service role. The only exception is deleting the whole recipe.
- **Media paths:** each must start with its `family_id`, and its kind must match its bucket.

**Storage:**

- `vault-audio` and `vault-scans` are private.
- A file is readable exactly when its `media` row is readable: the storage policy queries `public.media` under the caller's RLS.
- No client can overwrite or delete raw media.

**Consent:**

- Recorded once per person, kind, wording version and source.
- Consent the elder gives on their own recording link is kept separately from the organiser's, because it is the stronger proof.
- Voice captures record `voice_recording` and `third_party_processing`. Handwriting records `third_party_processing` only.

**Contributor links:**

- The token is stored only as a hash.
- Limits: 1 to 50 uploads, and at most 90 days (30 by default).
- `contributor_link_info()` returns only the elder's name, relation, photo path and uploads left.

## Not decided here

- **Resumable uploads for elders.** Signed upload URLs are single-request, not TUS. Whether slow-3G elder uploads need chunking or a short-lived scoped token is for the capture-screens work to decide.
- **Erasure.** The function that deletes storage objects and sets `media.removed_at` on consent withdrawal is part of the privacy work. The schema already supports it.
- **Drafts.** `recipe_versions.status = 'draft'` is reserved; Phase 2 keeps the in-review recipe in `capture_jobs.ai_output`.

## Consequences

The capture screens and pipeline call a small, tested set of functions instead of writing tables. The rules hold even if application code has a bug: 49 pgTAP tests cover them, allowed and refused.
