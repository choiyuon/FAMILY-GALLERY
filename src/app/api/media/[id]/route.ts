import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import {
  ForbiddenError,
  requireAdmin,
  requireSession,
  UnauthorizedError,
} from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteMedia } from "@/lib/media/trash";
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

// Members cannot delete (spec §2: "멤버는 삭제·휴지통 접근 불가").
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }

  const { id } = await params;
  const row = await softDeleteMedia(id, session.user.id);
  if (!row) return new NextResponse("Not Found", { status: 404 });

  await writeAudit({
    actorId: session.user.id,
    action: "delete",
    targetMediaId: row.id,
    metadata: { title: row.title },
  });

  return NextResponse.json({ id: row.id });
}
