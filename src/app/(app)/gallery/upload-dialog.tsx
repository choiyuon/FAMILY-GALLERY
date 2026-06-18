"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FileEntry {
  file: File;
  title: string;
  error: string | null;
  suggestions: string[];
  uploading: boolean;
  done: boolean;
  thumbBlob?: Blob;
  width: number;
  height: number;
  durationMs?: number;
}

async function extractVideoThumb(
  file: File
): Promise<{ blob: Blob; width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.onloadeddata = () => {
      const MAX_MS =
        Number(process.env.NEXT_PUBLIC_MAX_VIDEO_DURATION_MS) || 5 * 60 * 1000;
      if (video.duration * 1000 > MAX_MS) {
        reject(new Error(`영상은 최대 ${MAX_MS / 60000}분입니다.`));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("썸네일 생성 실패"));
            return;
          }
          resolve({
            blob,
            width: video.videoWidth,
            height: video.videoHeight,
            durationMs: Math.round(video.duration * 1000),
          });
          URL.revokeObjectURL(video.src);
        },
        "image/jpeg",
        0.8
      );
    };
    video.onerror = () => reject(new Error("영상 로드 실패"));
  });
}

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const newEntries: FileEntry[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      let width = 0,
        height = 0,
        durationMs: number | undefined,
        thumbBlob: Blob | undefined;
      try {
        if (isVideo) {
          const info = await extractVideoThumb(file);
          width = info.width;
          height = info.height;
          durationMs = info.durationMs;
          thumbBlob = info.blob;
        } else {
          const dims = await getImageDimensions(file);
          width = dims.width;
          height = dims.height;
        }
      } catch (e: unknown) {
        newEntries.push({
          file,
          title: file.name.replace(/\.[^.]+$/, ""),
          error: (e as Error).message,
          suggestions: [],
          uploading: false,
          done: false,
          width: 0,
          height: 0,
        });
        continue;
      }
      newEntries.push({
        file,
        title: file.name.replace(/\.[^.]+$/, ""),
        error: null,
        suggestions: [],
        uploading: false,
        done: false,
        thumbBlob,
        width,
        height,
        durationMs,
      });
    }
    setEntries((prev) => [...prev, ...newEntries]);
  }

  function setTitle(idx: number, title: string) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, title, error: null, suggestions: [] } : e
      )
    );
  }

  function pickSuggestion(idx: number, suggestion: string) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, title: suggestion, error: null, suggestions: [] } : e
      )
    );
  }

  async function uploadOne(idx: number) {
    const entry = entries[idx];
    if (!entry || entry.done || entry.uploading) return;

    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, uploading: true, error: null } : e
      )
    );

    try {
      const startRes = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: entry.title,
          mimeType: entry.file.type,
          sizeBytes: entry.file.size,
        }),
      });
      const startData = await startRes.json();

      if (startRes.status === 409) {
        setEntries((prev) =>
          prev.map((e, i) =>
            i === idx
              ? { ...e, uploading: false, error: startData.error, suggestions: startData.suggestions ?? [] }
              : e
          )
        );
        return;
      }
      if (!startRes.ok) {
        setEntries((prev) =>
          prev.map((e, i) =>
            i === idx ? { ...e, uploading: false, error: startData.error ?? "업로드 실패" } : e
          )
        );
        return;
      }

      const { mediaId, key, uploadUrl, thumbKey, thumbUploadUrl } = startData as {
        mediaId: string;
        key: string;
        uploadUrl: string;
        thumbKey?: string;
        thumbUploadUrl?: string;
      };

      await fetch(uploadUrl, {
        method: "PUT",
        body: entry.file,
        headers: { "content-type": entry.file.type },
      });

      if (entry.thumbBlob && thumbUploadUrl) {
        await fetch(thumbUploadUrl, {
          method: "PUT",
          body: entry.thumbBlob,
          headers: { "content-type": "image/jpeg" },
        });
      }

      const completeRes = await fetch("/api/media/upload/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaId,
          key,
          title: entry.title,
          mimeType: entry.file.type,
          sizeBytes: entry.file.size,
          width: entry.width,
          height: entry.height,
          durationMs: entry.durationMs,
          thumbKey,
        }),
      });

      if (!completeRes.ok) {
        const d = await completeRes.json().catch(() => ({}));
        setEntries((prev) =>
          prev.map((e, i) =>
            i === idx ? { ...e, uploading: false, error: (d as { error?: string }).error ?? "완료 실패" } : e
          )
        );
        return;
      }

      setEntries((prev) =>
        prev.map((e, i) => (i === idx ? { ...e, uploading: false, done: true } : e))
      );
    } catch {
      setEntries((prev) =>
        prev.map((e, i) =>
          i === idx ? { ...e, uploading: false, error: "네트워크 오류" } : e
        )
      );
    }
  }

  async function uploadAll() {
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].done && !entries[i].uploading && !entries[i].error) {
        await uploadOne(i);
      }
    }
  }

  function onDoneClose() {
    router.refresh();
    onClose();
  }

  const allDone = entries.length > 0 && entries.every((e) => e.done);
  const hasErrors = entries.some((e) => e.error);
  const anyUploading = entries.some((e) => e.uploading);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-overlay)] flex items-end md:items-center justify-center p-4">
      <div
        className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] w-full max-w-lg max-h-[80vh] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-serif text-lg text-[var(--color-ink)]">업로드</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-ink-muted)] text-xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <button
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-6 text-center text-[var(--color-ink-muted)] font-sans hover:border-[var(--color-gold)] transition-colors"
          >
            + 파일 선택 (이미지 / 영상)
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />

          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="border border-[var(--color-border)] rounded-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--color-ink-muted)] truncate flex-1">
                  {entry.file.name}
                </span>
                {entry.done && (
                  <span className="text-xs text-[var(--color-gold)]">완료</span>
                )}
                {entry.uploading && (
                  <span className="text-xs text-[var(--color-ink-muted)]">올리는 중...</span>
                )}
              </div>
              <input
                type="text"
                value={entry.title}
                onChange={(e) => setTitle(idx, e.target.value)}
                disabled={entry.done || entry.uploading}
                placeholder="이름"
                className="border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm rounded text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]"
              />
              {entry.error && (
                <p className="text-xs text-[var(--color-wine)]">{entry.error}</p>
              )}
              {entry.suggestions.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {entry.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => pickSuggestion(idx, s)}
                      className="text-xs border border-[var(--color-gold-soft)] rounded-full px-2 py-1 text-[var(--color-gold)] hover:bg-[var(--color-gold-soft)] hover:text-[var(--color-overlay-fg)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {entries.length > 0 && (
          <div className="px-5 py-4 border-t border-[var(--color-border)]">
            {allDone ? (
              <button
                onClick={onDoneClose}
                className="w-full bg-[var(--color-ink)] text-[var(--color-overlay-fg)] font-sans py-2.5 rounded"
              >
                완료
              </button>
            ) : (
              <button
                onClick={uploadAll}
                disabled={hasErrors || anyUploading}
                className="w-full bg-[var(--color-gold)] text-[var(--color-overlay-fg)] font-sans py-2.5 rounded disabled:opacity-50"
              >
                {anyUploading ? "올리는 중..." : "올리기"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
