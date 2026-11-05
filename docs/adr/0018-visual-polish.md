# 0018. Pictures, backdrop and motion

Status: Accepted · 2026-11-10

## Context

The design system (ADR 0015) made the app clean and warm, but plain: flat colour, no imagery, little movement. The brief asks for a family album, not a food blog. This ADR adds atmosphere without costing the people the product is for anything: the elder's recording page must stay light, text must stay readable, and nothing may be needed to use the app.

## Decision

**Decoration only.** Nothing added here carries meaning, hides content, or has to load before the page works. Every piece is CSS or inline SVG, so there are no image files to download, and each works in light and dark.

**Backdrop** (`apps/web/src/app/globals.css`, ceilings in `packages/ui-tokens`).

- A soft accent glow in two corners and a faint paper grain, on a fixed layer behind the page (`body::before`, `z-index: -1`, no pointer events).
- The strengths are capped in `backdrop` (glow 5% and 4%, grain at most 8% opaque). A test works out the worst spot of the backdrop, with both glows and the densest grain speck on top, and requires every text colour to keep WCAG AA there, and outlines to keep 3:1, in both themes. Another test fails if the CSS exceeds the ceilings. Making the backdrop stronger means changing the numbers and passing the test, not bypassing it.

**Illustrations** (`@virasat/ui/illustrations`, `packages/ui`).

- Six small scenes drawn as inline SVG: a microphone, a handwritten page, a family at a table, a recipe card with a heart, a pot with a spoon, and an empty bowl.
- All colours come from the theme through `fill-*` and `stroke-*` classes, so there is one drawing for both themes. A test fails on any hard-coded colour.
- They are decoration (`aria-hidden`, not focusable). They are server components, so they ship no JavaScript.
- Used on the landing page (three steps: record, photograph, keep), sign-in, onboarding, the first-recipe screen, and the empty states for recipes, people, captures and moments. `EmptyState` takes an `illustration` in place of its small icon.
- **Original artwork, no stock or generated photos.** There are no licences to track and no real family's likeness to misuse.

**Printed-border ornament** (`rule-motif`). A row of small diamonds, drawn as a mask so it takes the accent colour. It sits under every page title and the landing section heading.

**Motion.** CSS, apart from the saved check below, which uses the existing Motion setup. All of it stops under `prefers-reduced-motion`: the one CSS rule covers the CSS, and Motion's own `reducedMotion` setting covers the check.

- `Reveal` lets blocks of a page settle in one after another (a short fade and rise). The recipe page uses it.
- Steam drifts in the illustrations.
- On the recipe page, a row of bars beside the recording moves only while it plays (`RecipeAudio`). The bars are a decorative stand-in for her voice, not a reading of it, and the player is still the browser's own.
- Saving a reviewed recipe shows the existing `ConfirmMoment` once on the recipe page (`?saved=1`). The marker is removed from the address straight away, so a reload or a shared link does not replay it.

**The elder's recording page** gets the backdrop's colour and nothing else. It imports no illustration and no motion, so its JavaScript budget (`pnpm check:record-budget`) is unchanged. A test fails if `/record` imports either.

## Consequences

- The grain is deliberately faint. Making it more visible would break the contrast ceiling, so a stronger look needs a different technique, not a higher number.
- The waveform bars always have the same shape. They show that a recording is playing, not what is in it.
- Hindi and Gujarati wording for the landing steps needs native-speaker review.
- Only the key screens have been dressed: landing, sign-in, onboarding, first recipe, vault home, the recipe page and the empty states. The capture screens and settings keep the plainer look until these have been judged.
- Photography is not part of this. Dish photos and portraits still appear in print-style mats where a family has added them.
