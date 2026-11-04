# 0013. The capture pipeline

Status: Accepted · 2026-11-06

## Context

ADR 0010 says the pipeline moves a capture through `uploaded → transcribing → structuring → ready_for_review` (or `failed`), and ADR 0012 ends at `uploaded`. This ADR covers what runs in between. Rules that shape it:

- The AI never publishes: a person reviews every draft.
- Raw media is never overwritten or deleted by processing.
- No recipe content, transcripts or media in logs or analytics.
- With no provider keys (local development, CI) the whole flow must still run and be testable.
- Gemini is never used here (ADR 0011). Production structuring and handwriting use Claude. Speech-to-text uses the provider chosen by environment.

## Decision

**Inngest runs it, in `jobs/`.**

- `jobs/` is a workspace package, `@virasat/jobs`, with the Inngest SDK pinned exactly (it is in the brief's stack). The web app serves it at `/api/inngest` and sends one event, `capture/uploaded`, carrying only the job id.
- `confirmUpload` sends the event after `confirm_upload` succeeds. If sending fails, the elder's upload still succeeds, and a sweep (below) sends it again.

**Two steps, retried separately.**

1. `transcribe`: download the original audio, call the speech-to-text provider, move the job to `structuring` with the transcript and detected language. A handwriting capture skips this and moves straight to `structuring`.
2. `structure`: call `RecipeStructurer` (voice) or `HandwritingReader` (handwriting). A draft moves the job to `ready_for_review` with `ai_output`. When the AI gives up (`needs_manual_entry`), the job moves to `failed` with the reason `manual_entry:<reason>` and the transcript kept, so the review screen can offer manual entry prefilled with it.

Each step picks up wherever a crashed run stopped, and a step that finds the job already past it does nothing. A function-level concurrency key allows one run per capture at a time. After its retries (3), `onFailure` fails the capture with `pipeline_error`.

**Steps return a word, never content.** Inngest stores step results. Recipe text, transcripts and audio move only between storage, the AI providers and our own database. Failure reasons are short codes, and `provider_meta` holds model names, prompt versions, latency and token counts only.

**`advance_capture()` owns the state machine.**

- It is a service-role-only SQL function. It has no actor to re-check, because the pipeline is not a person. Instead it refuses every move the machine does not allow.
- A repeated step is a no-op. A job a person has already confirmed cannot be failed by a late step. `ready_for_review` needs the AI output, and `failed` needs a short reason.
- Clients keep read-only access to `capture_jobs`. Writers (owner, admin, member) see captures. Viewers do not see unreviewed ones, and another family sees nothing.
- This follows ADR 0010: every write to capture and recipe tables goes through a function.

**A sweep every five minutes** sends the event again for captures still `uploaded` after two minutes, and fails any capture that has made no progress for 15 minutes with `timed_out`. An organiser is never left looking at a spinner.

**Mock and live providers.**

- `AI_MODE=mock` or `AI_MODE=live` is explicit and wins. Unset means live when its keys are present and mock otherwise, except in production, which is always live and refuses to start the pipeline without its keys.
- Mock providers return a fixed transcript and a fixed recipe, ignore the audio, and touch no network. A banner on every screen that shows pipeline output says so, so a sample recipe is never mistaken for a real one.
- The speech-to-text provider is `STT_PROVIDER` (default `openai`, as chosen in ADR 0003 once a key exists), and structuring uses Claude. `pnpm env:local` writes `AI_MODE=mock` and `INNGEST_DEV=1`.

**Progress is honest and visible.** Organisers see "Received", "Listening to Ba's recording", "Writing the recipe", "Ready for you to review" or "Could not be turned into a recipe automatically", and the list refreshes itself every few seconds while anything is in progress.

**Local development and CI.** `pnpm dev:inngest` runs the Inngest dev server (`inngest-cli`, pinned, through `npx`, so it is not a dependency of the repo). Playwright starts it alongside the app, so the end-to-end tests run the real pipeline with the mock providers.

## Consequences

- **Real-provider quality is not verified.** No API keys exist yet, so nothing here has run against real Gujarati speech or real Claude output. The mock path proves the wiring, state machine, retries and screens. It says nothing about transcript accuracy or recipe quality. That needs `pnpm eval:stt` and `pnpm eval:structure` with real keys and real recordings before launch.
- **Handwriting pages go in as uploaded.** ADR 0009 asks for a derived, downscaled copy. Until the capture screens create one (M3), a scan over the API's size limits fails the input check and the capture fails to manual entry. The original is never touched.
- **The mock recipe is the same every time.** Tests that need variety must script providers directly (the `jobs` unit tests do).
- **Hosted setup** needs `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` on Vercel, and the app registered with Inngest.
- **No push notification yet.** The brief's "notify organiser" waits for push notifications (Phase 3). The organiser sees the capture in the vault list.
