/**
 * Structuring eval: transcript -> recipe, scored against hand-checked answers (brief section 7).
 *
 *   pnpm eval:structure --mock            no API key: a mock returns each case's own answer, so every
 *                                         score must be perfect. Checks the harness, not the model.
 *   pnpm eval:structure                   real Claude calls, needs ANTHROPIC_API_KEY in .env
 *   pnpm eval:structure --only=gu-thepla,hi-kadhi
 *
 * Reads eval/structure/cases/*.json (synthetic, committed) and eval/structure/data/*.json (real
 * family transcripts, gitignored). Writes eval/structure/results/<timestamp>.{json,md} (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ClaudeModelClient } from "../../src/structuring/claude/client.ts";
import { ClaudeRecipeStructurer } from "../../src/structuring/claude/structurer.ts";
import { ScriptedModelClient } from "../../src/structuring/testing.ts";
import { loadCases } from "./cases.ts";
import { runStructureEval, summarise, toMarkdown } from "./runner.ts";

const resultsDir = new URL("./results/", import.meta.url);

const { values } = parseArgs({
  options: {
    mock: { type: "boolean", default: false },
    only: { type: "string" },
  },
});

const onlyIds = values.only?.split(",");
const cases = loadCases().filter((c) => !onlyIds || onlyIds.includes(c.id));
if (cases.length === 0) throw new Error("No cases matched.");

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!values.mock && !apiKey) {
  throw new Error("Set ANTHROPIC_API_KEY in .env, or pass --mock to run against the mock.");
}
const realClient = values.mock || !apiKey ? null : new ClaudeModelClient(apiKey);
const label = realClient ? realClient.model : "mock";

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
