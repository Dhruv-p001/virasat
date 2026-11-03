# Virasat

Family recipes, captured in the voices of the people who made them. `CLAUDE.md` is the product and engineering brief.

## Setup

```bash
npm i -g pnpm@12.16.1      # once per machine
pnpm install
cp .env.example .env
```

## Everyday commands

| Command                                                  | What it does                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                                               | Run the web app                                                                 |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | What CI runs                                                                    |
| `pnpm format`                                            | Prettier                                                                        |
| `pnpm db:start` / `pnpm db:reset`                        | Local Supabase (needs Docker). Reset applies migrations and `supabase/seed.sql` |
| `pnpm db:types`                                          | Regenerate `packages/db/src/database.types.ts` from the local database          |
| `pnpm eval:stt`                                          | Speech-to-text provider comparison (see below)                                  |

## Speech-to-text evaluation (Phase 0)

1. Do the data setup in `docs/adr/0003-speech-to-text-evaluation.md` first. In particular, set Sarvam retention to 0 days before uploading any elder audio.
2. Put recordings in `packages/ai/eval/stt/data/`. This folder is gitignored and recordings never go in git.
3. Describe the recordings in `data/manifest.json`, following `eval/stt/manifest.example.json`. Each reference transcript should be checked by someone in the family.
4. Set the API keys for the providers you want to test in `.env`.
5. Run `pnpm eval:stt`, or `pnpm eval:stt --language=hint`. Results are written to `eval/stt/results/`.

## Layout

```
apps/web            Next.js: contributor links, share pages, dashboard, API routes
packages/core       Domain types, Zod schemas, permission helpers, tokens
packages/ai         STT providers, error-rate metrics, eval harness
packages/db         Generated Supabase types
packages/ui-tokens  Colours, type scale, sizing → generated Tailwind theme
packages/i18n       en, hi, gu strings
supabase/           Migrations (with RLS) and seed
docs/adr/           Architecture decision records
docs/open-decisions.md
```

`apps/mobile` and `jobs/` arrive in later phases (see ADR 0004 and Phase 2).
