import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages must not be bundled by Turbopack — keep them external
  // so they load from node_modules at runtime on the server.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@node-rs/argon2",
    "@neondatabase/serverless",
  ],
  // Next.js blocks cross-origin requests to dev-only assets (JS chunks, HMR)
  // by default — allow LAN access for testing on other devices on the same
  // Wi-Fi. See node_modules/next/dist/docs/.../allowedDevOrigins.md.
  allowedDevOrigins: ["192.168.45.235"],
};

export default nextConfig;
