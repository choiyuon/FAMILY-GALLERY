import { NextResponse } from "next/server";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import {
  deleteObject,
  getObjectBuffer,
  getObjectPrefix,
  putObject,
} from "@/lib/storage/blob";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { isTitleTaken } from "@/lib/media/title";
import {
  buildImageVariants,
  buildVideoThumb,
  mediumKey,
  thumbKey,
  VARIANT_CONTENT_TYPE,
} from "@/lib/media/variants";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
    throw e;
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

  if (!mediaId || !key || !title || !mimeType || !width || !height) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
  }

  // Fix 1: [HIGH] IDOR — validate key matches mediaId
  const safeKeyPattern = /^[a-zA-Z0-9/_.-]+$/;
  if (!safeKeyPattern.test(key) || key.includes('..') || !key.startsWith(`original/${mediaId}.`)) {
    return NextResponse.json({ error: "잘못된 키입니다." }, { status: 400 });
  }

  if (await isTitleTaken(title)) {
    return NextResponse.json({ error: "이름 충돌 — 다시 시도해주세요." }, { status: 409 });
  }

  const isPhoto = mimeType.startsWith("image/");

  // Fix 2: [HIGH] Path traversal — derive thumb/medium keys from server-controlled mediaId
  const blobThumbKey = thumbKey(mediaId);
  const blobMediumKey: string | undefined = isPhoto ? mediumKey(mediaId) : undefined;

  let actualMimeType = mimeType;
  let actualWidth = width;
  let actualHeight = height;
  let actualShortEdgePx = Math.min(width, height);

  if (!isPhoto) {
    // Fix 4: [MEDIUM] Server-side sniff MIME for videos — mirrors the photo
    // branch below. Only reads the first few KB (Range GET) since magic bytes
    // for mp4/mov/webm all sit near the start of the file.
    const headBuf = await getObjectPrefix(key, 4100);

    const { fileTypeFromBuffer } = await import("file-type");
    const sniffed = await fileTypeFromBuffer(headBuf);
    const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
    if (!sniffed || !ALLOWED_VIDEO_MIME.has(sniffed.mime)) {
      return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
    }
    actualMimeType = sniffed.mime;

    // The browser staged a raster frame at thumb-src/<id>.jpg (it cannot encode
    // a canonical WebP on every platform). Re-encode it here so thumb/ is WebP.
    const srcKey = `thumb-src/${mediaId}.jpg`;
    const frameBuf = await getObjectBuffer(srcKey);
    await putObject(
      blobThumbKey,
      await buildVideoThumb(frameBuf),
      VARIANT_CONTENT_TYPE
    );
    await deleteObject(srcKey);
  }

  if (isPhoto) {
    const buf = await getObjectBuffer(key);

    // Fix 3: [MEDIUM] Server-side sniff MIME + dimensions for photos
    const { fileTypeFromBuffer } = await import("file-type");
    const sniffed = await fileTypeFromBuffer(buf);
    const ALLOWED_MIME = new Set([
      "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
    ]);
    if (!sniffed || !ALLOWED_MIME.has(sniffed.mime)) {
      return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
    }
    actualMimeType = sniffed.mime;

    const variants = await buildImageVariants(buf);
    actualWidth = variants.width || width;
    actualHeight = variants.height || height;
    actualShortEdgePx = Math.min(actualWidth, actualHeight);

    await Promise.all([
      putObject(blobThumbKey, variants.thumb, VARIANT_CONTENT_TYPE),
      putObject(blobMediumKey!, variants.medium, VARIANT_CONTENT_TYPE),
    ]);
  }

  const db = await getDb();
  const [row] = await db.insert(media).values({
    id: mediaId,
    ownerId: session.user.id,
    title,
    titleLower: title.toLowerCase(),
    kind: isPhoto ? "photo" : "video",
    mimeType: actualMimeType,
    width: actualWidth,
    height: actualHeight,
    durationMs: durationMs ?? null,
    sizeBytes,
    blobOriginalKey: key,
    blobMediumKey: blobMediumKey ?? null,
    blobThumbKey,
    shortEdgePx: actualShortEdgePx,
  }).returning({ id: media.id });

  await writeAudit({
    actorId: session.user.id,
    action: "upload",
    targetMediaId: row.id,
    metadata: { title, kind: isPhoto ? "photo" : "video" },
  });

  return NextResponse.json({ id: row.id });
}
