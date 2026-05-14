/**
 * Korea Tourism Organization (KTO) — TourAPI 4.0 image fetcher.
 *
 *   1. searchKeyword2  → contentId for a POI
 *   2. detailImage2    → array of official photos for that contentId
 *
 * Auth: serviceKey query param (decoding key). Env: TOUR_API_KEY
 *
 * Endpoints in this client default to EngService2; the API itself uses identical
 * paths under KorService2 / JpnService2 / ChsService2 / ChtService2.
 *
 * https://www.data.go.kr/data/15101578/openapi.do
 */

const BASE_URL = "https://apis.data.go.kr/B551011";

export type TourApiService =
  | "EngService2"
  | "KorService2"
  | "JpnService2"
  | "ChsService2"
  | "ChtService2";

export class TourApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bodySnippet?: string
  ) {
    super(message);
    this.name = "TourApiError";
  }
}

type SearchKeywordItem = {
  contentid?: string;
  contenttypeid?: string;
  title?: string;
  firstimage?: string;
  firstimage2?: string;
  addr1?: string;
};

type DetailImageItem = {
  originimgurl?: string;
  smallimageurl?: string;
  serialnum?: string;
  imgname?: string;
};

type ApiEnvelope<TItem> = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: TItem | TItem[] } | "";
      totalCount?: number;
      pageNo?: number;
      numOfRows?: number;
    };
  };
};

/** TourAPI returns `items.item` as object (single), array (multi), or `""` (none). */
function unwrapItems<T>(env: ApiEnvelope<T>): T[] {
  const items = env.response?.body?.items;
  if (!items || typeof items === "string") return [];
  const it = items.item;
  if (!it) return [];
  return Array.isArray(it) ? it : [it];
}

function buildBaseParams(serviceKey: string) {
  const p = new URLSearchParams();
  p.set("serviceKey", serviceKey);
  p.set("MobileOS", "ETC");
  p.set("MobileApp", "atockorea-image-pipeline/1.0");
  p.set("_type", "json");
  return p;
}

async function callApi<T>(
  service: TourApiService,
  path: string,
  extra: Record<string, string>,
  serviceKey: string,
  fetchImpl: typeof fetch
): Promise<ApiEnvelope<T>> {
  const u = new URL(`${BASE_URL}/${service}/${path}`);
  const base = buildBaseParams(serviceKey);
  base.forEach((v, k) => u.searchParams.set(k, v));
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);

  const res = await fetchImpl(u.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "atockorea-tourapi/1.0",
    },
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: ApiEnvelope<T> | null = null;
  try {
    parsed = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new TourApiError(
      `TourAPI invalid JSON (${res.status})`,
      res.status,
      text.slice(0, 280)
    );
  }
  if (!res.ok) {
    throw new TourApiError(
      `TourAPI HTTP ${res.status}`,
      res.status,
      text.slice(0, 400)
    );
  }
  const code = parsed.response?.header?.resultCode;
  if (code && code !== "0000" && code !== "00") {
    throw new TourApiError(
      `TourAPI ${code}: ${parsed.response?.header?.resultMsg ?? ""}`,
      res.status,
      text.slice(0, 400)
    );
  }
  return parsed;
}

/**
 * Step 1 — keyword search. Returns first matching contentId or null.
 * Tries items in order, prefers ones with a non-empty firstimage.
 */
