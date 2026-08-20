import { NextResponse } from "next/server";
import {
  ForbiddenError,
  requireAdmin,
  UnauthorizedError,
} from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { blobKeysOf, listTrash, purgeMedia } from "@/lib/media/trash";
import { deleteObject } from "@/lib/storage/blob";

// One of only two places allowed to really delete media; the other is the
// nightly cron (AGENTS.md §8).
export async function POST() {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }

  const rows = await listTrash();
  for (const row of rows) {
    // A missing object is not a failure — the goal is that it ends up gone.
    for (const key of blobKeysOf(row)) await deleteObject(key).catch(() => {});
  }
  await purgeMedia(rows.map((row) => row.id));

  if (rows.length > 0) {
    await writeAudit({
      actorId: session.user.id,
      action: "purge",
      metadata: { count: rows.length, ids: rows.map((r) => r.id) },
    });
  }

  return NextResponse.json({ purged: rows.length });
}
