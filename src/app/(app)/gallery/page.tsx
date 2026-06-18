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

const MOCK_ITEMS = [
  { id: "mock-1", title: "봄날의 벚꽃", kind: "photo" as const, thumbUrl: "https://picsum.photos/seed/cherry/800/600", width: 800, height: 600, shortEdgePx: 600, durationMs: null },
  { id: "mock-2", title: "가족 나들이", kind: "photo" as const, thumbUrl: "https://picsum.photos/seed/family/600/800", width: 600, height: 800, shortEdgePx: 600, durationMs: null },
  { id: "mock-3", title: "제주 바다", kind: "photo" as const, thumbUrl: "https://picsum.photos/seed/jeju/1200/800", width: 1200, height: 800, shortEdgePx: 800, durationMs: null },
  { id: "mock-4", title: "생일 파티", kind: "photo" as const, thumbUrl: "https://picsum.photos/seed/party/800/1000", width: 800, height: 1000, shortEdgePx: 800, durationMs: null },
  { id: "mock-5", title: "첫 걸음마", kind: "video" as const, thumbUrl: "https://picsum.photos/seed/walk/800/600", width: 800, height: 600, shortEdgePx: 600, durationMs: 45000 },
  { id: "mock-6", title: "여름 휴가", kind: "photo" as const, thumbUrl: "https://picsum.photos/seed/summer/1000/700", width: 1000, height: 700, shortEdgePx: 700, durationMs: null },
  { id: "mock-7", title: "할머니 생신", kind: "photo" as const, thumbUrl: "https://picsum.photos/seed/granny/700/900", width: 700, height: 900, shortEdgePx: 700, durationMs: null },
  { id: "mock-8", title: "운동회", kind: "video" as const, thumbUrl: "https://picsum.photos/seed/sports/800/600", width: 800, height: 600, shortEdgePx: 600, durationMs: 120000 },
];

export default async function GalleryPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  const navItems = [
    ...(isAdmin ? [{ href: "/admin", label: "관리" }] : []),
    { href: "/landing", label: "나가기" },
  ];

  if (!process.env.R2_ACCOUNT_ID) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <Topbar navItems={navItems} cta={<SearchBar />} />
        <Suspense fallback={null}>
          <MediaGrid initialItems={MOCK_ITEMS} initialCursor={null} />
          <Lightbox />
        </Suspense>
        <UploadFab />
      </div>
    );
  }

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
