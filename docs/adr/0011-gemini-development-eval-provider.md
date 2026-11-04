# 0011. Gemini as a development evaluation provider

Status: Accepted · 2026-11-05

## Context

Structuring and handwriting reading run on Claude (brief section 3, ADR 0009). The real-API eval needs an Anthropic key, and none was available when this was written, but a free-tier Gemini key was. Running the pipeline against a real model on synthetic data is still worth doing: it exercises the prompts, structured-output handling, retries and scoring against something other than a mock.

This does not change the production provider. Claude stays the structurer. Gemini only sits behind the same `ModelClient` seam as a second implementation.

## What was found (tested 2026-11-04)

The key starts with `AQ.` (53 characters), not `AIza`. That looked like a Vertex AI express-mode key. It is not a reliable signal:

| Mode                                                                   | Result                                                                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini Developer API (`new GoogleGenAI({ apiKey })`)                   | **Accepted.** Model list and `generateContent` with a response JSON schema both work.                                                                                 |
| Vertex AI express mode (`new GoogleGenAI({ apiKey, vertexai: true })`) | **Rejected.** Model list returns 401 "API keys are not supported by this API". `generateContent` returns 403: the Vertex AI API is not enabled for the key's project. |

Model availability on the Developer API: `gemini-2.5-flash` returns 404 ("no longer available to new users"). `gemini-3.5-flash` works. `gemini-3.8-flash` and `gemini-3.1-flash-lite` each returned a transient 503 "high demand" on one try.

## Decision

- **Default to the Developer API**, because it is the mode this key works in.
- **The mode is configurable.** `GEMINI_API_MODE=developer` (default) or `vertex-express`. Anything else is an error, not a silent default. `vertex-express` is covered by a request-shape unit test only. It has not been run against a live key, so treat it as untested.
- **Default model `gemini-3.5-flash`**, thinking level `low`, overridable with `--model` and `--thinking`. The SDK retries 408, 429 and 5xx (4 attempts), since 503s are common on the free tier.
- **Dependency: `@google/genai` 2.32.0, pinned exactly.** It is outside the brief's stack list and is added for this eval provider only. It is not used by app code. Its install scripts (docs and test tooling) and `protobufjs`'s optional helper are not needed, so both are explicitly denied with `allowBuilds: false` in `pnpm-workspace.yaml`. Without a decision pnpm 12 fails `install --frozen-lockfile`, and with it CI.
- **How it is used:** `pnpm eval:structure --provider=gemini`. Claude remains the default provider. Gemini scores say how the pipeline and prompts behave on another model, not how Claude scores.

## Data-use terms, and the synthetic-only rule

The rule from the `.env` note stays in force: **only synthetic data goes to Gemini.** Neither mode changes that.

- **Developer API.** The [Gemini API Additional Terms](https://aistudio.google.com/docs/terms) (effective 2026-03-23) say that for unpaid services Google may use inputs and outputs to improve its products, and human reviewers may read, annotate and process them (disconnected from the account, API key and project first). They say "Do not submit sensitive, confidential, or personal information to the Unpaid Services". For paid services, Google says it does not use prompts or responses to improve its products and logs them for a limited time. Nothing in the key shows which tier it is on. It is treated as unpaid, as the `.env` note says.
- **Vertex AI express mode.** The [express mode overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview) says express mode is subject to the Pre-GA Offerings Terms ("as is", limited support) and says nothing about data use. The Vertex [data governance page](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance) says Google does not train on customer data without permission, with caches deleted within 24 hours, but it does not mention express mode or the free tier, so it cannot be assumed to cover it. The terms for express mode data use are therefore **unverified**.

So express mode would not loosen the rule: its terms are unconfirmed, and the mode does not work with this key anyway. Revisit only on the founder's decision, with written confirmation from Google or a paid tier.

**Guards, so the rule does not rest on memory:**

- `eval:structure` holds back every case in `eval/structure/data/` (real family transcripts) from any provider other than Claude and the mock, and says so in its output. `casesForProvider` is unit tested.
- `.env.example` carries the same warning next to `GEMINI_API_KEY`.
- Gemini is not wired into the capture pipeline, and it is not a sub-processor of family data. Consent wording (`docs/consent.md`) makes promises about Claude and speech-to-text processing only.

## First live results

Six synthetic cases, `gemini-3.5-flash` via the Developer API, thinking `low`:

|                           |                                                             |
| ------------------------- | ----------------------------------------------------------- |
| Ingredient recall         | 100%                                                        |
| Invented items            | 0                                                           |
| `original_text` preserved | 100%                                                        |
| Uncertain-field recall    | 50%                                                         |
| Uncertain-field precision | 50%                                                         |
| Manual-entry results      | 0 of 6                                                      |
| Tokens                    | 5,649 in, 2,170 out (thinking included), 3 to 19 s per case |

The pipeline works against a live model, including structured output and a retry. Flagging unclear parts is the weak spot: three of six cases missed an expected flag or raised an unexpected one. A first smoke run needed one retry. These are Gemini numbers on six synthetic cases, so they are a smoke test and not a benchmark. The run against Claude is still to do.

## Consequences

- If Gemini ever becomes a production candidate, it needs its own ADR: paid-tier terms, data residency (ADR 0005, India), and consent wording.
- The key is in a gitignored `.env` and is never printed. Rotate it if it leaks.
- A second `ModelClient` shows the seam holds: nothing outside `packages/ai/src/structuring/gemini/` and the eval runner knows about Gemini.
