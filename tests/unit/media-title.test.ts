import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll, insertTestUser, testSql } from "../helpers/db";
import { isTitleTaken, suggestTitles } from "@/lib/media/title";

beforeEach(truncateAll);

async function insertMedia(ownerId: string, title: string) {
  const titleLower = title.toLowerCase();
  await testSql`
    INSERT INTO media (owner_id, title, title_lower, kind, mime_type, width, height,
                       size_bytes, blob_original_key, blob_thumb_key, short_edge_px)
    VALUES (${ownerId}, ${title}, ${titleLower}, 'photo', 'image/jpeg',
            800, 600, 100000, 'original/test.jpg', 'thumb/test.jpg', 600)
  `;
}

describe("isTitleTaken", () => {
  it("returns false when no media exists with that title", async () => {
    await insertTestUser();
    expect(await isTitleTaken("제주 여행")).toBe(false);
  });

  it("returns true when a media row has that title (case-insensitive)", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "제주 여행");
    expect(await isTitleTaken("제주 여행")).toBe(true);
    expect(await isTitleTaken("제주 여행".toUpperCase())).toBe(true);
  });
});

describe("suggestTitles", () => {
  it("suggests base (1), base (2), base (3) when base is taken", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "여행");
    const suggestions = await suggestTitles("여행");
    expect(suggestions).toEqual(["여행 (1)", "여행 (2)", "여행 (3)"]);
  });

  it("skips already-taken numbered variants", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "여행");
    await insertMedia(user.id, "여행 (1)");
    await insertMedia(user.id, "여행 (2)");
    const suggestions = await suggestTitles("여행");
    expect(suggestions).toEqual(["여행 (3)", "여행 (4)", "여행 (5)"]);
  });

  it("returns empty array when base is not taken", async () => {
    const suggestions = await suggestTitles("새 제목");
    expect(suggestions).toEqual([]);
  });
});
