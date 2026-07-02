"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UnderlineInput } from "@/components/design/underline-input";
import { PillButton } from "@/components/design/pill-button";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-6 w-full max-w-sm">
      <UnderlineInput
        required
        aria-label="이름 (예: 엄마, 동생)"
        placeholder="이름 (예: 엄마, 동생)"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
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
        minLength={8}
        autoComplete="new-password"
        aria-label="비밀번호 (8자 이상)"
        placeholder="비밀번호 (8자 이상)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-[var(--color-wine)] text-sm">{error}</p>}
      <PillButton type="submit" disabled={submitting} className="w-full">
        {submitting ? "가입 중..." : "가족 갤러리 시작하기"}
      </PillButton>
    </form>
  );
}
