import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll, insertTestUser, testSql } from "../helpers/db";
import { writeAudit } from "@/lib/audit/log";

beforeEach(truncateAll);

describe("writeAudit", () => {
  it("writes an entry with given action and metadata", async () => {
    const user = await insertTestUser({ role: "admin" });
    await writeAudit({
      actorId: user.id,
      action: "invite_create",
      metadata: { note: "hello" },
    });

    const rows = await testSql`SELECT actor_id, action, metadata FROM audit_log`;
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("invite_create");
    expect(rows[0].metadata).toEqual({ note: "hello" });
  });

  it("records optional target IDs", async () => {
    const user = await insertTestUser({ role: "admin" });
    const targetUserId = "11111111-1111-1111-1111-111111111111";
    await writeAudit({
      actorId: user.id,
      action: "role_change",
      targetUserId,
      metadata: { from: "member", to: "admin" },
    });

    const rows = await testSql`SELECT target_user_id, target_media_id FROM audit_log`;
    expect(rows[0].target_user_id).toBe(targetUserId);
    expect(rows[0].target_media_id).toBeNull();
  });
});
