import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages must not be bundled by Turbopack — keep them external
  // so they load from node_modules at runtime on the server.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@node-rs/argon2",
    "@neondatabase/serverless",
  ],
};

export default nextConfig;
