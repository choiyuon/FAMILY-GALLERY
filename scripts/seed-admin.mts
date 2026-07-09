// Manual admin seed for a remote DB (Neon). The local PGlite dev DB seeds the
// admin automatically on boot, so this is mainly for production setup.
// Run with: npm run seed:admin
import { seedFromEnv } from "../src/lib/seed/admin";

await seedFromEnv();
console.log("Admin seed complete.");
