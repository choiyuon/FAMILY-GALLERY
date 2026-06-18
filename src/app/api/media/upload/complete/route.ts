import { NextResponse } from "next/server";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { r2 } from "@/lib/r2/client";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { isTitleTaken } from "@/lib/media/title";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

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

  const bucket = process.env.R2_BUCKET_NAME!;
  const isPhoto = mimeType.startsWith("image/");

  // Fix 2: [HIGH] Path traversal — derive thumb/medium keys from server-controlled mediaId
  const r2ThumbKey = `thumb/${mediaId}.jpg`;
  const r2MediumKey: string | undefined = isPhoto ? `medium/${mediaId}.jpg` : undefined;

  let actualMimeType = mimeType;
  let actualWidth = width;
  let actualHeight = height;
  let actualShortEdgePx = Math.min(width, height);

  if (isPhoto) {
    const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buf = await streamToBuffer(
      obj.Body as unknown as NodeJS.ReadableStream
    );

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
    const sharpMeta = await sharp(buf).metadata();
    actualWidth = sharpMeta.width ?? width;
    actualHeight = sharpMeta.height ?? height;
    actualShortEdgePx = Math.min(actualWidth, actualHeight);

    const [thumbBuf, mediumBuf] = await Promise.all([
      sharp(buf).resize(200, 200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(),
      sharp(buf).resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    ]);

    await Promise.all([
      r2.send(new PutObjectCommand({ Bucket: bucket, Key: r2ThumbKey, Body: thumbBuf, ContentType: "image/jpeg" })),
      r2.send(new PutObjectCommand({ Bucket: bucket, Key: r2MediumKey!, Body: mediumBuf, ContentType: "image/jpeg" })),
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
    r2OriginalKey: key,
    r2MediumKey: r2MediumKey ?? null,
    r2ThumbKey,
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
