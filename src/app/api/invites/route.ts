import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdmin, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { invites } from "@/lib/db/schema";
import { createInvite } from "@/lib/invites/service";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }

  const db = await getDb();
  const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(100);
  return NextResponse.json(rows);
}

export async function POST() {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }

  const { token, expiresAt } = await createInvite({ adminId: session.user.id });
  return NextResponse.json({ token, expiresAt });
}
