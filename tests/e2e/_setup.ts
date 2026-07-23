import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../../src/lib/auth/password";
import { resolveE2eDatabaseUrl } from "../../src/lib/db/client";

// NOTE: E2E runs in a separate process from the dev server, so it cannot share
// the in-memory PGlite database. These tests require a real shared DB — set
// TEST_DATABASE_URL to a throwaway Neon branch before running `npm run test:e2e`.
// resolveE2eDatabaseUrl() refuses DATABASE_URL, because resetTestUsers()
// truncates every table it touches.
const sql = neon(resolveE2eDatabaseUrl());

export async function resetTestUsers() {
  await sql`TRUNCATE TABLE audit_log, invites, users RESTART IDENTITY CASCADE`;
  const passwordHash = await hashPassword("e2epassword");
  await sql`
    INSERT INTO users (email, password_hash, display_name, role)
    VALUES
      ('admin-e2e@example.com', ${passwordHash}, '관리자', 'admin'),
      ('member-e2e@example.com', ${passwordHash}, '멤버', 'member')
  `;
}
