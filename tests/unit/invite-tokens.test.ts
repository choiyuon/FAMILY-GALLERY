import { describe, expect, it } from "vitest";
import { generateInviteToken, INVITE_EXPIRY_DAYS } from "@/lib/invites/tokens";

describe("invite tokens", () => {
  it("generates URL-safe tokens of the configured length", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it("produces unique tokens across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateInviteToken());
    expect(seen.size).toBe(1000);
  });

  it("exposes a 7-day expiry constant", () => {
    expect(INVITE_EXPIRY_DAYS).toBe(7);
  });
});
