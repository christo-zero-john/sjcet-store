import { createHash, randomBytes } from "node:crypto";

export type HandoffToken = Readonly<{ rawToken: string; sha256: string }>;

/**
 * Generates a 32-byte base64url handoff token and its lowercase SHA-256 hash.
 * Only the hash is ever stored; the raw token is returned once for the QR.
 */
export function createHandoffToken(): HandoffToken {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, sha256: hashHandoffToken(rawToken) };
}

export function hashHandoffToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Builds the application-owned handoff URL encoded in the QR. It contains only
 * the opaque token — never order data, an internal UUID, or a provider URL.
 */
export function buildHandoffUrl(siteUrl: string, rawToken: string): string {
  return new URL(`/pay/${rawToken}`, siteUrl).toString();
}
