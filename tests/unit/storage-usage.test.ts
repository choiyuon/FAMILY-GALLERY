import { describe, expect, it } from "vitest";
import {
  formatBytes,
  STORAGE_LIMIT_BYTES,
  STORAGE_WARN_BYTES,
  summarizeBlobs,
  usageLevel,
  usagePercent,
} from "@/lib/storage/usage";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe("free-tier thresholds", () => {
  it("caps at the ~1 GB Hobby allowance", () => {
    expect(STORAGE_LIMIT_BYTES).toBe(GB);
  });

  it("warns at 0.8 GB per AGENTS.md §6", () => {
    expect(STORAGE_WARN_BYTES).toBe(0.8 * GB);
  });
});

describe("usageLevel", () => {
  it("is ok well below the warning line", () => {
    expect(usageLevel(200 * MB)).toBe("ok");
  });

  it("is ok just under the warning line", () => {
    expect(usageLevel(STORAGE_WARN_BYTES - 1)).toBe("ok");
  });

  it("warns from the warning line up to the limit", () => {
    expect(usageLevel(STORAGE_WARN_BYTES)).toBe("warn");
    expect(usageLevel(STORAGE_LIMIT_BYTES - 1)).toBe("warn");
  });

  it("is critical once the limit is reached", () => {
    expect(usageLevel(STORAGE_LIMIT_BYTES)).toBe("critical");
    expect(usageLevel(2 * GB)).toBe("critical");
  });
});

describe("usagePercent", () => {
  it("is 0 for an empty store", () => {
    expect(usagePercent(0)).toBe(0);
  });

  it("reports the fraction of the limit used", () => {
    expect(usagePercent(GB / 2)).toBe(50);
  });

  it("clamps to 100 when over the limit", () => {
    expect(usagePercent(3 * GB)).toBe(100);
  });

  it("keeps one decimal so a nearly-empty store is not shown as 0", () => {
    expect(usagePercent(5 * MB)).toBe(0.5);
  });
});

describe("formatBytes", () => {
  it("shows an empty store as 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("scales through KB, MB and GB", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(120 * MB)).toBe("120 MB");
    expect(formatBytes(1.25 * GB)).toBe("1.25 GB");
  });

  it("drops the decimal for whole numbers", () => {
    expect(formatBytes(2 * MB)).toBe("2 MB");
  });

  it("loses precision as the number grows, so sizes stay glanceable", () => {
    expect(formatBytes(558_694_400)).toBe("533 MB"); // not 532.88 MB
    expect(formatBytes(STORAGE_WARN_BYTES)).toBe("819 MB");
    expect(formatBytes(41.98 * MB)).toBe("42 MB");
    expect(formatBytes(1234)).toBe("1.21 KB");
  });
});

describe("summarizeBlobs", () => {
  const blobs = [
    { pathname: "original/a.jpeg", size: 3_000_000 },
    { pathname: "original/b.heic", size: 2_000_000 },
    { pathname: "medium/a.webp", size: 120_000 },
    { pathname: "thumb/a.webp", size: 8_000 },
    { pathname: "edited/a.jpeg", size: 500_000 },
    { pathname: "thumb-src/a.jpg", size: 40_000 },
  ];

  it("totals every object", () => {
    const s = summarizeBlobs(blobs);
    expect(s.totalBytes).toBe(5_668_000);
    expect(s.objectCount).toBe(6);
  });

  it("groups bytes by the key prefix", () => {
    const s = summarizeBlobs(blobs);
    expect(s.byKind.original).toBe(5_000_000);
    expect(s.byKind.medium).toBe(120_000);
    expect(s.byKind.thumb).toBe(8_000);
    expect(s.byKind.edited).toBe(500_000);
  });

  it("files an unknown prefix under other, so the bar always sums to the total", () => {
    const s = summarizeBlobs(blobs);
    expect(s.byKind.other).toBe(40_000);
    const sum = Object.values(s.byKind).reduce((a, b) => a + b, 0);
    expect(sum).toBe(s.totalBytes);
  });

  it("handles an empty store", () => {
    const s = summarizeBlobs([]);
    expect(s.totalBytes).toBe(0);
    expect(s.objectCount).toBe(0);
    expect(s.byKind.original).toBe(0);
  });
});
