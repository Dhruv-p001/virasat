import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import vm from "node:vm";

// Performance budget for the elder-facing /record page (docs/adr/0015-ui-stack.md).
// Run after `next build`. Adds up the gzipped JavaScript a first visit downloads: the framework
// chunks every page loads, plus the chunks the page's client components need. Fails when it goes
// over the budget, so a heavy library can't sneak onto a page opened on a cheap phone over 3G.

/**
 * Gzipped kilobytes. Measured 195.5 KB on 2026-11-05 (React, Next's runtime, i18n, the recorder
 * and the upload queue), so 215 KB leaves about 10% headroom. A single Radix dialog or Motion's
 * animation features would use most of that, which is the point. Raising it needs an ADR.
 */
const BUDGET_KB = Number(process.env["RECORD_BUDGET_KB"] ?? 215);

const next = new URL("../apps/web/.next/", import.meta.url);
const pageManifestFile = new URL(
  "server/app/record/[token]/page_client-reference-manifest.js",
  next,
);

type Manifest = {
  clientModules: Record<string, { chunks: string[] }>;
  entryJSFiles?: Record<string, string[]>;
};

const sandbox: { globalThis: { __RSC_MANIFEST?: Record<string, Manifest> } } = {
  globalThis: {},
};
vm.runInNewContext(readFileSync(pageManifestFile, "utf8"), sandbox);
const manifest = Object.values(sandbox.globalThis.__RSC_MANIFEST ?? {})[0];
if (!manifest)
  throw new Error("Could not read the /record client manifest. Run `next build` first.");

const build = JSON.parse(readFileSync(new URL("build-manifest.json", next), "utf8")) as {
  rootMainFiles: string[];
};

const files = new Set<string>(build.rootMainFiles);
for (const module of Object.values(manifest.clientModules)) {
  for (const chunk of module.chunks) files.add(chunk.replace(/^\/_next\//, ""));
}
for (const entry of Object.values(manifest.entryJSFiles ?? {})) {
  for (const chunk of entry) files.add(chunk.replace(/^\/_next\//, ""));
}

let total = 0;
const rows: { file: string; kb: number }[] = [];
for (const file of files) {
  if (!file.endsWith(".js")) continue;
  const kb = gzipSync(readFileSync(new URL(file, next))).length / 1024;
  total += kb;
  rows.push({ file, kb });
}

rows.sort((a, b) => b.kb - a.kb);
for (const row of rows.slice(0, 8))
  console.warn(`${row.kb.toFixed(1).padStart(7)} KB  ${row.file}`);
console.warn(
  `${total.toFixed(1).padStart(7)} KB  total gzipped JS for /record (${rows.length} files)`,
);

if (total > BUDGET_KB) {
  console.error(
    `/record is over its ${BUDGET_KB} KB budget by ${(total - BUDGET_KB).toFixed(1)} KB.`,
  );
  process.exit(1);
}
