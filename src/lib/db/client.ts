import path from "node:path";
import { eq } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

// Driver selection:
//  - a real Postgres URL → Neon serverless (production / Vercel).
//  - otherwise → local in-memory PGlite, migrated + seeded at boot (no external DB).
// To connect Neon later, just set DATABASE_URL in .env.local — no code change.
//
// Under Vitest the URL comes from TEST_DATABASE_URL and NEVER from DATABASE_URL:
// the suite calls truncateAll(), so falling back to DATABASE_URL would wipe the
// production database. With TEST_DATABASE_URL unset, tests get their own
// throwaway PGlite instance instead.
export function resolveDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const url = (env.VITEST ? env.TEST_DATABASE_URL : env.DATABASE_URL)?.trim();
  if (!url) return undefined;
  if (url.includes("ep-xxx")) return undefined; // .env.example placeholder
  if (env.VITEST && url === env.DATABASE_URL?.trim()) {
    throw new Error(
      "TEST_DATABASE_URL is the same as DATABASE_URL. Tests truncate every " +
        "table — point TEST_DATABASE_URL at a separate database branch, or " +
        "unset it to run against the in-memory PGlite backend."
    );
  }
  return url;
}

// Playwright drives the dev server in a separate process, so the per-process
// PGlite instance cannot be shared. E2E therefore needs a real database and
// truncates it — which makes an explicit, non-production URL mandatory.
export function resolveE2eDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const url = env.TEST_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "E2E tests need TEST_DATABASE_URL (in-memory PGlite cannot be shared " +
        "across processes). Point it at a throwaway database branch — these " +
        "tests truncate every table."
    );
  }
  if (url === env.DATABASE_URL?.trim()) {
    throw new Error(
      "TEST_DATABASE_URL is the same as DATABASE_URL. E2E tests truncate " +
        "every table — point TEST_DATABASE_URL at a separate database branch."
    );
  }
  return url;
}

const databaseUrl = resolveDatabaseUrl();
const useRemote = !!databaseUrl;

export type Db = PgliteDatabase<typeof schema>;

// Tagged-template raw SQL returning an array of rows. Used by the test helpers
// so they can talk to whichever backend `db` is bound to.
export type RawSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

interface Backend {
  db: Db;
  sqlRaw: RawSql;
}

// Lazy, memoized init — no top-level await, so this module is safe to import
// from Server Components, Route Handlers, Vitest, and plain tsx scripts alike.
// Stored on globalThis so every module instance in the Next dev server (route
// handlers, pages, proxy) shares ONE backend — critical for the in-memory
// PGlite database, whose data only lives inside a single instance.
const globalForDb = globalThis as unknown as {
  __familyGalleryBackend?: Promise<Backend>;
};

async function initRemote(): Promise<Backend> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const client = neon(databaseUrl!);
  const db = drizzle(client, { schema }) as unknown as Db;
  const sqlRaw = ((strings, ...values) =>
    (client as unknown as RawSql)(strings, ...values)) as RawSql;
  return { db, sqlRaw };
}

async function initLocal(): Promise<Backend> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "src/lib/db/migrations"),
  });

  const sqlRaw: RawSql = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1];
    const res = await client.query<Record<string, unknown>>(text, values as unknown[]);
    return res.rows;
  };

  // Dev convenience: seed the first admin into the ephemeral PGlite DB so login
  // works immediately. Skipped under Vitest (tests manage their own rows).
  if (!process.env.VITEST && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, "admin"))
      .limit(1);
    if (!existing) {
      const { hashPassword } = await import("../auth/password");
      await db.insert(schema.users).values({
        email: process.env.ADMIN_EMAIL.toLowerCase().trim(),
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD),
        displayName: process.env.ADMIN_DISPLAY_NAME ?? "관리자",
        role: "admin",
      });
    }
  }

  return { db, sqlRaw };
}

function getBackend(): Promise<Backend> {
  globalForDb.__familyGalleryBackend ??= useRemote ? initRemote() : initLocal();
  return globalForDb.__familyGalleryBackend;
}

export async function getDb(): Promise<Db> {
  return (await getBackend()).db;
}

export async function getSql(): Promise<RawSql> {
  return (await getBackend()).sqlRaw;
}
