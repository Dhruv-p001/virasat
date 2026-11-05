import { uploadRetryDelayMs } from "./capture.ts";
import type { CaptureFileSpec, CaptureSource } from "./capture-files.ts";

// The organiser's upload of a capture: one recording, or a few handwritten pages and their readable
// copies. Same rules as the elder's (ADR 0012, upload.ts): everything stays on the device until the
// server has confirmed it, each retry reuses the same capture, and files go straight to storage by
// signed URL. Free of browser APIs, so the retry behaviour is tested without a browser.
//
// The credential here is the signed-in session, not a link token, so these calls carry none.

/** One file of a capture, with what is known about where it has got to. */
export type CaptureFile<Blob> = CaptureFileSpec & {
  blob: Blob;
  /** Set once the capture is registered. */
  mediaId?: string;
  /** A signed upload URL, short-lived. Dropped when the server says it expired. */
  uploadUrl?: string | null;
  /** The file has been stored. */
  stored?: boolean;
};

/** What is kept on the device until the server has confirmed the capture. */
export type PendingCapture<Blob> = {
  id: string;
  familyId: string;
  personId: string;
  source: CaptureSource;
  files: CaptureFile<Blob>[];
  /** Set once the capture is registered. Every retry reuses it: a new one would leave an empty capture behind. */
  jobId?: string;
};

export type CaptureUploadSlot = { mediaId: string; uploadUrl: string | null };

export type CaptureUploadApi<Blob> = {
  /** Registers the capture and every file. `uploads` is in the order of `files`. */
  begin(
    personId: string,
    source: CaptureSource,
    files: CaptureFileSpec[],
  ): Promise<
    | { ok: true; jobId: string; uploads: CaptureUploadSlot[] }
    | { ok: false; reason: "not_allowed" | "rejected" }
  >;
  /** Fresh URLs for the capture's files. `done` means the server already has it all. */
  refresh(
    jobId: string,
  ): Promise<
    { ok: true; done: boolean; uploads: CaptureUploadSlot[] } | { ok: false; reason: "not_allowed" }
  >;
  /** "expired" means the URL is no longer accepted. Network failures and 5xx throw. */
  put(url: string, blob: Blob, mime: string): Promise<"ok" | "exists" | "expired">;
  confirm(
    jobId: string,
  ): Promise<{ ok: true } | { ok: false; reason: "not_allowed" | "incomplete" }>;
};

export type CaptureUploadDeps<Blob> = {
  api: CaptureUploadApi<Blob>;
  save(entry: PendingCapture<Blob>): Promise<void>;
  remove(id: string): Promise<void>;
  /** Waits `ms`, or less if the connection comes back. */
  sleep(ms: number): Promise<void>;
  onWaiting(attempt: number): void;
  onSending(): void;
};

/**
 * "sent": the server has it, and the device has let it go. "not_allowed": the session ended or the
 * person may no longer add recipes. "rejected": the server refused the files. In the last two the
 * capture stays on the device so the organiser can try again or discard it.
 */
export type CaptureUploadOutcome = "sent" | "not_allowed" | "rejected";

/** After this many refused URLs or incomplete confirmations, the files themselves are the problem. */
const MAX_REFUSALS = 6;

/** Drives one capture to "the server has it". Retries forever on network trouble, with backoff. */
export async function runCaptureUpload<Blob>(
  entry: PendingCapture<Blob>,
  deps: CaptureUploadDeps<Blob>,
): Promise<CaptureUploadOutcome> {
  const { api } = deps;
  let attempt = 0;
  let refusals = 0;

  const forgetUrls = () => {
    for (const file of entry.files) {
      file.stored = false;
      file.uploadUrl = null;
    }
  };

  for (;;) {
    try {
      deps.onSending();

      if (!entry.jobId) {
        const specs = entry.files.map(({ role, page, mime, size, width, height }) => ({
          role,
          page,
          mime,
          size,
          width,
          height,
        }));
        const started = await api.begin(entry.personId, entry.source, specs);
        if (!started.ok) return started.reason;
        if (started.uploads.length !== entry.files.length) return "rejected";
        entry.jobId = started.jobId;
        entry.files.forEach((file, index) => {
          const slot = started.uploads[index];
          if (!slot) return;
          file.mediaId = slot.mediaId;
          file.uploadUrl = slot.uploadUrl;
        });
        await deps.save(entry);
      }

      if (entry.files.some((file) => !file.stored && !file.uploadUrl)) {
        const fresh = await api.refresh(entry.jobId);
        if (!fresh.ok) return fresh.reason;
        for (const file of entry.files) {
          if (fresh.done) file.stored = true;
          else
            file.uploadUrl =
              fresh.uploads.find((slot) => slot.mediaId === file.mediaId)?.uploadUrl ?? null;
        }
        await deps.save(entry);
      }

      let refused = false;
      for (const file of entry.files) {
        if (file.stored || !file.uploadUrl) continue;
        const result = await api.put(file.uploadUrl, file.blob, file.mime);
        if (result === "expired") {
          file.uploadUrl = null;
          refused = true;
          break;
        }
        file.stored = true;
        await deps.save(entry);
      }
      if (refused) {
        refusals += 1;
        if (refusals >= MAX_REFUSALS) return "rejected";
        await deps.save(entry);
        continue;
      }
      // A file with no URL even now: ask again rather than confirm something that is not there.
      if (entry.files.some((file) => !file.stored)) {
        refusals += 1;
        if (refusals >= MAX_REFUSALS) return "rejected";
        continue;
      }

      const confirmed = await api.confirm(entry.jobId);
      if (confirmed.ok) {
        await deps.remove(entry.id);
        return "sent";
      }
      if (confirmed.reason === "not_allowed") return "not_allowed";
      // "incomplete": storage is missing a file, or has a partial one. Send them all again.
      forgetUrls();
      refusals += 1;
      if (refusals >= MAX_REFUSALS) return "rejected";
      await deps.save(entry);
    } catch {
      deps.onWaiting(attempt);
      await deps.sleep(uploadRetryDelayMs(attempt));
      attempt += 1;
    }
  }
}
