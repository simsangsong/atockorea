/**
 * Flickr Photos Search — CC-licensed photo discovery (server / scripts).
 *
 * Auth: `api_key` query param (Client-ID equivalent — no OAuth needed for public search).
 * Env: FLICKR_API_KEY  (FLICKR_SECRET_KEY is only required for OAuth-signed write operations,
 *      which we don't use here.)
 *
 * Default license filter: `4,5,9,10` =
 *   4  Attribution (CC-BY)
 *   5  Attribution-ShareAlike (CC-BY-SA)
 *   9  Public Domain Dedication (CC0)
 *   10 Public Domain Mark
 * Excludes NoDerivs (cropping/resizing would create a derivative) and NonCommercial.
 *
 * Default sort `interestingness-desc` returns Flickr's curated "most interesting" results
 * first — better emotional/aesthetic curation than naive relevance.
 *
 * https://www.flickr.com/services/api/flickr.photos.search.html
 */

export class FlickrApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bodySnippet?: string
  ) {
    super(message);
    this.name = "FlickrApiError";
  }
}

export type FlickrPhotoMeta = {
  url: string;
  width?: number;
  height?: number;
  license: string;
  /** Author display name. May be missing for old uploads. */
  ownerName?: string;
  /** Flickr user ID (for the photo URL). */
  ownerNsid?: string;
  /** Flickr photo page (use as the source link in attribution). */
  photoPage: string;
  title?: string;
  views?: number;
};

type FlickrPhoto = {
  id?: string;
  owner?: string;
  ownername?: string;
  secret?: string;
  server?: string;
  title?: string;
  license?: string;
  views?: string;
  url_o?: string;
  height_o?: string | number;
  width_o?: string | number;
  url_h?: string;
  height_h?: string | number;
  width_h?: string | number;
  url_l?: string;
  height_l?: string | number;
  width_l?: string | number;
  url_c?: string;
  url_z?: string;
};

type FlickrSearchEnvelope = {
  stat?: string;
  message?: string;
  photos?: {
    page?: number;
    pages?: number;
    perpage?: number;
    total?: number | string;
    photo?: FlickrPhoto[];
  };
};

const DEFAULT_LICENSES = "4,5,9,10";

function pickBestUrl(p: FlickrPhoto): { url: string; width?: number; height?: number } | null {
  // Prefer larger sizes; cap at "url_l" (1024w) for typical use — full-original "url_o" can be 6000+
  // and is fine for hero shots. Order: l (1024) → h (1600) → o (original) → c → z.
  // Flicker `url_l` is most reliably ≥ 1024 wide.
  const candidates: Array<{ url?: string; w?: string | number; h?: string | number }> = [
    { url: p.url_l, w: p.width_l, h: p.height_l },
    { url: p.url_h, w: p.width_h, h: p.height_h },
    { url: p.url_o, w: p.width_o, h: p.height_o },
    { url: p.url_c },
    { url: p.url_z },
  ];
  for (const c of candidates) {
    if (typeof c.url === "string" && c.url.startsWith("http")) {
      return {
        url: c.url.startsWith("http://") ? `https://${c.url.slice("http://".length)}` : c.url,
        width: c.w == null ? undefined : Number(c.w),
        height: c.h == null ? undefined : Number(c.h),
      };
    }
  }
  return null;
}

/**
 * Search Flickr CC-licensed photos by free-text query.
 * Returns up to `maxUrls` results with attribution metadata.
 *
 * Geo + tag filtering (use to narrow off-topic noise):
 *   - `bbox`: "lon_min,lat_min,lon_max,lat_max" — only photos geotagged inside the box.
 *     Example for Jeju Island: "126.0,33.1,127.0,33.7".
 *   - `tags`: CSV of tag tokens (no spaces inside a tag — Flickr collapses them).
 *   - `tagMode`: "all" requires every tag; "any" matches any. Default "any".
 *   - `query` is optional when bbox/tags are given (Flickr accepts geo-only or tag-only search).
 */
