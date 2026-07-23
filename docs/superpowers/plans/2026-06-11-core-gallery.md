# Core Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudflare R2 storage, media upload/display flow, infinite-scroll masonry gallery, lightbox, and search so the app can actually show family photos and videos.

**Architecture:** R2 pre-signed PUT for uploads (client → R2 directly). Server generates sharp thumbnails on upload-complete. Gallery page uses CSS-columns masonry with cursor-based infinite scroll. Lightbox is a query-param overlay (`?photo=<id>`). Search is server-side `ILIKE` on `title_lower`.

**Tech Stack:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2 is S3-compatible), `sharp` (thumb/medium generation), `file-type` (MIME + magic-byte validation), Drizzle ORM, React `use` hook + Server Components.

---

## Reference Documents

- Spec: `docs/superpowers/specs/2026-05-14-family-gallery-design.md` (§3, §4.3, §6, §7.1–7.3, §13)
- Design pattern: `docs/superpowers/specs/2026-05-21-design-pattern.md` (§3–§5)
- Existing design primitives: `src/components/design/` (Topbar, MasonryLayout, ChipRow, PillButton, UnderlineInput)
- AGENTS.md §3 (TDD mandatory for title.ts), §5 (R2 TTL limits), §6 (upload size limits), §7 (design tokens only)

## File Structure

```
src/
├── lib/
│   ├── r2/
│   │   └── client.ts            # S3Client pointed at R2 + presign helpers
│   ├── media/
│   │   └── title.ts             # suggestTitles(), isTitleTaken()
│   └── db/
│       └── schema.ts            # +media table, +kindEnum
├── app/
│   ├── api/
│   │   └── media/
│   │       ├── upload/
│   │       │   ├── route.ts     # POST: validate title + issue pre-signed PUT
│   │       │   └── complete/
│   │       │       └── route.ts # POST: sharp thumbnails + DB insert
│   │       ├── search/
│   │       │   └── route.ts     # GET ?q=
│   │       └── [id]/
│   │           └── route.ts     # GET single media
│   └── (app)/
│       └── gallery/
│           ├── page.tsx         # Server shell (first page of media)
│           ├── media-grid.tsx   # "use client" infinite-scroll grid
│           ├── media-tile.tsx   # Single masonry tile (img/video thumbnail)
│           ├── lightbox.tsx     # "use client" ?photo= overlay
│           └── search-bar.tsx   # "use client" debounced search input
└── components/design/
    └── (existing — no changes needed)
tests/
└── unit/
    └── media-title.test.ts
```

---

## Task 1: R2 Client + Environment

**Files:**
- Create: `src/lib/r2/client.ts`
- Modify: `.env.example`

- [ ] **Step 1.1: Install AWS SDK v3**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 1.2: Add R2 env vars to .env.example**

Append to `.env.example`:
```
# Cloudflare R2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=family-gallery
R2_PUBLIC_URL=https://pub-xxxx.r2.dev   # or custom domain — used for signed URL base
```

Add the same keys to `.env.local` with real values from Cloudflare R2 dashboard.

- [ ] **Step 1.3: Create R2 client**

Create `src/lib/r2/client.ts`:
```ts
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});

const BUCKET = () => requireEnv("R2_BUCKET_NAME");

/** Issue a pre-signed PUT URL (5-minute TTL per spec §13). */
export async function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET(), Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
}

/** Issue a pre-signed GET URL (24-hour TTL per spec §13). */
export async function presignGet(key: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET(), Key: key }),
    { expiresIn: 86400 }
  );
}

/** Delete an R2 object. */
export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}
```

- [ ] **Step 1.4: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/r2/client.ts .env.example
git commit -m "feat(r2): add S3-compatible R2 client with presign helpers"
```

---

## Task 2: Media Table in Schema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: generated migration under `src/lib/db/migrations/`

- [ ] **Step 2.1: Add media table to schema**

Replace `src/lib/db/schema.ts` (keep existing enums/tables, add below `auditLog`):
```ts
import {
  pgTable, pgEnum, uuid, text, timestamp,
  bigserial, jsonb, index, integer, bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "member"]);
