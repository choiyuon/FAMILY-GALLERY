import { beforeEach, describe, expect, it } from "vitest";
import { insertTestUser, testSql, truncateAll } from "../helpers/db";
import { createInvite, redeemInvite, InviteError } from "@/lib/invites/service";
import { hashToken } from "@/lib/invites/tokens";

beforeEach(truncateAll);

describe("createInvite", () => {
  it("creates an invite row owned by the admin with a hashed token", async () => {
    const admin = await insertTestUser({ role: "admin" });
    const { token, expiresAt } = await createInvite({ adminId: admin.id });

    const rows = await testSql`SELECT token, created_by, expires_at FROM invites`;
    expect(rows).toHaveLength(1);
    // DB stores the hash, not the plaintext
    expect(rows[0].token).toBe(hashToken(token));
    expect(rows[0].created_by).toBe(admin.id);
    expect(new Date(rows[0].expires_at as string).getTime()).toBe(expiresAt.getTime());
  });
});

describe("redeemInvite", () => {
  it("creates a user and marks the invite used", async () => {
    const admin = await insertTestUser({ role: "admin" });
    const { token } = await createInvite({ adminId: admin.id });

    const result = await redeemInvite({
      token,
      email: "kid@example.com",
      passwordHash: "hash",
      displayName: "동생",
    });

    expect(result.userId).toBeDefined();
    const userRows = await testSql`SELECT email, role FROM users WHERE email = 'kid@example.com'`;
    expect(userRows[0].role).toBe("member");

    // Look up invite by its hash
    const inviteRows =
      await testSql`SELECT used_at, used_by FROM invites WHERE token = ${hashToken(token)}`;
    expect(inviteRows[0].used_at).not.toBeNull();
    expect(inviteRows[0].used_by).toBe(result.userId);
  });

  it("rejects an expired invite", async () => {
    const admin = await insertTestUser({ role: "admin" });
    const past = new Date(Date.now() - 1000);
    // Insert with hashed token to match what the service expects
    await testSql`
      INSERT INTO invites (token, created_by, expires_at)
      VALUES (${hashToken("expired-token")}, ${admin.id}, ${past.toISOString()})
    `;
    await expect(
      redeemInvite({
        token: "expired-token",
        email: "x@example.com",
        passwordHash: "h",
        displayName: "x",
      })
    ).rejects.toThrow(InviteError);
  });

  it("rejects an already-used invite", async () => {
    const admin = await insertTestUser({ role: "admin" });
    const { token } = await createInvite({ adminId: admin.id });
    await redeemInvite({ token, email: "first@example.com", passwordHash: "h", displayName: "first" });
    await expect(
      redeemInvite({
        token,
        email: "second@example.com",
        passwordHash: "h",
        displayName: "second",
      })
    ).rejects.toThrow(InviteError);
  });

  it("rejects an unknown token", async () => {
    await expect(
      redeemInvite({
        token: "does-not-exist",
        email: "x@example.com",
        passwordHash: "h",
        displayName: "x",
      })
    ).rejects.toThrow(InviteError);
  });
});
