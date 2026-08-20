import { describe, expect, it } from "vitest";
import { findOrphanKeys, ORPHAN_GRACE_MS } from "@/lib/storage/orphans";

const NOW = Date.parse("2026-08-20T00:00:00Z");
const ago = (ms: number) => new Date(NOW - ms);
const HOUR = 60 * 60 * 1000;

describe("ORPHAN_GRACE_MS", () => {
  it("is long enough that an in-flight upload is never swept", () => {
    // An upload PUTs the original, then calls /complete. Anything shorter than
    // a few hours risks deleting a photo mid-upload.
    expect(ORPHAN_GRACE_MS).toBeGreaterThanOrEqual(24 * HOUR);
  });
});

describe("findOrphanKeys", () => {
  const known = new Set(["original/keep.jpeg", "medium/keep.webp", "thumb/keep.webp"]);

  it("keeps every object a media row points at", () => {
    const blobs = [
      { pathname: "original/keep.jpeg", uploadedAt: ago(90 * 24 * HOUR) },
      { pathname: "medium/keep.webp", uploadedAt: ago(90 * 24 * HOUR) },
      { pathname: "thumb/keep.webp", uploadedAt: ago(90 * 24 * HOUR) },
    ];
    expect(findOrphanKeys(blobs, known, NOW)).toEqual([]);
  });

  it("sweeps an object no media row references", () => {
    const blobs = [{ pathname: "original/lost.jpeg", uploadedAt: ago(48 * HOUR) }];
    expect(findOrphanKeys(blobs, known, NOW)).toEqual(["original/lost.jpeg"]);
  });

  it("spares a recent unreferenced object, because the upload may still be running", () => {
    const blobs = [{ pathname: "original/inflight.jpeg", uploadedAt: ago(2 * HOUR) }];
    expect(findOrphanKeys(blobs, known, NOW)).toEqual([]);
  });

  it("sweeps abandoned video staging frames", () => {
    const blobs = [{ pathname: "thumb-src/abandoned.jpg", uploadedAt: ago(48 * HOUR) }];
    expect(findOrphanKeys(blobs, known, NOW)).toEqual(["thumb-src/abandoned.jpg"]);
  });

  it("returns nothing for an empty store", () => {
    expect(findOrphanKeys([], known, NOW)).toEqual([]);
  });

  it("keeps referenced objects while sweeping unreferenced ones in the same pass", () => {
    const blobs = [
      { pathname: "original/keep.jpeg", uploadedAt: ago(48 * HOUR) },
      { pathname: "original/lost-a.jpeg", uploadedAt: ago(48 * HOUR) },
      { pathname: "thumb/keep.webp", uploadedAt: ago(48 * HOUR) },
      { pathname: "medium/lost-b.webp", uploadedAt: ago(72 * HOUR) },
    ];
    expect(findOrphanKeys(blobs, known, NOW).sort()).toEqual([
      "medium/lost-b.webp",
      "original/lost-a.jpeg",
    ]);
  });
});
