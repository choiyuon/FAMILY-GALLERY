import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll, insertTestUser, testSql } from "../helpers/db";
import { runCleanup, type CleanupStorage } from "@/lib/media/cleanup";
import type { StoredBlob } from "@/lib/storage/orphans";

beforeEach(truncateAll);

const DAY = 24 * 60 * 60 * 1000;

/**
 * An in-memory stand-in for the object store. The real Blob store must never be
 * reachable from the suite: `truncateAll()` empties the media table, which would
 * make every real photo look like an orphan and get it deleted.
 */
function fakeStorage(blobs: StoredBlob[]): CleanupStorage & { remaining: () => string[] } {
  const state = new Map(blobs.map((b) => [b.pathname, b]));
  return {
    list: async () => [...state.values()],
    delete: async (pathname: string) => {
      state.delete(pathname);
    },
    remaining: () => [...state.keys()].sort(),
  };
}

async function insertMedia(
  ownerId: string,
  slug: string,
  deletedAt: Date | null = null
) {
  const [row] = await testSql`
    INSERT INTO media (owner_id, title, title_lower, kind, mime_type, width, height,
                       size_bytes, blob_original_key, blob_thumb_key, short_edge_px,
                       deleted_at)
    VALUES (${ownerId}, ${slug}, ${slug}, 'photo', 'image/jpeg', 800, 600, 1000,
            ${`original/${slug}.jpeg`}, ${`thumb/${slug}.webp`}, 600, ${deletedAt})
    RETURNING id
  `;
  return row.id as string;
}

describe("runCleanup: orphan sweep", () => {
  it("deletes an aged object no media row points at", async () => {
    const storage = fakeStorage([
      { pathname: "original/lost.jpeg", uploadedAt: new Date(Date.now() - 3 * DAY) },
    ]);

    const result = await runCleanup({ storage });

    expect(result.swept).toBe(1);
    expect(storage.remaining()).toEqual([]);
  });

  it("never deletes an object a live media row points at", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "keeper");
    const storage = fakeStorage([
      { pathname: "original/keeper.jpeg", uploadedAt: new Date(Date.now() - 9 * DAY) },
      { pathname: "thumb/keeper.webp", uploadedAt: new Date(Date.now() - 9 * DAY) },
    ]);

    const result = await runCleanup({ storage });

    expect(result.swept).toBe(0);
    expect(storage.remaining()).toEqual(["original/keeper.jpeg", "thumb/keeper.webp"]);
  });

  it("leaves an object belonging to media still sitting in the trash", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "trashed", new Date(Date.now() - 3 * DAY));
    const storage = fakeStorage([
      { pathname: "original/trashed.jpeg", uploadedAt: new Date(Date.now() - 9 * DAY) },
      { pathname: "thumb/trashed.webp", uploadedAt: new Date(Date.now() - 9 * DAY) },
    ]);

    const result = await runCleanup({ storage });

    expect(result.swept).toBe(0);
    expect(storage.remaining()).toHaveLength(2);
  });

  it("spares an object young enough to be an upload still in flight", async () => {
    const storage = fakeStorage([
      { pathname: "original/inflight.jpeg", uploadedAt: new Date(Date.now() - 60_000) },
    ]);

    expect((await runCleanup({ storage })).swept).toBe(0);
    expect(storage.remaining()).toEqual(["original/inflight.jpeg"]);
  });
});

describe("runCleanup: expired trash", () => {
  it("deletes the row and its objects once the 30-day hold has passed", async () => {
    const user = await insertTestUser();
    const id = await insertMedia(user.id, "expired", new Date(Date.now() - 31 * DAY));
    const storage = fakeStorage([
      { pathname: "original/expired.jpeg", uploadedAt: new Date(Date.now() - 40 * DAY) },
      { pathname: "thumb/expired.webp", uploadedAt: new Date(Date.now() - 40 * DAY) },
    ]);

    const result = await runCleanup({ storage });

    expect(result.purged).toBe(1);
    expect(storage.remaining()).toEqual([]);
    expect(await testSql`SELECT id FROM media WHERE id = ${id}`).toEqual([]);
  });

  it("keeps media whose hold has not run out", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "recent", new Date(Date.now() - 5 * DAY));
    const storage = fakeStorage([
      { pathname: "original/recent.jpeg", uploadedAt: new Date(Date.now() - 9 * DAY) },
      { pathname: "thumb/recent.webp", uploadedAt: new Date(Date.now() - 9 * DAY) },
    ]);

    const result = await runCleanup({ storage });

    expect(result).toEqual({ purged: 0, swept: 0 });
    expect((await testSql`SELECT id FROM media`).length).toBe(1);
  });

  it("audits what it removed, with no human actor", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "expired", new Date(Date.now() - 31 * DAY));
    const storage = fakeStorage([
      { pathname: "original/expired.jpeg", uploadedAt: new Date(Date.now() - 40 * DAY) },
      { pathname: "thumb/expired.webp", uploadedAt: new Date(Date.now() - 40 * DAY) },
      { pathname: "original/lost.jpeg", uploadedAt: new Date(Date.now() - 40 * DAY) },
    ]);

    await runCleanup({ storage });

    const rows = await testSql`SELECT actor_id, action FROM audit_log ORDER BY action`;
    expect(rows.map((r) => r.action)).toEqual(["orphan_sweep", "trash_purge"]);
    expect(rows.every((r) => r.actor_id === null)).toBe(true);
  });

  it("writes no audit rows when there was nothing to do", async () => {
    await runCleanup({ storage: fakeStorage([]) });
    expect(await testSql`SELECT id FROM audit_log`).toEqual([]);
  });
});
