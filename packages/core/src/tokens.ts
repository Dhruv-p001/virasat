const MIN_TOKEN_BYTES = 16; // 128 bits, the floor the brief sets for share and contributor links.

/** Unguessable URL-safe token for share links, contributor links and invites. */
export function generateToken(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < MIN_TOKEN_BYTES) {
    throw new RangeError(`Token must be at least ${MIN_TOKEN_BYTES} bytes, got ${bytes}`);
  }
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString("base64url");
}
