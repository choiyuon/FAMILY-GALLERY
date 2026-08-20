import { NextResponse } from "next/server";
import { and, isNull, lt, eq, desc } from "drizzle-orm";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { presignGet } from "@/lib/storage/blob";

export async function GET(req: Request) {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 30), 60);
  const cursor = searchParams.get("cursor");
  const kind = searchParams.get("kind") as "photo" | "video" | null;

  const conditions = [isNull(media.deletedAt)];
  if (cursor) conditions.push(lt(media.createdAt, new Date(cursor)));
  if (kind === "photo" || kind === "video") conditions.push(eq(media.kind, kind));

  const db = await getDb();
  const rows = await db
    .select()
    .from(media)
    .where(and(...conditions))
    .orderBy(desc(media.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageItems = rows.slice(0, limit);

  const withUrls = await Promise.all(
    pageItems.map(async (row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      thumbUrl: await presignGet(row.blobThumbKey),
      width: row.width,
      height: row.height,
      shortEdgePx: row.shortEdgePx,
      durationMs: row.durationMs,
    }))
  );

  const nextCursor = hasMore ? pageItems[pageItems.length - 1].createdAt.toISOString() : null;
  return NextResponse.json({ items: withUrls, cursor: nextCursor });
}
