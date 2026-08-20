import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages must not be bundled by Turbopack — keep them external
  // so they load from node_modules at runtime on the server.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@node-rs/argon2",
    "@neondatabase/serverless",
  ],
  // sharp's native addon dlopen()s libvips-cpp.so from a sibling package
  // (@img/sharp-libvips-linux-x64). Nothing requires that package from JS, so
  // output file tracing leaves the .so out of the function bundle and the route
  // dies at runtime with ERR_DLOPEN_FAILED. Pull the whole @img tree in for the
  // one route that touches sharp — same pattern the Next docs use for aws-crt.
  outputFileTracingIncludes: {
    "/api/media/upload/complete": ["./node_modules/@img/**/*"],
  },
  // Next.js blocks cross-origin requests to dev-only assets (JS chunks, HMR)
  // by default — allow LAN access for testing on other devices on the same
  // Wi-Fi. See node_modules/next/dist/docs/.../allowedDevOrigins.md.
  allowedDevOrigins: ["192.168.45.235"],
};

export default nextConfig;
