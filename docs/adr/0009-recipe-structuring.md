# 0009. Recipe structuring and handwriting reading

Status: Accepted · 2026-11-04 · Amended 2026-11-05 (see Amendment 1)

## Context

Brief section 7 says transcripts and photographed handwriting become a `StructuredRecipe`, and that the AI never publishes on its own: a person reviews the draft. The output has to keep the speaker's words ("andaaz"), never invent anything, and be honest about what is unclear. Failures must never lose the transcript or crash the pipeline.

## Decision

- **Two interfaces in `packages/ai`:** `RecipeStructurer` (transcript, language hint and speaker in; recipe out) and `HandwritingReader` (page images in; recipe out). Claude implements both with `claude-sonnet-5-5`, through the official `@anthropic-ai/sdk`, pinned exactly. App code depends on the interfaces.
- **A narrow `ModelClient` seam.** One user turn in, one JSON answer out. `ClaudeModelClient` is the only file that imports the SDK. Unit tests use a scripted fake, so CI needs no API key.
- **Structured output by `output_config.format`.** The schema comes from the Zod contract through the SDK's `zodOutputFormat`, which closes every object and moves constraints the API does not support (such as `minLength` and the pointer pattern) into field descriptions. Those constraints are enforced by our own Zod parse and retry instead. A forced tool call was the first design and does not work: `claude-sonnet-5-5` answers `tool_choice` `tool` or `any` with a 400. The SDK retries 429s, 5xx and timeouts itself.
- **The contract is unchanged.** `StructuredRecipeSchema` in `packages/core` already fits. Rules a schema cannot express are checked in `packages/ai` after parsing (below). The handwriting answer is `{ transcript, recipe }`. The page text is a sibling of the recipe, not a field of it, because a transcript belongs to the capture job, not to the recipe version.
- **Every response is validated, never trusted.** The result is a union:
  - `ok`: the validated recipe, the text it was built from, pointers that were auto-flagged, usage and prompt version.
  - `needs_manual_entry`: a reason (`empty_input`, `invalid_input`, `invalid_output`, `truncated`, `refused`, `provider_error`), the transcript, the failed paths, usage and prompt version.
  - Invalid output is retried up to 3 attempts in total. A cut-off answer (`stop_reason: max_tokens`, `truncated`) and a safety refusal (`refused`, with the category such as `general_harms` in `issues`) are not retried, because the same request would fail the same way. Each retry lists the failed paths ("ingredients.2.suggested_unit: …") and none of the content. After the last attempt the result is `needs_manual_entry`. Provider errors that survive the SDK's retries end the same way and are not retried again. Nothing throws. The transcript is always returned, and an empty one never reaches the model.
- **Rules enforced in code, on top of the prompt:**
  - Suggested units are metric: `g`, `kg`, `ml`, `l`, and `piece` for countable things. Spoons and cups are not metric, so they are rejected as suggestions and the model is asked again. The speaker's own measure stays in `original_text`.
  - `uncertain_fields` pointers that do not resolve to a real part of the recipe are dropped, so the review screen never highlights nothing.
  - An ingredient whose `original_text` is not found in the source text as whole words (compared after case, punctuation, Unicode and Indic-digit normalisation, so "namak" does not match inside "namakeen"), or a step with fewer than half of its words in the source, is added to `uncertain_fields` and reported in `autoFlagged`. It is flagged, not rejected: a reviewer can compare it with the audio. The step check is a coarse net for invented or translated steps, not a proof, since steps are tidied and may reword.
  - **Handwriting caveat: the invention check there is circular.** For handwriting the source is the transcript the model read off the page, so the checks only catch drift between the recipe and the model's own reading. A misread word is in both and passes. Review against the image is the safeguard, and the review screen must show the scan beside the draft.
