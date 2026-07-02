"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export interface MediaTileData {
  id: string;
  title: string;
  kind: "photo" | "video";
  thumbUrl: string;
  width: number;
  height: number;
  shortEdgePx: number;
  durationMs?: number | null;
}

export function MediaTile({ item }: { item: MediaTileData }) {
  const router = useRouter();

  return (
    <div
      className="tile relative cursor-pointer overflow-hidden bg-[var(--color-bg-elevated)] group"
      onClick={() => router.push(`/gallery?photo=${item.id}`, { scroll: false })}
      role="button"
      aria-label={item.title}
    >
      <Image
        src={item.thumbUrl}
        alt={item.title}
        width={item.width}
        height={item.height}
        className="w-full h-auto block"
        loading="lazy"
        unoptimized
      />
      {item.kind === "video" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-[var(--color-overlay)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" className="fill-[var(--color-overlay-fg)]">
              <polygon points="5,3 13,8 5,13" />
            </svg>
          </div>
        </div>
      )}
      {item.shortEdgePx >= 300 && (
        <span className="tile-cap absolute bottom-0 left-0 right-0 px-3 py-2 text-xs italic font-serif text-[var(--color-overlay-fg)] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-[var(--color-overlay)] to-transparent hidden md:block">
          {item.title}
        </span>
      )}
    </div>
  );
}
