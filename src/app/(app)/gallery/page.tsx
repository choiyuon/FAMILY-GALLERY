import Link from "next/link";
import { auth } from "@/lib/auth/config";

export default async function GalleryPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  return (
    <main className="min-h-screen p-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl">갤러리</h1>
        <nav className="flex gap-4">
          {isAdmin && (
            <Link href="/admin" className="text-[var(--color-gold)] font-serif">
              관리
            </Link>
          )}
          <Link href="/landing" className="text-[var(--color-ink-muted)] font-serif">
            나가기
          </Link>
        </nav>
      </header>
      <p className="text-[var(--color-ink-muted)]">
        Plan 2에서 그리드와 업로드를 추가합니다.
      </p>
    </main>
  );
}
