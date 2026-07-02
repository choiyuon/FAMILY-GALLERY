import Link from "next/link";
import { auth, signOut } from "@/lib/auth/config";

export default async function LandingPage() {
  const session = await auth();
  const name = session?.user.displayName ?? "가족";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl">환영합니다, {name}</h1>
      <p className="text-[var(--color-ink-muted)] font-serif">우리 가족의 르네상스 갤러리</p>
      <div className="flex gap-4">
        <Link
          href="/gallery"
          className="bg-[var(--color-gold)] text-[var(--color-bg)] font-serif px-6 py-3 rounded"
        >
          갤러리 들어가기
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="border border-[var(--color-wine)] text-[var(--color-wine)] font-serif px-6 py-3 rounded"
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
