# 0006. Test RLS with pgTAP

Status: Accepted · 2026-11-04

## Context

The brief requires a test for every RLS policy, showing both allowed and denied access. Phase 1 is done only when tests prove that two families cannot see each other's data under any query.

## Decision

- Write database tests in pgTAP, run by `supabase test db`.
  - pgTAP is a Postgres extension that ships with Supabase. It is not an npm dependency.
  - The tests run inside the database, so they exercise exactly the policies, triggers and grants that production uses, with no client in between.
- Tests live in `supabase/tests/database/`.
  - `00_helpers.test.sql` installs a `tests` schema with fixed fixtures (the Shah and Patel families) and `tests.authenticate_as(name)`, which switches to the `authenticated` role with that user's JWT claims, the way PostgREST does.
  - Every other file runs in a transaction and rolls back.
- CI runs them in the migrations job, after `db reset` and `db lint`.
- Server-only SQL functions (`create_invite`, `accept_invite`, `revoke_invite`) take the acting user as a parameter and can be executed only by `service_role`.
  - Next.js API routes call them after verifying the session.
  - The tests check both sides: clients get a permission error, and each function enforces its own rules.

## Consequences

- Every migration that adds a table or policy must add pgTAP tests in the same PR.
- The `tests` schema exists only in local and CI databases, never in production.
