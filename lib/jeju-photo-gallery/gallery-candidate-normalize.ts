/**
 * Map raw PhotoGalleryService1 JSON rows → `JejuGalleryCandidate` with strict http(s) URLs.
 */

import { keyMapLoose } from '@/lib/jeju-photo-gallery/tour-api/parser';
import type { JejuGalleryCandidate } from '@/lib/jeju-photo-gallery/gallery-candidate-types';

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

export function pickGalleryListTitle(item: Record<string, unknown>): string | null {
  const lo = keyMapLoose(item);
  const keys = ['title', 'galtitle', 'gal_title', 'galtitl'];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function pickGalContentId(item: Record<string, unknown>): string | null {
  const lo = keyMapLoose(item);
  const keys = ['galcontentid', 'gal_content_id', 'contentid'];
  for (const k of keys) {
    const v = lo[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

export function pickHttpImage(raw: Record<string, unknown>): string | null {
  const lo = keyMapLoose(raw);
  const keys = [
    'originimgurl',
    'originimgurl2',
    'imgpath',
    'imageurl',
    'imagepath',
    'smallimageurl',
    'imgurl',
    'galwebviewimage',
  ];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && isHttpUrl(v.trim())) return v.trim();
  }
  for (const v of Object.values(lo)) {
    if (typeof v === 'string' && /^https?:\/\/.+\.(jpe?g|png|webp)(\?|$)/i.test(v)) {
      return v.trim();
    }
  }
  return null;
}

function pickThumb(raw: Record<string, unknown>): string | null {
  const lo = keyMapLoose(raw);
  const keys = ['smallimageurl', 'thumbpath', 'thumburl'];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && isHttpUrl(v.trim())) return v.trim();
  }
  return null;
}

function pickMonthLoc(raw: Record<string, unknown>): { month: string | null; loc: string | null } {
  const lo = keyMapLoose(raw);
  const monthKeys = ['galphotographymonth', 'photographymonth', 'month'];
  const locKeys = ['galphotographylocation', 'photographylocation', 'location', 'shootingplace'];
  let month: string | null = null;
  let loc: string | null = null;
  for (const k of monthKeys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) {
      month = v.trim();
      break;
    }
  }
  for (const k of locKeys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) {
      loc = v.trim();
      break;
    }
  }
  return { month, loc };
}

function pickModifiedTime(raw: Record<string, unknown>): string | null {
  const lo = keyMapLoose(raw);
  const keys = ['modifiedtime', 'modtime', 'createdtime'];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickGalSearchKeyword(raw: Record<string, unknown>): string | null {
  const lo = keyMapLoose(raw);
  const keys = ['galsearchkeyword', 'searchkeyword', 'keyword'];
  for (const k of keys) {
    const v = lo[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Normalize a detail/search item. Drops rows without a valid `imageUrl` (detail) —
 * search-only rows may lack images; callers can use `normalizeSearchListRow` for titles.
 */
export function normalizeGalleryDetailRowToCandidate(
  raw: Record<string, unknown>,
  ctx: {
    sourceTitleQueried: string | null;
    galleryGroupTitleHint?: string | null;
  },
): JejuGalleryCandidate | null {
  const imageUrl = pickHttpImage(raw);
  if (!imageUrl) return null;

  const lo = keyMapLoose(raw);
  const gListTitle = pickGalleryListTitle(raw);
  const gTitle =
    (typeof lo['galtitle'] === 'string' && lo['galtitle'].trim()) ||
    (typeof lo['title'] === 'string' && lo['title'].trim()) ||
    null;
  const { month, loc } = pickMonthLoc(raw);
  const galCid = pickGalContentId(raw);

  return {
    galleryTitle: gListTitle,
    galTitle: gTitle ? gTitle.trim() : null,
    galContentId: galCid,
    imageUrl,
    thumbUrl: pickThumb(raw),
    photographyMonth: month,
    photographyLocation: loc,
    galleryGroupTitle: ctx.galleryGroupTitleHint ?? gListTitle,
    galSearchKeyword: pickGalSearchKeyword(raw),
    modifiedTime: pickModifiedTime(raw),
    sourceApi: 'PhotoGalleryService1',
    sourceTitleQueried: ctx.sourceTitleQueried,
  };
}

/** Search list rows may not include image URLs — still useful for title / galContentId. */
export function normalizeSearchListRowMeta(
  raw: Record<string, unknown>,
  sourceTitleQueried: string | null,
): {
  galleryTitle: string | null;
  galContentId: string | null;
  galSearchKeyword: string | null;
} {
  return {
    galleryTitle: pickGalleryListTitle(raw),
    galContentId: pickGalContentId(raw),
    galSearchKeyword: pickGalSearchKeyword(raw),
  };
}
