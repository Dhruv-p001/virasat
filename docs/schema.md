# Schema design (v1 + v2)

This is the whole data model, designed now so later phases add tables rather than reshape them (brief section 5, as amended by ADR 0005). Each phase's migration implements its slice. Every table gets RLS, plus pgTAP tests proving both allowed and denied access.

Conventions:

- UUID primary keys.
- `created_at` and `updated_at` on every table.
- `deleted_at` (soft delete) on user content.
- Every content row carries `family_id`, so RLS is one cheap membership check.
- Clients never write `profile_id` links, roles or tokens directly. Those go through SQL functions called by the server with the service role.

## Phase 1: identity and vaults

| Table            | Purpose                    | Key columns                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`       | One per account            | `id` (= auth user), `display_name`, `preferred_language`, `unit_system`, `country_code`, `avatar_path`                                                                                                                                                      |
| `families`       | A vault                    | `name`, `created_by`, `cover_path`, `deleted_at`                                                                                                                                                                                                            |
| `family_members` | Account ↔ vault, with role | PK (`family_id`, `profile_id`), `role` (owner, admin, member, viewer)                                                                                                                                                                                       |
| `people`         | Everyone in the vault      | `display_name`, `relation_label` ("Ba", "Nani", "Oma"), `profile_id` (null for people without an account), `photo_path`, `birth_year`, `notes`, `deleted_at`                                                                                                |
| `invites`        | Joining a vault            | `role` (never owner), `channel` (link, phone, email), `phone` or `email`, `person_id` (links the joiner to an existing person, e.g. "Mom"), `token_hash` (SHA-256; the token itself is never stored), `expires_at` (≤ 30 days), `accepted_at`, `revoked_at` |

Differences from the brief:

- `profiles` has no `phone` column. The phone stays in `auth.users`, so it isn't exposed to every family member.
- Invite tokens are stored only as hashes.

## Phase 2: capture

| Table               | Purpose                                       | Key columns                                                                                                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contributor_links` | Zero-install recording links for elders       | `person_id`, `token_hash`, `expires_at`, `revoked_at`, `max_uploads`, `upload_count`                                                                                                                                                                                                                                    |
| `consents`          | Proof of consent, per person                  | `person_id`, `kind` (voice_recording, third_party_processing), `wording_version`, `given_via` (organiser, contributor_link), `given_by_profile_id` or `contributor_link_id`, `given_at`, `withdrawn_at`                                                                                                                 |
| `capture_jobs`      | One AI pipeline run                           | `created_by` xor `contributor_link_id`, `person_id`, `status` (uploaded → transcribing → structuring → ready_for_review → confirmed / failed), `transcript`, `detected_language`, `ai_output` (jsonb, Zod-validated), `error`, `provider_meta`                                                                          |
| `media`             | Every uploaded file, raw and derived          | `capture_job_id` (set at upload), `recipe_version_id` (set at confirm), `kind` (original_audio, handwriting_scan, dish_photo, family_photo, derived_scan), `derived_from_media_id`, `storage_path`, `duration_ms`, `width`, `height`, `caption`, `uploaded_by` or `contributor_link_id`, `removed_at`, `removed_reason` |
| `recipes`           | A dish's identity across versions and vaults  | `title`, `origin_person_id`, `visibility` (private, family, link, public), `root_version_id`, `current_version_id`, `origin_recipe_id` (set when handed into another vault), `cover_media_id`, `deleted_at`                                                                                                             |
| `recipe_versions`   | Snapshots. Immutable once confirmed (trigger) | `kind` (original, correction, fork), `parent_version_id`, `author_person_id`, `title`, `servings`, `ingredients` (jsonb), `steps` (jsonb), `tips`, `story`, `language`, `source_type`, `status` (draft, confirmed), `change_note`, `created_by`, `confirmed_at`                                                         |

Rules:

- **Media.** Raw media is never overwritten. Derived files (a cropped scan, a transcoded audio file) are new `media` rows with `derived_from_media_id`.
- **Consent withdrawal.** The storage object is deleted. The `media` row stays with `removed_at` set, so the recipe can show "original recording removed".
- **Correction chain.**
  - An owner or admin publishes a `kind = correction` version whose parent is the current original.
  - `recipes.current_version_id` moves to it. Older versions stay readable in history.
  - Forks (`kind = fork`) are personal versions: they never move `current_version_id`, and they belong to their author.

