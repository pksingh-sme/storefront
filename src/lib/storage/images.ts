import "server-only";
import sharp from "sharp";
import { sniffImageType } from "@/lib/validation/upload";
import type { StorageDriver } from "./types";

/** Responsive rendition widths. The smallest doubles as the thumbnail. */
export const RENDITION_WIDTHS = [320, 640, 960, 1280, 1600] as const;
const MAX_INPUT_PIXELS = 40_000_000;

export class ImageValidationError extends Error {}

export type ProcessedImage = { widths: number[]; width: number; height: number };

export function renditionKey(storageKey: string, width: number) {
  return `${storageKey}/w${width}.webp`;
}

/**
 * Validates an uploaded image by content (not by name or declared type), strips
 * metadata, applies EXIF orientation and stores WebP renditions at several widths.
 */
export async function processAndStoreImage(
  driver: StorageDriver,
  input: Buffer,
  storageKey: string,
): Promise<ProcessedImage> {
  if (!sniffImageType(input)) throw new ImageValidationError("The file is not a supported image.");

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageValidationError("The image could not be read. It may be corrupted.");
  }
  if (!meta.width || !meta.height) throw new ImageValidationError("The image has no dimensions.");
  if (!["jpeg", "png", "webp", "heif", "avif"].includes(meta.format ?? "")) {
    throw new ImageValidationError("Unsupported image format.");
  }

  const oriented = meta.orientation && meta.orientation >= 5;
  const sourceWidth = oriented ? meta.height : meta.width;
  const sourceHeight = oriented ? meta.width : meta.height;

  const widths = RENDITION_WIDTHS.filter((w) => w <= sourceWidth) as number[];
  if (widths.length === 0) widths.push(sourceWidth);

  for (const width of widths) {
    const output = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    await driver.putObject(renditionKey(storageKey, width), output, "image/webp");
  }

  return { widths, width: sourceWidth, height: sourceHeight };
}

export type ImageUrls = { src: string; srcSet: string; thumbSrc: string };

export function imageUrls(driver: StorageDriver, storageKey: string, widths: number[]): ImageUrls | null {
  if (widths.length === 0) return null;
  const sorted = [...widths].sort((a, b) => a - b);
  const largest = sorted[sorted.length - 1];
  const mid = sorted.find((w) => w >= 960) ?? largest;
  return {
    src: driver.publicUrl(renditionKey(storageKey, mid)),
    srcSet: sorted.map((w) => `${driver.publicUrl(renditionKey(storageKey, w))} ${w}w`).join(", "),
    thumbSrc: driver.publicUrl(renditionKey(storageKey, sorted[0])),
  };
}

export function renditionKeys(storageKey: string, widths: number[]) {
  return widths.map((w) => renditionKey(storageKey, w));
}
