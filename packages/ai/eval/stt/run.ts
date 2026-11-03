/**
 * STT provider comparison on real elder recordings (brief Phase 0).
 *
 *   pnpm eval:stt                          all providers with keys configured
 *   pnpm eval:stt --providers=sarvam,openai
 *   pnpm eval:stt --only=ba-thepla-01 --language=hint
 *
 * Reads eval/stt/data/manifest.json, writes eval/stt/results/<timestamp>.{json,md}.
 * Both folders are gitignored.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { characterErrorRate, wordErrorRate } from "../../src/metrics/error-rate.ts";
import { configuredProviders } from "../../src/transcription/providers/index.ts";
import type { TranscriptionProvider } from "../../src/transcription/types.ts";
import { EvalManifestSchema, type EvalRecording } from "./manifest.ts";

const dataDir = new URL("./data/", import.meta.url);
const resultsDir = new URL("./results/", import.meta.url);

const { values } = parseArgs({
  options: {
    providers: { type: "string" },
    only: { type: "string" },
    // "auto" tests detection, which is what the contributor link will rely on.
    language: { type: "string", default: "auto" },
  },
});
if (values.language !== "auto" && values.language !== "hint") {
  throw new Error(`--language must be "auto" or "hint", got ${values.language}`);
}

const manifestUrl = new URL("manifest.json", dataDir);
if (!existsSync(manifestUrl)) {
  throw new Error(
    "No eval/stt/data/manifest.json. Put recordings in eval/stt/data/ and describe them using manifest.example.json.",
  );
}
const manifest = EvalManifestSchema.parse(JSON.parse(readFileSync(manifestUrl, "utf8")));
const onlyIds = values.only?.split(",");
const recordings = onlyIds ? manifest.filter((r) => onlyIds.includes(r.id)) : manifest;

const wanted = values.providers?.split(",");
const providers = configuredProviders(process.env).filter((p) => !wanted || wanted.includes(p.id));
if (providers.length === 0) {
  throw new Error("No providers configured. Set the API keys listed in .env.example.");
}

interface Row {
  recording: string;
  language: EvalRecording["language"];
  environment: EvalRecording["recording"]["environment"];
  provider: string;
  model: string;
  wer: number | null;
  cer: number | null;
  detectedLanguage: string | null;
  latencyMs: number | null;
  hypothesis: string | null;
  error: string | null;
}

const rows: Row[] = [];
for (const recording of recordings) {
  const audio = new Uint8Array(readFileSync(new URL(recording.audio, dataDir)));
  for (const provider of providers) {
    rows.push(await score(provider, recording, audio));
    log(`${recording.id} · ${provider.id}: ${describe(rows.at(-1))}`);
  }
}

mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(new URL(`${stamp}.json`, resultsDir), JSON.stringify(rows, null, 2));
writeFileSync(new URL(`${stamp}.md`, resultsDir), summarise(rows));
log(`\n${summarise(rows)}\nWrote results/${stamp}.json and .md`);

async function score(
  provider: TranscriptionProvider,
  recording: EvalRecording,
  audio: Uint8Array<ArrayBuffer>,
): Promise<Row> {
  const base = {
    recording: recording.id,
    language: recording.language,
    environment: recording.recording.environment,
    provider: provider.id,
    model: provider.model,
  };
  try {
    const result = await provider.transcribe({
      audio,
      mimeType: recording.mimeType,
      filename: basename(recording.audio),
      language:
        values.language === "hint" && recording.language !== "mixed" ? recording.language : "auto",
    });
    return {
      ...base,
      wer: wordErrorRate(recording.reference, result.text).rate,
      cer: characterErrorRate(recording.reference, result.text).rate,
      detectedLanguage: result.detectedLanguage,
      latencyMs: result.latencyMs,
      hypothesis: result.text,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      wer: null,
      cer: null,
      detectedLanguage: null,
      latencyMs: null,
      hypothesis: null,
      error: message,
    };
  }
}

function summarise(all: Row[]): string {
  const groups = Map.groupBy(all, (r) => `${r.provider} (${r.model})`);
  const lines = [
    `STT eval, ${recordings.length} recordings, language=${values.language}`,
    "",
    "| Provider | Mean WER | Mean CER | WER gu | WER hi | WER mixed | Median latency | Failures |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const [name, group] of groups) {
    const ok = group.filter((r) => r.error === null);
    const werFor = (lang: Row["language"]) =>
      pct(mean(ok.filter((r) => r.language === lang).map((r) => r.wer)));
    lines.push(
      `| ${name} | ${pct(mean(ok.map((r) => r.wer)))} | ${pct(mean(ok.map((r) => r.cer)))} | ${werFor("gu")} | ${werFor("hi")} | ${werFor("mixed")} | ${median(ok.map((r) => r.latencyMs))} ms | ${group.length - ok.length} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function mean(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function median(values: (number | null)[]): string {
  const nums = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (nums.length === 0) return "–";
  const mid = Math.floor(nums.length / 2);
  const value = nums.length % 2 ? nums[mid] : ((nums[mid - 1] ?? 0) + (nums[mid] ?? 0)) / 2;
  return String(Math.round(value ?? 0));
}

function pct(value: number | null): string {
  return value === null ? "–" : `${(value * 100).toFixed(1)}%`;
}

function describe(row: Row | undefined): string {
  if (!row) return "";
  return row.error ?? `WER ${pct(row.wer)}, CER ${pct(row.cer)}, ${row.latencyMs} ms`;
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}
