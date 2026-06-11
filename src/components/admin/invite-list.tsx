import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { invites } from "@/lib/db/schema";

export async function InviteList() {
  const db = await getDb();
  const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(50);

  if (rows.length === 0) {
    return <p className="text-[var(--color-ink-muted)]">아직 발급된 초대가 없습니다.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b border-[var(--color-border)]">
          <th className="py-2 pr-4 font-serif">토큰 (앞 8자)</th>
          <th className="py-2 pr-4 font-serif">상태</th>
          <th className="py-2 pr-4 font-serif">만료</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const expired = row.expiresAt < new Date();
          const status = row.usedAt ? "사용됨" : expired ? "만료" : "유효";
          return (
            <tr key={row.id} className="border-b border-[var(--color-border)]">
              <td className="py-2 pr-4 font-mono">{row.token.slice(0, 8)}…</td>
              <td className="py-2 pr-4">{status}</td>
              <td className="py-2 pr-4">{row.expiresAt.toLocaleDateString("ko-KR")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