export async function findContentIdByKeyword(options: {
  keyword: string;
  service?: TourApiService;
  serviceKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ contentId: string; title: string; preview?: string } | null> {
  const key = options.serviceKey?.trim() || process.env.TOUR_API_KEY?.trim();
  if (!key) {
    throw new TourApiError(
      "Missing TourAPI key — set TOUR_API_KEY in .env.local"
    );
  }
  const service = options.service ?? "EngService2";
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = await callApi<SearchKeywordItem>(
    service,
    "searchKeyword2",
    {
      keyword: options.keyword.trim(),
      numOfRows: "10",
      pageNo: "1",
    },
    key,
    fetchImpl
  );
  const items = unwrapItems(env);
  if (items.length === 0) return null;

  const withImage = items.find(
    (x) => typeof x.contentid === "string" && (x.firstimage || x.firstimage2)
  );
  const fallback = items.find((x) => typeof x.contentid === "string");
  const pick = withImage ?? fallback;
  if (!pick?.contentid) return null;
  return {
    contentId: pick.contentid,
    title: pick.title ?? "",
    preview: pick.firstimage || pick.firstimage2 || undefined,
  };
}

/** Filter to web-friendly raster images. TourAPI sometimes returns BMP. */
function isWebImageUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  if (!u.startsWith("https://") && !u.startsWith("http://")) return false;
  const lower = u.toLowerCase();
  return /\.(jpe?g|png|webp)(?:\?|$)/.test(lower);
}

function toHttps(u: string): string {
  return u.startsWith("http://") ? `https://${u.slice("http://".length)}` : u;
}

/**
 * Step 2 — fetch all images for a contentId, filtered to jpg/png/webp.
 * Returns up to maxUrls high-res `originimgurl`s.
 */
export async function fetchTourApiImagesByContentId(options: {
  contentId: string;
  service?: TourApiService;
  serviceKey?: string;
  maxUrls?: number;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const key = options.serviceKey?.trim() || process.env.TOUR_API_KEY?.trim();
  if (!key) {
    throw new TourApiError(
      "Missing TourAPI key — set TOUR_API_KEY in .env.local"
    );
  }
  const service = options.service ?? "EngService2";
  const maxUrls = Math.max(1, Math.min(50, options.maxUrls ?? 10));
  const fetchImpl = options.fetchImpl ?? fetch;

  const env = await callApi<DetailImageItem>(
    service,
    "detailImage2",
    {
      contentId: options.contentId,
      imageYN: "Y",
      numOfRows: String(Math.min(50, maxUrls + 5)),
      pageNo: "1",
    },
    key,
    fetchImpl
  );
  const items = unwrapItems(env);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of items) {
    const candidate = x.originimgurl || x.smallimageurl;
    if (!isWebImageUrl(candidate)) continue;
    const https = toHttps(candidate);
    if (seen.has(https)) continue;
    seen.add(https);
    out.push(https);
    if (out.length >= maxUrls) break;
  }
  return out;
}

/**
 * One-shot: keyword → contentId → image URLs.
 * Tries multiple keyword variants in order and returns first non-empty result.
 */
export async function searchTourApiImages(options: {
  keywords: readonly string[];
  service?: TourApiService;
  serviceKey?: string;
  maxUrls?: number;
  fetchImpl?: typeof fetch;
  /** ms between API calls within this function. Default 250. */
  delayMs?: number;
}): Promise<{ urls: string[]; usedKeyword?: string; contentId?: string; title?: string }> {
  const delayMs = options.delayMs ?? 250;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  for (const kw of options.keywords) {
    const trimmed = kw.trim();
    if (trimmed.length < 2) continue;
    let hit: Awaited<ReturnType<typeof findContentIdByKeyword>>;
    try {
      hit = await findContentIdByKeyword({
        keyword: trimmed,
        service: options.service,
        serviceKey: options.serviceKey,
        fetchImpl: options.fetchImpl,
      });
    } catch {
      hit = null;
    }
    if (!hit) {
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }
    if (delayMs > 0) await sleep(delayMs);
    let urls: string[] = [];
    try {
      urls = await fetchTourApiImagesByContentId({
        contentId: hit.contentId,
        service: options.service,
        serviceKey: options.serviceKey,
        maxUrls: options.maxUrls,
        fetchImpl: options.fetchImpl,
      });
    } catch {
      urls = [];
    }
    if (urls.length > 0) {
      return { urls, usedKeyword: trimmed, contentId: hit.contentId, title: hit.title };
    }
  }
  return { urls: [] };
}
