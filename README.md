# Virasat

Family recipes, captured in the voices of the people who made them. `CLAUDE.md` is the product and engineering brief.

## Setup

Needs Node 24 and Docker.

```bash
npm i -g pnpm@12.16.1      # once per machine
pnpm install
pnpm db:start              # local Supabase: database, auth, storage, test inbox
pnpm env:local             # writes apps/web/.env.local from the running stack
pnpm dev                   # http://localhost:3000
pnpm dev:inngest           # in a second terminal: runs the capture pipeline (see below)
```

### Signing in locally

- **Email:** use `dhruv@example.test` (Shah family owner), `meena@example.test` (member) or `raj@example.test` (an unrelated family). Codes and links arrive in the local inbox at http://127.0.0.1:55324.
- **Phone:** use `+1 555 555 0100` or `+1 555 555 0101`. The code is always `123456` and no SMS is sent.
- **New accounts:** any new email or test phone number creates an account and starts onboarding.

## Everyday commands

| Command                                                  | What it does                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                                               | Run the web app                                                                     |
| `pnpm dev:inngest`                                       | Run the Inngest dev server that powers the capture pipeline (needs `pnpm dev`)      |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | Checks CI runs                                                                      |
| `pnpm db:test`                                           | pgTAP: vault isolation and every RLS policy, allowed and denied                     |
| `pnpm e2e`                                               | Playwright end-to-end tests on phone and desktop (needs the local stack)            |
| `pnpm format`                                            | Prettier                                                                            |
| `pnpm db:start` / `pnpm db:reset`                        | Local Supabase (needs Docker). Reset applies migrations and `supabase/seed.sql`     |
| `pnpm db:types`                                          | Regenerate `packages/db/src/database.types.ts` from the local database              |
| `pnpm eval:stt`                                          | Speech-to-text provider comparison (see below)                                      |
| `pnpm eval:structure`                                    | Transcript to recipe eval. `--mock` needs no API key, otherwise `ANTHROPIC_API_KEY` |

The `/style` page shows every design token and pattern in light and dark mode (development only).

## The capture pipeline

When an elder's recording is confirmed, the app sends a `capture/uploaded` event to [Inngest](https://www.inngest.com), which runs the pipeline in `jobs/`: transcribe, then write the recipe, then mark the capture "ready for review" (or "failed", when a person must type it in). Organisers see progress under "Waiting for you" in the vault. A person always reviews the draft before it becomes a recipe.

- **Locally,** run `pnpm dev` and `pnpm dev:inngest` together (`pnpm env:local` sets `INNGEST_DEV=1`). The Inngest dashboard is at http://localhost:8288. Without the dev server, a confirmed recording waits in "Received" and the five-minute sweep retries it once the server is up.
- **Mock mode** needs no API keys: a fixed sample transcript and recipe stand in for the real providers, and a banner says so. `pnpm env:local` sets `AI_MODE=mock`, and CI runs the same way. The recipe a mock capture produces is **not** made from the recording.
- **Live mode** (`AI_MODE=live`) uses Claude for the recipe and the speech-to-text provider named by `STT_PROVIDER` (OpenAI by default). Set `ANTHROPIC_API_KEY` and that provider's key. If `AI_MODE` is unset, live is used when the keys are present and mock otherwise; production never falls back to mock. Gemini is never used here (ADR 0011).
- **Hosted,** set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` and register `https://<site>/api/inngest` with Inngest.

Organisers capture in the app too: from a person's page, record them, or photograph up to four handwritten pages. Each photo is kept as taken, and a readable copy is made in the browser. When a capture is ready, "Waiting for you" opens the review screen, where a person checks the draft against the original and saves it. Only saving makes a recipe.

See `docs/adr/0013-capture-pipeline.md` and `docs/adr/0014-organiser-capture-and-review.md`.

## Speech-to-text evaluation (Phase 0)

1. Do the data setup in `docs/adr/0003-speech-to-text-evaluation.md` first. In particular, set Sarvam retention to 0 days before uploading any elder audio.
2. Put recordings in `packages/ai/eval/stt/data/`. This folder is gitignored and recordings never go in git.
3. Describe the recordings in `data/manifest.json`, following `eval/stt/manifest.example.json`. Each reference transcript should be checked by someone in the family.
4. Set the API keys for the providers you want to test in `.env`.
5. Run `pnpm eval:stt`, or `pnpm eval:stt --language=hint`. Results are written to `eval/stt/results/`.

## Layout

```
apps/web            Next.js: sign-in, vaults, people, invites, settings, recording links, capture progress
jobs/               Inngest functions: the capture pipeline and its sweep
packages/core       Domain types, Zod schemas (recipes and forms), permission helpers, tokens
packages/ai         STT providers, recipe structuring, mock providers, error-rate metrics, eval harness
packages/db         Generated Supabase types
packages/ui-tokens  Colours, type scale, sizing → generated Tailwind theme
packages/i18n       en, hi, gu strings
supabase/           Migrations (with RLS), pgTAP tests, seed, email templates
docs/               Schema design, ADRs, open decisions
```

`apps/mobile` arrives in v2 (ADR 0004).
