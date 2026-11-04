import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  baseMimeType,
  CONSENT_WORDING_VERSION,
  formatTimer,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_SECONDS,
  MAX_SCAN_BYTES,
  pickRecordingMimeType,
  RECORDING_MIME_CANDIDATES,
  RECORDING_TOKEN_PATTERN,
  recordingLinkUrl,
  uploadRetryDelayMs,
  whatsAppShareUrl,
} from "./capture.ts";
import { generateToken } from "./tokens.ts";

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

describe("recording format", () => {
  it("prefers webm/opus where supported", () => {
    expect(pickRecordingMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });

  it("falls back to mp4 on iOS Safari", () => {
    expect(pickRecordingMimeType((type) => type === "audio/mp4")).toBe("audio/mp4");
  });

  it("returns null when nothing is supported", () => {
    expect(pickRecordingMimeType(() => false)).toBeNull();
  });

  it("strips codec parameters for the database and storage", () => {
    expect(baseMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseMimeType(" Audio/MP4 ")).toBe("audio/mp4");
  });

  it("only offers formats the storage bucket accepts", () => {
    const bucket = /\('vault-audio'[^)]*array\[([^\]]*)\]/s.exec(migrations)?.[1] ?? "";
    for (const candidate of RECORDING_MIME_CANDIDATES) {
      expect(bucket).toContain(`'${baseMimeType(candidate)}'`);
    }
  });
});

describe("recording timer", () => {
  it("formats minutes and seconds", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(65.9)).toBe("1:05");
    expect(formatTimer(MAX_RECORDING_SECONDS)).toBe("10:00");
    expect(formatTimer(-3)).toBe("0:00");
  });
});

describe("upload retry delay", () => {
  it("backs off and caps", () => {
    expect([0, 1, 2, 3].map(uploadRetryDelayMs)).toEqual([2000, 4000, 8000, 16000]);
    expect(uploadRetryDelayMs(20)).toBe(60_000);
  });
});

describe("recording link tokens", () => {
  it("accepts generated tokens and rejects junk", () => {
    expect(RECORDING_TOKEN_PATTERN.test(generateToken())).toBe(true);
    expect(RECORDING_TOKEN_PATTERN.test("short")).toBe(false);
    expect(RECORDING_TOKEN_PATTERN.test("../../etc/passwd/aaaaaaaaaaaaaaaa")).toBe(false);
  });
});

describe("sharing a recording link", () => {
  it("builds the elder's URL without a double slash", () => {
    expect(recordingLinkUrl("https://virasat.app/", "abc")).toBe("https://virasat.app/record/abc");
  });

  it("encodes the WhatsApp message", () => {
    expect(whatsAppShareUrl("Record here: https://x.test/record/a b")).toBe(
      "https://wa.me/?text=Record%20here%3A%20https%3A%2F%2Fx.test%2Frecord%2Fa%20b",
    );
  });
});
