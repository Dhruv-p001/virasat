# 0004. When to build the Expo mobile app

Status: **Proposed**. Needs a founder decision before Phase 1 UI work.

## Context

The brief puts an Expo app for organisers and family members in v1. Elders never install anything, because they contribute through a web link. Shipping Expo in v1 brings EAS builds, store submission, NativeWind, Maestro E2E tests and a second UI codebase.

## Options

1. **Follow the brief:** Expo and web together in v1.
2. **Web-first v1:** Next.js as an installable PWA for organisers, with Expo in v2.
   - Roughly halves the UI surface.
   - The hero flow (the contributor link) is unchanged.
   - Cost: weaker push notifications on iOS, which need the PWA installed to the home screen. Notifications like "recipe ready for review" and "you received a recipe" would also go by WhatsApp or email.

## Status

`apps/mobile` is deliberately not scaffolded in Phase 0. That way neither option creates throwaway work. If option 1 is chosen, scaffold it with `create-expo-app` on the latest stable SDK and add it to CI.
