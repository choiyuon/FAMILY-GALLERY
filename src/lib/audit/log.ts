import { getDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

export type AuditAction =
  | "invite_create"
  | "invite_redeem"
  | "login"
  | "role_change"
  // Plan 2/3/4 actions appear later but the type is permissive
  | (string & {});

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  targetMediaId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb();
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetMediaId: entry.targetMediaId,
    targetUserId: entry.targetUserId,
    metadata: entry.metadata ?? {},
  });
}
