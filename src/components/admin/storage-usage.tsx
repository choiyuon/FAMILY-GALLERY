import { getStorageUsage, isStorageConfigured } from "@/lib/storage/blob";
import {
  formatBytes,
  STORAGE_KINDS,
  STORAGE_LIMIT_BYTES,
  STORAGE_WARN_BYTES,
  usageLevel,
  usagePercent,
  type StorageKind,
} from "@/lib/storage/usage";

const KIND_LABEL: Record<StorageKind, string> = {
  original: "원본",
  medium: "중간 크기 (1280px)",
  thumb: "썸네일 (200px)",
  edited: "편집본",
  other: "기타",
};

// Tokens only (AGENTS.md §7). Ordered darkest-to-lightest so the bar reads as
// one gradient of decreasing weight, matching the size order of the variants.
const KIND_COLOR: Record<StorageKind, string> = {
  original: "var(--color-gold)",
  medium: "var(--color-gold-soft)",
  thumb: "var(--color-ink-muted)",
  edited: "var(--color-wine)",
  other: "var(--color-border)",
};

const WARN_AT_PERCENT = (STORAGE_WARN_BYTES / STORAGE_LIMIT_BYTES) * 100;

export async function StorageUsage() {
  if (!isStorageConfigured()) {
    return (
      <p className="text-[var(--color-ink-muted)] text-sm">
        저장소가 연결되지 않아 사용량을 읽을 수 없습니다.
      </p>
    );
  }

  const { totalBytes, objectCount, byKind } = await getStorageUsage();
  const level = usageLevel(totalBytes);
  const percent = usagePercent(totalBytes);
  const present = STORAGE_KINDS.filter((kind) => byKind[kind] > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="font-serif text-2xl text-[var(--color-ink)]">
          {formatBytes(totalBytes)}
          <span className="text-[var(--color-ink-muted)] text-base">
            {" / "}
            {formatBytes(STORAGE_LIMIT_BYTES)}
          </span>
        </p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {percent}% 사용 · 파일 {objectCount.toLocaleString("ko-KR")}개
        </p>
      </div>

      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)] ring-1 ring-inset ring-[var(--color-border)]"
        role="progressbar"
        aria-label="저장소 사용량"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${formatBytes(totalBytes)} / ${formatBytes(STORAGE_LIMIT_BYTES)} 사용`}
      >
        <div className="flex h-full">
          {present.map((kind) => (
            <div
              key={kind}
              style={{
                width: `${(byKind[kind] / STORAGE_LIMIT_BYTES) * 100}%`,
                background: KIND_COLOR[kind],
              }}
            />
          ))}
        </div>
        {/* The 0.8 GB guardrail from AGENTS.md §6, drawn where it actually sits. */}
        <div
          aria-hidden
          className="absolute inset-y-0 w-px bg-[var(--color-wine)] opacity-60"
          style={{ left: `${WARN_AT_PERCENT}%` }}
        />
      </div>

      <p
        aria-hidden
        className="-mt-1.5 text-[0.6875rem] text-[var(--color-ink-muted)] whitespace-nowrap"
        style={{ marginInlineStart: `${WARN_AT_PERCENT}%`, transform: "translateX(-100%)" }}
      >
        경고선 {formatBytes(STORAGE_WARN_BYTES)} ↑
      </p>

      {present.length > 0 ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[var(--color-ink-muted)]">
          {present.map((kind) => (
            <li key={kind} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: KIND_COLOR[kind] }}
              />
              {KIND_LABEL[kind]}
              <span className="text-[var(--color-ink)]">{formatBytes(byKind[kind])}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">
          아직 올린 사진이 없습니다. 갤러리에서 첫 사진을 올려보세요.
        </p>
      )}

      {level === "warn" && (
        <p className="text-sm text-[var(--color-wine)]">
          경고선 {formatBytes(STORAGE_WARN_BYTES)}을 넘었습니다. 휴지통을 비우거나 오래된
          영상을 정리해주세요.
        </p>
      )}
      {level === "critical" && (
        <p className="text-sm text-[var(--color-wine)]">
          무료 한도를 다 썼습니다. 새 업로드가 실패할 수 있으니 사진을 정리하거나 요금제를
          올려주세요.
        </p>
      )}
    </div>
  );
}
