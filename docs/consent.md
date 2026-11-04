# Consent for recording elders

Version `2026-11-v1` (`CONSENT_WORDING_VERSION` in `packages/core/src/capture.ts`). The text is in `packages/i18n/locales/*.json` under `consent`. Status: **approved by the founder, pending legal review and native-speaker review** (see `open-decisions.md`).

## What the elder sees (recording link)

Shown on one screen before the record button, in large text. In English:

> **Before you record**
>
> This recording is for your family. Only people in your family's vault can listen to it.
>
> A computer listens to it and writes your recipe down. The companies that do this don't keep your voice or use it for anything else.
>
> Your voice is kept safely in India. You can ask for it to be deleted at any time.
>
> [I agree. Start recording]

Tapping the button records two consents for that person through that link: `voice_recording` and `third_party_processing`.

## What the organiser confirms (recording in the app, sitting with the elder)

> ☐ Ba knows this recording is for the family, and agrees to it being recorded, written down and kept.
>
> If Ba changes their mind, you can delete the recording at any time.

The same two consents are recorded, given by the organiser on the elder's behalf. The elder's own consent through their link is kept separately, because it is the stronger proof.

## Handwritten pages

> A computer reads this page to type up the recipe. The original photo stays in your family vault.

This records a `third_party_processing` consent. Diaries of family members who have died are a common case. The organiser decides for the family.

## Promises in the wording, and what must stay true for them

Each sentence is a promise. If any of these conditions stops being true, the wording must change, and a new version must be issued.

| Promise                                                         | Condition                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only family vault members can listen                            | RLS on `media` and storage (ADR 0010). Public or link sharing of a recording (Phase 4) must ask again.                                                                                                                                                                             |
| The companies that process it don't keep it or use it otherwise | Every speech-to-text and LLM provider is set to zero or minimal retention, with training off. For example, Sarvam workspace retention is 0 days with training opted out (ADR 0003), and OpenAI and Anthropic API data is not used for training. Verify before adding any provider. |
| Kept in India                                                   | The Supabase project is in Mumbai (ADR 0005). Processing by a provider elsewhere is transient. Counsel to confirm the wording covers this.                                                                                                                                         |
| Can be deleted at any time                                      | The erasure flow (ADR 0010, "Not decided here") must ship before launch. Until then this promise is not yet backed by a feature.                                                                                                                                                   |

## Versioning rules

- Any change to the meaning needs a new version string. Typo fixes in one language don't.
- Consents are stored per version (`consents.wording_version`), so earlier recordings keep pointing at the text that was agreed to.
- A new version doesn't invalidate past consents. Whether to re-ask is a product and legal decision, made at that time.

## Recording limit

Each recording is at most 10 minutes (`MAX_RECORDING_SECONDS`), which is enough for one recipe told slowly. At 10 minutes the recorder stops and keeps everything, and the elder sees `consent.limitReached`. Files are capped at 50 MB, and a 10-minute phone recording fits well within that.
