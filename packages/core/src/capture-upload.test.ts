/* eslint-disable @typescript-eslint/require-await -- the fakes implement async interfaces without awaiting */
import { describe, expect, it } from "vitest";
import {
  type CaptureUploadApi,
  type CaptureUploadDeps,
  type PendingCapture,
  runCaptureUpload,
} from "./capture-upload.ts";

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error("expected at least one item");
  return item;
}

const pages = (): PendingCapture<string> => ({
  id: "c1",
  familyId: "f1",
  personId: "p1",
  source: "handwriting",
  files: [
    { role: "page", page: 0, mime: "image/heic", blob: "p0", size: 10 },
    { role: "page", page: 1, mime: "image/jpeg", blob: "p1", size: 11 },
    { role: "copy", page: 0, mime: "image/jpeg", blob: "c0", size: 5, width: 100, height: 80 },
  ],
});

const recording = (): PendingCapture<string> => ({
  id: "c2",
  familyId: "f1",
  personId: "p1",
  source: "voice",
  files: [{ role: "recording", page: 0, mime: "audio/webm", blob: "audio", size: 5 }],
});

type Harness = {
  deps: CaptureUploadDeps<string>;
  calls: string[];
  puts: string[];
  saved: PendingCapture<string>[];
  removed: string[];
  sleeps: number[];
};

function harness(overrides: Partial<CaptureUploadApi<string>> = {}): Harness {
  const calls: string[] = [];
  const puts: string[] = [];
  const saved: PendingCapture<string>[] = [];
  const removed: string[] = [];
  const sleeps: number[] = [];
  const api: CaptureUploadApi<string> = {
    begin: async (_person, _source, files) => {
      calls.push("begin");
      return {
        ok: true,
        jobId: "job-1",
        uploads: files.map((_file, index) => ({
          mediaId: `m${index}`,
          uploadUrl: `https://s/u${index}`,
        })),
      };
    },
    refresh: async () => {
      calls.push("refresh");
      return {
        ok: true,
        done: false,
        uploads: [0, 1, 2].map((index) => ({
          mediaId: `m${index}`,
          uploadUrl: `https://s/r${index}`,
        })),
      };
    },
    put: async (url) => {
      calls.push("put");
      puts.push(url);
      return "ok";
    },
    confirm: async () => {
      calls.push("confirm");
      return { ok: true };
    },
    ...overrides,
  };
  return {
    calls,
    puts,
    saved,
    removed,
    sleeps,
    deps: {
      api,
      save: async (entry) =>
        void saved.push({ ...entry, files: entry.files.map((file) => ({ ...file })) }),
      remove: async (id) => void removed.push(id),
      sleep: async (ms) => void sleeps.push(ms),
      onWaiting: () => {},
      onSending: () => {},
    },
  };
}

