import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { presignGet } from "@/lib/storage/blob";

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

  const displayKey = row.blobEditedKey ?? row.blobMediumKey ?? row.blobOriginalKey;
  const [thumbUrl, displayUrl, originalUrl] = await Promise.all([
    presignGet(row.blobThumbKey),
    presignGet(displayKey),
    presignGet(row.blobOriginalKey),
  ]);

  return NextResponse.json({ ...row, thumbUrl, displayUrl, originalUrl });
}
