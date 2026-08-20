import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll, insertTestUser, testSql } from "../helpers/db";
import {
  blobKeysOf,
  listExpiredTrash,
  purgeMedia,
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
  it("removes the rows and their audit entries", async () => {
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
    const audits = await testSql`SELECT id FROM audit_log WHERE target_media_id = ${doomed}`;
    expect(audits).toEqual([]);
  });

  it("does nothing when handed an empty list", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "safe", null);
    await purgeMedia([]);
    expect((await testSql`SELECT id FROM media`).length).toBe(1);
  });
});
