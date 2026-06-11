import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { invites, users } from "@/lib/db/schema";
import { expiresInDays, generateInviteToken, hashToken, INVITE_EXPIRY_DAYS } from "./tokens";
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
  const tokenHash = hashToken(token);
  const expiresAt = expiresInDays(INVITE_EXPIRY_DAYS);
  const [invite] = await db
    .insert(invites)
    .values({ token: tokenHash, createdBy: adminId, expiresAt })
    .returning({ id: invites.id });
  await writeAudit({
    actorId: adminId,
    action: "invite_create",
    metadata: { inviteId: invite.id, tokenHash },
  });
  // Return plaintext once — caller must share it immediately; it cannot be recovered from DB.
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
  const tokenHash = hashToken(input.token);

  // 1. Atomic claim: UPDATE is the gate, not SELECT.
  //    Postgres row-level locking ensures only one concurrent caller wins even without
  //    an explicit transaction (the Neon HTTP driver does not support multi-statement txns).
  const [claimed] = await db
    .update(invites)
    .set({ usedAt: now })
    .where(and(eq(invites.token, tokenHash), isNull(invites.usedAt), gt(invites.expiresAt, now)))
    .returning({ id: invites.id });

  if (!claimed) {
    // Diagnostic-only lookup for better UX; the invite is NOT claimed at this point.
    const [any] = await db.select().from(invites).where(eq(invites.token, tokenHash));
    if (!any) throw new InviteError("not_found", "초대를 찾을 수 없습니다.");
    if (any.usedAt) throw new InviteError("used", "이미 사용된 초대입니다.");
    throw new InviteError("expired", "만료된 초대입니다.");
  }

  // 2. Email uniqueness check
  const [existing] = await db.select().from(users).where(eq(users.email, input.email));
  if (existing) throw new InviteError("email_taken", "이미 가입된 이메일입니다.");

  // 3. Create user, then backfill used_by (invite already claimed above)
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: "member",
    })
    .returning({ id: users.id });

  await db.update(invites).set({ usedBy: user.id }).where(eq(invites.id, claimed.id));

  await writeAudit({
    actorId: user.id,
    action: "invite_redeem",
    targetUserId: user.id,
    metadata: { inviteId: claimed.id, tokenHash },
  });

  return { userId: user.id };
}
