/**
 * A post-sign-in destination, accepted only if it is a same-site path. Anything else (absolute
 * URLs, protocol-relative "//evil.example", backslash tricks) falls back, so links can't be
 * turned into open redirects.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || /^\/[\\/]/.test(next) || /\p{Cc}/u.test(next)) {
    return fallback;
  }
  try {
    const url = new URL(next, "http://same.site");
    return url.host === "same.site" ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
