import { getSql, type RawSql } from "@/lib/db/client";

// Tagged-template raw SQL bound to whichever backend `db` uses (PGlite locally,
// Neon when DATABASE_URL is set). Mirrors neon()'s "returns rows array" shape.
export const testSql: RawSql = async (strings, ...values) =>
  (await getSql())(strings, ...values);

export async function truncateAll() {
  await testSql`TRUNCATE TABLE audit_log, invites, users RESTART IDENTITY CASCADE`;
}

export async function insertTestUser(
  overrides: Partial<{
    email: string;
    passwordHash: string;
    displayName: string;
    role: "admin" | "member";
  }> = {}
) {
  const row = {
    email: overrides.email ?? `u-${Math.random().toString(36).slice(2, 8)}@test`,
    passwordHash: overrides.passwordHash ?? "x",
    displayName: overrides.displayName ?? "Test",
    role: overrides.role ?? "member",
  };
  const [user] = await testSql`
    INSERT INTO users (email, password_hash, display_name, role)
    VALUES (${row.email}, ${row.passwordHash}, ${row.displayName}, ${row.role})
    RETURNING id, email, role
  `;
  return user as { id: string; email: string; role: "admin" | "member" };
}
