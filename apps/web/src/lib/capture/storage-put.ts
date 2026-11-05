/**
 * A file goes to storage as a plain multipart PUT to a signed upload URL, as the storage client
 * itself does it (ADR 0012). "expired" means the URL is no longer accepted, so ask for a new one.
 * Network failures and server errors throw, so the caller retries.
 */
export async function putToSignedUrl(
  url: string,
  blob: Blob,
  mime: string,
): Promise<"ok" | "exists" | "expired"> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  // Plain mime type: the bucket's allow-list has no codec parameters.
  body.append("", new Blob([blob], { type: mime }));
  const response = await fetch(url, { method: "PUT", body });
  if (response.ok) return "ok";
  if (response.status === 409) return "exists";
  if (response.status >= 400 && response.status < 500) return "expired";
  throw new Error(`Upload failed (${response.status})`);
}
