import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { deleteObject, listObjects } from "@/lib/storage/blob";
import { findOrphanKeys, type StoredBlob } from "@/lib/storage/orphans";
import { blobKeysOf, listExpiredTrash, purgeMedia } from "./trash";

/**
 * The object store, narrowed to what cleanup needs and injectable so tests can
 * substitute an in-memory store. That substitution is a safety requirement, not
 * a convenience: the suite truncates the media table, which would make every
 * real object look unreferenced and get it deleted.
 */
export interface CleanupStorage {
  list(): Promise<StoredBlob[]>;
  delete(pathname: string): Promise<void>;
}

const realStorage: CleanupStorage = {
  list: listObjects,
  delete: deleteObject,
};

export interface CleanupResult {
  purged: number;
  swept: number;
}

/** Delete one object, tolerating an object that is already gone. */
async function forget(storage: CleanupStorage, pathname: string): Promise<void> {
  await storage.delete(pathname).catch(() => {});
}

/**
 * The daily maintenance pass, run by /api/cron/cleanup.
 *
 * 1. Media whose 30-day trash hold has expired is really deleted, objects first.
 * 2. Objects that no media row points at, and that are old enough not to be an
 *    upload in flight, are swept.
 *
 * Both steps are idempotent, so a duplicated or missed cron run is harmless.
 */
export async function runCleanup(
  { storage = realStorage }: { storage?: CleanupStorage } = {}
): Promise<CleanupResult> {
  const expired = await listExpiredTrash();
  for (const row of expired) {
    for (const key of blobKeysOf(row)) await forget(storage, key);
  }
  await purgeMedia(expired.map((row) => row.id));
  if (expired.length > 0) {
    await writeAudit({
      action: "trash_purge",
      metadata: { count: expired.length, ids: expired.map((row) => row.id) },
    });
  }

  // Read the surviving references only after the purge, so objects just deleted
  // above are not counted as orphans a second time.
  const db = await getDb();
  const rows = await db.select().from(media);
  // Soft-deleted rows still count: their objects must live until their own hold
  // expires and step 1 removes them deliberately.
  const referenced = new Set(rows.flatMap(blobKeysOf));

  const orphans = findOrphanKeys(await storage.list(), referenced);
  for (const key of orphans) await forget(storage, key);
  if (orphans.length > 0) {
    await writeAudit({
      action: "orphan_sweep",
      metadata: { count: orphans.length, keys: orphans.slice(0, 50) },
    });
  }

  return { purged: expired.length, swept: orphans.length };
}
