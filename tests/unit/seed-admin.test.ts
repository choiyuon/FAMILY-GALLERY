import { beforeEach, describe, expect, it } from "vitest";
import { testSql, truncateAll } from "../helpers/db";
import { seedAdminIfMissing } from "@/lib/seed/admin";
import { verifyPassword } from "@/lib/auth/password";

beforeEach(truncateAll);

describe("seedAdminIfMissing", () => {
  it("creates an admin user when none exists", async () => {
    await seedAdminIfMissing({
      email: "boss@example.com",
      password: "rootsecret",
      displayName: "관리자",
    });

    const rows = await testSql`SELECT email, role, password_hash, display_name FROM users WHERE email = 'boss@example.com'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
    expect(rows[0].display_name).toBe("관리자");
    expect(await verifyPassword("rootsecret", rows[0].password_hash as string)).toBe(true);
  });

  it("is a no-op when an admin already exists", async () => {
    await testSql`
      INSERT INTO users (email, password_hash, display_name, role)
      VALUES ('preexisting@a', 'x', 'pre', 'admin')
    `;
    await seedAdminIfMissing({
      email: "boss@example.com",
      password: "rootsecret",
      displayName: "관리자",
    });
    const rows = await testSql`SELECT email FROM users ORDER BY email`;
    expect(rows.map((r) => r.email)).toEqual(["preexisting@a"]);
  });

  it("throws when email or password is missing", async () => {
    await expect(seedAdminIfMissing({ email: "", password: "x", displayName: "a" }))
      .rejects.toThrow(/ADMIN_EMAIL/);
    await expect(seedAdminIfMissing({ email: "a@b", password: "", displayName: "a" }))
      .rejects.toThrow(/ADMIN_PASSWORD/);
  });
});
