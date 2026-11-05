# 0017. The recipe page

Status: Accepted · 2026-11-09

## Context

M3 ended on a temporary "saved" page: a confirmed recipe could not be opened. Phase 2.5 drew the recipe page on the example vault (`/sample/recipes/[slug]`, ADR 0015). This ADR covers the real one, flow D in the brief.

## Decision

**One page, `/vault/[familyId]/recipes/[recipeId]`, built to match the sample page.**

- It reads through RLS as the signed-in user (`lib/recipes.ts`). A recipe in another family, or one that does not exist, is a 404. Any member can read it, viewers included. Only writers see "I cooked it".
- It shows the current version. The original recording and handwriting belong to the original version and stay with the recipe through later corrections, so media is read from `root_version_id`.
- **Her voice comes first.** The recording plays from a signed URL with the browser's own controls (`preload="metadata"`, so the length shows). If the file was removed after a consent withdrawal, the row stays and the page says so in place of the player. The written recipe is untouched (ADR 0005).
- **Their words are the ingredient.** Each line shows `original_text` in quotes. A suggested amount sits beside it (`suggestionLine`, now in `packages/core` and shared with the sample page). When no amount was suggested, nothing is shown: the page never fills a gap.
- **Handwriting** shows each page as the reader saw it: its readable copy where there is one (`readableMedia`), else the original. A HEIC page that has no copy and cannot be shown says so, and stays safely in the vault.
- **Typed recipes** have no audio and no scan, and the page shows neither. Their source reads "Typed from memory".
- The recipe's own moments appear at the bottom (`listRecipeMoments`), through the existing `attempts` policy.
- **Left out on purpose:** the lineage strip, which needs handovers (Phase 3), and dish photos on the recipe, which have no way to be added yet. The page does not show sample data in their place.

**Wiring.** Vault recipe cards link to it. Saving on the review screen goes straight to it, and `confirmReview` returns the new recipe's id. A capture that is already confirmed redirects to its recipe. The temporary saved page and its strings are removed.

**No schema change.** Recipe, version, media and moment reads were already covered by RLS and its pgTAP tests.

## Consequences

- **Corrections and version history have no screen yet.** `publish_correction` exists. The page shows the current version without saying whether it is a correction.
- Suggested amounts show as the AI wrote them. Converting to each viewer's units (ADR 0005) is not built.
- Signed URLs last an hour. A page left open longer needs a reload to play or show images again.
- Real-provider quality is still unverified (no API keys). The page has only been exercised with the mock providers' fixed sample and with typed recipes.
- Hindi and Gujarati wording for the new strings reuses the sample page's words where it overlaps, and needs native-speaker review for the rest.
