import { z } from 'zod';

/** Valid HTTP(S) URL for gallery assets (Tour API CDN). */
function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function stringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normalizeThumbUrl(v: unknown): string | null {
  const s = stringOrNull(v);
  if (!s || !isHttpUrl(s)) return null;
  return s;
}

/**
 * One photo from `jeju_kor_tourapi_places.photo_gallery_detail_json` or from a saved itinerary `stop.photoGallery[]`.
 * All nullable metadata fields are normalized to `null` when absent or empty.
 */
export const itineraryPhotoGalleryItemSchema = z.object({
  imageUrl: z
    .string()
    .min(1)
    .refine((s) => isHttpUrl(s), { message: 'imageUrl must be http(s)' }),
  thumbUrl: z.string().nullable(),
  galTitle: z.string().nullable(),
  galContentId: z.string().nullable(),
  photographyMonth: z.string().nullable(),
  photographyLocation: z.string().nullable(),
  galleryGroupTitle: z.string().nullable(),
});

export type ItineraryPhotoGalleryItem = z.infer<typeof itineraryPhotoGalleryItemSchema>;

type PoiGalleryRow = { photo_gallery_detail_json?: unknown };

function buildItemFromPhotoRecord(
  prec: Record<string, unknown>,
  galleryGroupTitle: string | null,
): ItineraryPhotoGalleryItem | null {
  const imageUrl = prec.imageUrl != null ? String(prec.imageUrl).trim() : '';
  if (!imageUrl || !isHttpUrl(imageUrl)) return null;
  const galContentIdRaw = prec.galContentId ?? prec.galcontentid;
  const galContentId = stringOrNull(galContentIdRaw);
  return {
    imageUrl,
    thumbUrl: normalizeThumbUrl(prec.thumbUrl),
    galTitle: stringOrNull(prec.galTitle),
    galContentId,
    photographyMonth: stringOrNull(prec.photographyMonth),
    photographyLocation: stringOrNull(prec.photographyLocation),
    galleryGroupTitle,
  };
}

/**
 * Flattens `photo_gallery_detail_json` (import script shape) into a deduped list.
 * Order: groups array order, then photos within each group; first occurrence of an `imageUrl` wins.
 */
export function extractItineraryPhotoGalleryItems(row: PoiGalleryRow): ItineraryPhotoGalleryItem[] {
  const raw = row.photo_gallery_detail_json;
  const out: ItineraryPhotoGalleryItem[] = [];
  const seen = new Set<string>();
  if (raw == null || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  const groups = obj.groups;
  if (!Array.isArray(groups)) return out;
  for (const g of groups) {
    if (g == null || typeof g !== 'object') continue;
    const grec = g as Record<string, unknown>;
    const galleryGroupTitle =
      typeof grec.galleryGroupTitle === 'string' ? grec.galleryGroupTitle.trim() : null;
    const photos = grec.photos;
    if (!Array.isArray(photos)) continue;
    for (const p of photos) {
      if (p == null || typeof p !== 'object') continue;
      const item = buildItemFromPhotoRecord(p as Record<string, unknown>, galleryGroupTitle);
      if (!item) continue;
      if (seen.has(item.imageUrl)) continue;
      seen.add(item.imageUrl);
      out.push(item);
    }
  }
  return out;
}

/**
 * Normalizes `stop.photoGallery` from persisted JSON (unknown shape) for parsing.
 * - `undefined` / missing → `[]`
 * - non-array → `[]`
 * - drops entries without a valid http(s) `imageUrl`
 * - dedupes by `imageUrl` (first wins, list order preserved)
 */
export function sanitizeItineraryPhotoGalleryFromUnknown(raw: unknown): ItineraryPhotoGalleryItem[] {
  if (raw == null || raw === undefined) return [];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ItineraryPhotoGalleryItem[] = [];
  for (const el of raw) {
    if (el == null || typeof el !== 'object') continue;
    const prec = el as Record<string, unknown>;
    const item = buildItemFromPhotoRecord(prec, stringOrNull(prec.galleryGroupTitle));
    if (!item) continue;
    if (seen.has(item.imageUrl)) continue;
    seen.add(item.imageUrl);
    out.push(item);
  }
  return out;
}

/**
 * Saved-itinerary `stop.photoGallery`: sanitize unknown → validate items → `z.array(...).default([])` for missing/absent fields.
 */
export const itineraryStopPhotoGallerySchema = z.preprocess(
  sanitizeItineraryPhotoGalleryFromUnknown,
  z.array(itineraryPhotoGalleryItemSchema).default([]),
);
