/**
 * Pixabay Photo API — landscape photo search → URL list (server / scripts).
 *
 * Auth: `key=<API_KEY>` query param
 * Env: PIXABAY_API_KEY
 *
 * Returns up to ~1280px-wide images (`largeImageURL`). Pixabay's truly-original
 * `imageURL` is gated behind a separate API tier and not used here.
 *
 * https://pixabay.com/api/docs/
 */

export class PixabayApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bodySnippet?: string
  ) {
    super(message);
    this.name = "PixabayApiError";
  }
}

type PixabayHit = {
  id?: number;
  pageURL?: string;
  type?: string;
  tags?: string;
  previewURL?: string;
  webformatURL?: string;
  largeImageURL?: string;
  imageWidth?: number;
  imageHeight?: number;
  user?: string;
};

type PixabaySearchJson = {
  total?: number;
  totalHits?: number;
  hits?: ReadonlyArray<PixabayHit>;
};

/** Pixabay landscape photo search → high-res URLs (default `largeImageURL`, up to ~1280w). */
export async function searchPixabayPhotoUrls(options: {
  query: string;
  perPage?: number;
  maxUrls?: number;
  apiKey?: string;
  /** Pixabay accepts: "horizontal" | "vertical" | "all". Default: "horizontal". */
  orientation?: "horizontal" | "vertical" | "all";
  /** Default: "photo" — exclude vector / illustration / 3D. */
  imageType?: "all" | "photo" | "illustration" | "vector";
  /** Default: 800px width (>= 800 keeps usable hero candidates). */
  minWidth?: number;
  /** Pixabay language hint, e.g. "en" / "ko". Default: "en". */
  lang?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ urls: string[]; rawTotal?: number }> {
  const key = options.apiKey?.trim() || process.env.PIXABAY_API_KEY?.trim();
  if (!key) {
    throw new PixabayApiError(
      "Missing Pixabay API key — set PIXABAY_API_KEY in .env.local"
    );
  }

  const perPage = Math.min(Math.max(options.perPage ?? 20, 3), 200); // Pixabay min 3, max 200
  const maxUrls = Math.min(Math.max(options.maxUrls ?? 10, 1), perPage);

  const u = new URL("https://pixabay.com/api/");
  u.searchParams.set("key", key);
  u.searchParams.set("q", options.query.trim().slice(0, 100));
  u.searchParams.set("per_page", String(perPage));
  u.searchParams.set("page", "1");
  u.searchParams.set("image_type", options.imageType ?? "photo");
  u.searchParams.set("orientation", options.orientation ?? "horizontal");
  u.searchParams.set("safesearch", "true");
  u.searchParams.set("min_width", String(options.minWidth ?? 800));
  u.searchParams.set("lang", options.lang ?? "en");

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(u.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "atockorea-pixabay-pipeline/1.0",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: PixabaySearchJson | null = null;
  try {
    parsed = JSON.parse(text) as PixabaySearchJson;
  } catch {
    throw new PixabayApiError(
      `Pixabay invalid JSON (${res.status})`,
      res.status,
      text.slice(0, 280)
    );
  }
  if (!res.ok) {
    throw new PixabayApiError(
      `Pixabay HTTP ${res.status}`,
      res.status,
      text.slice(0, 400)
    );
  }

  const hits = parsed.hits ?? [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const candidate = h.largeImageURL ?? h.webformatURL;
    if (typeof candidate !== "string" || !candidate.startsWith("https://")) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    urls.push(candidate);
    if (urls.length >= maxUrls) break;
  }
  return {
    urls,
    rawTotal: typeof parsed.totalHits === "number" ? parsed.totalHits : parsed.total,
  };
}
