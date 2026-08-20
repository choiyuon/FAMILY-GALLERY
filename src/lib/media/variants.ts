import sharp from "sharp";

// Derived display variants are always WebP: ~30% smaller than the equivalent
// JPEG at matching quality, which matters against the ~1 GB Vercel Blob free
// tier (AGENTS.md §6). The `original/` object is never touched (spec §3.1).
export const THUMB_MAX_PX = 200;
export const MEDIUM_MAX_PX = 1280;
export const VARIANT_CONTENT_TYPE = "image/webp";

export function thumbKey(mediaId: string): string {
  return `thumb/${mediaId}.webp`;
}

export function mediumKey(mediaId: string): string {
  return `medium/${mediaId}.webp`;
}

export interface ImageVariants {
  thumb: Buffer;
  medium: Buffer;
  /** Display dimensions of the source, after EXIF orientation is applied. */
  width: number;
  height: number;
}

/** Re-encode one source image into the thumb + medium WebP variants. */
export async function buildImageVariants(input: Buffer): Promise<ImageVariants> {
  const meta = await sharp(input).metadata();
  // EXIF orientation 5-8 means the stored pixels are rotated 90°, so the
  // displayed width/height are swapped relative to the raw buffer.
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = (swapped ? meta.height : meta.width) ?? 0;
  const height = (swapped ? meta.width : meta.height) ?? 0;

  const encode = (maxPx: number, quality: number) =>
    sharp(input)
      .rotate() // bake in EXIF orientation; WebP output drops the EXIF tag
      .resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

  const [thumb, medium] = await Promise.all([
    encode(THUMB_MAX_PX, 72),
    encode(MEDIUM_MAX_PX, 82),
  ]);

  return { thumb, medium, width, height };
}

/**
 * Re-encode a client-extracted video frame into the thumb WebP variant.
 * Videos cannot be decoded server-side (no ffmpeg on Vercel — AGENTS.md §6),
 * so the browser hands us a raster frame and the conversion happens here.
 */
export async function buildVideoThumb(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}
