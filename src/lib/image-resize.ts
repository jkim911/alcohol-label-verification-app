/**
 * Client-side image shrinking, so a 12-megapixel phone photo becomes a
 * ~1800px JPEG before it leaves the browser. Smaller uploads, fewer image
 * tokens, no server-side image library. Browser only (uses canvas).
 *
 * Used by both the single-review upload and batch upload.
 */

export const MAX_EDGE_PX = 1800;
export const JPEG_QUALITY = 0.85;
/** Files already at/below this size and within the cap are passed through untouched. */
const PASS_THROUGH_BYTES = 1_500_000;

export interface ResizeResult {
  file: File;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  /** False when the original was already small enough and was returned as-is. */
  resized: boolean;
}

/** Pure: the largest size that fits within `maxEdge` while keeping the aspect ratio. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE_PX): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Pure: whether a file can be sent as-is without touching the canvas. */
export function canPassThrough(file: { type: string; size: number }, width: number, height: number, maxEdge = MAX_EDGE_PX): boolean {
  const smallEnough = Math.max(width, height) <= maxEdge && file.size <= PASS_THROUGH_BYTES;
  const serverAccepts = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  return smallEnough && serverAccepts;
}

function jpegName(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

/**
 * Decode the image (honouring EXIF orientation so phone photos aren't
 * sideways), scale it to fit the cap, and re-encode as JPEG.
 * If the browser can't decode the file (e.g. HEIC on some platforms), the
 * original is returned unchanged so the server can explain the problem.
 */
export async function resizeImageForUpload(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<ResizeResult> {
  const maxEdge = options.maxEdge ?? MAX_EDGE_PX;
  const quality = options.quality ?? JPEG_QUALITY;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return {
      file,
      width: 0,
      height: 0,
      originalWidth: 0,
      originalHeight: 0,
      originalBytes: file.size,
      resized: false,
    };
  }

  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;

  if (canPassThrough(file, originalWidth, originalHeight, maxEdge)) {
    bitmap.close();
    return { file, width: originalWidth, height: originalHeight, originalWidth, originalHeight, originalBytes: file.size, resized: false };
  }

  const { width, height } = fitWithin(originalWidth, originalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { file, width: originalWidth, height: originalHeight, originalWidth, originalHeight, originalBytes: file.size, resized: false };
  }
  // White backing: transparent PNG regions would otherwise turn black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) {
    return { file, width: originalWidth, height: originalHeight, originalWidth, originalHeight, originalBytes: file.size, resized: false };
  }
  const out = new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  return { file: out, width, height, originalWidth, originalHeight, originalBytes: file.size, resized: true };
}

/** "4032×3024 → 1800×1350, 3.1 MB → 420 KB" for a caption. */
export function describeResize(r: ResizeResult): string | null {
  if (!r.resized) return null;
  return `Resized from ${r.originalWidth}×${r.originalHeight} (${fmtBytes(r.originalBytes)}) to ${r.width}×${r.height} (${fmtBytes(r.file.size)})`;
}

function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} KB`;
  return `${n} B`;
}
