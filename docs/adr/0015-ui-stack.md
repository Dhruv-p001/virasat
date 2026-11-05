# 0015. UI stack: shadcn/ui, Motion, lucide-react, Vaul, Sonner

Status: Accepted · 2026-11-05 (Phase 2.5 plan, workstream A)

## Context

Phase 1 screens were built on a handful of hand-written components. The family-album feel needs
accessible sheets, dialogs, menus, tabs and toasts, small purposeful animation and one icon set.
Writing focus management, scroll locking and screen-reader semantics ourselves is where
accessibility bugs come from. The brief's rule is no libraries outside the stack without a reason
and an ADR.

## Decision

A new workspace package `@virasat/ui` holds the shared components. The core stack (Next.js,
Supabase, Tailwind v4, Inngest, i18next) is unchanged.

| Library                      | Version      | Used for                                                                    |
| ---------------------------- | ------------ | --------------------------------------------------------------------------- |
| `radix-ui` (shadcn/ui basis) | 1.8.1        | Accessible primitives: dialog, dropdown menu, tabs, visually-hidden, slot   |
| `vaul`                       | 1.1.2        | Bottom sheets on phones (drag to dismiss, native feel)                      |
| `sonner`                     | 2.0.8        | Toasts for saved, sent and copied                                           |
| `motion`                     | 14.9.0       | Page and confirm transitions, via `LazyMotion` and the small `m` components |
| `lucide-react`               | 1.67.0       | One icon set, imported by name so unused icons are dropped                  |
| `clsx`, `tailwind-merge`     | 2.1.1, 3.7.0 | The `cn()` class helper that shadcn components use                          |

shadcn/ui is not a dependency. Its components are copied into `packages/ui` and edited, so they
use our tokens and logical properties. Radix is installed as the single `radix-ui` package.

**Versions.** Each is the newest release at least two days old on 2026-11-05 (Motion 14.9.1 and
lucide-react 1.68 to 1.69 were under a day or two old, so one release back). pnpm's
supply-chain guard stays on with no `minimumReleaseAgeExclude`.

**Components are imported by path** (`@virasat/ui/sheet`), never through a barrel file, so a page
only bundles what it uses.

## Rules that follow

- **Elder pages stay light.** `/record` may import only dependency-free components (today:
  `Avatar`). A CI check (`pnpm check:record-budget`) fails the build if the page's first-load
  JavaScript passes its budget.
- **One reduced-motion guard.** `MotionConfig reducedMotion="user"` wraps the app shell, and the
  stylesheet zeroes CSS transitions and animations under `prefers-reduced-motion: reduce`. No
  component animates around it.
- **Logical properties only** in `packages/ui` (`ms`, `pe`, `text-start`, `start-0`), so
  right-to-left languages work later without rework (ADR 0005).
- **Strings are never baked in.** Components take text as props; the app passes i18n strings.

## Consequences

- Signed-in screens ship more client JavaScript (Radix, Vaul, Sonner). `/record` ships none of it: after A1 it measures 195.5 KB gzipped in total, and the CI budget is 215 KB.
- Pages use `loading.tsx` sparingly. A `loading.tsx` makes Next stream the page, so a `notFound()` after it answers 200 instead of 404, which the viewer and cross-family e2e tests (rightly) refuse. Slow parts of a page use `Suspense` skeletons inside the page instead.
- Capture screens move from `components/ui.tsx` to `@virasat/ui` after A1 merges. `ui.tsx`
  stays as a thin re-export of the server-safe components until then, so nothing breaks.
- Upgrading a Radix primitive means retesting focus and keyboard behaviour in the Playwright
  phone and desktop projects.
