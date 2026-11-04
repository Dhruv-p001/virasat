/**
 * Version of the consent wording shown before recording (i18n keys `consent.*`, docs/consent.md).
 * Recorded with every consent. Any change to what the wording promises needs a new version, so
 * each stored consent points at the exact text the person agreed to.
 */
export const CONSENT_WORDING_VERSION = "2026-11-v1";

/** Longest single recording: enough for one recipe told slowly. Recording stops here. */
export const MAX_RECORDING_SECONDS = 10 * 60;

// Upload limits enforced by begin_capture() and the storage buckets (migration capture_and_recipes).
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_SCAN_BYTES = 20 * 1024 * 1024;

/**
 * Recording formats to try, best first. Chrome and Firefox on Android do webm/opus; Safari on
 * iOS only does mp4. The first one the browser's MediaRecorder reports as supported is used.
 */
export const RECORDING_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/** The first supported recording format, or null when the browser can't record at all. */
export function pickRecordingMimeType(isSupported: (mimeType: string) => boolean): string | null {
  return RECORDING_MIME_CANDIDATES.find((candidate) => isSupported(candidate)) ?? null;
}

/** "audio/webm;codecs=opus" becomes "audio/webm": what the database and storage buckets accept. */
export function baseMimeType(mimeType: string): string {
  return (mimeType.split(";")[0] ?? "").trim().toLowerCase();
}

/** Shape of a recording link token in a URL (generateToken output), checked before any lookup. */
export const RECORDING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

/** Seconds as m:ss for the recording timer. */
export function formatTimer(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const UPLOAD_RETRY_BASE_MS = 2_000;
const UPLOAD_RETRY_MAX_MS = 60_000;

/** Wait before upload retry number `attempt` (0 is the first retry): 2s, 4s, 8s ... capped at 60s. */
export function uploadRetryDelayMs(attempt: number): number {
  return Math.min(UPLOAD_RETRY_MAX_MS, UPLOAD_RETRY_BASE_MS * 2 ** Math.max(0, attempt));
}

/** The link an organiser sends to an elder. */
export function recordingLinkUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/record/${token}`;
}

/** wa.me link that opens WhatsApp with `text` ready to send. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
