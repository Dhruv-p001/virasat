/**
 * Structuring eval: transcript -> recipe, scored against hand-checked answers (brief section 7).
 *
 *   pnpm eval:structure --mock            no API key: a mock returns each case's own answer, so every
 *                                         score must be perfect. Checks the harness, not the model.
 *   pnpm eval:structure                   real Claude calls, needs ANTHROPIC_API_KEY in .env
 *   pnpm eval:structure --only=gu-thepla,hi-kadhi
 *   pnpm eval:structure --effort=low      compare Claude thinking effort (default medium)
 *   pnpm eval:structure --provider=gemini Gemini instead (GEMINI_API_KEY, GEMINI_API_MODE; ADR 0011).
 *                                         Synthetic cases only: real transcripts are withheld.
 *                                         --model=<id> and --thinking=minimal|low|medium|high apply.
 *
 * Reads eval/structure/cases/*.json (synthetic, committed) and eval/structure/data/*.json (real
 * family transcripts, gitignored). Writes eval/structure/results/<timestamp>.{json,md} (gitignored).
 * Gemini scores say how the pipeline and prompts behave on another model. They are not Claude's scores.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  CLAUDE_STRUCTURING_EFFORT,
  ClaudeModelClient,
} from "../../src/structuring/claude/client.ts";
import { ClaudeRecipeStructurer } from "../../src/structuring/claude/structurer.ts";
import { GeminiModelClient, geminiModeFromEnv } from "../../src/structuring/gemini/client.ts";
import type { ModelClient } from "../../src/structuring/model-client.ts";
import { ScriptedModelClient } from "../../src/structuring/testing.ts";
import { casesForProvider, loadCases } from "./cases.ts";
import { runStructureEval, summarise, toMarkdown } from "./runner.ts";

const resultsDir = new URL("./results/", import.meta.url);

const { values } = parseArgs({
  options: {
    mock: { type: "boolean", default: false },
    provider: { type: "string", default: "claude" },
    only: { type: "string" },
    model: { type: "string" },
    effort: { type: "string", default: CLAUDE_STRUCTURING_EFFORT },
    thinking: { type: "string", default: "low" },
  },
});
const efforts = ["low", "medium", "high", "xhigh", "max"] as const;
const effort = efforts.find((level) => level === values.effort);
if (!effort) throw new Error(`--effort must be one of ${efforts.join(", ")}, got ${values.effort}`);
const thinkingLevels = ["minimal", "low", "medium", "high"] as const;
const thinking = thinkingLevels.find((level) => level === values.thinking);
if (!thinking) {
  throw new Error(`--thinking must be one of ${thinkingLevels.join(", ")}, got ${values.thinking}`);
}
if (values.provider !== "claude" && values.provider !== "gemini") {
  throw new Error(`--provider must be claude or gemini, got ${values.provider}`);
}
const provider = values.mock ? "mock" : values.provider;

const onlyIds = values.only?.split(",");
const selected = loadCases().filter((c) => !onlyIds || onlyIds.includes(c.id));
const { allowed: cases, withheld } = casesForProvider(selected, provider);
if (withheld.length > 0) {
  log(
    `Withheld ${withheld.length} real-transcript case(s) from ${provider}: free tiers may use inputs ` +
      "for training and human review, so only synthetic cases are sent (ADR 0011).",
  );
}
if (cases.length === 0) throw new Error("No cases matched.");

const realClient = makeRealClient();
const label = realClient
  ? provider === "gemini"
    ? `${realClient.model} via ${geminiModeFromEnv(process.env)}, thinking ${thinking}`
    : `${realClient.model}, effort ${effort}`
  : "mock";

function makeRealClient(): ModelClient | null {
  if (provider === "mock") return null;
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Set GEMINI_API_KEY in .env to use --provider=gemini.");
    return new GeminiModelClient(key, {
      mode: geminiModeFromEnv(process.env),
      thinking,
      ...(values.model ? { model: values.model } : {}),
    });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Set ANTHROPIC_API_KEY in .env, or pass --mock to run against the mock.");
  }
  return new ClaudeModelClient(key, { effort, ...(values.model ? { model: values.model } : {}) });
}

const rows = await runStructureEval(
  cases,
  (testCase) =>
    new ClaudeRecipeStructurer(realClient ?? new ScriptedModelClient([testCase.expected])),
  (row) => {
    log(`${row.id}: ${row.status}${row.reason ? ` (${row.reason})` : ""}, ${row.latencyMs} ms`);
  },
);
const summary = summarise(rows);

mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(
  new URL(`${stamp}.json`, resultsDir),
  JSON.stringify({ label, rows, summary }, null, 2),
);
writeFileSync(new URL(`${stamp}.md`, resultsDir), toMarkdown(rows, summary, label));
log(`\n${toMarkdown(rows, summary, label)}\n\nWrote results/${stamp}.json and .md`);

// The mock hands back the answer key, so anything short of perfect means the harness is broken.
if (values.mock) {
  const perfect =
    summary.needsManualEntry === 0 &&
    summary.inventedItems === 0 &&
    [
      summary.ingredientRecall,
      summary.originalTextPreserved,
      summary.uncertainRecall,
      summary.uncertainPrecision,
    ].every((value) => value === null || value === 1);
  if (!perfect) {
    console.error("Mock run was not perfect: the eval harness or a case is broken.");
    process.exitCode = 1;
  }
}

function log(message: string) {
  console.error(message);
}
