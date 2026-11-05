import { describe, expect, it } from "vitest";
import {
  type CaptureFileSpec,
  fitWithin,
  MAX_SCAN_PAGES,
  planCaptureFiles,
  READABLE_COPY_MAX_BYTES,
  readableMedia,
  scanMimeType,
} from "./capture-files.ts";

const page = (index: number, mime = "image/jpeg"): CaptureFileSpec => ({
  role: "page",
  page: index,
  mime,
  size: 1000,
});
const copy = (index: number, overrides: Partial<CaptureFileSpec> = {}): CaptureFileSpec => ({
  role: "copy",
  page: index,
  mime: "image/jpeg",
  size: 500,
  ...overrides,
});

describe("fitWithin", () => {
  it("scales the longer side down to the limit and keeps the proportions", () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("never scales up", () => {
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(2000, 1000, 2000)).toEqual({ width: 2000, height: 1000 });
  });

  it("never rounds a side down to nothing", () => {
    expect(fitWithin(100000, 1, 2000).height).toBe(1);
  });
});

describe("planCaptureFiles for a recording", () => {
  const recording: CaptureFileSpec = { role: "recording", page: 0, mime: "audio/webm", size: 5 };

  it("accepts one audio file", () => {
    expect(planCaptureFiles("voice", [recording])).toEqual([]);
  });

  it("refuses anything else", () => {
    expect(planCaptureFiles("voice", [])).not.toEqual([]);
    expect(planCaptureFiles("voice", [recording, recording])).not.toEqual([]);
    expect(planCaptureFiles("voice", [{ ...recording, mime: "image/jpeg" }])).not.toEqual([]);
    expect(planCaptureFiles("voice", [page(0)])).not.toEqual([]);
  });
});

describe("planCaptureFiles for handwriting", () => {
  it("accepts pages followed by their copies", () => {
    expect(planCaptureFiles("handwriting", [page(0), copy(0)])).toEqual([]);
    expect(
      planCaptureFiles("handwriting", [page(0, "image/heic"), page(1), copy(0), copy(1)]),
    ).toEqual([]);
    expect(planCaptureFiles("handwriting", [page(0)])).toEqual([]);
  });

  it("holds at most four pages", () => {
    const many = Array.from({ length: MAX_SCAN_PAGES + 1 }, (_, i) => page(i));
    expect(planCaptureFiles("handwriting", many)).not.toEqual([]);
    expect(planCaptureFiles("handwriting", many.slice(0, MAX_SCAN_PAGES))).toEqual([]);
  });

  it("needs at least one page", () => {
    expect(planCaptureFiles("handwriting", [])).not.toEqual([]);
  });

  it("refuses copies of pages that are not there, or two for one page", () => {
    expect(planCaptureFiles("handwriting", [page(0), copy(1)])).not.toEqual([]);
    expect(planCaptureFiles("handwriting", [page(0), copy(0), copy(0)])).not.toEqual([]);
  });

  it("refuses a copy the reader cannot take", () => {
    expect(planCaptureFiles("handwriting", [page(0), copy(0, { mime: "image/heic" })])).not.toEqual(
      [],
    );
    expect(
      planCaptureFiles("handwriting", [page(0), copy(0, { size: READABLE_COPY_MAX_BYTES + 1 })]),
    ).not.toEqual([]);
  });

  it("refuses pages out of order, copies before pages, empty files and non-images", () => {
    expect(planCaptureFiles("handwriting", [page(1)])).not.toEqual([]);
    expect(planCaptureFiles("handwriting", [copy(0), page(0)])).not.toEqual([]);
    expect(planCaptureFiles("handwriting", [{ ...page(0), size: 0 }])).not.toEqual([]);
    expect(planCaptureFiles("handwriting", [page(0, "audio/webm")])).not.toEqual([]);
    expect(
      planCaptureFiles("handwriting", [
        { role: "recording", page: 0, mime: "audio/webm", size: 5 },
      ]),
    ).not.toEqual([]);
  });
});

describe("readableMedia", () => {
  const row = (id: string, derivedFrom: string | null = null) => ({
    id,
    derived_from_media_id: derivedFrom,
  });
  const ids = (rows: { id: string }[]) => rows.map((media) => media.id);

  it("passes a recording through", () => {
    expect(readableMedia([row("a")])).toEqual([row("a")]);
  });

  it("swaps each page for its readable copy, keeping page order", () => {
    // Registration order: pages first, then their copies.
    const rows = [row("p1"), row("p2"), row("p3"), row("c2", "p2"), row("c1", "p1")];
    expect(ids(readableMedia(rows))).toEqual(["c1", "c2", "p3"]);
  });

  it("reads a page as it is when it has no copy", () => {
    expect(ids(readableMedia([row("p1"), row("p2")]))).toEqual(["p1", "p2"]);
  });

  it("ignores a copy whose original is not in the list", () => {
    expect(ids(readableMedia([row("c9", "gone"), row("p1")]))).toEqual(["p1"]);
  });
});

describe("scanMimeType", () => {
  it("trusts the declared type when the vault stores it", () => {
    expect(scanMimeType({ type: "image/jpeg", name: "a.jpg" })).toBe("image/jpeg");
    expect(scanMimeType({ type: "image/HEIC", name: "a.heic" })).toBe("image/heic");
  });

  it("falls back to the file name when the browser leaves the type empty", () => {
    expect(scanMimeType({ type: "", name: "IMG_0042.HEIC" })).toBe("image/heic");
    expect(scanMimeType({ type: "application/octet-stream", name: "page.png" })).toBe("image/png");
  });

  it("refuses everything else", () => {
    expect(scanMimeType({ type: "image/gif", name: "a.gif" })).toBeNull();
    expect(scanMimeType({ type: "application/pdf", name: "a.pdf" })).toBeNull();
    expect(scanMimeType({ type: "", name: "notes" })).toBeNull();
    expect(scanMimeType({ type: "", name: "a.tiff" })).toBeNull();
  });
});
