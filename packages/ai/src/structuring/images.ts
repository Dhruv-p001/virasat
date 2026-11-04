import type { HandwritingImage, ImageMimeType } from "./types.ts";

/** The API takes at most 5 MB per image and 32 MB per request. Callers send a downscaled derived copy. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
/** Pages per call. A recipe is a page or two, and a long diary is better read in parts. */
export const MAX_PAGES = 8;

const startsWith = (data: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, i) => data[offset + i] === byte);

/** Checks the first bytes against the declared type, so a PDF renamed .jpg never reaches the API. */
const MATCHERS: Record<ImageMimeType, (data: Uint8Array) => boolean> = {
  "image/jpeg": (d) => startsWith(d, [0xff, 0xd8, 0xff]),
  "image/png": (d) => startsWith(d, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/gif": (d) =>
    startsWith(d, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(d, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  // "RIFF" <4-byte size> "WEBP"
  "image/webp": (d) =>
    startsWith(d, [0x52, 0x49, 0x46, 0x46]) && startsWith(d, [0x57, 0x45, 0x42, 0x50], 8),
};

/** Problems with the images, as "path: rule" strings. Empty means they can be sent. */
export function validateImages(images: readonly HandwritingImage[]): string[] {
  const issues: string[] = [];
  if (images.length > MAX_PAGES) issues.push(`images: more than ${MAX_PAGES} pages`);

  let total = 0;
  images.forEach((image, index) => {
    total += image.data.byteLength;
    const matches = Object.hasOwn(MATCHERS, image.mimeType) ? MATCHERS[image.mimeType] : undefined;
    if (image.data.byteLength === 0) issues.push(`images.${index}: empty`);
    else if (!matches) issues.push(`images.${index}: unsupported type`);
    else if (!matches(image.data))
      issues.push(`images.${index}: bytes do not match the declared type`);
    if (image.data.byteLength > MAX_IMAGE_BYTES)
      issues.push(`images.${index}: over ${MAX_IMAGE_BYTES} bytes`);
  });
  if (total > MAX_TOTAL_IMAGE_BYTES)
    issues.push(`images: over ${MAX_TOTAL_IMAGE_BYTES} bytes in total`);
  return issues;
}
