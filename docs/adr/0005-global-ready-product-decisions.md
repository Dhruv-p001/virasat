# 0005. Global-ready product decisions before Phase 1

Status: Accepted · 2026-11-03 (founder answers)

## Context

The founder wants the product used by families worldwide. The brief names NRI families as the first audience. These decisions settle the questions that shape the Phase 1 schema and UI, so they are recorded before any migration is written.

## Decisions

**Audience.**

- The product is built to work for any family anywhere: any language, units, right-to-left text, and data-protection rules.
- Launch marketing targets Indian diaspora (NRI) families first.

**Visual style: warm and culture-neutral.**

- A family-album feel: paper tones, warm neutrals, serif headings. Photos and voices are the hero.
- No culture-specific motifs. Each family's content carries the culture.
- This replaces the turmeric and terracotta placeholder palette.

**Languages.**

- The v1 UI ships in English, Hindi and Gujarati.
- Adding a language must not need code changes.
- Layouts use CSS logical properties (`margin-inline-start`, not `margin-left`) so right-to-left languages work later without rework.

**Sign-in.**

- Phone OTP, email magic link, Google and Apple.
- Email covers regions where SMS is expensive or unreliable, and people who won't share a number.

**Data region.**

- The Supabase project, database and storage are hosted in India (Mumbai, `ap-south-1`).
- GDPR compliance for users in Europe and the UK covers these points:
  - Standard Contractual Clauses (SCCs) and a transfer impact assessment for EU and UK data.
  - A clear privacy notice that names India as the storage location.
  - Data subject rights: access, export and erasure.
  - Data processing agreements (DPAs) with every processor, including Supabase and the STT and LLM providers.
  - India's DPDP Act consent and notice duties.
- The legal wording needs review by counsel before launch. That review is not an engineering task.

**Name.** "Virasat" is the working name. It lives in one config place so it can be renamed cheaply before launch.

**Correcting an original (correction chain).**

- An owner or admin can publish a corrected original.
- It supersedes the previous one, which stays in history with who changed what and when. It is still the same person's recipe.
- Personal versions (forks) remain a separate concept.

**Handover across vaults.**

- The schema supports it from day one: a copy in the receiving vault, linked to its origin recipe and lineage.
- v1 screens allow handovers within one vault only. The full cross-vault flow ships in v2.

**Withdrawing consent.**

- Original audio and scans are permanently deleted from storage. Backups expire on their normal retention cycle.
- The confirmed text recipe stays, marked "original recording removed".
- It can be triggered by the vault owner, or by the person themselves when they have an account.

**Mobile.**

- v1 is web-first: an installable PWA for organisers and family members.
- The Expo native app moves to v2 (see ADR 0004).
- Notifications use web push, plus WhatsApp or email where web push is weak (iOS without the app installed to the home screen).

**Units (engineering default, no founder input needed).**

- Suggested quantities are stored in metric.
- Each viewer sees them in their chosen system: metric, US customary or "cups & spoons".
- The speaker's original words are always shown unchanged.

**Media linkage (engineering default).**

- Uploaded media belongs to a capture job first and gets attached to a recipe version when the recipe is confirmed.
- No array-of-ids columns.

## Consequences

- The brief's sections on Expo in v1, phone-only sign-in and the immutable original are amended by this ADR.
- The Phase 1 and Phase 2 schemas follow the decisions above.
