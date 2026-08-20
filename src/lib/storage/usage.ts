// Vercel Blob Hobby includes roughly 1 GB of storage. Going over does not bill —
// it blocks Blob access for 30 days — so AGENTS.md §6 keeps a 0.8 GB warning
// line well below the wall.
export const STORAGE_LIMIT_BYTES = 1024 ** 3;
export const STORAGE_WARN_BYTES = 0.8 * 1024 ** 3;

export type UsageLevel = "ok" | "warn" | "critical";

export function usageLevel(usedBytes: number): UsageLevel {
  if (usedBytes >= STORAGE_LIMIT_BYTES) return "critical";
  if (usedBytes >= STORAGE_WARN_BYTES) return "warn";
  return "ok";
}

/** Share of the free allowance used, 0-100, one decimal. */
export function usagePercent(usedBytes: number): number {
  const pct = (usedBytes / STORAGE_LIMIT_BYTES) * 100;
  return Math.round(Math.min(pct, 100) * 10) / 10;
}

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  // Shed precision as the number grows: "533 MB" is easier to read at a glance
  // than "532.81 MB", while small values still need their decimals to mean
  // anything. Trailing zeros are dropped by Number's own formatting.
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const factor = 10 ** decimals;
  return `${Math.round(value * factor) / factor} ${UNITS[unit]}`;
}

// Keys are laid out by variant (see src/lib/media/variants.ts), so the prefix
// tells us what kind of object it is. Splitting usage this way answers the
// question an admin actually has: what is eating the allowance?
export const STORAGE_KINDS = ["original", "medium", "thumb", "edited", "other"] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

export interface StorageSummary {
  totalBytes: number;
  objectCount: number;
  byKind: Record<StorageKind, number>;
}

export function summarizeBlobs(
  blobs: readonly { pathname: string; size: number }[]
): StorageSummary {
  const byKind = Object.fromEntries(
    STORAGE_KINDS.map((k) => [k, 0])
  ) as Record<StorageKind, number>;

  let totalBytes = 0;
  for (const blob of blobs) {
    const prefix = blob.pathname.split("/")[0] as StorageKind;
    const kind = STORAGE_KINDS.includes(prefix) && prefix !== "other" ? prefix : "other";
    byKind[kind] += blob.size;
    totalBytes += blob.size;
  }

  return { totalBytes, objectCount: blobs.length, byKind };
}
