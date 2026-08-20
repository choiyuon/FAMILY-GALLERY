import { describe, expect, it } from "vitest";
import {
  isStorageConfigured,
  UPLOAD_URL_TTL_MS,
  VIEW_URL_TTL_MS,
} from "@/lib/storage/blob";

describe("signed URL lifetimes", () => {
  // spec §13 / AGENTS.md §5 — these are a security ceiling, not a tuning knob.
  it("expires upload URLs after 5 minutes", () => {
    expect(UPLOAD_URL_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("expires view URLs after 24 hours", () => {
    expect(VIEW_URL_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("isStorageConfigured", () => {
  it("is false when neither a read-write token nor OIDC credentials exist", () => {
    expect(isStorageConfigured({})).toBe(false);
  });

  it("is true with a static read-write token", () => {
    expect(isStorageConfigured({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" })).toBe(true);
  });

  it("is true with OIDC credentials plus a store id", () => {
    expect(
      isStorageConfigured({ VERCEL_OIDC_TOKEN: "eyJ", BLOB_STORE_ID: "store_abc" })
    ).toBe(true);
  });

  it("is false with an OIDC token but no store id", () => {
    expect(isStorageConfigured({ VERCEL_OIDC_TOKEN: "eyJ" })).toBe(false);
  });
});