export const themeEnum = pgEnum("theme", ["light", "dark"]);
export const kindEnum = pgEnum("kind", ["photo", "video"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("member"),
  theme: themeEnum("theme").notNull().default("light"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    action: text("action").notNull(),
    targetMediaId: uuid("target_media_id"),
    targetUserId: uuid("target_user_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_actor_idx").on(t.actorId),
    index("audit_log_created_idx").on(t.createdAt),
  ]
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    titleLower: text("title_lower").notNull().unique(),
    kind: kindEnum("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    durationMs: integer("duration_ms"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    r2OriginalKey: text("r2_original_key").notNull(),
    r2MediumKey: text("r2_medium_key"),
    r2ThumbKey: text("r2_thumb_key").notNull(),
    r2EditedKey: text("r2_edited_key"),
    shortEdgePx: integer("short_edge_px").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("media_owner_idx").on(t.ownerId),
    index("media_created_idx").on(t.createdAt),
    index("media_deleted_idx").on(t.deletedAt),
  ]
);
```

- [ ] **Step 2.2: Generate migration**

```bash
npm run db:generate
```

Expected: new file under `src/lib/db/migrations/000X_*.sql` containing `CREATE TYPE "kind"` and `CREATE TABLE "media"`.

- [ ] **Step 2.3: Apply migration**

```bash
npm run db:migrate
```

Expected: "All migrations applied successfully" or similar.

- [ ] **Step 2.4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/
git commit -m "feat(db): add media table with R2 key columns"
```

---

## Task 3: Title Uniqueness + Suggestion (TDD)

**Files:**
- Create: `tests/unit/media-title.test.ts`, `src/lib/media/title.ts`

AGENTS.md §3 mandates TDD for this module.

- [ ] **Step 3.1: Write the failing test**

Create `tests/unit/media-title.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll, insertTestUser, testSql } from "../helpers/db";
import { isTitleTaken, suggestTitles } from "@/lib/media/title";

beforeEach(truncateAll);

async function insertMedia(ownerId: string, title: string) {
  const titleLower = title.toLowerCase();
  await testSql`
    INSERT INTO media (owner_id, title, title_lower, kind, mime_type, width, height,
                       size_bytes, r2_original_key, r2_thumb_key, short_edge_px)
    VALUES (${ownerId}, ${title}, ${titleLower}, 'photo', 'image/jpeg',
            800, 600, 100000, 'original/test.jpg', 'thumb/test.jpg', 600)
  `;
}

describe("isTitleTaken", () => {
  it("returns false when no media exists with that title", async () => {
    const user = await insertTestUser();
    expect(await isTitleTaken("제주 여행")).toBe(false);
  });

  it("returns true when a media row has that title (case-insensitive)", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "제주 여행");
    expect(await isTitleTaken("제주 여행")).toBe(true);
    expect(await isTitleTaken("제주 여행".toUpperCase())).toBe(true);
  });
});

describe("suggestTitles", () => {
  it("suggests base (1), base (2), base (3) when base is taken", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "여행");
    const suggestions = await suggestTitles("여행");
    expect(suggestions).toEqual(["여행 (1)", "여행 (2)", "여행 (3)"]);
  });

  it("skips already-taken numbered variants", async () => {
    const user = await insertTestUser();
    await insertMedia(user.id, "여행");
    await insertMedia(user.id, "여행 (1)");
    await insertMedia(user.id, "여행 (2)");
    const suggestions = await suggestTitles("여행");
    expect(suggestions).toEqual(["여행 (3)", "여행 (4)", "여행 (5)"]);
  });

  it("returns empty array when base is not taken", async () => {
    const suggestions = await suggestTitles("새 제목");
    expect(suggestions).toEqual([]);
  });
});
```

- [ ] **Step 3.2: Run, watch it fail**

```bash
npm test -- tests/unit/media-title.test.ts
```

Expected: failures referencing `@/lib/media/title`.

- [ ] **Step 3.3: Implement title module**

Create `src/lib/media/title.ts`:
```ts
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";

export async function isTitleTaken(title: string): Promise<boolean> {
  const [row] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.titleLower, title.toLowerCase()))
    .limit(1);
  return Boolean(row);
}

export async function suggestTitles(base: string): Promise<string[]> {
  if (!(await isTitleTaken(base))) return [];

  const suggestions: string[] = [];
  let n = 1;
  while (suggestions.length < 3) {
    const candidate = `${base} (${n})`;
    if (!(await isTitleTaken(candidate))) {
      suggestions.push(candidate);
    }
    n++;
    if (n > 1000) break; // safety guard
  }
  return suggestions;
}
```

- [ ] **Step 3.4: Run tests, expect green**

```bash
npm test -- tests/unit/media-title.test.ts
```

Expected: 5 passes.

- [ ] **Step 3.5: Run all tests to check for regressions**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 3.6: Commit**

```bash
git add tests/unit/media-title.test.ts src/lib/media/title.ts
git commit -m "feat(media): add title uniqueness check and suggestion with tests"
```

---

## Task 4: Upload Start API (pre-signed PUT)

**Files:**
- Create: `src/app/api/media/upload/route.ts`

This route validates the title, then issues a pre-signed R2 PUT URL. The client uploads directly to R2.

- [ ] **Step 4.1: Install file-type for MIME validation**

```bash
npm install file-type
```

- [ ] **Step 4.2: Create upload start route**

Create `src/app/api/media/upload/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { UnauthorizedError } from "@/lib/auth/guard";
import { isTitleTaken, suggestTitles } from "@/lib/media/title";
import { presignPut } from "@/lib/r2/client";
import { randomUUID } from "node:crypto";

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
]);

export async function POST(req: Request) {
  try {
    await requireSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim();
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!title) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  if (!ALLOWED_MIME.has(mimeType)) return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });

  const isPhoto = mimeType.startsWith("image/");
  const maxBytes = isPhoto ? 25 * 1024 * 1024 : 100 * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return NextResponse.json({ error: isPhoto ? "사진은 최대 25MB입니다." : "영상은 최대 100MB입니다." }, { status: 400 });
  }

  if (await isTitleTaken(title)) {
    const suggestions = await suggestTitles(title);
    return NextResponse.json({ error: "이미 사용 중인 이름입니다.", suggestions }, { status: 409 });
  }

  const ext = mimeType.split("/")[1].replace("quicktime", "mov");
  const mediaId = randomUUID();
  const key = `original/${mediaId}.${ext}`;
  const uploadUrl = await presignPut(key, mimeType);

  // For videos, also issue a pre-signed PUT for the thumbnail frame the client will extract
  let thumbKey: string | undefined;
  let thumbUploadUrl: string | undefined;
  if (!isPhoto) {
    thumbKey = `thumb/${mediaId}.jpg`;
    thumbUploadUrl = await presignPut(thumbKey, "image/jpeg");
  }

  return NextResponse.json({ mediaId, key, uploadUrl, thumbKey, thumbUploadUrl });
}
```

- [ ] **Step 4.3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/app/api/media/upload/route.ts
git commit -m "feat(api): add upload start endpoint with pre-signed PUT"
```

---

## Task 5: Upload Complete API (sharp thumbnails + DB insert)

**Files:**
- Create: `src/app/api/media/upload/complete/route.ts`

After the client has PUT the file to R2, it calls this route. We use sharp to generate thumb + medium from the original, insert the media row, and write the audit log.

- [ ] **Step 5.1: Install sharp**

```bash
npm install sharp
npm install -D @types/sharp
```

- [ ] **Step 5.2: Create upload complete route**

Create `src/app/api/media/upload/complete/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { r2, presignGet } from "@/lib/r2/client";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { isTitleTaken } from "@/lib/media/title";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const { mediaId, key, title, mimeType, sizeBytes, durationMs, width, height } = body as {
    mediaId: string;
    key: string;
    title: string;
    mimeType: string;
    sizeBytes: number;
    durationMs?: number;
    width: number;
    height: number;
  };

  if (!mediaId || !key || !title || !mimeType) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
  }

  if (await isTitleTaken(title)) {
    return NextResponse.json({ error: "이름 충돌 — 다시 시도해주세요." }, { status: 409 });
  }

  const bucket = process.env.R2_BUCKET_NAME!;
  const isPhoto = mimeType.startsWith("image/");
  const shortEdgePx = Math.min(width, height);

  let r2ThumbKey: string;
  let r2MediumKey: string | undefined;

  if (isPhoto) {
    // Fetch original from R2 and generate thumbnails
    const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buf = await streamToBuffer(obj.Body as NodeJS.ReadableStream);

    const thumbBuf = await sharp(buf).resize(200, 200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const mediumBuf = await sharp(buf).resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

    r2ThumbKey = key.replace("original/", "thumb/").replace(/\.\w+$/, ".jpg");
    r2MediumKey = key.replace("original/", "medium/").replace(/\.\w+$/, ".jpg");

    await Promise.all([
      r2.send(new PutObjectCommand({ Bucket: bucket, Key: r2ThumbKey, Body: thumbBuf, ContentType: "image/jpeg" })),
      r2.send(new PutObjectCommand({ Bucket: bucket, Key: r2MediumKey, Body: mediumBuf, ContentType: "image/jpeg" })),
    ]);
  } else {
    // Video: client already extracted the thumbnail frame and uploaded it via thumbUploadUrl
    // The server issued thumbKey in the upload-start response; client echoes it back here
    r2ThumbKey = String(body.thumbKey ?? key.replace("original/", "thumb/").replace(/\.\w+$/, ".jpg"));
  }

  const [row] = await db.insert(media).values({
    id: mediaId,
    ownerId: session.user.id,
    title,
    titleLower: title.toLowerCase(),
    kind: isPhoto ? "photo" : "video",
    mimeType,
    width,
    height,
    durationMs: durationMs ?? null,
    sizeBytes,
    r2OriginalKey: key,
    r2MediumKey: r2MediumKey ?? null,
    r2ThumbKey,
    shortEdgePx,
  }).returning({ id: media.id });

  await writeAudit({
    actorId: session.user.id,
    action: "upload",
    targetMediaId: row.id,
    metadata: { title, kind: isPhoto ? "photo" : "video" },
  });

  return NextResponse.json({ id: row.id });
}
```

- [ ] **Step 5.3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/app/api/media/upload/complete/route.ts
git commit -m "feat(api): add upload complete endpoint with sharp thumbnails"
```

