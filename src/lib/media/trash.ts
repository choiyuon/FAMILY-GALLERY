import { and, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";

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
 * Really delete media rows. Only the nightly cron and /api/trash/empty may call
 * this (AGENTS.md §8).
 *
 * audit_log keeps its rows: `target_media_id` deliberately carries no foreign
 * key, so the record of what was uploaded and deleted outlives the media it
 * describes. An audit trail you erase along with the evidence is not one.
 */
export async function purgeMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.delete(media).where(inArray(media.id, ids));
}

/**
 * Move media to the trash. Never touches the stored objects — the whole point
 * of the 30-day hold is that the files are still there to restore (spec §7).
 * Returns null if the id is unknown or already trashed, so the caller can 404
 * rather than silently re-stamping the deletion time.
 */
export async function softDeleteMedia(
  id: string,
  actorId: string | null
): Promise<TrashedMedia | null> {
  const db = await getDb();
  const [row] = await db
    .update(media)
    .set({ deletedAt: new Date(), deletedBy: actorId })
    .where(and(eq(media.id, id), isNull(media.deletedAt)))
    .returning();
  return row ?? null;
}

/** Bring media back out of the trash. Null if it was not in there. */
export async function restoreMedia(id: string): Promise<TrashedMedia | null> {
  const db = await getDb();
  const [row] = await db
    .update(media)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(media.id, id), isNotNull(media.deletedAt)))
    .returning();
  return row ?? null;
}

/** Everything currently in the trash, most recently deleted first. */
export async function listTrash(): Promise<TrashedMedia[]> {
  const db = await getDb();
  return db
    .select()
    .from(media)
    .where(isNotNull(media.deletedAt))
    .orderBy(desc(media.deletedAt));
}
