import { NextResponse } from "next/server";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { r2 } from "@/lib/r2/client";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { isTitleTaken } from "@/lib/media/title";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { StreamingBlobPayloadOutputTypes } from "@smithy/types";
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

  const { mediaId, key, title, mimeType, sizeBytes, durationMs, width, height, thumbKey } = body as {
    mediaId: string;
    key: string;
    title: string;
    mimeType: string;
    sizeBytes: number;
    durationMs?: number;
    width: number;
    height: number;
    thumbKey?: string;
  };

  if (!mediaId || !key || !title || !mimeType || !width || !height) {
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
    const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buf = await streamToBuffer(
      obj.Body as unknown as NodeJS.ReadableStream
    );

    const [thumbBuf, mediumBuf] = await Promise.all([
      sharp(buf).resize(200, 200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(),
      sharp(buf).resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    ]);

    r2ThumbKey = key.replace("original/", "thumb/").replace(/\.\w+$/, ".jpg");
    r2MediumKey = key.replace("original/", "medium/").replace(/\.\w+$/, ".jpg");

    await Promise.all([
      r2.send(new PutObjectCommand({ Bucket: bucket, Key: r2ThumbKey, Body: thumbBuf, ContentType: "image/jpeg" })),
      r2.send(new PutObjectCommand({ Bucket: bucket, Key: r2MediumKey, Body: mediumBuf, ContentType: "image/jpeg" })),
    ]);
  } else {
    r2ThumbKey = thumbKey ?? key.replace("original/", "thumb/").replace(/\.\w+$/, ".jpg");
  }

  const db = await getDb();
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
