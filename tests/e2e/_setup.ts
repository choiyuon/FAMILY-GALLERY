import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../../src/lib/auth/password";

// NOTE: E2E runs in a separate process from the dev server, so it cannot share
// the in-memory PGlite database. These tests require a real shared DB — set
// DATABASE_URL (a throwaway Neon branch) before running `npm run test:e2e`.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "E2E tests need a shared database. Set DATABASE_URL to a Neon branch in .env.local " +
      "(in-memory PGlite cannot be shared across processes)."
  );
}

const sql = neon(process.env.DATABASE_URL);

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
