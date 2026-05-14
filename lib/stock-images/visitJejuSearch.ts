/**
 * Visit Jeju content search wrapper for the stock-images pipeline.
 *
 * Wraps `lib/visitjeju/contentSearch.ts` with:
 *   - Multi-keyword fallback (try variants until enough photos)
 *   - Dedupe by URL across attempts
 *   - Uniform return shape compatible with other stock sources
 *
 * The underlying API returns at most 1 representative photo per content; to
 * approach N photos for a single conceptual POI, callers pass keyword variants
 * (e.g. ["Seongsan Ilchulbong", "성산", "일출봉"]) and we collect the top match
 * from each — items are usually nearby attractions or themed sub-content that
 * still represent the area visually.
 *
 * Env: VISIT_JEJU_TOUR_API
 */

import { fetchVisitJejuSearchList, extractRepPhotoUrls } from "../visitjeju/contentSearch";

export type VisitJejuPhotoMeta = {
  url: string;
  /** thumbnail variant (smaller resolution, same content). */
  thumbnailUrl?: string;
  /** Source content title from VisitJeju. */
  contentTitle?: string;
  /** Source content ID — useful for caching / dedupe. */
  contentId?: string;
  /** Keyword variant that yielded this result. */
  matchedKeyword: string;
};

export async function searchVisitJejuPhotos(options: {
  /** Korean keywords ordered by specificity (most precise first). */
  keywords: readonly string[];
  /** Default 3 — caller-driven. */
  maxUrls?: number;
  /** Default `c1` (관광지). Use `c2` for restaurants, etc. */
  category?: string;
  /** Default "kr". The CDN photo is the same regardless, but title text differs by locale. */
  locale?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<VisitJejuPhotoMeta[]> {
  const maxUrls = Math.max(1, Math.min(20, options.maxUrls ?? 3));
  const category = options.category ?? "c1";
  const out: VisitJejuPhotoMeta[] = [];
  const seen = new Set<string>();

  for (const kw of options.keywords) {
    if (out.length >= maxUrls) break;
    const trimmed = kw.trim();
    if (trimmed.length < 1) continue;

    let body;
    try {
      body = await fetchVisitJejuSearchList(
        {
          locale: options.locale ?? "kr",
          category,
          page: 1,
          apiKey: options.apiKey,
          extraQuery: { title: trimmed },
        },
        options.fetchImpl ?? fetch
      );
    } catch {
      continue;
    }

    const items = Array.isArray(body.items) ? body.items : [];
    for (const it of items) {
      if (out.length >= maxUrls) break;
      const urls = extractRepPhotoUrls(it);
      const main = urls[0];
      if (!main || seen.has(main)) continue;
      seen.add(main);
      const photoid = it.repPhoto?.photoid;
      const thumb = (typeof photoid === "object" && photoid != null
        ? (photoid as { thumbnailpath?: string }).thumbnailpath
        : undefined) ?? undefined;
      out.push({
        url: main,
        thumbnailUrl: thumb && thumb !== main ? thumb : undefined,
        contentTitle: typeof it.title === "string" ? it.title : undefined,
        contentId: typeof it.contentsid === "string" ? it.contentsid : undefined,
        matchedKeyword: trimmed,
      });
    }
  }

  return out.slice(0, maxUrls);
}
