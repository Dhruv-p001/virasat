# 0003. Speech-to-text provider evaluation

Status: **Proposed**. The provider decision waits for results on real recordings.

## Context

Transcription quality on elderly Gujarati and Hindi speakers, who often code-mix with English, is the make-or-break metric (brief section 3). Recordings will mostly be 1 to 6 minutes long, recorded on phones as webm/opus (Android Chrome) or mp4/aac (iOS Safari).

Provider facts below were checked against vendor docs on 2026-11-03:

|                       | Sarvam                                                       | OpenAI                                                                     | Google                                         |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------- |
| Model                 | `saaras:v4`                                                  | `gpt-transcribe` (gpt-4o-transcribe is deprecated, shuts down 26 Feb 2027) | `chirp_3`                                      |
| Gujarati              | Supported (`gu-IN`)                                          | Not officially listed. Hinted via `languages[]`                            | Preview                                        |
| Sync limit            | 30 s                                                         | 25 MB, so one call per recording works                                     | 60 s                                           |
| Long-audio path       | Batch job API                                                | Not needed                                                                 | BatchRecognize. Audio must be in Cloud Storage |
| Price / min           | ₹0.49                                                        | $0.0045                                                                    | ~$0.016 standard (pricing page not confirmed)  |
| Training on API audio | Opt-out. Retention is indefinite until the workspace sets it | Not used unless you opt in                                                 | Off unless data logging is enabled             |

## Decision (method)

- **Adapters.** All three sit behind `TranscriptionProvider` in `packages/ai`. Sarvam and Google use their batch paths so a full recording goes in one piece. Chunking audio could cut words at the boundaries and would bias the comparison.
- **Harness.** `pnpm eval:stt` runs every configured provider on every recording in the gitignored `eval/stt/data/manifest.json`.
  - It reports word error rate (WER), character error rate (CER, over grapheme clusters) and latency.
  - Results are broken down by language (gu / hi / mixed). The recording environment is kept on each result row.
  - `--language=auto` tests detection, which the contributor link depends on. `--language=hint` tests the best case.
- **Normalisation before scoring.**
  - Ignored: punctuation, danda, case, Unicode composition, and Indic versus ASCII digits.
  - Kept: matras and virama, because they change the word.
  - Code-mixed English can show up in Latin script or in native script. Reference transcripts must pick one convention per recording, and the speaker's family should check it.
- **Eval set.** 10 to 15 recordings with recorded consent (enforced by the manifest schema), never committed to git. They should cover 80+ speakers, kitchen noise, cheap Android phones, and both Gujarati and Hindi.
- **Proposed decision criteria, in order:**
  1. Gujarati CER on 80+ speakers.
  2. Auto-detect accuracy.
  3. Hindi CER.
  4. Data terms.
  5. Cost.
  6. Latency. This matters least because the pipeline is asynchronous.

## Before sending any elder audio

- Sarvam: set workspace retention to 0 days and opt out of training. This must be done before the first upload, because it does not apply retroactively.
- Google: keep Speech-to-Text data logging off. Use a private bucket. The adapter deletes each object after transcription.
- OpenAI: the default is no training. Zero Data Retention is available if needed.

## Not yet verified against live APIs

The adapters are tested against mocked HTTP only. Two steps are inferred and need confirming on the first real run:

- Sarvam's file upload. It uses an Azure Blob SAS `PUT` with `x-ms-blob-type: BlockBlob`, which Sarvam's docs do not show.
- Google's operation polling URL (`GET /v2/{operation.name}`).

## Consequences

The winning provider becomes the default in the Phase 2 pipeline. The others stay behind the same interface as fallbacks. If no provider reaches acceptable Gujarati CER, the review screen becomes the core product surface, and Phase 2 UX has to change accordingly.