export async function searchFlickrPhotos(options: {
  query?: string;
  apiKey?: string;
  perPage?: number;
  maxUrls?: number;
  /** CSV of Flickr license codes. Default: `4,5,9,10` (CC-BY, CC-BY-SA, CC0, PDM). */
  license?: string;
  /** Default `interestingness-desc`. */
  sort?: "interestingness-desc" | "relevance" | "date-posted-desc";
  /** "1" / "0". Default "1" — Flickr considers tags + title + description. */
  contentType?: string;
  /** Default 200 — drop low-engagement results. */
  minViews?: number;
  /** "lon_min,lat_min,lon_max,lat_max" — bounding box geo filter. */
  bbox?: string;
  /** CSV of tag tokens (e.g. "seongsanilchulbong,jeju"). */
  tags?: string;
  /** "all" requires all tags; "any" matches any. Default "any". */
  tagMode?: "all" | "any";
  fetchImpl?: typeof fetch;
}): Promise<FlickrPhotoMeta[]> {
  const key = options.apiKey?.trim() || process.env.FLICKR_API_KEY?.trim();
  if (!key) {
    throw new FlickrApiError(
      "Missing Flickr API key — set FLICKR_API_KEY in .env.local"
    );
  }

  const queryText = options.query?.trim() ?? "";
  const tagText = options.tags?.trim() ?? "";
  const bboxText = options.bbox?.trim() ?? "";
  if (!queryText && !tagText && !bboxText) {
    throw new FlickrApiError("Flickr search needs at least one of: query, tags, or bbox");
  }

  const perPage = Math.min(Math.max(options.perPage ?? 20, 1), 100);
  const maxUrls = Math.min(Math.max(options.maxUrls ?? 10, 1), perPage);
  const minViews = Math.max(0, options.minViews ?? 200);

  const u = new URL("https://api.flickr.com/services/rest/");
  u.searchParams.set("method", "flickr.photos.search");
  u.searchParams.set("api_key", key);
  if (queryText) u.searchParams.set("text", queryText);
  if (tagText) {
    u.searchParams.set("tags", tagText);
    u.searchParams.set("tag_mode", options.tagMode ?? "any");
  }
  if (bboxText) u.searchParams.set("bbox", bboxText);
  u.searchParams.set("license", options.license ?? DEFAULT_LICENSES);
  u.searchParams.set("sort", options.sort ?? "interestingness-desc");
  u.searchParams.set("content_type", "1"); // photos only
  u.searchParams.set("media", "photos");
  u.searchParams.set("safe_search", "1");
  u.searchParams.set("per_page", String(perPage));
  u.searchParams.set("page", "1");
  u.searchParams.set("format", "json");
  u.searchParams.set("nojsoncallback", "1");
  u.searchParams.set("extras", "url_l,url_h,url_o,url_c,url_z,owner_name,license,views,o_dims");

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(u.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "atockorea-flickr-pipeline/1.0",
    },
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: FlickrSearchEnvelope | null = null;
  try {
    parsed = JSON.parse(text) as FlickrSearchEnvelope;
  } catch {
    throw new FlickrApiError(
      `Flickr invalid JSON (${res.status})`,
      res.status,
      text.slice(0, 280)
    );
  }
  if (parsed.stat !== "ok") {
    throw new FlickrApiError(
      `Flickr API error: ${parsed.message ?? "unknown"}`,
      res.status,
      text.slice(0, 400)
    );
  }

  const photos = parsed.photos?.photo ?? [];
  const out: FlickrPhotoMeta[] = [];
  const seen = new Set<string>();
  for (const p of photos) {
    const views = Number(p.views ?? 0);
    if (views < minViews) continue;
    const best = pickBestUrl(p);
    if (!best) continue;
    if (seen.has(best.url)) continue;
    seen.add(best.url);
    out.push({
      url: best.url,
      width: best.width,
      height: best.height,
      license: String(p.license ?? ""),
      ownerName: p.ownername || undefined,
      ownerNsid: p.owner || undefined,
      photoPage:
        p.owner && p.id
          ? `https://www.flickr.com/photos/${p.owner}/${p.id}`
          : "https://www.flickr.com/",
      title: p.title || undefined,
      views: Number.isFinite(views) ? views : undefined,
    });
    if (out.length >= maxUrls) break;
  }
  return out;
}