- **Prompts are code.** `prompts/structure.v2.ts` and `prompts/handwriting.v2.ts` share `rules.ts`. Each exports a version string that is returned with every result, and a test pins a hash of each system prompt to its version, so the text cannot change without a version bump. Tests pin the non-negotiable instructions: no invention, verbatim `original_text`, metric suggestions beside the original, JSON-pointer flags, original-language dish names, story, and treating the source as data. Weakening a rule fails a test. Changing wording means a new version and an eval run.
- **The transcript and speaker are untrusted input.** They are wrapped in tags and XML-escaped (`&`, `<`, `>`), so a transcript containing `</transcript>` cannot close its tag. Names are flattened to one line and capped at 100 characters. The system prompt says the text is escaped, to read it as the characters it stands for, and to ignore instructions inside it. An escape was chosen over a random delimiter because it keeps the prompt deterministic.
- **Images are checked before the call.** Handwriting images must match their declared type by magic bytes (JPEG, PNG, GIF, WebP), be at most 5 MB each, 20 MB in total and 8 pages. Failures return `invalid_input`, not a provider error, and the API is never called.
- **Usage, not logs.** Each result carries `{ model, calls, inputTokens, outputTokens }` summed over retries. The package logs nothing. Issues and errors carry schema paths and error class names, never recipe content, so nothing from a family reaches logs or analytics through this package.
- **Evaluation.** `pnpm eval:structure` scores a recipe against a hand-checked answer:
  - _Ingredient recall_: expected ingredients found, matched on `original_text`.
  - _Invented items_: output ingredients that are neither expected nor in the transcript, plus any per-case forbidden word that shows up in ingredients, steps or tips. Each case lists words the speaker never said (for example salt, when salt was not mentioned). The target is zero.
  - _original_text preserved_: share of output ingredients whose `original_text` is verbatim in the transcript.
  - _Uncertain-field recall and precision_: expected pointers (the answer key's own `uncertain_fields`) against the output's. Ingredient pointers are followed by text, not by index, so reordering is not penalised, and a pointer to a whole ingredient covers its fields.
  - Six synthetic cases are committed in `eval/structure/cases/` (Gujarati, Hindi, romanised Hindi, English, a recipe with forgotten and unrecognised parts, and a memory with no recipe in it). Real family transcripts go in `eval/structure/data/`, in the same format, gitignored like the STT recordings. Answer keys are checked when loaded: each expected `original_text` must be in its transcript and no forbidden word may be.
  - `--mock` hands each case its own answer through the real structurer, so every score must be 100%. It checks the harness and the validation path and needs no key. Without it the runner calls Claude with `ANTHROPIC_API_KEY` and reports tokens. A run in CI would need a key, so real runs are manual, as `eval:stt` is.

## Consequences

- Swapping the model or provider means a new `ModelClient`, not a change to app code.
- The scores measure recall and traceability, not whether a step was paraphrased well. Step quality is reviewed by people on the review screen. Steps are checked only for invention through the forbidden words.
- Handwriting has no eval cases yet. It needs real photographs and family consent. The reader is covered by unit tests with the fake client, and a real-image case set should be added once such pages are collected.
- The metric-only rule drops spoon and cup suggestions. If families find that unhelpful, add `tsp` and `tbsp` to `METRIC_UNITS` and the prompt tests in one change.
- Pass handwriting images as a derived, downscaled copy. The original scan is never changed (brief section 3), and the API limits image size.

## Amendment 1 (2026-11-05): review fixes

A review of the first version found that it could not work against the real API. What changed and why:

- **No forced tool call.** `claude-sonnet-5-5` rejects `tool_choice` `tool` and `any` with a 400, so every real call would have failed into `provider_error`. The client now uses structured outputs (`output_config.format`). Unit tests assert that the request carries no `tool_choice` or `tools`.
- **Stop reasons are read.** `max_tokens` becomes `truncated` and `refusal` becomes `refused`. Neither is retried.
- **Thinking and effort are chosen, not defaulted.** Sonnet 5.5 thinks adaptively, and thinking counts against `max_tokens`. Extraction follows rules written in the prompt, so deep reasoning adds cost and truncation risk rather than accuracy. The client sends `output_config.effort: "medium"` (overridable, and `pnpm eval:structure --effort=low` compares) and leaves thinking at its default. `max_tokens` is 16,000 for transcripts and 20,000 for handwriting (the largest value the SDK allows without streaming).
- **No server-side refusal fallback.** The API's `fallbacks: "default"` only retries `cyber` and `frontier_llm` declines, on another model. A recipe is unlikely to hit either, and the likelier false positive, `general_harms`, is not retried by it. It needs the beta endpoint and a header and applies only on the Claude API. A refusal here ends in `refused` and manual entry, which is the safe outcome for this feature. Revisit if real traffic shows refusals.
- **Prompts are v2.** The text changed (no tool call, escaping note), so the versions moved to `structure.v2` and `handwriting.v2`.
- The model answer for handwriting is parsed with `HandwritingOutputSchema`, and a blank transcript is invalid.
