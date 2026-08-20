import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLog, media } from "@/lib/db/schema";

// spec §7: deleted media sits in the trash for 30 days before it is really gone.
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type TrashedMedia = typeof media.$inferSelect;

/** Media soft-deleted long enough ago that the grace period has run out. */
export async function listExpiredTrash(now: Date = new Date()): Promise<TrashedMedia[]> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);
  const db = await getDb();
  return db
    .select()
    .from(media)
    .where(and(isNotNull(media.deletedAt), lt(media.deletedAt, cutoff)));
}

/** Every stored object belonging to one media row. Optional keys may be absent. */
export function blobKeysOf(row: TrashedMedia): string[] {
  return [
    row.blobOriginalKey,
    row.blobMediumKey,
    row.blobThumbKey,
    row.blobEditedKey,
  ].filter((key): key is string => Boolean(key));
}

/**
 * The only place besides /trash/empty that issues a real DELETE (AGENTS.md §8).
 * Audit rows reference the media, so they go first.
 */
export async function purgeMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.delete(auditLog).where(inArray(auditLog.targetMediaId, ids));
  await db.delete(media).where(inArray(media.id, ids));
}
