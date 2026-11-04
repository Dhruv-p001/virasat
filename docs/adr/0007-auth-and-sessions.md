# 0007. Sign-in and sessions

Status: Accepted · 2026-11-04

## Context

ADR 0005 chose phone OTP, email, Google and Apple. Sessions must work in Next.js server components, server actions and route handlers.

## Decision

- **`@supabase/ssr`** (Supabase's official Next.js package) stores the session in cookies.
  - `src/proxy.ts` refreshes the session on each request. In Next 16, `middleware` is renamed `proxy`.
  - It also redirects signed-out visitors away from `/vault`, `/onboarding` and `/settings`.
  - Authorisation is never done in the proxy; RLS does it.
- **Email** sends one message with both a link and a 6-digit code.
  - The link goes to `/auth/confirm`, which verifies a token hash on the server. It works on any device, unlike PKCE links, which only work in the browser that asked for them.
  - The code covers people who read email on one device and sign in on another.
- **Phone** uses a 6-digit SMS code. Locally, fixed test numbers (`+15555550100`, `+15555550101`, code `123456`) never send an SMS.
- **Google and Apple** use OAuth through `/auth/callback`. Their buttons appear only when `NEXT_PUBLIC_AUTH_PROVIDERS` lists them, so nothing half-configured is shown.
- **`server-only`** (a tiny official Next.js package) makes any import of the service-role client from client code a build error.
- **Post-sign-in redirects** go through `safeNextPath`, which allows same-site paths only (no open redirects).

## Hosted project setup (when the Supabase projects exist)

- Site URL is the app's domain. Redirect URLs are `https://<domain>/**`.
- The email templates "Magic link" and "Confirm signup" use `supabase/templates/sign_in.html`.
- An SMS provider is configured for phone sign-in (docs/open-decisions.md).
- The Google OAuth client and Apple Services ID are configured, then their names are added to `NEXT_PUBLIC_AUTH_PROVIDERS`.

## Consequences

The same sign-in screen serves new and returning users, and there are no passwords to manage or leak. Email deliverability matters, so production needs custom SMTP. Supabase's default sender is rate-limited.
