/**
 * Shrink a photo before it is uploaded for a vision answer.
 *
 * 🔴 Why this exists: "Ask about a photo" has never once succeeded in
 * production. `ops_ai_usage` holds 1,898 rows since 2026-07-25 and **zero** with
 * `purpose='vision'`; there is not a single `vision_answer` message in the
 * database. The AI router meters both success and total failure, so zero rows
 * means the router was never reached — the request was dying before the
 * function ran.
 *
 * The size arithmetic explains that. A current phone camera writes 3-12MB per
 * shot. The route accepted up to 8MB, then base64-encoded it for the provider,
 * which inflates by 4/3. A serverless request body limit sits well below that,
 * so the platform rejected the upload before any of our code executed — which
 * is also why the server logs hold nothing.
 *
 * A vision model does not want a 12-megapixel image anyway; it downsamples to a
 * fixed tile grid on arrival. Sending the original was paying upload time and a
 * failed request for detail that was discarded on receipt.
 *
 * So the photo is resized on the phone first. This runs in the browser (canvas),
 * and the decisions it makes — the target edge and the quality ladder — are pure
 * and tested separately.
 */

/**
 * Longest edge after resizing. Vision models tile images to roughly this scale;
 * beyond it, extra pixels cost upload time and buy nothing.
 */
export const VISION_MAX_EDGE = 1568;

/**
 * Byte budget for the encoded result. Base64 inflates by 4/3 on the wire, so
 * this leaves a wide margin under any serverless body limit even with the
 * multipart overhead and the other form fields.
 */
export const VISION_TARGET_BYTES = 1_200_000;

/** Tried in order until one lands under budget. Below this, stop — legibility. */
const QUALITY_LADDER = [0.82, 0.7, 0.6, 0.5];

export interface ScaleDecision {
  width: number;
  height: number;
  /** True when the source was already small enough to leave alone. */
  unchanged: boolean;
}

/**
 * The resize maths, separated from the canvas so it can be tested.
 * Aspect ratio is preserved and dimensions never round to zero.
 */
export function scaleToFit(
  width: number,
  height: number,
  maxEdge: number = VISION_MAX_EDGE,
): ScaleDecision {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0, unchanged: true };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height), unchanged: true };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    unchanged: false,
  };
}

/** A file already small enough to send as-is. */
export function alreadySmallEnough(file: { size: number; type: string }): boolean {
  // HEIC is excluded on purpose even when small: providers reject it, and it is
  // what an iPhone produces by default. Re-encoding through canvas turns it into
  // a JPEG, which is the actual reason to run this on those files.
  if (/heic|heif/i.test(file.type)) return false;
  return file.size <= VISION_TARGET_BYTES;
}

/**
 * Downscale a photo to something a vision model can accept.
 *
 * Returns the ORIGINAL file if anything goes wrong — a resize failure must not
 * become a second way for the feature to be unavailable. The server still has
 * its own limit; this only makes hitting it unlikely.
 */
export async function downscaleForVision(file: File): Promise<File> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file;
  if (alreadySmallEnough(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaleToFit(bitmap.width, bitmap.height);
    if (width === 0 || height === 0) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    for (const quality of QUALITY_LADDER) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      );
      if (!blob) break;
      if (blob.size <= VISION_TARGET_BYTES || quality === QUALITY_LADDER[QUALITY_LADDER.length - 1]) {
        return new File([blob], renameToJpeg(file.name), { type: 'image/jpeg' });
      }
    }
    return file;
  } catch {
    // Canvas is tainted, the codec is unsupported, memory ran out — any of these
    // and we send the original rather than blocking the guest.
    return file;
  }
}

function renameToJpeg(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}
