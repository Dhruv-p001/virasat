/* eslint-disable @typescript-eslint/require-await -- the fakes implement async interfaces without awaiting */
import { describe, expect, it } from "vitest";
import { type PendingUpload, runUpload, type UploadApi, type UploadDeps } from "./upload.ts";

const entry = (): PendingUpload<string> => ({
  id: "e1",
  token: "t".repeat(32),
  mime: "audio/webm",
  blob: "audio-bytes",
  size: 11,
});

type Harness = {
  deps: UploadDeps<string>;
  calls: string[];
  saved: PendingUpload<string>[];
  removed: string[];
  sleeps: number[];
};

function harness(overrides: Partial<UploadApi<string>> = {}): Harness {
  const calls: string[] = [];
  const saved: PendingUpload<string>[] = [];
  const removed: string[] = [];
  const sleeps: number[] = [];
  const api: UploadApi<string> = {
    start: async () => {
      calls.push("start");
      return { ok: true, jobId: "job-1", uploadUrl: "https://s/url-1" };
    },
    refresh: async () => {
      calls.push("refresh");
      return { ok: true, uploadUrl: "https://s/url-2", done: false };
    },
    put: async () => {
      calls.push("put");
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
    saved,
    removed,
    sleeps,
    deps: {
      api,
      save: async (e) => void saved.push({ ...e }),
      remove: async (id) => void removed.push(id),
      sleep: async (ms) => void sleeps.push(ms),
      onWaiting: () => {},
      onSending: () => {},
    },
  };
}

describe("runUpload", () => {
  it("starts, stores and confirms, then forgets the recording", async () => {
    const h = harness();
    expect(await runUpload(entry(), h.deps)).toBe("sent");
    expect(h.calls).toEqual(["start", "put", "confirm"]);
    expect(h.removed).toEqual(["e1"]);
  });

  it("keeps the recording until the server has confirmed", async () => {
    let confirms = 0;
    const h = harness({
      confirm: async () => {
        confirms += 1;
        if (confirms < 3) throw new Error("offline");
        return { ok: true };
      },
    });
    expect(await runUpload(entry(), h.deps)).toBe("sent");
    expect(h.removed).toEqual(["e1"]);
    expect(h.sleeps).toEqual([2000, 4000]);
  });

  it("never starts a second capture when the connection drops mid-upload", async () => {
    let puts = 0;
    const h = harness({
      put: async () => {
        puts += 1;
        if (puts < 3) throw new Error("connection reset");
        return "ok";
      },
    });
    expect(await runUpload(entry(), h.deps)).toBe("sent");
    expect(h.calls.filter((c) => c === "start")).toHaveLength(1);
    expect(puts).toBe(3);
  });

  it("resumes after a reload without starting again or re-sending a stored file", async () => {
    const h = harness();
    const resumed = { ...entry(), jobId: "job-1", stored: true };
    expect(await runUpload(resumed, h.deps)).toBe("sent");
    expect(h.calls).toEqual(["confirm"]);
  });

  it("asks for a fresh URL when the old one expired", async () => {
    let puts = 0;
    const h = harness({
      put: async () => {
        puts += 1;
        return puts === 1 ? "expired" : "ok";
      },
    });
    expect(await runUpload(entry(), h.deps)).toBe("sent");
    expect(h.calls).toEqual(["start", "refresh", "confirm"]);
  });

  it("treats a file that is already there as stored", async () => {
    const h = harness({ put: async () => "exists" });
    expect(await runUpload(entry(), h.deps)).toBe("sent");
    expect(h.calls).toEqual(["start", "confirm"]);
  });

  it("re-sends when the server says the file is incomplete", async () => {
    let confirms = 0;
    const h = harness({
      confirm: async () => {
        confirms += 1;
        return confirms === 1 ? { ok: false, reason: "incomplete" } : { ok: true };
      },
    });
    expect(await runUpload(entry(), h.deps)).toBe("sent");
    expect(h.calls).toEqual(["start", "put", "refresh", "put"]);
  });

  it("gives up on a file the storage keeps refusing, and keeps the recording", async () => {
    const h = harness({ put: async () => "expired" });
    expect(await runUpload(entry(), h.deps)).toBe("rejected");
    expect(h.removed).toEqual([]);
  });

  it("drops the recording from the phone when the link was revoked", async () => {
    const h = harness({ start: async () => ({ ok: false, reason: "invalid_link" }) });
    expect(await runUpload(entry(), h.deps)).toBe("invalid_link");
    expect(h.removed).toEqual(["e1"]);
  });

  it("keeps a refused recording on the phone", async () => {
    const h = harness({ start: async () => ({ ok: false, reason: "rejected" }) });
    expect(await runUpload(entry(), h.deps)).toBe("rejected");
    expect(h.removed).toEqual([]);
  });

  it("saves the job id before uploading, so a reload reuses it", async () => {
    const h = harness();
    await runUpload(entry(), h.deps);
    expect(h.saved[0]?.jobId).toBe("job-1");
  });
});
