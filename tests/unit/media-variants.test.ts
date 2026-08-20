import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  buildImageVariants,
  buildVideoThumb,
  mediumKey,
  thumbKey,
  VARIANT_CONTENT_TYPE,
} from "@/lib/media/variants";

/** A real JPEG of the given size — no mocks, sharp encodes it for real. */
async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 120, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("variant keys", () => {
  it("stores both derived variants as .webp", () => {
    expect(thumbKey("abc-123")).toBe("thumb/abc-123.webp");
    expect(mediumKey("abc-123")).toBe("medium/abc-123.webp");
    expect(VARIANT_CONTENT_TYPE).toBe("image/webp");
  });
});

describe("buildImageVariants", () => {
  it("encodes both thumb and medium as webp", async () => {
    const { thumb, medium } = await buildImageVariants(await jpeg(2000, 1500));

    expect((await sharp(thumb).metadata()).format).toBe("webp");
    expect((await sharp(medium).metadata()).format).toBe("webp");
  });

  it("fits the thumb inside 200px and the medium inside 1280px", async () => {
    const { thumb, medium } = await buildImageVariants(await jpeg(2000, 1500));

    const t = await sharp(thumb).metadata();
    expect(Math.max(t.width!, t.height!)).toBeLessThanOrEqual(200);

    const m = await sharp(medium).metadata();
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(1280);
  });

  it("never enlarges an image smaller than the target box", async () => {
    const { medium } = await buildImageVariants(await jpeg(400, 300));

    const m = await sharp(medium).metadata();
    expect(m.width).toBe(400);
    expect(m.height).toBe(300);
  });

  it("reports the source dimensions of the original", async () => {
    const { width, height } = await buildImageVariants(await jpeg(2000, 1500));

    expect(width).toBe(2000);
    expect(height).toBe(1500);
  });

  it("applies EXIF orientation so phone photos are not stored sideways", async () => {
    // orientation 6 = rotate 90° CW on display → a 1000x500 file shows as 500x1000
    const rotated = await sharp({
      create: { width: 1000, height: 500, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const { medium, width, height } = await buildImageVariants(rotated);

    expect([width, height]).toEqual([500, 1000]);
    const m = await sharp(medium).metadata();
    expect(m.height).toBeGreaterThan(m.width!);
  });

  it("converts a webp original too, without failing", async () => {
    const source = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .webp()
      .toBuffer();

    const { thumb } = await buildImageVariants(source);
    expect((await sharp(thumb).metadata()).format).toBe("webp");
  });
});

describe("buildVideoThumb", () => {
  it("re-encodes the client-extracted frame as a webp thumb within 200px", async () => {
    const frame = await jpeg(1920, 1080);

    const thumb = await buildVideoThumb(frame);

    const t = await sharp(thumb).metadata();
    expect(t.format).toBe("webp");
    expect(Math.max(t.width!, t.height!)).toBeLessThanOrEqual(200);
  });
});
