# 0002. Toolchain versions and Phase 0 conventions

Status: Accepted · 2026-11-03

## Context

The brief fixes the stack but not versions. Versions were checked against the npm registry on 2026-11-03.

## Decision

- **Node 24**, **pnpm 12.16.1**, **Turborepo 2.11**.
- **TypeScript 6.0.3, not 7.0.** typescript-eslint 8.72 supports TypeScript below 6.1 only. TypeScript 7 (the native compiler) would mean dropping type-aware linting, and that linting is part of how the brief's "no `any`" rule is enforced. Revisit once typescript-eslint supports 7.
- **ESLint 9.39** with the `strictTypeChecked` preset. ESLint 10 is out, but eslint-config-next and its plugins have not been verified against it yet.
- **Next.js 16.4, React 19.3, Tailwind 4.3, Zod 4.6, Vitest 5.0.**
- **pnpm's supply-chain guard stays on.** pnpm refuses package versions published within the last day, which is how compromised releases usually spread.
  - No `minimumReleaseAgeExclude` entries.
  - If a just-published version is wanted, wait out the window rather than adding an exception.
  - Amended 2026-11-04: the Phase 0 install had silently added exceptions for Tailwind 4.3.4 and Vitest 5.1.0. Both are now pinned to their previous releases (4.3.3, 5.0.5) and the lockfile was rebuilt.
- **Internal packages ship TypeScript source** (`exports` points at `src/index.ts`). There is no build step per package. Next compiles them via `transpilePackages`.
- **Scripts run on Node's native TypeScript support.** Imports use explicit `.ts` extensions, and `erasableSyntaxOnly` is on, so `enum` and parameter properties are not allowed. No `tsx` dependency.
- **Design tokens** live in `packages/ui-tokens/src/tokens.ts`. `theme.css` (the Tailwind v4 `@theme`) is generated from them and committed, and a test fails if it drifts from the tokens. Another test checks that every text colour meets WCAG AA contrast in both light and dark mode.
- **pnpm is installed globally** on dev machines (`npm i -g pnpm@12.16.1`). In CI it comes from `pnpm/action-setup`, which reads `packageManager`.

## Consequences

- The first lint and typecheck runs are slower because they are type-aware. That is acceptable at this size.
- Upgrading TypeScript to 7 needs its own ADR.
