"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

interface MediaDetail {
  id: string;
  title: string;
  kind: "photo" | "video";
  displayUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

export function Lightbox({ isAdmin = false }: { isAdmin?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const photoId = searchParams.get("photo");
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) {
      setDetail(null);
      return;
    }
    setError(false);
    setConfirming(false);
    setDeleteError(null);
    setLoading(true);
    fetch(`/api/media/${photoId}`)
      .then((r) => {
        if (!r.ok) {
          setError(true);
          return null;
        }
        return r.json();
      })
      .then(setDetail)
      .catch(() => {
        setError(true);
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [photoId]);

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("photo");
    const qs = params.toString();
    router.push(`/gallery${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  async function remove() {
    if (!detail) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/media/${detail.id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteError(
          res.status === 403
            ? "삭제 권한이 없습니다."
            : "삭제하지 못했습니다. 잠시 후 다시 시도해주세요."
        );
        setDeleting(false);
        return;
      }
      close();
      router.refresh();
    } catch {
      setDeleteError("네트워크 오류로 삭제하지 못했습니다.");
      setDeleting(false);
    }
  }

  if (!photoId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--color-overlay)] flex items-center justify-center"
      onClick={close}
    >
      <button
        className="cursor-pointer absolute top-4 right-4 text-[var(--color-overlay-fg)] text-2xl leading-none p-2"
        onClick={(e) => { e.stopPropagation(); close(); }}
        aria-label="닫기"
      >
        ×
      </button>
      {loading && (
        <div className="text-[var(--color-overlay-fg)] font-sans text-lg">불러오는 중...</div>
      )}
      {error && !loading && !detail && (
        <div className="text-[var(--color-overlay-fg)] font-sans text-sm">
          네트워크 오류 또는 삭제된 미디어입니다.
        </div>
      )}
      {detail && !loading && (
        <div
          className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          {detail.kind === "photo" ? (
            <Image
              src={detail.displayUrl}
              alt={detail.title}
              width={detail.width}
              height={detail.height}
              className="max-h-[80vh] w-auto object-contain"
              unoptimized
            />
          ) : (
            <video
              src={detail.originalUrl}
              controls
              className="max-h-[80vh] max-w-full"
              autoPlay
              muted
            />
          )}
          <p className="text-[var(--color-overlay-fg)] font-serif italic text-sm">{detail.title}</p>

          {isAdmin && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="cursor-pointer flex items-center gap-1.5 text-xs font-sans text-[var(--color-overlay-fg)]/70 hover:text-[var(--color-overlay-fg)] transition-colors"
              aria-label="삭제"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="fill-current">
                <path d="M6 1h4l1 1h3v2H2V2h3l1-1zM3 5h10l-.8 9.1A1 1 0 0 1 11.2 15H4.8a1 1 0 0 1-1-.9L3 5z" />
              </svg>
              삭제
            </button>
          )}

          {isAdmin && confirming && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[var(--color-overlay-fg)] font-sans text-sm">
                정말로 삭제 하시겠습니까?
              </p>
              <p className="text-[var(--color-overlay-fg)]/60 font-sans text-xs">
                휴지통에서 30일 동안 되돌릴 수 있습니다.
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="cursor-pointer text-sm font-sans px-4 py-1.5 rounded-full border border-[var(--color-overlay-fg)]/40 text-[var(--color-overlay-fg)] hover:border-[var(--color-overlay-fg)] transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={remove}
                  disabled={deleting}
                  className="cursor-pointer text-sm font-sans px-4 py-1.5 rounded-full bg-[var(--color-wine)] hover:bg-[var(--color-wine-hover)] text-[var(--color-overlay-fg)] transition-colors disabled:opacity-50"
                >
                  {deleting ? "삭제하는 중..." : "확인"}
                </button>
              </div>
              {deleteError && (
                <p className="text-[var(--color-overlay-fg)] font-sans text-xs">{deleteError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
