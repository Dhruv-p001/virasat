import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, MAX_PAGES, MAX_TOTAL_IMAGE_BYTES, validateImages } from "./images.ts";
import type { HandwritingImage } from "./types.ts";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

const jpeg: HandwritingImage = { data: bytes(0xff, 0xd8, 0xff, 0xe0), mimeType: "image/jpeg" };
const png: HandwritingImage = {
  data: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0),
  mimeType: "image/png",
};
const gif: HandwritingImage = { data: ascii("GIF89a...."), mimeType: "image/gif" };
const webp: HandwritingImage = { data: ascii("RIFF\0\0\0\0WEBPVP8 "), mimeType: "image/webp" };

describe("validateImages", () => {
  it("accepts real JPEG, PNG, GIF and WebP headers", () => {
    expect(validateImages([jpeg, png, gif, webp])).toEqual([]);
  });

  it("rejects bytes that do not match the declared type", () => {
    expect(validateImages([{ data: ascii("%PDF-1.7"), mimeType: "image/jpeg" }])).toEqual([
      "images.0: bytes do not match the declared type",
    ]);
    expect(validateImages([{ ...png, mimeType: "image/jpeg" }])).toEqual([
      "images.0: bytes do not match the declared type",
    ]);
    // RIFF alone is a WAV or AVI, not WebP.
    expect(
      validateImages([{ data: ascii("RIFF\0\0\0\0WAVEfmt "), mimeType: "image/webp" }]),
    ).toEqual(["images.0: bytes do not match the declared type"]);
  });

  it("rejects an empty image and an unsupported declared type", () => {
    expect(validateImages([{ data: bytes(), mimeType: "image/jpeg" }])).toEqual([
      "images.0: empty",
    ]);
    const heic = { data: ascii("ftypheic"), mimeType: "image/heic" } as unknown as HandwritingImage;
    expect(validateImages([heic])).toEqual(["images.0: unsupported type"]);
  });

  it("rejects an image over the per-image byte cap", () => {
    const big = { data: new Uint8Array(MAX_IMAGE_BYTES + 1), mimeType: "image/jpeg" as const };
    big.data.set([0xff, 0xd8, 0xff]);
    expect(validateImages([big])).toEqual([`images.0: over ${MAX_IMAGE_BYTES} bytes`]);
  });

  it("rejects too many pages, and too many bytes across pages", () => {
    expect(validateImages(Array.from({ length: MAX_PAGES + 1 }, () => jpeg))).toEqual([
      `images: more than ${MAX_PAGES} pages`,
    ]);

    // Five pages just under the per-image cap add up to more than the request cap.
    const page = { data: new Uint8Array(MAX_IMAGE_BYTES - 1), mimeType: "image/jpeg" as const };
    page.data.set([0xff, 0xd8, 0xff]);
    expect(validateImages(Array.from({ length: 5 }, () => page))).toEqual([
      `images: over ${MAX_TOTAL_IMAGE_BYTES} bytes in total`,
    ]);
  });
});
