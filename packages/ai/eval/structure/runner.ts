import { scoreStructuring, type StructuringScore } from "../../src/metrics/structuring-score.ts";
import type { RecipeStructurer, StructuringUsage } from "../../src/structuring/types.ts";
import type { StructureCase } from "./cases.ts";

export interface EvalRow {
  id: string;
  status: "ok" | "needs_manual_entry";
  reason: string | null;
  score: StructuringScore | null;
  autoFlagged: number;
  usage: StructuringUsage;
  latencyMs: number;
}

/** Runs every case through a structurer built per case (a mock needs the case to know its answer). */
export async function runStructureEval(
  cases: StructureCase[],
  makeStructurer: (testCase: StructureCase) => RecipeStructurer,
  onRow?: (row: EvalRow) => void,
): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (const testCase of cases) {
    const started = performance.now();
    const result = await makeStructurer(testCase).structure({
      transcript: testCase.transcript,
      language: testCase.language,
      speaker: testCase.speaker,
    });
    const row: EvalRow = {
      id: testCase.id,
      status: result.status,
      reason: result.status === "ok" ? null : result.reason,
      score:
        result.status === "ok"
          ? scoreStructuring({
              transcript: testCase.transcript,
              expected: testCase.expected,
              forbidden: testCase.forbidden,
              actual: result.recipe,
            })
          : null,
      autoFlagged: result.status === "ok" ? result.autoFlagged.length : 0,
      usage: result.usage,
      latencyMs: Math.round(performance.now() - started),
    };
    rows.push(row);
    onRow?.(row);
  }
  return rows;
}

export interface EvalSummary {
  cases: number;
  needsManualEntry: number;
  ingredientRecall: number | null;
  inventedItems: number;
  originalTextPreserved: number | null;
  uncertainRecall: number | null;
  uncertainPrecision: number | null;
  inputTokens: number;
  outputTokens: number;
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0) / present.length;
}

/** Ratios are averaged over the cases where they apply. Invented items are summed: one is one too many. */
export function summarise(rows: EvalRow[]): EvalSummary {
  const scores = rows.flatMap((row) => (row.score ? [row.score] : []));
  return {
    cases: rows.length,
    needsManualEntry: rows.filter((row) => row.status === "needs_manual_entry").length,
    ingredientRecall: mean(scores.map((s) => s.ingredientRecall)),
    inventedItems: scores.reduce((sum, s) => sum + s.inventedItems, 0),
    originalTextPreserved: mean(scores.map((s) => s.originalTextPreserved)),
    uncertainRecall: mean(scores.map((s) => s.uncertainRecall)),
    uncertainPrecision: mean(scores.map((s) => s.uncertainPrecision)),
    inputTokens: rows.reduce((sum, row) => sum + row.usage.inputTokens, 0),
    outputTokens: rows.reduce((sum, row) => sum + row.usage.outputTokens, 0),
  };
}

const pct = (value: number | null) => (value === null ? "n/a" : `${Math.round(value * 100)}%`);

export function toMarkdown(rows: EvalRow[], summary: EvalSummary, label: string): string {
  const lines = [
    `# Structuring eval (${label})`,
    "",
    "| case | status | recall | invented | original_text kept | flag recall | flag precision | tokens in/out |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${[
          row.id,
          row.status === "ok" ? "ok" : `manual entry (${row.reason ?? "?"})`,
          pct(row.score?.ingredientRecall ?? null),
          row.score?.inventedItems ?? "n/a",
          pct(row.score?.originalTextPreserved ?? null),
          pct(row.score?.uncertainRecall ?? null),
          pct(row.score?.uncertainPrecision ?? null),
          `${row.usage.inputTokens}/${row.usage.outputTokens}`,
        ].join(" | ")} |`,
    ),
    "",
    `**All ${summary.cases} cases:** recall ${pct(summary.ingredientRecall)}, invented items ${summary.inventedItems}, ` +
      `original_text kept ${pct(summary.originalTextPreserved)}, flag recall ${pct(summary.uncertainRecall)}, ` +
      `flag precision ${pct(summary.uncertainPrecision)}, manual entry ${summary.needsManualEntry}, ` +
      `tokens ${summary.inputTokens} in / ${summary.outputTokens} out.`,
  ];
  return lines.join("\n");
}
