# Phase 2.5: Design system, first run and family moments

Status: proposed 2026-11-05 · Owner: founder

## Why

A new user who hasn't recorded anyone yet sees an empty app, and the brief's biggest risk is low engagement between occasions. This phase makes Virasat feel alive from minute one and gives families a weekly reason to come back. It stays private by default: there is no public feed (decision 8 in the brief stands).

## What we build

1. **Design system.** A shared component library and app shell that make every screen feel like a family album, not a form. Phase 1 screens get restyled on it.
2. **Sample vault.** A fully filled example family that anyone can explore before (and after) signing up:
   - Ba's voice
   - her words beside suggested quantities
   - a handwritten page
   - a story
   - the lineage strip (Ba → Mom → you)

   It's static content shipped with the app, not a database family, so it can never leak into or read from real vaults.

3. **First recipe in two minutes.** After creating a vault, onboarding goes straight to "add one recipe you know by heart". The quick path is typing it in. Recording someone or photographing a diary page are the other options. Nobody lands on an empty vault.
4. **"I cooked it" moments, family only.** When you cook a family recipe, you add a photo and a note ("less sugar, kids loved it"). Moments show on the recipe and in a family activity strip. This is the brief's v2 "attempts" log, moved into v1.
5. **Later, not this phase:** curated public stories for marketing (opt-in families), and public recipes (v3).

## UI stack (additions, each with an ADR)

| Library             | Why                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| shadcn/ui on Radix  | Most-used React component approach. Accessible primitives, and we own the code, so it takes our tokens |
| Motion (motion.dev) | Small, purposeful animation: page and sheet transitions, record button, confirm moments                |
| lucide-react        | One consistent icon set                                                                                |
| Vaul                | Mobile bottom sheets (the native-app feel on phones)                                                   |
| Sonner              | Toasts for saved, sent and copied                                                                      |

The core stack is unchanged: Next.js, Supabase, Tailwind v4, Inngest and i18next. pnpm's supply-chain guard stays on.

## Design principles (the bar for every screen)

- **A family album, not a food blog.** Photos and voices are the heroes. Warm paper tones and serif headings, as in the approved `/style` page and ADR 0005.
- **Phone first.** On phones the app shell has bottom navigation (Vault, Add, Moments, You). Primary actions sit within thumb reach, and sheets are used instead of new pages for quick tasks.
- **Every screen has a designed state for each moment:**
  - an empty state that guides the next action
  - skeleton loading, not spinners
  - honest AI progress
  - a celebratory confirm, kept subtle
- **Elder-facing pages stay radically simple and light:**
  - at least 20pt text and 56px targets
  - one action per screen
  - no heavy libraries on `/record`; it has a performance budget and is checked in CI
- **Accessibility:**
  - WCAG AA contrast (already tested)
  - visible focus states
  - screen-reader labels
  - `prefers-reduced-motion` respected by every animation
- **Global:**
  - en, hi and gu for every string
  - logical CSS properties (RTL-ready)
  - Gujarati and Devanagari typography checked on every new component

## Workstreams and file ownership

Three sessions work in parallel. Ownership is by file, so branches don't collide. Each works in its own git worktree and merges through a PR with green CI.

| Workstream                            | Session                          | Owns                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Design system and first run**    | New "Design" chat                | `packages/ui` (new), `packages/ui-tokens`, `apps/web/src/components`, the app shell and layout, Phase 1 screens (`/`, sign-in, onboarding, vault home, people, members, invite, settings, `/style`), the sample vault (`apps/web/src/app/sample`, its content and media), and the moments UI |
| **B. Capture M4 and capture screens** | Existing "capture" chat          | `apps/web/src/app/record`, `apps/web/src/app/vault/[familyId]/capture*`, review and recipe pages, `jobs/`. M4 recipe page, then restyling its own screens on `packages/ui` once A1 is merged                                                                                                 |
| **C. Data contracts and review**      | This chat (the founding session) | `supabase/` (migration for moments and typed recipes, pgTAP tests), `packages/db` types, `packages/core` schemas for moments, the sample-vault content contract, and reviewing every PR against the brief                                                                                    |

Shared files (`packages/i18n/locales/*.json`, `CLAUDE.md`, `README.md`) are edited by everyone. Keep those edits small and grouped by key prefix (`ui.*`, `sample.*`, `moments.*`, `recipe.*`) to keep merges easy.

## Sequence

**Step 1, in parallel:**

- **A1. Design foundation.** Add the UI stack (ADRs), build `packages/ui`: buttons, inputs, sheet, dialog, toast, card, avatar, skeleton, tabs, menus and empty state. Build the app shell with mobile bottom navigation, and restyle the Phase 1 screens. **This is the PR B waits on before restyling.**
- **B1. M4 logic.** The recipe page's data, server code, corrections and version history, plus their tests, using the existing components. No visual polish yet.
- **C1. Contracts.** A migration adding:
  - `attempts`, i.e. moments: photo, note, rating, cooked_on, family-only RLS, with a storage path under `vault-images`
  - `create_typed_recipe()`, so a recipe can exist without a recording (the quick first recipe)
  - pgTAP tests (allowed and refused)
  - Zod schemas for moments
  - the sample vault's content contract (JSON shape) and copy in en, hi and gu

**Step 2, after A1 and C1 merge:**

- **A2. First run:**
  - the sample vault (`/sample`, open to everyone, linked from the landing page and from empty states)
  - two-minute first-recipe onboarding (typed, using `create_typed_recipe()`)
  - the moments UI ("I cooked it" sheet, moments on the recipe page, a family activity strip on vault home)
- **B2. M4 on the design system.** Restyle the record, review and recipe pages on `packages/ui`, then run Phase 2's done check.

**Step 3:** C reviews A2 and B2 against the brief and this plan, and the founder approves. Then Phase 3 (recipe experience and handover) begins.

## Done when

- A first-time visitor can explore the sample vault without an account, and it feels like a real family's.
- A new user creates a vault and has a first recipe in it within two minutes, without recording anyone.
- A family member can add an "I cooked it" moment with a photo. Only their family sees it, and pgTAP proves another family can't.
- Every Phase 1 and capture screen uses `packages/ui`, with light and dark mode, en, hi and gu, and phone and desktop.
- The `/record` page stays within its performance budget (CI check).
- All checks are green: lint, typecheck, unit tests, pgTAP, Playwright on phone and desktop, format.
