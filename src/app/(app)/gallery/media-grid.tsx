"use client";

import { useEffect, useRef, useState } from "react";
import { MasonryLayout } from "@/components/design/masonry-layout";
import { ChipRow } from "@/components/design/chip-row";
import { MediaTile, type MediaTileData } from "./media-tile";

const FILTER_CHIPS = [
  { id: "all", label: "전체" },
  { id: "photo", label: "사진" },
  { id: "video", label: "영상" },
];

interface MediaGridProps {
  initialItems: MediaTileData[];
  initialCursor: string | null;
}

export function MediaGrid({ initialItems, initialCursor }: MediaGridProps) {
  const [filter, setFilter] = useState<string>("all");
  const [items, setItems] = useState<MediaTileData[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const url = `/api/media/list?limit=30${filter !== "all" ? `&kind=${filter}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then(({ items: newItems, cursor: newCursor }: { items: MediaTileData[]; cursor: string | null }) => {
        setItems(newItems);
        setCursor(newCursor);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || loading || !cursor) return;
        setLoading(true);
        const url = `/api/media/list?limit=30&cursor=${cursor}${filter !== "all" ? `&kind=${filter}` : ""}`;
        fetch(url)
          .then((r) => r.json())
          .then(({ items: newItems, cursor: newCursor }: { items: MediaTileData[]; cursor: string | null }) => {
            setItems((prev) => [...prev, ...newItems]);
            setCursor(newCursor);
          })
          .finally(() => setLoading(false));
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, filter, loading]);

  return (
    <>
      <ChipRow items={FILTER_CHIPS} activeId={filter} onSelect={setFilter} />
      {items.length === 0 && !loading && (
        <p className="text-center text-[var(--color-ink-muted)] py-16 font-serif">
          아직 사진이나 영상이 없어요.
        </p>
      )}
      <MasonryLayout>
        {items.map((item) => (
          <MediaTile key={item.id} item={item} />
        ))}
      </MasonryLayout>
      <div ref={sentinelRef} className="h-1" />
      {loading && (
        <p className="text-center text-[var(--color-ink-muted)] py-4 text-sm">불러오는 중...</p>
      )}
    </>
  );
}
