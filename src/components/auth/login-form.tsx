"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { UnderlineInput } from "@/components/design/underline-input";
import { PillButton } from "@/components/design/pill-button";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-6 w-full max-w-sm">
      <UnderlineInput
        type="email"
        required
        autoComplete="email"
        aria-label="이메일"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <UnderlineInput
        type="password"
        required
        autoComplete="current-password"
        aria-label="비밀번호"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-[var(--color-wine)] text-sm">{error}</p>}
      <PillButton type="submit" disabled={submitting} className="w-full">
        {submitting ? "확인 중..." : "들어가기"}
      </PillButton>
    </form>
  );
}
