"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateInviteButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    const res = await fetch("/api/invites", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      alert("초대 발급 실패");
      return;
    }
    const data = await res.json();
    const url = `${window.location.origin}/invite/${data.token}`;
    setLastUrl(url);
    await navigator.clipboard.writeText(url).catch(() => {});
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={create}
        disabled={loading}
        className="bg-[var(--color-gold)] text-white font-serif px-4 py-2 rounded disabled:opacity-50 self-start"
      >
        {loading ? "발급 중..." : "초대 발급"}
      </button>
      {lastUrl && (
        <p className="text-sm text-[var(--color-ink-muted)]">
          클립보드에 복사됨: <code className="break-all">{lastUrl}</code>
        </p>
      )}
    </div>
  );
}
