# 0012. How an elder's recording reaches the server

Status: Accepted · 2026-11-05

## Context

ADR 0010 left one question open: signed upload URLs are a single request, not resumable (TUS), so how should an elder on a slow 3G connection upload a recording? The elder has no account and no app, and a 10-minute recording is a few MB (64 kbps opus is about 4.8 MB).

Two facts from the schema shaped the answer:

- `begin_capture()` spends one of the link's uploads when it is called, not when the file arrives.
- Nothing moved a job from `awaiting_upload` to `uploaded`.

## Decision

**No chunking for now. Keep the recording on the phone until the server has confirmed it, and retry the whole upload.**

1. **While recording**, the audio is held in memory by `MediaRecorder`. When she stops, the whole recording is written to IndexedDB first (memory as a fallback where IndexedDB is unavailable). Nothing is sent before it is safe on the phone.
2. **`startUpload`** (server action, token only) calls `begin_capture()` and returns a signed upload URL. The browser stores the job id straight away. Every retry reuses that job. A retry never calls `begin_capture()` again, so a flaky connection cannot use up the link.
3. **The recording goes straight to storage** with a multipart PUT to the signed URL. It never passes through Next.js, so there is no body size limit to hit and no server time spent.
4. **`refreshUpload`** (server action) issues a new signed URL for the same registered path when the old one expired. It checks that the job belongs to the link in the URL, that the link is not revoked and that the job is still `awaiting_upload`. These URLs allow replacing the file, because the only file that can be there is this capture's own unconfirmed copy, for example a partial one. After confirmation no URL is issued.
5. **`confirm_upload()`** (new SQL function, migration `confirm_upload`) checks that the file exists in storage with exactly the registered size, then sets `uploaded`. If it is not there in full, the browser sends it again. If the browser reports success but the file is missing or the wrong size, nothing proceeds.
6. **Only then** is the recording removed from IndexedDB.
7. **Retries** use backoff (2s, 4s, ... capped at 60s) and wake up on the browser's `online` event. On the next visit, any recording still waiting is found and finished first, before the consent screen.
8. **Giving up.** After six refused URLs or incomplete confirmations in a row the page stops and says something went wrong. The recording stays on the phone with a "try again" button.

The retry logic is in `packages/core/src/upload.ts`, free of browser APIs, so its behaviour is covered by unit tests.

**An invalid link still resumes.** The page renders the recorder even for a link that is revoked, expired or used up, because the last allowed upload may still be in flight. `startUpload` is what refuses a new capture. `confirm_upload()` accepts the last upload (it does not check uploads left) but refuses a revoked link.

## Known limits

- If the response to `begin_capture()` is lost, the retry registers a second capture and spends a second upload. The first stays `awaiting_upload` and is never confirmed. This is rare and costs only one upload of up to 50 per link. Fixing it needs an idempotency key on `begin_capture()`; not done.
- A recording that is in progress (not yet stopped) is lost if the tab is killed. Chunks are not persisted while recording.
- Without IndexedDB (some private modes) the recording survives only while the tab is open.

## When to revisit

If testing on real slow connections shows failed uploads that a whole-file retry cannot get through, switch to TUS with a short-lived scoped token for the capture, or chunk the upload. `PendingUpload` and the `UploadApi` seam are where it would change.

## Consequences

- One new service-role-only function with pgTAP tests, allowed and denied. No table, policy or client grant changes.
- Nothing about the recording page needs a login, a cookie or a library.
