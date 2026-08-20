import { NextResponse } from "next/server";
import { and, isNull, like } from "drizzle-orm";
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
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json([]);

  const db = await getDb();
  const rows = await db
    .select()
    .from(media)
    .where(and(isNull(media.deletedAt), like(media.titleLower, `%${q}%`)))
    .orderBy(media.createdAt)
    .limit(50);

  const results = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      thumbUrl: await presignGet(row.blobThumbKey),
    }))
  );

  return NextResponse.json(results);
}
