# 0004. When to build the Expo mobile app

Status: **Accepted** · 2026-11-03. Option 2, web-first.

## Context

The brief puts an Expo app for organisers and family members in v1. Elders never install anything, because they contribute through a web link. Shipping Expo in v1 brings EAS builds, store submission, NativeWind, Maestro E2E tests and a second UI codebase.

## Options considered

1. Follow the brief: Expo and web together in v1.
2. Web-first v1: Next.js as an installable PWA for organisers, with Expo in v2.

## Decision

Option 2.

- v1 is a Next.js PWA. The hero flow (the contributor link) is unchanged.
- Notifications use web push. Where web push is weak (iOS without the app installed to the home screen), they also go by WhatsApp or email.
- `apps/mobile` is scaffolded in v2 with `create-expo-app` on the then-latest stable SDK, and added to CI at that point.

## Consequences

- The v1 UI surface is roughly halved.
- Maestro mobile E2E tests move to v2. Playwright covers v1 flows on mobile-sized viewports.
- The v1 "done" criterion of submitting to TestFlight and Play internal testing is replaced by a PWA that installs and works on a low-end Android phone and on iPhone Safari.