---

## Task 6: GET /api/media/[id] and GET /api/media/search

**Files:**
- Create: `src/app/api/media/[id]/route.ts`
- Create: `src/app/api/media/search/route.ts`

- [ ] **Step 6.1: Single media GET**

Create `src/app/api/media/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { presignGet } from "@/lib/r2/client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), isNull(media.deletedAt)))
    .limit(1);

  if (!row) return new NextResponse("Not Found", { status: 404 });

  const displayKey = row.r2EditedKey ?? row.r2MediumKey ?? row.r2OriginalKey;
  const [thumbUrl, displayUrl, originalUrl] = await Promise.all([
    presignGet(row.r2ThumbKey),
    presignGet(displayKey),
    row.kind === "photo" ? presignGet(row.r2OriginalKey) : presignGet(row.r2OriginalKey),
  ]);

  return NextResponse.json({ ...row, thumbUrl, displayUrl, originalUrl });
}
```

- [ ] **Step 6.2: Search route**

Create `src/app/api/media/search/route.ts`:
```ts
import { NextResponse } from "next/server";
import { and, isNull, like } from "drizzle-orm";
import { requireSession } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { presignGet } from "@/lib/r2/client";

export async function GET(req: Request) {
  try {
    await requireSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(media)
    .where(and(isNull(media.deletedAt), like(media.titleLower, `%${q}%`)))
    .orderBy(media.createdAt)
    .limit(50);

  const results = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      thumbUrl: await presignGet(row.r2ThumbKey),
    }))
  );

  return NextResponse.json(results);
}
```

