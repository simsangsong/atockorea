/**
 * Server-side validation for review `images` JSON (URLs only).
 */

const MAX_REVIEW_IMAGES = 5;

function isAllowedHttpsOrLocalhostUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type ReviewImagesValidation =
  | { ok: true; images: string[] }
  | { ok: false; error: string; status: number };

/**
 * `images` must be an array (or omitted / null → empty).
 * Each entry: non-empty string, allowed URL, max {@link MAX_REVIEW_IMAGES} items.
 */
export function validateReviewImagesPayload(imagesUnknown: unknown): ReviewImagesValidation {
  if (imagesUnknown === undefined || imagesUnknown === null) {
    return { ok: true, images: [] };
  }

  if (!Array.isArray(imagesUnknown)) {
    return { ok: false, error: 'images must be an array', status: 400 };
  }

  if (imagesUnknown.length > MAX_REVIEW_IMAGES) {
    return {
      ok: false,
      error: `At most ${MAX_REVIEW_IMAGES} images allowed`,
      status: 400,
    };
  }

  const out: string[] = [];
  for (const item of imagesUnknown) {
    if (typeof item !== 'string') {
      return { ok: false, error: 'Each image must be a string URL', status: 400 };
    }
    const s = item.trim();
    if (s.length === 0) {
      return { ok: false, error: 'Image URLs must not be empty', status: 400 };
    }
    if (!isAllowedHttpsOrLocalhostUrl(s)) {
      return {
        ok: false,
        error: 'Image URLs must use https:// (or http://localhost for development)',
        status: 400,
      };
    }
    out.push(s);
  }

  return { ok: true, images: out };
}
