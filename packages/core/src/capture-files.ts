// The files of one capture as the organiser's browser sends them (ADR 0014): one recording, or up to
// four handwritten pages, each with a readable copy. Shared by the browser, which checks the plan
// before sending, and the server, which checks it again before registering anything.

/** Pages in one handwriting capture. The database holds the same number (add_capture_media). */
export const MAX_SCAN_PAGES = 4;

/**
 * The readable copy of a page: JPEG, longest side at most this many pixels. Big enough to read
 * handwriting, small enough to be well under the reader's 5 MB per image and quick to send.
 */
export const READABLE_COPY_MAX_EDGE = 2000;
export const READABLE_COPY_MIME = "image/jpeg";
/** Encoder qualities to try, best first, until the copy fits the reader's limit. */
export const READABLE_COPY_QUALITIES = [0.85, 0.7, 0.55, 0.4] as const;
/** The reader's per-image limit, mirrored in the database (add_capture_media). */
export const READABLE_COPY_MAX_BYTES = 5 * 1024 * 1024;

export type CaptureSource = "voice" | "handwriting";
export type CaptureFileRole = "recording" | "page" | "copy";

/** What the server needs to know about a file before it exists in storage. */
export type CaptureFileSpec = {
  role: CaptureFileRole;
  /** The page number, from 0. For a "copy", the page it is the readable copy of. Always 0 for a recording. */
  page: number;
  /** Base mime type, e.g. "image/jpeg". */
  mime: string;
  size: number;
  width?: number | undefined;
  height?: number | undefined;
};

/** Scales `width` x `height` down to fit within `maxEdge` on the longer side. Never scales up. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const READABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Problems with a plan of files, as short "what: rule" strings. Empty means it can be registered.
 * Files must come in the order the server registers them: the recording, or the pages in page
 * order and then the copies.
 */
export function planCaptureFiles(
  source: CaptureSource,
  files: readonly CaptureFileSpec[],
): string[] {
  const issues: string[] = [];
  for (const [index, file] of files.entries()) {
    if (!Number.isInteger(file.size) || file.size <= 0) issues.push(`files.${index}: empty`);
    if (file.width !== undefined && (!Number.isInteger(file.width) || file.width <= 0))
      issues.push(`files.${index}: width`);
    if (file.height !== undefined && (!Number.isInteger(file.height) || file.height <= 0))
      issues.push(`files.${index}: height`);
  }

  if (source === "voice") {
    const [only] = files;
    if (files.length !== 1 || only?.role !== "recording" || only.page !== 0) {
      issues.push("files: a recording is exactly one file");
    } else if (!only.mime.startsWith("audio/")) {
      issues.push("files.0: not audio");
    }
    return issues;
  }

  const pages = files.filter((file) => file.role === "page");
  const copies = files.filter((file) => file.role === "copy");
  if (pages.length + copies.length !== files.length) issues.push("files: only pages and copies");
  if (pages.length < 1) issues.push("files: at least one page");
  if (pages.length > MAX_SCAN_PAGES) issues.push(`files: more than ${MAX_SCAN_PAGES} pages`);
  if (files.some((file, index) => file.role === "page" && index >= pages.length)) {
    issues.push("files: pages come before copies");
  }
  pages.forEach((page, index) => {
    if (page.page !== index) issues.push(`files.${index}: pages are numbered from 0 in order`);
    if (!page.mime.startsWith("image/")) issues.push(`files.${index}: a page must be an image`);
  });
  const seen = new Set<number>();
  for (const copy of copies) {
    if (copy.page < 0 || copy.page >= pages.length)
      issues.push("copy: for a page that is not there");
    if (seen.has(copy.page)) issues.push("copy: more than one for a page");
    seen.add(copy.page);
    if (!READABLE_TYPES.has(copy.mime)) issues.push("copy: not a type the reader takes");
    if (copy.size > READABLE_COPY_MAX_BYTES) issues.push("copy: over the reader's limit");
  }
  return issues;
}

/**
 * The files to read, in page order: each original, or its readable copy when it has one (ADR 0014).
 * The reader takes JPEG, PNG or WebP of at most 5 MB, and a phone photo is often neither, so the
 * organiser's browser makes a copy. The original is never changed, only passed over here.
 * `rows` are a capture's files, oldest first.
 */
export function readableMedia<Row extends { id: string; derived_from_media_id: string | null }>(
  rows: readonly Row[],
): Row[] {
  const copies = new Map<string, Row>();
  for (const row of rows) {
    if (row.derived_from_media_id) copies.set(row.derived_from_media_id, row);
  }
  return rows.filter((row) => !row.derived_from_media_id).map((row) => copies.get(row.id) ?? row);
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Page photos the vault stores (the scans bucket's allow-list). */
export const SCAN_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * A page photo's type. Browsers often leave it empty for HEIC (Windows, some Android), so the
 * file name is the fallback. Null when it is not a photo format the vault stores.
 */
export function scanMimeType(file: { type: string; name: string }): string | null {
  const declared = (file.type.split(";")[0] ?? "").trim().toLowerCase();
  if (declared && SCAN_MIME_TYPES.includes(declared)) return declared;
  if (declared && declared !== "application/octet-stream") return null;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}
