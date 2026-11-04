# 0008. Translations at runtime

Status: Accepted · 2026-11-04

## Context

The brief picks i18next with shared translation files. The web app uses React Server Components, so translations must work on the server and in client components.

## Decision

- Translation files live in `packages/i18n` (en, hi, gu). A test checks that every language has the same keys and placeholders.
- **On the server**, `getT()` creates an i18next instance per request.
- **In the browser**, **react-i18next** (i18next's official React binding) provides `useT()` in client components.
  - The server passes only the active language's strings, not all three, to keep pages light on slow phones.
- **Language choice:**
  1. A signed-in user's profile language.
  2. Otherwise, the `virasat_lang` cookie set by the language picker.
  3. Otherwise, the browser's `Accept-Language`.
  4. English as the fallback.
- **No language in the URL.** App pages are private and not indexed. Public share pages (Phase 4) may add one if SEO needs it.
- **Typed keys.** Translation keys are type-checked (`src/i18next.d.ts`), so a typo fails the build. Keys that arrive at runtime, such as server action messages, go through `useMessage()`, which falls back to a generic error rather than showing a raw key.
- `<html lang dir>` follows the language. Right-to-left languages only need adding to the RTL set, because layouts use logical CSS properties.

## Consequences

Adding a language means a JSON file, one line in `LanguageSchema` and a native-speaker review, with no component changes.
