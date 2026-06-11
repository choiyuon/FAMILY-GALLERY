"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Only allow same-origin relative paths to prevent open redirects
  // (reject absolute URLs, protocol-relative `//host`, and backslash tricks).
  const rawNext = params.get("next") ?? "/gallery";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/gallery";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setSubmitting(false);
    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 w-full max-w-sm">
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
        <span className="text-sm font-serif">비밀번호</span>
        <input
          type="password"
          required
          autoComplete="current-password"
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
        {submitting ? "확인 중..." : "들어가기"}
      </button>
    </form>
  );
}
