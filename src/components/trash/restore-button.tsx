"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RestoreButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function restore() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/trash/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        setError(true);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={restore}
        disabled={busy}
        className="cursor-pointer text-xs font-sans px-3 py-1.5 rounded-full border border-[var(--color-gold-soft)] text-[var(--color-gold)] hover:bg-[var(--color-gold-soft)] hover:text-[var(--color-overlay-fg)] transition-colors disabled:opacity-50"
      >
        {busy ? "되돌리는 중..." : "되돌리기"}
      </button>
      {error && (
        <p className="text-xs text-[var(--color-wine)]">
          {title}을(를) 되돌리지 못했습니다.
        </p>
      )}
    </div>
  );
}
