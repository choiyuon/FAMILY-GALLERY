import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { resolveE2eDatabaseUrl } from "./src/lib/db/client";

loadEnv({ path: ".env.local" });

// Throws unless TEST_DATABASE_URL is set to something other than DATABASE_URL.
// The dev server under test must read the same throwaway database that
// resetTestUsers() truncates — otherwise E2E would seed one DB and assert
// against another.
const e2eDatabaseUrl = resolveE2eDatabaseUrl();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    // A dev server already running on :3000 reads .env.local and would point at
    // the production database, so always start a dedicated one for E2E.
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: e2eDatabaseUrl },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
