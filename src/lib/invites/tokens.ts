import { randomBytes } from "node:crypto";

export const INVITE_EXPIRY_DAYS = 7;

export function generateInviteToken(): string {
  // 32 random bytes → 43 URL-safe chars after base64url stripping.
  return randomBytes(32).toString("base64url");
}

export function expiresInDays(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
