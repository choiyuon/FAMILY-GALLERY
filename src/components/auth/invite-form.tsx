"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/invites/${token}/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "가입 실패");
      setSubmitting(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setSubmitting(false);
    if (signInResult?.error) {
      setError("가입은 됐지만 자동 로그인에 실패했어요. /login에서 직접 들어와주세요.");
      return;
    }
    router.push("/gallery");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-serif">이름 (예: 엄마, 동생)</span>
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 rounded"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-serif">이메일</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 rounded"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-serif">비밀번호 (8자 이상)</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 rounded"
        />
      </label>
      {error && <p className="text-[var(--color-wine)] text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-[var(--color-gold)] text-white font-serif px-4 py-2 rounded disabled:opacity-50"
      >
        {submitting ? "가입 중..." : "가족 갤러리 시작하기"}
      </button>
    </form>
  );
}
