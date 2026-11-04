# Family Recipe Vault: Build Brief for Claude Code

> **Amendments. Read these before the brief.** Where they conflict, the ADRs in `docs/adr/` win over the text below. The original brief is kept unchanged in `docs/brief.md`.
>
> - **0002:** TypeScript 6, not 7, because typescript-eslint doesn't support 7 yet.
> - **0003:** STT providers are evaluated before one is chosen.
> - **0004:** v1 is web-first (installable PWA). Expo moves to v2.
> - **0005:**
>   - Built global-ready, launched to NRI families.
>   - Warm, culture-neutral style. Right-to-left-ready layouts.
>   - Sign-in by phone, email, Google and Apple.
>   - Data hosted in India (Mumbai), with GDPR met through SCCs.
>   - The original recipe changes only through a correction chain, never by editing it in place.
>   - Cross-vault handover is in the schema now, with UI in v2.
>   - Withdrawing consent hard-deletes the audio but keeps the text recipe.
>   - Units are chosen per viewer.
>   - Media belongs to the capture job until confirm.
> - **0006:** RLS is tested with pgTAP (`pnpm db:test`). Every new table or policy ships with allowed and denied tests.
> - **0007:** Sessions use `@supabase/ssr` with a `proxy.ts` (Next 16's name for middleware). Email sign-in sends a link and a code; local test phones use code `123456`.
> - **0008:** Translations use i18next on the server and react-i18next in client components. Keys are type-checked.
> - **0010:** Capture and recipe tables are read-only for clients. Every write goes through service-role SQL functions (`begin_capture`, `confirm_capture`, `publish_correction`, contributor-link functions) that re-check the actor.
> - **Consent:** wording version `2026-11-v1` (`docs/consent.md`, i18n `consent.*`). Each sentence is a promise with conditions that must stay true.
> - **Recording limit:** 10 minutes per recording (`MAX_RECORDING_SECONDS` in `packages/core`).
> - The full data model is in `docs/schema.md`. Soft deletes go through SQL functions (e.g. `remove_person()`), never direct `deleted_at` writes.
> - Open questions live in `docs/open-decisions.md`.

> Working name: **Virasat** (placeholder, rename freely)
> Guiding principle: *If you do something, do it with perfection.*
> In practice: build less, but build every piece completely. No half-finished features in production, no shortcuts in privacy or data integrity, no "we'll fix it later" on the data model.

---

## 1. Product context (read this before writing any code)

### The problem
Food is one of the few things that still brings families together, and that closeness is fading. The most valuable family recipes were never written down. In most Indian households a grandmother's recipe lives only in her hands and her words: "add oil till it looks right", "a fistful of besan". When she is gone, the recipe is gone.

### The core idea
**Capture before it's lost, not storage.** Storing recipes is solved (Notes, Google Docs, recipe apps). This product captures recipes that exist only as memory and voice, keeps them with their original voice, handwriting and story, and passes them down through the family.

### Product decisions already made
1. **Capture first.** The hero flow is recording a recipe from an elder by voice or photo, then AI turns it into a structured recipe. The original voice clip and handwriting image are always kept and shown. They are the emotional core, not attachments.
2. **Respect "andaaz".** Every ingredient keeps the elder's exact words ("mutthi bhar besan"). AI may suggest an approximate quantity, shown beside the original, never replacing it.
3. **Contributors never install the app.** Elders contribute through a zero-install web link with one big record button (v1), and a WhatsApp voice-note bot (v2). Only the family organiser needs the app.
4. **The family tree is a tree of recipes passing between people, not a genealogy tree.** Nobody builds a tree upfront. The tree grows each time a recipe is handed down (Ba to Mom to me). Every branch has food attached.
5. **Inheritance and personal versions are one system.** When someone inherits a recipe they can keep it as is or create their own version (less sugar, a substitute ingredient abroad). Versions are branches off the original, like git. The original is immutable. This also powers the personal "my attempts until perfection" use case later.
6. **Handover is a moment.** A giver can seal a recipe with a voice note and set it to open on a date (wedding, first Diwali in a new home, moving abroad).
7. **Private by default.** Four levels: Private, Family vault (invite only), Shared by link or QR (single recipe), Public (explicit opt-in).
8. **No social photo feed in v1.** Families already share food photos on WhatsApp. Photos exist only attached to a recipe, a person, or a handover.
9. **Business model: gifting, not subscriptions first.** Printed heirloom cookbook generated from the vault, sold around weddings, Diwali, Mother's Day. Subscription for storage or premium features can come later.
10. **First audience: NRI families.** People living away from their mother's kitchen feel the loss most and have the strongest reason to pay.

### Known risks (design against them)
- Low engagement between occasions. Mitigate with gentle occasion-based prompts (birthdays, festivals), not a daily habit loop.
- Every vault needs one motivated organiser. Make the organiser's job easy and rewarding.
- Elders are not tech users. Any contributor screen must work for a 75-year-old on a cheap Android phone with poor network.

---

## 2. Scope

### v1 (MVP), build in this order
1. Auth and family vault (organiser creates vault, invites members by phone or link).
2. People in the vault, including **non-account people** (Ba never signs up, but she is a person in the vault).
3. Capture: voice recording (in app and via zero-install contributor link) and photo of handwritten recipe.
4. AI pipeline: transcription, structuring into recipe JSON, handwriting OCR. Human review screen before saving. AI never publishes on its own.
5. Recipe page: structured recipe plus original voice playback, handwriting image, story, dish photos, "recipe of" person.
6. Handover: pass a recipe to a family member, lineage shown on the recipe.
7. Sharing: privacy levels, share link with unguessable token, QR code for that link, revoke anytime.
8. Languages: UI in English, Hindi, Gujarati. Recipes captured in any of these.

### v2
- Personal versions (fork on inherit, my attempts log with notes and photos per attempt).
- Sealed handovers that unlock on a date.
- WhatsApp contributor bot.
- Family recipe tree visualisation.
- Occasion prompts and reminders.

### v3
- Printed heirloom cookbook (PDF generation plus print partner), payments.
- Public recipe discovery for opted-in recipes.
- Semantic search ("Ba's winter recipes with methi").

---

## 3. Tech stack (decided)

Chosen for scalability, type safety end to end, India plus diaspora usage, and speed of a small team.

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **pnpm + Turborepo**, TypeScript strict everywhere | Shared types and logic between mobile, web and backend |
| Mobile app | **Expo (React Native), latest stable SDK, Expo Router** | One codebase for iOS and Android, native audio recording, OTA updates via EAS |
| Web app | **Next.js (App Router)** | Contributor recording links, share/QR recipe pages (SEO-safe, fast), organiser dashboard on desktop, API routes |
| Database | **PostgreSQL via Supabase** | Relational data (families, lineage, versions) fits Postgres. Row Level Security enforces privacy at the database layer |
| Auth | **Supabase Auth**: phone OTP primary, plus Google and Apple | Phone OTP suits India and families |
| File storage | **Supabase Storage** (S3-compatible) behind a storage interface | Audio, images, handwriting scans. Interface allows moving to Cloudflare R2 or S3 later |
| Migrations | **Supabase CLI SQL migrations** as source of truth, generated TS types | RLS policies are SQL-native, keep them versioned with schema |
| Validation | **Zod** schemas in a shared package | Same validation on client, API and AI output parsing |
| Background jobs | **Inngest** | Durable multi-step AI pipeline with retries (transcribe, structure, notify) |
| Speech to text | Provider interface, evaluate candidates in Phase 0 (Sarvam AI, OpenAI transcription models, Google Chirp) on real Gujarati and Hindi recordings | Quality on elderly voices in Indian languages is the make-or-break metric. Decide with real tests, not assumptions |
| LLM structuring + OCR | **Claude API** (`claude-sonnet-5-5`) with structured JSON output, vision for handwriting | Strong multilingual reasoning and vision, reliable structured output |
| Client data fetching | **TanStack Query** | Caching, retries, offline-tolerant UX |
| Mobile state | **Zustand** (only for UI state) | Server state stays in TanStack Query |
| Styling | **NativeWind** on mobile, **Tailwind** on web, shared design tokens | One design language across platforms |
| i18n | **i18next** (en, hi, gu) | Shared translation files |
| Push notifications | **Expo Notifications** | Handover received, recipe ready for review |
| QR | Generate client-side from share URL (`qrcode` library) | No server cost |
| Analytics | **PostHog** | Product analytics and feature flags |
| Errors | **Sentry** (mobile, web, jobs) | |
| Testing | **Vitest** (unit), **Playwright** (web E2E), **Maestro** (mobile E2E) | |
| CI/CD | **GitHub Actions**: typecheck, lint, test, migration check on every PR. **Vercel** for web, **EAS Build/Submit** for mobile | |
| Later | **pgvector** for semantic search, **Razorpay** (India) and **Stripe** (diaspora) for payments, **WhatsApp Business Cloud API** for the bot | |

### Architecture rules
- Mobile and web read data directly from Supabase **only through RLS-protected queries**. Any privileged action (AI jobs, handovers, share links, invites, unlocking sealed content) goes through Next.js API route handlers using the service role on the server only.
- Service role keys never ship to a client. Ever.
- AI providers sit behind interfaces in `packages/ai` (`TranscriptionProvider`, `RecipeStructurer`, `HandwritingReader`). Swapping a provider must not touch app code.
- All AI output is parsed with Zod. Invalid output is retried, then surfaced to the user for manual entry. Never crash, never silently save junk.
- Raw media (original audio, original scans) is never deleted or overwritten by processing. Derived files are separate.

---

## 4. Repository structure

```
/
├── apps/
│   ├── mobile/          # Expo app (organiser + family members)
│   └── web/             # Next.js: contributor links, share pages, dashboard, API routes
├── packages/
│   ├── core/            # Domain logic, Zod schemas, types, permission helpers
│   ├── ai/              # STT, LLM structuring, OCR providers + prompts + evals
│   ├── db/              # Generated Supabase types, typed query helpers
│   ├── ui-tokens/       # Colors, spacing, typography shared by NativeWind and Tailwind
│   └── i18n/            # en, hi, gu translation files
├── supabase/
│   ├── migrations/      # SQL migrations incl. RLS policies
│   └── seed.sql         # Realistic seed family for development
├── jobs/                # Inngest functions (capture pipeline, notifications)
├── docs/                # ADRs (architecture decision records), this brief
└── .github/workflows/
```

---

## 5. Data model (v1 with v2 already designed in)

Design the v2 columns now so no painful migration later. Use UUIDs, `created_at`, `updated_at` everywhere, soft delete (`deleted_at`) on user content.

- **profiles**: `id` (= auth user id), `display_name`, `phone`, `preferred_language`, `avatar_path`
- **families** (vaults): `id`, `name`, `created_by`, `cover_path`
- **family_members**: `family_id`, `profile_id`, `role` (`owner` | `admin` | `member` | `viewer`), `joined_at`
- **people**: everyone who appears in the vault, with or without an account. `id`, `family_id`, `display_name`, `relation_label` (free text like "Ba", "Nani"), `profile_id` (nullable), `photo_path`, `birth_year` (optional), `notes`
- **recipes**: the identity of a dish across all its versions. `id`, `family_id`, `title`, `origin_person_id`, `root_version_id`, `visibility` (`private` | `family` | `link` | `public`), `cover_path`
- **recipe_versions**: immutable snapshots. `id`, `recipe_id`, `parent_version_id` (null for the original, set for forks), `author_person_id`, `title`, `servings`, `ingredients` (jsonb, see below), `steps` (jsonb), `tips`, `story`, `language`, `source_type` (`voice` | `handwriting` | `typed` | `whatsapp`), `status` (`draft` | `confirmed`), `created_by`
- **ingredients jsonb item**: `{ original_text, name, suggested_quantity, suggested_unit, confidence, note }`. `original_text` is required and always displayed.
- **recipe_media**: `id`, `recipe_version_id`, `kind` (`original_audio` | `handwriting_scan` | `dish_photo` | `family_photo`), `storage_path`, `duration_ms`, `width`, `height`, `caption`, `uploaded_by`
- **capture_jobs**: `id`, `family_id`, `created_by` or `contributor_link_id`, `media_ids`, `status` (`uploaded` | `transcribing` | `structuring` | `ready_for_review` | `failed` | `confirmed`), `transcript`, `detected_language`, `ai_output` (jsonb), `error`, `provider_meta`
- **handovers**: `id`, `recipe_id`, `version_id`, `from_person_id`, `to_person_id`, `message_text`, `message_audio_path`, `unlock_at` (nullable, v2), `status` (`pending` | `delivered` | `opened`), `opened_at`
- **share_links**: `id`, `recipe_id`, `version_id`, `token` (random, at least 128 bits, URL-safe), `created_by`, `expires_at` (nullable), `revoked_at`, `view_count`
- **contributor_links**: magic links for elders to record without an account. `id`, `family_id`, `person_id`, `token`, `expires_at`, `revoked_at`, `max_uploads`
- **invites**: `id`, `family_id`, `phone` or `token`, `role`, `invited_by`, `accepted_at`, `expires_at`
- **attempts** (v2): `id`, `version_id`, `author_profile_id`, `notes`, `rating`, `photo_paths`, `cooked_on`

### Lineage logic
- Original capture creates `recipes` row + root `recipe_versions` row.
- Handover "keep as is" points to the same version. Lineage is read from `handovers`.
- "Make my version" (v2) creates a new `recipe_versions` row with `parent_version_id`. The tree view is `recipe_versions` (branches) plus `handovers` (who received what from whom).

### RLS rules (write tests for every one)
- Users see families they are members of. Viewers cannot write.
- Recipes with `visibility = family` are readable by family members only.
- Share link pages are served by the server, which validates token, expiry and revocation, then returns only that one version. No list or enumeration endpoints.
- Public recipes are readable by anyone, but only fields explicitly marked public.
- Sealed handovers (v2): content not returned before `unlock_at`, enforced server-side, not just hidden in UI.
- Contributor links can only upload media into a capture job for their family and person. They can never read vault content.

---

## 6. Core flows

### Flow A: Organiser sets up
Sign in with phone OTP, create vault, add people (Ba, Mom, Masi) as non-account people, invite family members.

### Flow B: Capture from an elder (the hero flow)
1. Organiser picks a person (Ba) and either records in the app sitting next to her, or generates a contributor link and sends it on WhatsApp.
2. Contributor page: Ba's name and photo at top, one huge record button, language auto-detected, works on slow 3G, resumable upload, max length setting, clear "sent" confirmation. Text size large, minimal words, works without login.
3. Upload triggers Inngest pipeline: transcribe, detect language, structure into recipe JSON with Claude, notify organiser.
4. Review screen: organiser sees transcript, AI recipe, and plays original audio segment by segment. Edits anything. Confirms. Only then is the recipe saved as `confirmed`.

### Flow C: Handwritten recipe
Photograph diary page, auto-crop and enhance as a derived copy (keep original), Claude vision reads it, same review screen.

### Flow D: View a recipe
Title, "Ba's recipe" with her photo, play button for her voice telling it, ingredients showing her words with suggested quantity beside them, steps, tips, story, handwriting image, dish photos, lineage strip (Ba to Mom to me).

### Flow E: Pass it down
Choose recipe, choose family member, add a text or voice message, send. Receiver gets a push notification and a "you received a recipe" moment, not a plain list item.

### Flow F: Share
Set visibility, generate link, show QR, copy or share. Revoke button always visible.

---

## 7. AI pipeline details (`packages/ai`)

- **Prompts are code**: versioned files with tests.
- **Structuring output schema**: title, servings (nullable), ingredients (with `original_text` mandatory), steps, tips, story (any personal memory the speaker mentioned), language, uncertain fields list.
- **Rules for the structurer**: never invent ingredients or steps not in the transcript; keep the speaker's measurement phrases verbatim; mark anything unclear as uncertain so the review screen highlights it; preserve original-language dish names.
- **Eval set**: from Phase 0, keep a folder of real recordings (with family consent) and expected outputs. Every prompt or provider change runs against it. Track word error rate and structuring accuracy.
- **Cost and limits**: log tokens and audio minutes per job, cap recording length, rate-limit contributor links.

---

## 8. Design and UX standards

- Warm, personal, heritage feel. Not a generic recipe app. Think family album, not food blog.
- Elder-facing screens: minimum 20pt text, tap targets at least 56px, one action per screen, no jargon, works one-handed.
- Accessibility: screen reader labels, sufficient contrast, captions for audio via transcript.
- Every empty state guides the next action ("Record your first family recipe").
- Every loading state for AI shows honest progress ("Listening to Ba's recording", "Writing the recipe").
- Offline tolerant: queued uploads retry automatically.
- Light and dark mode.

---

## 9. Engineering standards (the perfection rule, made concrete)

- TypeScript `strict`, no `any` without a comment explaining why.
- ESLint + Prettier, enforced in CI.
- Every migration reviewed for RLS. Every RLS policy has a test proving both allowed and denied access.
- Unit tests for domain logic in `packages/core`, AI parsing in `packages/ai`.
- E2E tests for flows B, D, E, F before calling v1 done.
- Secrets only in env vars, `.env.example` kept current, never commit secrets.
- Write an ADR in `docs/` for every significant decision or deviation from this brief.
- Structured logging with request and job IDs. Sentry on all surfaces.
- Data export: a family owner can export the entire vault (JSON plus media) at any time. Families must never feel locked in with their heritage.
- Privacy: no recipe content in analytics events, no media in logs.

---

## 10. Build phases with definition of done

### Phase 0: Foundation and STT evaluation
- Scaffold monorepo, CI, Supabase project, environments (dev, staging, prod).
- Spike: record 10 to 15 real Gujarati and Hindi recipe explanations from elders, run through candidate STT providers, compare. Write ADR with the decision.
- **Done when**: CI green on empty apps, ADR for STT written, seed data loads.

### Phase 1: Auth, vault, people
- Phone OTP, vault creation, invites, roles, people (with and without accounts), full RLS with tests.
- **Done when**: two test families cannot see each other's data under any query, verified by tests.

### Phase 2: Capture pipeline
- In-app recording, contributor link page, resumable uploads, Inngest pipeline, review screen, handwriting capture.
- **Done when**: a real Gujarati voice recording becomes a correct, reviewed, confirmed recipe end to end, with original audio playable.

### Phase 3: Recipe experience and handover
- Recipe page, lineage strip, handover with message, push notifications, receive moment.
- **Done when**: Ba to Mom to me lineage displays correctly and E2E test passes.

### Phase 4: Sharing and polish
- Visibility levels, share links, QR, revoke, i18n (en, hi, gu), accessibility pass, vault export.
- **Done when**: share link works for a non-user, revoked link returns nothing, all v1 E2E tests green, app submitted to TestFlight and Play internal testing.

### Phase 5 onward: v2 then v3 as listed in section 2.

---

## 11. How Claude Code should work on this

1. Read this whole brief first. Save it as `CLAUDE.md` in the repo root so it persists across sessions.
2. Work one phase at a time. At the start of each phase, propose a short plan and wait for approval.
3. Before any schema change, show the migration and the RLS impact.
4. Do not add libraries outside this stack without proposing them with a reason and writing an ADR.
5. Ask when a product decision is unclear. Do not guess on privacy, lineage or data deletion.
6. At the end of each phase, summarise what was built, what was tested, and what is still open.

---

## 12. Open questions for the founder

- Final app name and brand direction.
- Which languages beyond English, Hindi, Gujarati for launch (Marathi, Tamil, Punjabi?).
- Maximum recording length for elders.
- Pricing and timing for the printed cookbook.
- Consent flow wording for recording elders and storing their voice.
