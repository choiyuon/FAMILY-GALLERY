import { getDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

export type AuditAction =
  | "invite_create"
  | "invite_redeem"
  | "login"
  | "role_change"
  | "trash_purge"
  | "orphan_sweep"
  // Plan 3/4 actions appear later but the type is permissive
  | (string & {});

export interface AuditEntry {
  /** Omit for actions the system takes on its own, such as the cleanup cron. */
  actorId?: string | null;
  action: AuditAction;
  targetMediaId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb();
  await db.insert(auditLog).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    targetMediaId: entry.targetMediaId,
    targetUserId: entry.targetUserId,
    metadata: entry.metadata ?? {},
  });
}