**As built** (migration `capture_and_recipes`, ADR 0010):

- **Status.** `capture_jobs.status` starts at `awaiting_upload`, which comes before `uploaded`.
- **Recipes on `media`.** The table also has `family_id`, `storage_bucket`, `mime_type` and `byte_size`. Recipes and versions carry `family_id` for RLS.
- **Server functions are the only writers.** Each is called with the service role after the session is checked:
  - `begin_capture()` records consent, creates the job and registers the upload path.
  - `confirm_upload()` (ADR 0012) moves a job from `awaiting_upload` to `uploaded` once the registered file is in storage at the registered size. It is called for an organiser or an elder's link token, and is safe to repeat.
  - `advance_capture()` (ADR 0013) is the pipeline's only way to move a job along: `uploaded → transcribing → structuring → ready_for_review`, or `failed` from any of those. A repeated step is a no-op, and a confirmed capture is never touched. It is service-role only.
  - `confirm_capture()` creates the recipe and its original version and attaches the media.
  - `publish_correction()` is for owners and admins.
  - `create_contributor_link()`, `revoke_contributor_link()` and `contributor_link_info()` manage elder recording links.
- **Read rules:**
  - Unreviewed captures and their media are visible to owners, admins and members only.
  - A confirmed recipe's media follows the recipe.
  - Private recipes are visible to their creator only.

## Phase 3: handover

| Table       | Purpose                     | Key columns                                                                                                                                                                                                                                                |
| ----------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handovers` | A recipe passing to someone | `recipe_id`, `version_id`, `from_person_id`, `to_person_id`, `from_family_id`, `to_family_id`, `to_recipe_id` (the copy, for cross-vault), `message_text`, `message_media_id`, `unlock_at` (v2 sealed), `status` (pending, delivered, opened), `opened_at` |

- Lineage (Ba → Mom → me) is read from `handovers` joined to `people`.
- **Cross-vault (v2 UI, schema now).**
  - The receiving vault gets a new `recipes` row with `origin_recipe_id` pointing back.
  - Its root version is a copy of the handed-over version.
  - Original media is shared by reference, read through a server-checked link, not copied.
- **Sealed handovers.** Content is returned only by a server function that checks `unlock_at`, never by direct select.

## Phase 4: sharing

| Table         | Purpose                           | Key columns                                                                                                       |
| ------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `share_links` | A link or QR code for one version | `recipe_id`, `version_id`, `token_hash`, `created_by`, `expires_at`, `revoked_at`, `view_count`, `last_viewed_at` |

Share pages are served by the server, which validates the token, expiry and revocation and returns only that one version. There is no list endpoint.

## v2 additions

- `attempts`: `version_id`, `author_profile_id`, `notes`, `rating`, `cooked_on`, with photos as `media` rows.
- `occasions` and `reminders`: birthdays and festivals that drive gentle prompts.

## Storage buckets

| Bucket         | Phase | Contents                             | Path                                                                                  |
| -------------- | ----- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `vault-images` | 1     | People photos, vault covers          | `{family_id}/people/{person_id}/{file}`, `{family_id}/cover/{file}`                   |
| `vault-audio`  | 2     | Original recordings, voice notes     | `{family_id}/capture/{job_id}/{file}`. Clients can upload; only the server can delete |
| `vault-scans`  | 2     | Handwriting scans and derived copies | `{family_id}/capture/{job_id}/{file}`                                                 |

All buckets are private. Reads go through RLS on `storage.objects`, scoped by the leading `{family_id}` folder.

## Privacy rules enforced in the database

- Two families can never see each other's rows. This is tested across every table.
- Viewers cannot write.
- Only owners and admins see invites, and nobody can read `token_hash`.
- An account is linked to a person only by accepting an invite.
- A vault always keeps at least one owner.
- Soft deletes go through functions such as `remove_person()`, never direct `deleted_at` writes. Postgres refuses an update that hides a row from its own read policy, and a function can also check the role.
- Phone and email invites can only be accepted by that phone number or email address. Link invites can be accepted by anyone who has the link.