- [ ] **Step 6.3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6.4: Commit**

```bash
git add src/app/api/media/[id]/route.ts src/app/api/media/search/route.ts
git commit -m "feat(api): add media GET by id and search endpoint"
```

---

## Task 7: Gallery Page — Server Shell + Infinite-Scroll Grid

**Files:**
- Modify: `src/app/(app)/gallery/page.tsx`
- Create: `src/app/(app)/gallery/media-grid.tsx`
- Create: `src/app/(app)/gallery/media-tile.tsx`

The server page fetches the first 30 items and passes them to the client grid. The client grid loads more on scroll.

- [ ] **Step 7.1: Create MediaTile component**

Create `src/app/(app)/gallery/media-tile.tsx`:
```tsx
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
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
              <polygon points="5,3 13,8 5,13" />
            </svg>
          </div>
        </div>
      )}
      {item.shortEdgePx >= 300 && (
        <span className="tile-cap absolute bottom-0 left-0 right-0 px-3 py-2 text-xs italic font-serif text-white opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent hidden md:block">
          {item.title}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 7.2: Create MediaGrid (client component)**

Create `src/app/(app)/gallery/media-grid.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<string>("all");
  const [items, setItems] = useState<MediaTileData[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reload when filter changes
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

  // Infinite scroll
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
```

- [ ] **Step 7.3: Add /api/media/list route**

Create `src/app/api/media/list/route.ts`:
```ts
import { NextResponse } from "next/server";
import { and, isNull, lt, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { media, kindEnum } from "@/lib/db/schema";
import { presignGet } from "@/lib/r2/client";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await requireSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 30), 60);
  const cursor = searchParams.get("cursor"); // ISO timestamp of last item
  const kind = searchParams.get("kind") as "photo" | "video" | null;

  const conditions = [isNull(media.deletedAt)];
  if (cursor) conditions.push(lt(media.createdAt, new Date(cursor)));
  if (kind === "photo" || kind === "video") conditions.push(eq(media.kind, kind));

  const rows = await db
    .select()
    .from(media)
    .where(and(...conditions))
    .orderBy(desc(media.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  const withUrls = await Promise.all(
    items.map(async (row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      thumbUrl: await presignGet(row.r2ThumbKey),
      width: row.width,
      height: row.height,
      shortEdgePx: row.shortEdgePx,
      durationMs: row.durationMs,
    }))
  );

  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;
  return NextResponse.json({ items: withUrls, cursor: nextCursor });
}
```

- [ ] **Step 7.4: Replace gallery page.tsx**

Replace `src/app/(app)/gallery/page.tsx`:
```tsx
import { and, isNull, desc } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { presignGet } from "@/lib/r2/client";
import { Topbar } from "@/components/design/topbar";
import { PillButton } from "@/components/design/pill-button";
import { MediaGrid } from "./media-grid";
import { Suspense } from "react";

