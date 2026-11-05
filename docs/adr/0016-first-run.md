# 0016. First run: example family, first recipe, moments

Status: Accepted · 2026-11-05 (Phase 2.5, workstream A2)

## Context

A new visitor who has not recorded anyone yet sees an empty app (the brief's biggest risk is low
engagement). Phase 2.5 gives them something real to look at, a fast first win, and a reason for
the family to come back. Everything stays private by default; there is no public feed.

## Decisions

- **The example family is static and public.** `/sample` renders the validated
  `sampleVault` content (`packages/core`, contract owned by workstream C). It reads nothing from
  the database, so it can never leak into or out of a real vault. It is linked from the landing
  page and the vault's empty states, and its pages are `generateStaticParams` routes.
- **Placeholder media, clearly labelled.** The ten files named in `pendingAssets` do not exist
  yet. Nine are illustrations drawn by `pnpm --filter @virasat/web sample:placeholders` and
  stamped "Example". Ba's recording is not faked: the player shows an honest "on its way" note
  until a real file is placed at its path (`sampleAssetExists`). Real, consented material
  replaces the files with no code change.
- **Nobody lands on an empty vault.** Creating a vault goes to `/vault/{id}/recipes/new?first=1`:
  one recipe typed from memory, in the cook's own words, saved through the service-role
  `create_typed_recipe()` (ADR 0010). Recording and photographing stay one tap away; skipping
  lands in the vault, whose empty Recipes section points back.
- **Moments use ordinary RLS writes.** "I cooked it" inserts as the member (policy
  `attempts: writers add their own`), the browser uploads the photo to
  `vault-images/{family}/moments/{id}/`, and a second call records the path. If the photo fails,
  the note is kept and the person is told. Removal goes through `remove_moment()`.
- **Components are shared with the recipe page.** `MomentCard`, `LineageStrip` and `CookedSheet`
  take translated text and plain data, so the capture workstream's recipe page can use them.

## Consequences

- The vault home lists recipes by title only. Recipe pages arrive with workstream B; until then
  the cards are not links.
- The e2e helper `createVaultAs` and the auth spec now pass through the first-recipe step.
- Moments need a recipe, so the Moments page of a vault with none leads to "Add a recipe".
