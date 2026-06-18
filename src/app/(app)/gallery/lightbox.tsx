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

export function Lightbox() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const photoId = searchParams.get("photo");
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!photoId) {
      setDetail(null);
      return;
    }
    setError(false);
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

  if (!photoId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--color-overlay)] flex items-center justify-center"
      onClick={close}
    >
      <button
        className="absolute top-4 right-4 text-[var(--color-overlay-fg)] text-2xl leading-none p-2"
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
        </div>
      )}
    </div>
  );
}
