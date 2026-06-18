import { isNull, desc } from "drizzle-orm";
import { Suspense } from "react";
import { auth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { presignGet } from "@/lib/r2/client";
import { Topbar } from "@/components/design/topbar";
import { MediaGrid } from "./media-grid";
import { Lightbox } from "./lightbox";
import { UploadFab } from "./upload-fab";
import { SearchBar } from "./search-bar";

export default async function GalleryPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  const db = await getDb();
  const rows = await db
    .select()
    .from(media)
    .where(isNull(media.deletedAt))
    .orderBy(desc(media.createdAt))
    .limit(31);

  const hasMore = rows.length > 30;
  const firstPage = rows.slice(0, 30);

  const initialItems = await Promise.all(
    firstPage.map(async (row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind as "photo" | "video",
      thumbUrl: await presignGet(row.r2ThumbKey),
      width: row.width,
      height: row.height,
      shortEdgePx: row.shortEdgePx,
      durationMs: row.durationMs,
    }))
  );

  const initialCursor = hasMore ? firstPage[29].createdAt.toISOString() : null;

  const navItems = [
    ...(isAdmin ? [{ href: "/admin", label: "관리" }] : []),
    { href: "/landing", label: "나가기" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <Topbar navItems={navItems} cta={<SearchBar />} />
      <Suspense fallback={null}>
        <MediaGrid initialItems={initialItems} initialCursor={initialCursor} />
        <Lightbox />
      </Suspense>
      <UploadFab />
    </div>
  );
}
