import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { invites, users } from "@/lib/db/schema";
import { expiresInDays, generateInviteToken, INVITE_EXPIRY_DAYS } from "./tokens";
import { writeAudit } from "@/lib/audit/log";

export class InviteError extends Error {
  constructor(
    public code: "expired" | "used" | "not_found" | "email_taken",
    message: string
  ) {
    super(message);
    this.name = "InviteError";
  }
}

export async function createInvite({ adminId }: { adminId: string }) {
  const db = await getDb();
  const token = generateInviteToken();
  const expiresAt = expiresInDays(INVITE_EXPIRY_DAYS);
  await db.insert(invites).values({ token, createdBy: adminId, expiresAt });
  await writeAudit({ actorId: adminId, action: "invite_create", metadata: { token } });
  return { token, expiresAt };
}

export async function redeemInvite(input: {
  token: string;
  email: string;
  passwordHash: string;
  displayName: string;
}) {
  const db = await getDb();
  const now = new Date();

  // 1. find a valid, unused, unexpired invite
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, input.token), isNull(invites.usedAt), gt(invites.expiresAt, now)));

  if (!invite) {
    // Distinguish error reason for clearer UX
    const [any] = await db.select().from(invites).where(eq(invites.token, input.token));
    if (!any) throw new InviteError("not_found", "초대를 찾을 수 없습니다.");
    if (any.usedAt) throw new InviteError("used", "이미 사용된 초대입니다.");
    throw new InviteError("expired", "만료된 초대입니다.");
  }

  // 2. email uniqueness check
  const [existing] = await db.select().from(users).where(eq(users.email, input.email));
  if (existing) throw new InviteError("email_taken", "이미 가입된 이메일입니다.");

  // 3. create user + mark invite used (sequential — Neon HTTP driver doesn't support multi-statement tx)
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: "member",
    })
    .returning({ id: users.id });

  await db
    .update(invites)
    .set({ usedAt: now, usedBy: user.id })
    .where(eq(invites.id, invite.id));

  await writeAudit({
    actorId: user.id,
    action: "invite_redeem",
    targetUserId: user.id,
    metadata: { token: input.token },
  });

  return { userId: user.id };
}
