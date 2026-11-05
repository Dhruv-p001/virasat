import {
  fitWithin,
  READABLE_COPY_MAX_BYTES,
  READABLE_COPY_MAX_EDGE,
  READABLE_COPY_MIME,
  READABLE_COPY_QUALITIES,
} from "@virasat/core";

export type ReadableCopy = { blob: Blob; width: number; height: number };

/**
 * The copy of a page photo that the page reader takes (ADR 0014): upright, JPEG, longest side at
 * most 2000 px, under the reader's 5 MB. The original is never touched. Null when this browser
 * cannot open the photo (HEIC outside Safari, say), so the organiser can be told before sending.
 */
export async function makeReadableCopy(file: Blob): Promise<ReadableCopy | null> {
  let bitmap: ImageBitmap;
  try {
    // Applies the photo's rotation, so a phone photo taken sideways is upright in the copy.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, READABLE_COPY_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    // JPEG has no transparency: a PNG with a clear background would otherwise turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of READABLE_COPY_QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, READABLE_COPY_MIME, quality);
      });
      if (blob && blob.size > 0 && blob.size <= READABLE_COPY_MAX_BYTES) {
        return { blob, width, height };
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}
