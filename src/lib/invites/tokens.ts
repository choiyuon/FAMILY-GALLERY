import { createHash, randomBytes } from "node:crypto";

export const INVITE_EXPIRY_DAYS = 7;

export function generateInviteToken(): string {
  // 32 random bytes → 43 URL-safe chars after base64url stripping.
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest of a token — stored in DB, never the raw token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiresInDays(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
