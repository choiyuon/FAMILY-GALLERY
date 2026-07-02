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
  const isFirstRender = useRef(true);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    // Skip the initial mount — SSR already provided the first page for "all"
    if (isFirstRender.current && filter === "all") {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const url = `/api/media/list?limit=30${filter !== "all" ? `&kind=${filter}` : ""}`;
    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        const { items: newItems, cursor: newCursor }: { items: MediaTileData[]; cursor: string | null } = await res.json();
        setItems(newItems);
        setCursor(newCursor);
      } catch {
        // aborted (superseded by a newer filter change) or network error
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [filter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || loadingRef.current || !cursor) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        const url = `/api/media/list?limit=30&cursor=${cursor}${filter !== "all" ? `&kind=${filter}` : ""}`;
        (async () => {
          try {
            const res = await fetch(url, { signal: controller.signal });
            const { items: newItems, cursor: newCursor }: { items: MediaTileData[]; cursor: string | null } = await res.json();
            setItems((prev) => [...prev, ...newItems]);
            setCursor(newCursor);
          } catch {
            // aborted (superseded by a filter change) or network error
          } finally {
            if (abortRef.current === controller) setLoading(false);
          }
        })();
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, filter]);

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
