import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { CreateInviteButton } from "@/components/admin/create-invite-button";
import { InviteList } from "@/components/admin/invite-list";
import { StorageUsage } from "@/components/admin/storage-usage";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/gallery");

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl">관리</h1>
        <Link href="/gallery" className="text-[var(--color-ink-muted)] font-serif">
          갤러리로
        </Link>
      </header>

      <section className="mb-12">
        <h2 className="text-xl mb-4">소장 공간</h2>
        <StorageUsage />
      </section>

      <section className="mb-12">
        <h2 className="text-xl mb-4">가족 초대</h2>
        <CreateInviteButton />
      </section>

      <section>
        <h2 className="text-xl mb-4">발급 기록</h2>
        <InviteList />
      </section>
    </main>
  );
}
