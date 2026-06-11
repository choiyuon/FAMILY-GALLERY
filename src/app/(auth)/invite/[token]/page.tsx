import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { invites } from "@/lib/db/schema";
import { InviteForm } from "@/components/auth/invite-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const now = new Date();
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedAt), gt(invites.expiresAt, now)));

  if (!invite) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-wine)] p-8 max-w-md">
          <h1 className="text-2xl mb-3">이 초대는 사용할 수 없어요</h1>
          <p className="text-[var(--color-ink-muted)] font-serif">
            이미 사용되었거나 만료되었거나 잘못된 링크입니다. 관리자에게 새 링크를 받아주세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-gold-soft)] p-8 shadow-lg">
        <h1 className="text-3xl mb-2 text-center">가족 갤러리에 초대됐어요</h1>
        <p className="text-center text-[var(--color-ink-muted)] font-serif mb-6">
          정보를 입력하고 시작해주세요.
        </p>
        <InviteForm token={token} />
      </div>
    </main>
  );
}
