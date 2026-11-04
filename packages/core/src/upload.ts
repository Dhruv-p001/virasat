import { uploadRetryDelayMs } from "./capture.ts";

// The elder's upload, written so a dropped connection never loses the recording (ADR 0012).
// The browser keeps the recording in IndexedDB until the server confirms it, and calls this
// again after a reload. It is free of browser APIs: storage, network calls and waiting are passed
// in, so the retry behaviour is tested here without a browser.

/** What is kept on the phone until the server has confirmed the upload. */
export type PendingUpload<Blob> = {
  id: string;
  token: string;
  /** Base mime type, e.g. "audio/webm". */
  mime: string;
  blob: Blob;
  size: number;
  /** Set once begin_capture succeeded. Every retry reuses it: a new job would spend another upload. */
  jobId?: string;
  /** A signed upload URL, short-lived. Dropped when the server says it expired. */
  uploadUrl?: string | null;
  /** The file has been stored. Only the confirmation is left. */
  stored?: boolean;
};

export type UploadApi<Blob> = {
  start(
    token: string,
    mime: string,
    size: number,
  ): Promise<
    | { ok: true; jobId: string; uploadUrl: string | null }
    | { ok: false; reason: "invalid_link" | "rejected" }
  >;
  /** A fresh signed URL for the same registered path, for the same capture. */
  refresh(
    token: string,
    jobId: string,
  ): Promise<
    { ok: true; uploadUrl: string | null; done: boolean } | { ok: false; reason: "invalid_link" }
  >;
  /** "expired" means the URL is no longer accepted. Network failures and 5xx throw. */
  put(url: string, blob: Blob, mime: string): Promise<"ok" | "exists" | "expired">;
  confirm(
    token: string,
    jobId: string,
  ): Promise<{ ok: true } | { ok: false; reason: "invalid_link" | "incomplete" }>;
};

export type UploadDeps<Blob> = {
  api: UploadApi<Blob>;
  save(entry: PendingUpload<Blob>): Promise<void>;
  remove(id: string): Promise<void>;
  /** Waits `ms`, or less if the connection comes back. */
  sleep(ms: number): Promise<void>;
  onWaiting(attempt: number): void;
  onSending(): void;
};

export type UploadOutcome = "sent" | "invalid_link" | "rejected";

/** After this many refused URLs in a row, the file itself is the problem: stop instead of looping. */
const MAX_REFUSED_URLS = 6;

/**
 * Drives one recording to "the server has it". Retries forever on network trouble, with backoff.
 * `entry` is updated and saved as each step completes, so a reload resumes where it stopped.
 */
export async function runUpload<Blob>(
  entry: PendingUpload<Blob>,
  deps: UploadDeps<Blob>,
): Promise<UploadOutcome> {
  const { api } = deps;
  let attempt = 0;
  let refused = 0;

  for (;;) {
    try {
      deps.onSending();

      if (!entry.jobId) {
        const started = await api.start(entry.token, entry.mime, entry.size);
        if (!started.ok) {
          // A revoked link takes its recording off the phone; a refused file stays for the organiser to hear about.
          if (started.reason === "invalid_link") await deps.remove(entry.id);
          return started.reason;
        }
        entry.jobId = started.jobId;
        entry.uploadUrl = started.uploadUrl;
        await deps.save(entry);
      }

      if (!entry.stored) {
        if (!entry.uploadUrl) {
          const fresh = await api.refresh(entry.token, entry.jobId);
          if (!fresh.ok) {
            await deps.remove(entry.id);
            return fresh.reason;
          }
          if (fresh.done) entry.stored = true;
          entry.uploadUrl = fresh.uploadUrl;
          await deps.save(entry);
        }
      }

      if (!entry.stored && entry.uploadUrl) {
        const result = await api.put(entry.uploadUrl, entry.blob, entry.mime);
        if (result === "expired") {
          entry.uploadUrl = null;
          refused += 1;
          if (refused >= MAX_REFUSED_URLS) return "rejected";
          await deps.save(entry);
          continue;
        }
        entry.stored = true;
        await deps.save(entry);
      }

      const confirmed = await api.confirm(entry.token, entry.jobId);
      if (confirmed.ok) {
        await deps.remove(entry.id);
        return "sent";
      }
      if (confirmed.reason === "invalid_link") {
        await deps.remove(entry.id);
        return "invalid_link";
      }
      // "incomplete": storage has no complete file (a partial one, or lost). Send it again.
      entry.stored = false;
      entry.uploadUrl = null;
      refused += 1;
      if (refused >= MAX_REFUSED_URLS) return "rejected";
      await deps.save(entry);
    } catch {
      deps.onWaiting(attempt);
      await deps.sleep(uploadRetryDelayMs(attempt));
      attempt += 1;
    }
  }
}
