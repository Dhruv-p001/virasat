# 0014. Organiser capture and the review screen

Status: Accepted · 2026-11-07

## Context

ADR 0012 covers the elder's upload through a recording link. M3 adds the organiser's side: recording in the app next to the person, photographing handwritten pages, and the review screen where a person checks what the pipeline (ADR 0013) made and confirms it. Rules that shape it:

- Raw media is never changed. Processing makes derived copies (ADR 0009).
- The AI never publishes. Only a person's confirmation makes a recipe (`confirm_capture`).
- Clients never write capture or recipe tables (ADR 0010).
- The page reader (Claude) takes JPEG, PNG or WebP, at most 5 MB per image. A phone photo is often bigger, rotated by metadata the reader ignores, or HEIC.

## Decision

**The organiser's upload reuses the elder's design, with the session as the credential.**

- `runCaptureUpload` (`packages/core`) is the batch version of `runUpload`: register once, send every file by signed URL, confirm, and forget it on the device only after the server confirms. A retry reuses the same capture. It is free of browser APIs and unit-tested.
- The capture waits in IndexedDB (`virasat-organiser-captures`), separate from the elder's store. A closed tab or dropped connection is finished on the next visit to that person's capture page.
- Three server actions (`startCapture`, `refreshCapture`, `confirmCapture`) check the session and call `begin_capture`, `add_capture_media` and `confirm_upload` with the organiser as actor. Files never pass through them.
- The organiser ticks the consent wording from `docs/consent.md` (`consent.organiserCheckbox`, or `consent.scanNote` for pages) before anything is recorded or sent. `begin_capture` records it as given via the organiser.

**Handwriting: pages up to four, each with a readable copy made in the browser.**

- Each page is stored exactly as chosen (`handwriting_scan`). The browser also makes a copy: upright (the photo's rotation applied), JPEG, longest side at most 2000 px, under 5 MB (`derived_scan`, pointing at its original). A copy is always made, not only when a photo is large, because rotation metadata matters for every phone photo.
- The pipeline reads the copy where there is one and the original otherwise (`readableMedia`). The original is never replaced.
- A page this browser cannot open (HEIC outside Safari) is refused at the picker with a plain message, rather than failing later as "enter it by hand".

**Schema (migration `capture_pages_and_copies`).** No table, policy or client grant changes.

- `add_capture_media()` (service-role only) registers a further page or the copy of a page, only for the organiser who started the capture and only while it awaits its files. It enforces four pages, copies of JPEG/PNG/WebP up to 5 MB, one copy per page, and handwriting only.
- `confirm_upload()` now checks that every registered file is in storage at its registered size, not just the first, and that a handwriting page the reader cannot take as it is has its copy.
- pgTAP: `07_capture_pages.test.sql`, allowed and denied.

**The review screen** (`/vault/[familyId]/captures/[jobId]`).

- Writers only. Viewers and other families get a 404, enforced by RLS on `capture_jobs`.
- The original sits beside the draft: the audio player (signed URL) or the page images (the copies), and the transcript or what was read.
- The form's model is in `packages/core` (`review.ts`), tested without React. Parts the draft marked uncertain, and the pipeline's own flags, are highlighted per row, so a highlight stays with its row when rows are added or removed.
- Ingredients keep the speaker's words as a required field. A suggested amount is optional, sits beside them, and loses its confidence number when a person changes it.
- Confirming validates in the browser and again on the server (`ReviewContentSchema`), then calls `confirm_capture`. A confirmed version stores no uncertain fields: a person has checked everything. The AI's draft and its flags stay on the capture.
- A failed capture opens the same form empty, with what was heard in the first step to be split up, and a note saying why.

## Consequences

- A registration that fails halfway (rare) leaves an empty capture waiting for files. It is invisible and harmless: the waiting list shows captures only once their files are confirmed.
- Pages are read in the order they were added. There is no reordering yet, only removal.
- Always making a copy sends a second, smaller file per page. The original and its copy are separate uploads, both retried until confirmed.
- The organiser's consent is a checkbox in the browser; the server records the wording version it was given but cannot see the tick. This matches the elder's flow.
- Real-provider quality is still unverified (no API keys): the review screen has been exercised only against the mock providers' fixed sample.
- Hindi and Gujarati wording for the new screens needs native-speaker review.
- The confirmed state shows a short "saved" page. The recipe page itself is M4.
