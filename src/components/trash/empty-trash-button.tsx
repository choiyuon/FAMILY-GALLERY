"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_WORD = "DELETE";

export function EmptyTrashButton({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function empty() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trash/empty", { method: "POST" });
      if (!res.ok) {
        setError(res.status === 403 ? "권한이 없습니다." : "비우지 못했습니다.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setTyped("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("네트워크 오류로 비우지 못했습니다.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="cursor-pointer text-sm font-sans px-4 py-2 rounded-full border border-[var(--color-wine)] text-[var(--color-wine)] hover:bg-[var(--color-wine)] hover:text-[var(--color-overlay-fg)] transition-colors"
      >
        휴지통 비우기
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-[var(--color-wine)] rounded-lg p-4 max-w-sm">
      <p className="font-sans text-sm text-[var(--color-ink)]">
        {count}개를 영구히 삭제합니다. 되돌릴 수 없습니다.
      </p>
      <label className="font-sans text-xs text-[var(--color-ink-muted)]">
        확인하려면 <span className="font-mono text-[var(--color-ink)]">{CONFIRM_WORD}</span>를 입력하세요.
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          className="mt-1 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm rounded text-[var(--color-ink)] font-mono"
        />
      </label>
      {error && <p className="text-xs text-[var(--color-wine)]">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setTyped(""); setError(null); }}
          disabled={busy}
          className="cursor-pointer text-sm font-sans px-4 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors disabled:opacity-50"
        >
          취소
        </button>
        <button
          onClick={empty}
          disabled={busy || typed !== CONFIRM_WORD}
          className="cursor-pointer text-sm font-sans px-4 py-1.5 rounded-full bg-[var(--color-wine)] hover:bg-[var(--color-wine-hover)] text-[var(--color-overlay-fg)] transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          {busy ? "비우는 중..." : "영구 삭제"}
        </button>
      </div>
    </div>
  );
}
