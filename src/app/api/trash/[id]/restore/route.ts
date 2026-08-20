import { NextResponse } from "next/server";
import {
  ForbiddenError,
  requireAdmin,
  UnauthorizedError,
} from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { restoreMedia } from "@/lib/media/trash";

export async function POST(
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
  const row = await restoreMedia(id);
  if (!row) return new NextResponse("Not Found", { status: 404 });

  await writeAudit({
    actorId: session.user.id,
    action: "restore",
    targetMediaId: row.id,
    metadata: { title: row.title },
  });

  return NextResponse.json({ id: row.id });
}
