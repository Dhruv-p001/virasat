import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONSENT_WORDING_VERSION,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_SECONDS,
  MAX_SCAN_BYTES,
} from "./capture.ts";

const migrationsDir = new URL("../../../supabase/migrations/", import.meta.url);
const migrations = readdirSync(migrationsDir)
  .map((file) => readFileSync(new URL(file, migrationsDir), "utf8"))
  .join("\n");

describe("capture limits", () => {
  it("allow ten minutes per recording", () => {
    expect(MAX_RECORDING_SECONDS).toBe(600);
  });

  it("fit a ten-minute recording at a generous phone bitrate (256 kbps)", () => {
    expect(MAX_RECORDING_SECONDS * (256_000 / 8)).toBeLessThan(MAX_AUDIO_BYTES);
  });

  it("match the limits the database enforces", () => {
    expect(migrations).toContain(`v_max_bytes := ${MAX_AUDIO_BYTES}`);
    expect(migrations).toContain(`v_max_bytes := ${MAX_SCAN_BYTES}`);
  });
});

describe("consent wording version", () => {
  it("fits the database column (1 to 40 characters)", () => {
    expect(CONSENT_WORDING_VERSION.length).toBeGreaterThan(0);
    expect(CONSENT_WORDING_VERSION.length).toBeLessThanOrEqual(40);
  });
});