export default async function GalleryPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

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
      <Topbar navItems={navItems} />
      <Suspense>
        <MediaGrid initialItems={initialItems} initialCursor={initialCursor} />
      </Suspense>
    </div>
  );
}
```

Note: upload is handled by the FAB added in Task 9. Remove the `PillButton` import if added — it is not used here.

- [ ] **Step 7.5: Verify PillButton import (no changes needed)**

`src/components/design/pill-button.tsx` already exists. It's a `<button>` — do NOT add it to the gallery Topbar here (upload is handled by the FAB in Task 9). No file changes needed in this step.

- [ ] **Step 7.6: Type-check + dev server smoke test**

```bash
npx tsc --noEmit
npm run dev
```

Visit http://localhost:3000/gallery while logged in. With no media yet, expect: "아직 사진이나 영상이 없어요." message. Stop the server.

- [ ] **Step 7.7: Commit**

```bash
git add src/app/(app)/gallery/ src/app/api/media/list/ src/components/design/pill-button.tsx
git commit -m "feat(gallery): add masonry grid with infinite scroll and filter chips"
```

---

## Task 8: Lightbox Overlay

**Files:**
- Create: `src/app/(app)/gallery/lightbox.tsx`
- Modify: `src/app/(app)/gallery/page.tsx` (add Lightbox below MediaGrid)

Lightbox reads `?photo=<id>` from the URL. Closing it removes the query param.

- [ ] **Step 8.1: Create Lightbox component**

Create `src/app/(app)/gallery/lightbox.tsx`:
```tsx
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

  useEffect(() => {
    if (!photoId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    fetch(`/api/media/${photoId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null))
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
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      onClick={close}
    >
      <button
        className="absolute top-4 right-4 text-white text-2xl leading-none p-2"
        onClick={close}
        aria-label="닫기"
      >
        ×
      </button>
      {loading && (
        <div className="text-white font-serif text-lg">불러오는 중...</div>
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
            />
          )}
          <p className="text-white font-serif italic text-sm">{detail.title}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.2: Add Lightbox to gallery page**

In `src/app/(app)/gallery/page.tsx`, import and add `<Lightbox />` inside the `<Suspense>` block, after `<MediaGrid>`:
```tsx
import { Lightbox } from "./lightbox";

// Inside the return, after <MediaGrid .../>:
<Lightbox />
```

- [ ] **Step 8.3: Smoke test**

```bash
npm run dev
```

Log in, navigate to `/gallery`. With a real uploaded photo, click a tile — lightbox should open. Press Escape to close. Stop the server.

- [ ] **Step 8.4: Commit**

```bash
git add src/app/(app)/gallery/lightbox.tsx src/app/(app)/gallery/page.tsx
git commit -m "feat(gallery): add lightbox overlay for photo and video"
```

---

## Task 9: Upload Dialog + FAB

**Files:**
- Create: `src/app/(app)/gallery/upload-dialog.tsx`
- Create: `src/app/(app)/gallery/upload-fab.tsx`

The FAB is a fixed button at bottom-left. When clicked it opens `UploadDialog` which handles file selection, title input, duplicate checking, R2 upload, and completion.

- [ ] **Step 9.1: Create UploadFab**

Create `src/app/(app)/gallery/upload-fab.tsx`:
```tsx
"use client";

import { useState } from "react";
import { UploadDialog } from "./upload-dialog";

export function UploadFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-[var(--color-gold)] text-white shadow-lg flex items-center justify-center text-2xl hover:bg-[var(--color-gold-soft)] transition-colors"
        aria-label="업로드"
      >
        +
      </button>
      {open && <UploadDialog onClose={() => setOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 9.2: Create UploadDialog**

Create `src/app/(app)/gallery/upload-dialog.tsx`:
```tsx
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
  // For video, the client extracts a thumbnail frame and uploads it separately
  thumbBlob?: Blob;
  width: number;
  height: number;
  durationMs?: number;
}

async function extractVideoThumb(file: File): Promise<{ blob: Blob; width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.onloadeddata = () => {
      const MAX_DURATION_MS = Number(process.env.NEXT_PUBLIC_MAX_VIDEO_DURATION_MS ?? 5 * 60 * 1000);
      if (video.duration * 1000 > MAX_DURATION_MS) {
        reject(new Error(`영상은 최대 ${MAX_DURATION_MS / 60000}분입니다.`));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("썸네일 생성 실패")); return; }
          resolve({ blob, width: video.videoWidth, height: video.videoHeight, durationMs: Math.round(video.duration * 1000) });
        },
        "image/jpeg",
        0.8
      );
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => reject(new Error("영상 로드 실패"));
  });
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const newEntries: FileEntry[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      let width = 0, height = 0, durationMs: number | undefined, thumbBlob: Blob | undefined;
      try {
        if (isVideo) {
          const info = await extractVideoThumb(file);
          width = info.width; height = info.height; durationMs = info.durationMs; thumbBlob = info.blob;
        } else {
          const dims = await getImageDimensions(file);
          width = dims.width; height = dims.height;
        }
      } catch (e: unknown) {
        newEntries.push({ file, title: file.name.replace(/\.[^.]+$/, ""), error: (e as Error).message, suggestions: [], uploading: false, done: false, width: 0, height: 0 });
        continue;
      }
      newEntries.push({ file, title: file.name.replace(/\.[^.]+$/, ""), error: null, suggestions: [], uploading: false, done: false, thumbBlob, width, height, durationMs });
    }
    setEntries((prev) => [...prev, ...newEntries]);
  }

  function setTitle(idx: number, title: string) {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, title, error: null, suggestions: [] } : e));
  }

  function pickSuggestion(idx: number, suggestion: string) {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, title: suggestion, error: null, suggestions: [] } : e));
  }

  async function uploadOne(idx: number) {
    const entry = entries[idx];
    if (!entry || entry.done || entry.uploading) return;

    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, uploading: true, error: null } : e));

    try {
      // 1. Get pre-signed URL
      const startRes = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: entry.title, mimeType: entry.file.type, sizeBytes: entry.file.size }),
      });
      const startData = await startRes.json();
      if (startRes.status === 409) {
        setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, uploading: false, error: startData.error, suggestions: startData.suggestions ?? [] } : e));
        return;
      }
      if (!startRes.ok) {
        setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, uploading: false, error: startData.error ?? "업로드 실패" } : e));
        return;
      }

      const { mediaId, key, uploadUrl, thumbKey, thumbUploadUrl } = startData as {
        mediaId: string; key: string; uploadUrl: string;
        thumbKey?: string; thumbUploadUrl?: string;
      };

      // 2. PUT original to R2
      await fetch(uploadUrl, { method: "PUT", body: entry.file, headers: { "content-type": entry.file.type } });

      // 3. For video, upload the client-extracted thumbnail frame
      if (entry.thumbBlob && thumbUploadUrl) {
        await fetch(thumbUploadUrl, { method: "PUT", body: entry.thumbBlob, headers: { "content-type": "image/jpeg" } });
      }

      // 4. Call complete
      const completeRes = await fetch("/api/media/upload/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaId, key, title: entry.title, mimeType: entry.file.type,
          sizeBytes: entry.file.size, width: entry.width, height: entry.height,
          durationMs: entry.durationMs, thumbKey,
        }),
      });

      if (!completeRes.ok) {
        const d = await completeRes.json().catch(() => ({}));
        setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, uploading: false, error: d.error ?? "완료 실패" } : e));
        return;
      }

      setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, uploading: false, done: true } : e));
    } catch {
      setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, uploading: false, error: "네트워크 오류" } : e));
    }
  }

  async function uploadAll() {
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].done && !entries[i].uploading && !entries[i].error) {
        await uploadOne(i);
      }
    }
    if (entries.every((e) => e.done)) {
      router.refresh();
      onClose();
    }
  }

  const allDone = entries.length > 0 && entries.every((e) => e.done);
  const hasErrors = entries.some((e) => e.error);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4">
      <div
        className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] w-full max-w-lg max-h-[80vh] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-serif text-lg">업로드</h2>
          <button onClick={onClose} className="text-[var(--color-ink-muted)] text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <button
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-6 text-center text-[var(--color-ink-muted)] font-serif hover:border-[var(--color-gold)] transition-colors"
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
            <div key={idx} className="border border-[var(--color-border)] rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--color-ink-muted)] truncate flex-1">{entry.file.name}</span>
                {entry.done && <span className="text-xs text-green-600">완료</span>}
              </div>
              <input
                type="text"
                value={entry.title}
                onChange={(e) => setTitle(idx, e.target.value)}
                disabled={entry.done || entry.uploading}
                placeholder="이름"
                className="border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm rounded"
              />
              {entry.error && <p className="text-xs text-[var(--color-wine)]">{entry.error}</p>}
              {entry.suggestions.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {entry.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => pickSuggestion(idx, s)}
                      className="text-xs border border-[var(--color-gold-soft)] rounded-full px-2 py-1 text-[var(--color-gold)] hover:bg-[var(--color-gold-soft)] hover:text-[var(--color-bg)] transition-colors"
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
                onClick={() => { router.refresh(); onClose(); }}
                className="w-full bg-[var(--color-ink)] text-[var(--color-bg)] font-serif py-2.5 rounded"
              >
                완료
              </button>
            ) : (
              <button
                onClick={uploadAll}
                disabled={hasErrors}
                className="w-full bg-[var(--color-gold)] text-white font-serif py-2.5 rounded disabled:opacity-50"
              >
                올리기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.3: No additional upload route changes needed**

The video thumbnail presigned URL is now returned by the upload start endpoint alongside `uploadUrl`. No additional route changes required.

- [ ] **Step 9.4: Add UploadFab to gallery page**

In `src/app/(app)/gallery/page.tsx`, import and add `<UploadFab />` after the `</Suspense>`:
```tsx
import { UploadFab } from "./upload-fab";

// At the end of the return, before closing </div>:
<UploadFab />
```

- [ ] **Step 9.5: Type-check + smoke test**

```bash
npx tsc --noEmit
npm run dev
```

Log in. Click the `+` FAB. Select an image. Enter a title. Click "올리기". Expected: upload completes, gallery refreshes showing the new image. Stop the server.

- [ ] **Step 9.6: Commit**

```bash
git add src/app/(app)/gallery/upload-fab.tsx src/app/(app)/gallery/upload-dialog.tsx src/app/api/media/upload/route.ts src/app/(app)/gallery/page.tsx
git commit -m "feat(upload): add upload FAB and dialog with pre-signed R2 upload"
```

---

## Task 10: Search Bar

**Files:**
- Create: `src/app/(app)/gallery/search-bar.tsx`
- Modify: `src/app/(app)/gallery/page.tsx` (add SearchBar to Topbar)

- [ ] **Step 10.1: Create SearchBar**

Create `src/app/(app)/gallery/search-bar.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  title: string;
  thumbUrl: string;
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  function onSelect(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/gallery?photo=${id}`, { scroll: false });
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        placeholder="검색"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
        className="w-40 md:w-56 text-xs px-3 py-1.5 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] rounded-full placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-gold)]"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-lg rounded z-50">
          {results.map((r) => (
            <button
              key={r.id}
              onMouseDown={() => onSelect(r.id)}
              className="w-full text-left px-3 py-2 text-sm font-serif hover:bg-[var(--color-bg)] flex items-center gap-2 border-b border-[var(--color-border)] last:border-0"
            >
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 10.2: Add SearchBar to gallery Topbar**

In `src/app/(app)/gallery/page.tsx`, add the SearchBar import and pass it as the `cta` prop:
```tsx
import { SearchBar } from "./search-bar";

// In the return block, update Topbar:
<Topbar navItems={navItems} cta={<SearchBar />} />
```

- [ ] **Step 10.3: Smoke test**

```bash
npm run dev
```

Visit `/gallery`. Type in the search box. With media uploaded, results should appear. Clicking a result opens the lightbox. Stop the server.

- [ ] **Step 10.4: Commit**

```bash
git add src/app/(app)/gallery/search-bar.tsx src/app/(app)/gallery/page.tsx
git commit -m "feat(gallery): add debounced search bar with lightbox integration"
```

---

## Task 11: Final Verification

- [ ] **Step 11.1: Run unit tests**

```bash
npm test
```

Expected: all pass (password + audit + invite-tokens + invite-service + seed-admin + media-title).

- [ ] **Step 11.2: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 11.3: Production build**

```bash
npm run build
```

Expected: build succeeds. Note any warnings but no errors.

- [ ] **Step 11.4: Manual end-to-end flow**

Run `npm run dev`. Walk through:
1. Login as admin → `/gallery` shows empty state.
2. Click `+` FAB → select a JPEG → enter title → "올리기".
3. Upload completes, gallery reloads, image tile appears.
4. Click tile → lightbox opens with the image.
5. Press Escape → lightbox closes.
6. Select "사진" chip → only photos shown.
7. Type the title in search → result appears → click → lightbox opens.
8. Upload a second photo with the same title → 409 with suggestions → pick suggestion → upload succeeds.

- [ ] **Step 11.5: Commit final fixes if any**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: plan 2 core gallery complete"
```

---

## What's Next

- **Plan 3: Trash & Admin** — soft delete, `/trash` page, 30-day Vercel Cron cleanup, R2 storage usage display in admin.
- **Plan 4: Image Editing** — `EditorCanvas` with react-konva + react-image-crop, brightness/contrast/saturation, `POST /api/media/[id]/edit`, restore-original.
- **Plan 5: Settings & Polish** — `SettingsSheet`, theme persistence to DB, Lighthouse 90+ pass, dark mode wiring.
