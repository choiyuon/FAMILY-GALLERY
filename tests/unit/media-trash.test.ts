import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll, insertTestUser, testSql } from "../helpers/db";
import {
  blobKeysOf,
  listExpiredTrash,
  listTrash,
  purgeMedia,
  restoreMedia,
  softDeleteMedia,
  TRASH_RETENTION_MS,
} from "@/lib/media/trash";

beforeEach(truncateAll);

const DAY = 24 * 60 * 60 * 1000;

async function insertMedia(
  ownerId: string,
  title: string,
  deletedAt: Date | null,
  opts: { medium?: string | null; edited?: string | null } = {}
) {
  const [row] = await testSql`
    INSERT INTO media (owner_id, title, title_lower, kind, mime_type, width, height,
                       size_bytes, blob_original_key, blob_medium_key, blob_thumb_key,
                       blob_edited_key, short_edge_px, deleted_at)
    VALUES (${ownerId}, ${title}, ${title.toLowerCase()}, 'photo', 'image/jpeg',
            800, 600, 100000,
            ${`original/${title}.jpeg`},
            ${opts.medium === undefined ? `medium/${title}.webp` : opts.medium},
            ${`thumb/${title}.webp`},
            ${opts.edited ?? null},
            600, ${deletedAt})
    RETURNING id
  `;
  return row.id as string;
}

describe("TRASH_RETENTION_MS", () => {
  it("holds deleted media for 30 days", () => {
    expect(TRASH_RETENTION_MS).toBe(30 * DAY);
  });
});

describe("listExpiredTrash", () => {
  it("ignores media that was never deleted", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "live", null);
    expect(await listExpiredTrash()).toEqual([]);
  });

  it("ignores media deleted less than 30 days ago", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "recent", new Date(Date.now() - 29 * DAY));
    expect(await listExpiredTrash()).toEqual([]);
  });

  it("returns media deleted more than 30 days ago", async () => {
    const user = await insertTestUser();
    const id = await insertMedia(user.id, "old", new Date(Date.now() - 31 * DAY));
    const expired = await listExpiredTrash();
    expect(expired.map((m) => m.id)).toEqual([id]);
  });

  it("keeps media sitting exactly on the boundary", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "boundary", new Date(Date.now() - 30 * DAY + 60_000));
    expect(await listExpiredTrash()).toEqual([]);
  });
});

describe("blobKeysOf", () => {
  it("collects every stored object belonging to a media row", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "full", new Date(Date.now() - 31 * DAY), {
      edited: "edited/full.jpeg",
    });
    const [row] = await listExpiredTrash();
    expect(blobKeysOf(row).sort()).toEqual([
      "edited/full.jpeg",
      "medium/full.webp",
      "original/full.jpeg",
      "thumb/full.webp",
    ]);
  });

  it("skips the optional keys a video or an unedited photo does not have", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "sparse", new Date(Date.now() - 31 * DAY), {
      medium: null,
    });
    const [row] = await listExpiredTrash();
    expect(blobKeysOf(row).sort()).toEqual(["original/sparse.jpeg", "thumb/sparse.webp"]);
  });
});

describe("purgeMedia", () => {
  it("removes the rows but keeps their audit trail", async () => {
    const user = await insertTestUser();
    const doomed = await insertMedia(user.id, "doomed", new Date(Date.now() - 31 * DAY));
    const kept = await insertMedia(user.id, "kept", null);
    await testSql`
      INSERT INTO audit_log (actor_id, action, target_media_id)
      VALUES (${user.id}, 'upload', ${doomed})
    `;

    await purgeMedia([doomed]);

    const rows = await testSql`SELECT id FROM media`;
    expect(rows.map((r) => r.id)).toEqual([kept]);
    // audit_log has no foreign key to media on purpose: the history of what was
    // uploaded and deleted must outlive the media itself (AGENTS.md §8).
    const audits = await testSql`SELECT action FROM audit_log WHERE target_media_id = ${doomed}`;
    expect(audits.map((a) => a.action)).toEqual(["upload"]);
  });

  it("does nothing when handed an empty list", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "safe", null);
    await purgeMedia([]);
    expect((await testSql`SELECT id FROM media`).length).toBe(1);
  });
});

describe("softDeleteMedia", () => {
  it("moves media to the trash and records who did it", async () => {
    const owner = await insertTestUser();
    const admin = await insertTestUser({ role: "admin" });
    const id = await insertMedia(owner.id, "doomed", null);

    const row = await softDeleteMedia(id, admin.id);

    expect(row?.id).toBe(id);
    const [db] = await testSql`SELECT deleted_at, deleted_by FROM media WHERE id = ${id}`;
    expect(db.deleted_at).not.toBeNull();
    expect(db.deleted_by).toBe(admin.id);
  });

  it("returns null for media that is already in the trash", async () => {
    const user = await insertTestUser();
    const id = await insertMedia(user.id, "already", new Date());

    expect(await softDeleteMedia(id, user.id)).toBeNull();
  });

  it("returns null for an unknown id", async () => {
    await insertTestUser();
    expect(
      await softDeleteMedia("11111111-1111-1111-1111-111111111111", null)
    ).toBeNull();
  });

  it("leaves the stored objects alone", async () => {
    const user = await insertTestUser();
    const id = await insertMedia(user.id, "keeps-blobs", null);

    await softDeleteMedia(id, user.id);

    const [row] = await testSql`SELECT blob_original_key FROM media WHERE id = ${id}`;
    expect(row.blob_original_key).toBe("original/keeps-blobs.jpeg");
  });
});

describe("restoreMedia", () => {
  it("brings media back out of the trash", async () => {
    const user = await insertTestUser();
    const id = await insertMedia(user.id, "back", new Date());

    const row = await restoreMedia(id);

    expect(row?.id).toBe(id);
    const [db] = await testSql`SELECT deleted_at, deleted_by FROM media WHERE id = ${id}`;
    expect(db.deleted_at).toBeNull();
    expect(db.deleted_by).toBeNull();
  });

  it("returns null for media that was never deleted", async () => {
    const user = await insertTestUser();
    const id = await insertMedia(user.id, "live", null);
    expect(await restoreMedia(id)).toBeNull();
  });
});

describe("listTrash", () => {
  it("returns only trashed media, most recently deleted first", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "live", null);
    const older = await insertMedia(user.id, "older", new Date(Date.now() - 2 * DAY));
    const newer = await insertMedia(user.id, "newer", new Date(Date.now() - 1 * DAY));

    const rows = await listTrash();

    expect(rows.map((r) => r.id)).toEqual([newer, older]);
  });

  it("is empty when nothing has been deleted", async () => {
    await insertTestUser();
    expect(await listTrash()).toEqual([]);
  });
});
