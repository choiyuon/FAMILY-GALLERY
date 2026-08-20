import { NextResponse } from "next/server";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { isTitleTaken, suggestTitles } from "@/lib/media/title";
import { presignPut } from "@/lib/storage/blob";
import { randomUUID } from "node:crypto";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export async function POST(req: Request) {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return new NextResponse("Unauthorized", { status: 401 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim();
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!title)
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  if (!ALLOWED_MIME.has(mimeType))
    return NextResponse.json(
      { error: "지원하지 않는 파일 형식입니다." },
      { status: 400 }
    );

  const isPhoto = mimeType.startsWith("image/");
  const maxBytes = isPhoto ? 25 * 1024 * 1024 : 100 * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return NextResponse.json(
      {
        error: isPhoto ? "사진은 최대 25MB입니다." : "영상은 최대 100MB입니다.",
      },
      { status: 400 }
    );
  }

  if (await isTitleTaken(title)) {
    const suggestions = await suggestTitles(title);
    return NextResponse.json(
      { error: "이미 사용 중인 이름입니다.", suggestions },
      { status: 409 }
    );
  }

  const ext = mimeType.split("/")[1].replace("quicktime", "mov");
  const mediaId = randomUUID();
  const key = `original/${mediaId}.${ext}`;
  const uploadUrl = await presignPut(key, mimeType, maxBytes);

  // For videos, issue a pre-signed PUT for the client-extracted frame. It lands
  // on a staging key: /upload/complete re-encodes it to thumb/<id>.webp and
  // deletes this object, so every thumb/ object in the bucket is WebP.
  let thumbKey: string | undefined;
  let thumbUploadUrl: string | undefined;
  if (!isPhoto) {
    thumbKey = `thumb-src/${mediaId}.jpg`;
    thumbUploadUrl = await presignPut(thumbKey, "image/jpeg", 5 * 1024 * 1024);
  }

  return NextResponse.json({ mediaId, key, uploadUrl, thumbKey, thumbUploadUrl });
}
