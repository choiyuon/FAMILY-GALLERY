import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { presignGet } from "@/lib/r2/client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
    throw e;
  }

  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), isNull(media.deletedAt)))
    .limit(1);

  if (!row) return new NextResponse("Not Found", { status: 404 });

  const displayKey = row.r2EditedKey ?? row.r2MediumKey ?? row.r2OriginalKey;
  const [thumbUrl, displayUrl, originalUrl] = await Promise.all([
    presignGet(row.r2ThumbKey),
    presignGet(displayKey),
    presignGet(row.r2OriginalKey),
  ]);

  return NextResponse.json({ ...row, thumbUrl, displayUrl, originalUrl });
}
