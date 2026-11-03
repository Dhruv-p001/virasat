# Open decisions

These need a founder answer. Items 1 to 4 must be settled before the Phase 1 migration, because changing them later means a painful migration. The brief says not to guess on privacy, lineage or deletion.

1. **Media is uploaded before a version exists.**
   - `recipe_media.recipe_version_id` is required, but audio and scans arrive at capture time, when there is no version yet.
   - `capture_jobs.media_ids` is an array, which no foreign key can protect.
   - Proposal: media references `capture_job_id`, with `recipe_version_id` set when the recipe is confirmed. Drop the array.
2. **Correcting the immutable original.**
   - Example: the AI heard "jeera" where Ba said "ajwain", and someone notices months later. A fork is wrong, because the fix is still Ba's recipe.
   - Proposal: a correction chain on the original. It has the same author, is marked `supersedes`, and keeps the audit trail. This stays separate from personal versions, which are forks.
3. **Handover across vaults.**
   - Every recipe has one `family_id`. A daughter who marries and moves into her in-laws' vault is the most emotional handover there is, and the model can't express it.
   - Options: v1 explicitly limits handovers to one vault, or the model gets a cross-vault handover (a copy linked to its origin) now.
4. **Deletion versus consent.**
   - "Raw media is never deleted" and soft-delete everywhere conflict with an elder or family withdrawing consent. India's DPDP Act and GDPR both give a right to erasure.
   - A hard-delete path is needed. Its scope, who can trigger it, and what happens to recipes derived from the audio all need deciding.
5. **Consent wording** for recording elders. Needed before Phase 2, because the contributor page shows it.
6. **Mobile timing.** See ADR 0004.
7. Brief section 12: final name, extra launch languages, maximum recording length, cookbook pricing.
8. **Hindi and Gujarati UI strings** in `packages/i18n` were drafted by Claude and need a native speaker to review them.
