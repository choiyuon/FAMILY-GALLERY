import { describe, test, expect } from "vitest";
import { resolveDatabaseUrl, resolveE2eDatabaseUrl } from "@/lib/db/client";

// Guards against the test suite ever binding to the production database.
// `truncateAll()` wipes every table, so a test run pointed at prod destroys it.
describe("resolveDatabaseUrl", () => {
  test("ignores DATABASE_URL when running under Vitest", () => {
    expect(
      resolveDatabaseUrl({
        VITEST: "true",
        DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
      })
    ).toBeUndefined();
  });

  test("uses TEST_DATABASE_URL when running under Vitest", () => {
    expect(
      resolveDatabaseUrl({
        VITEST: "true",
        TEST_DATABASE_URL: "postgresql://test@ep-test-pooler.neon.tech/neondb",
        DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
      })
    ).toBe("postgresql://test@ep-test-pooler.neon.tech/neondb");
  });

  test("uses DATABASE_URL outside Vitest", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
      })
    ).toBe("postgresql://prod@ep-prod-pooler.neon.tech/neondb");
  });

  test("treats the .env.example placeholder as unset", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL:
          "postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require",
      })
    ).toBeUndefined();
  });

  test("treats a blank value as unset", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "   " })).toBeUndefined();
  });

  // Invariant for the suite that is actually running right now, with the real
  // .env.local loaded by vitest.config.ts.
  test("the running suite is not bound to the production database", () => {
    expect(resolveDatabaseUrl()).not.toBe(process.env.DATABASE_URL?.trim());
  });

  test("refuses a TEST_DATABASE_URL that points at the production database", () => {
    expect(() =>
      resolveDatabaseUrl({
        VITEST: "true",
        TEST_DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
        DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
      })
    ).toThrow(/TEST_DATABASE_URL/);
  });
});

// E2E runs the dev server in a separate process, so PGlite (in-memory, per
// process) cannot be shared — it needs a real database and truncates it.
describe("resolveE2eDatabaseUrl", () => {
  test("refuses to run when TEST_DATABASE_URL is unset", () => {
    expect(() =>
      resolveE2eDatabaseUrl({
        DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
      })
    ).toThrow(/TEST_DATABASE_URL/);
  });

  test("refuses a TEST_DATABASE_URL that points at the production database", () => {
    expect(() =>
      resolveE2eDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
        DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
      })
    ).toThrow(/TEST_DATABASE_URL/);
  });

  test("uses TEST_DATABASE_URL when it differs from DATABASE_URL", () => {
    expect(
      resolveE2eDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://test@ep-test-pooler.neon.tech/neondb",
        DATABASE_URL: "postgresql://prod@ep-prod-pooler.neon.tech/neondb",
      })
    ).toBe("postgresql://test@ep-test-pooler.neon.tech/neondb");
  });
});