describe("runCaptureUpload", () => {
  it("registers a capture once, stores every file, confirms and forgets it", async () => {
    const h = harness();
    expect(await runCaptureUpload(pages(), h.deps)).toBe("sent");
    expect(h.calls).toEqual(["begin", "put", "put", "put", "confirm"]);
    expect(h.puts).toEqual(["https://s/u0", "https://s/u1", "https://s/u2"]);
    expect(h.removed).toEqual(["c1"]);
  });

  it("sends the server the specs, never the files themselves", async () => {
    let seen: unknown;
    const h = harness({
      begin: async (_person, _source, files) => {
        seen = files;
        return {
          ok: true,
          jobId: "j",
          uploads: files.map((_f, i) => ({ mediaId: `m${i}`, uploadUrl: "u" })),
        };
      },
    });
    await runCaptureUpload(recording(), h.deps);
    expect(seen).toEqual([
      {
        role: "recording",
        page: 0,
        mime: "audio/webm",
        size: 5,
        width: undefined,
        height: undefined,
      },
    ]);
  });

  it("keeps everything until the server has confirmed, and never registers twice", async () => {
    let confirms = 0;
    const h = harness({
      confirm: async () => {
        confirms += 1;
        if (confirms < 3) throw new Error("offline");
        return { ok: true };
      },
    });
    expect(await runCaptureUpload(pages(), h.deps)).toBe("sent");
    expect(h.calls.filter((call) => call === "begin")).toHaveLength(1);
    // Files already stored are not sent again.
    expect(h.calls.filter((call) => call === "put")).toHaveLength(3);
    expect(h.sleeps).toEqual([2000, 4000]);
    expect(h.removed).toEqual(["c1"]);
  });

  it("resumes a capture that was already registered, asking for fresh URLs", async () => {
    const entry = pages();
    entry.jobId = "job-1";
    entry.files.forEach((file, index) => {
      file.mediaId = `m${index}`;
    });
    first(entry.files).stored = true;
    const h = harness();
    expect(await runCaptureUpload(entry, h.deps)).toBe("sent");
    expect(h.calls).toEqual(["refresh", "put", "put", "confirm"]);
    expect(h.puts).toEqual(["https://s/r1", "https://s/r2"]);
  });

  it("treats a server that already has everything as done", async () => {
    const entry = recording();
    entry.jobId = "job-1";
    first(entry.files).mediaId = "m0";
    const h = harness({
      refresh: async () => {
        h.calls.push("refresh");
        return { ok: true, done: true, uploads: [] };
      },
    });
    expect(await runCaptureUpload(entry, h.deps)).toBe("sent");
    expect(h.calls).toEqual(["refresh", "confirm"]);
  });

  it("asks for a new URL when one has expired, and stops when they keep being refused", async () => {
    let puts = 0;
    const h = harness({
      put: async () => {
        h.calls.push("put");
        puts += 1;
        return puts === 1 ? "expired" : "ok";
      },
    });
    expect(await runCaptureUpload(recording(), h.deps)).toBe("sent");
    expect(h.calls).toEqual(["begin", "put", "refresh", "put", "confirm"]);

    const stuck = harness({ put: async () => "expired" });
    expect(await runCaptureUpload(recording(), stuck.deps)).toBe("rejected");
    expect(stuck.removed).toEqual([]);
  });

  it("sends every file again when the server says something did not arrive", async () => {
    let confirms = 0;
    const h = harness({
      confirm: async () => {
        confirms += 1;
        return confirms === 1 ? { ok: false, reason: "incomplete" } : { ok: true };
      },
    });
    expect(await runCaptureUpload(pages(), h.deps)).toBe("sent");
    expect(h.calls.filter((call) => call === "put")).toHaveLength(6);
    expect(h.calls).toContain("refresh");
  });

  it("keeps the capture on the device when the server turns it away", async () => {
    const refused = harness({ begin: async () => ({ ok: false, reason: "rejected" }) });
    expect(await runCaptureUpload(pages(), refused.deps)).toBe("rejected");
    expect(refused.removed).toEqual([]);

    const signedOut = harness({ begin: async () => ({ ok: false, reason: "not_allowed" }) });
    expect(await runCaptureUpload(pages(), signedOut.deps)).toBe("not_allowed");
    expect(signedOut.removed).toEqual([]);

    const lateRefusal = harness({ confirm: async () => ({ ok: false, reason: "not_allowed" }) });
    expect(await runCaptureUpload(recording(), lateRefusal.deps)).toBe("not_allowed");
    expect(lateRefusal.removed).toEqual([]);
  });

  it("retries a failed registration without leaving a half-registered capture", async () => {
    let begins = 0;
    const h = harness({
      begin: async (_p, _s, files) => {
        begins += 1;
        if (begins === 1) throw new Error("offline");
        return {
          ok: true,
          jobId: "j",
          uploads: files.map((_f, i) => ({ mediaId: `m${i}`, uploadUrl: "u" })),
        };
      },
    });
    const entry = recording();
    expect(await runCaptureUpload(entry, h.deps)).toBe("sent");
    expect(begins).toBe(2);
    expect(h.sleeps).toEqual([2000]);
  });

  it("refuses a registration that does not match the files", async () => {
    const h = harness({ begin: async () => ({ ok: true, jobId: "j", uploads: [] }) });
    expect(await runCaptureUpload(pages(), h.deps)).toBe("rejected");
  });
});
