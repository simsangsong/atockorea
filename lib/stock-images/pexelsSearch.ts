/**
 * Pexels Photo API — landscape search → image URL list (server / scripts).
 *
 * Auth: `Authorization: <PEXELS_API_KEY>` (no `Bearer` prefix)
 * Env: PEXELS_API_KEY
 *
 * https://www.pexels.com/api/documentation/
 */

export class PexelsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bodySnippet?: string
  ) {
    super(message);
    this.name = "PexelsApiError";
  }
}

type PexelsSearchJson = {
  photos?: ReadonlyArray<{
    id?: number;
    width?: number;
    height?: number;
    src?: {
      original?: string;
      large2x?: string;
      large?: string;
      medium?: string;
      portrait?: string;
      landscape?: string;
      tiny?: string;
    };
    photographer?: string;
    photographer_url?: string;
    url?: string;
  }>;
  total_results?: number;
};

/** Pexels landscape search → high-res URLs (default `src.large2x` ≈ 1880px wide, falls back). */
export async function searchPexelsPhotoUrls(options: {
  query: string;
  perPage?: number;
  maxUrls?: number;
  apiKey?: string;
  orientation?: "landscape" | "portrait" | "square";
  fetchImpl?: typeof fetch;
}): Promise<{ urls: string[]; rawTotal?: number }> {
  const key = options.apiKey?.trim() || process.env.PEXELS_API_KEY?.trim();
  if (!key) {
    throw new PexelsApiError(
      "Missing Pexels API key — set PEXELS_API_KEY in .env.local"
    );
  }

  const perPage = Math.min(Math.max(options.perPage ?? 15, 1), 80);
  const maxUrls = Math.min(Math.max(options.maxUrls ?? 10, 1), perPage);

  const u = new URL("https://api.pexels.com/v1/search");
  u.searchParams.set("query", options.query.trim());
  u.searchParams.set("per_page", String(perPage));
  u.searchParams.set("page", "1");
  u.searchParams.set("orientation", options.orientation ?? "landscape");

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(u.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: key,
      "User-Agent": "atockorea-pexels-pipeline/1.0",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: PexelsSearchJson | null = null;
  try {
    parsed = JSON.parse(text) as PexelsSearchJson;
  } catch {
    throw new PexelsApiError(
      `Pexels invalid JSON (${res.status})`,
      res.status,
      text.slice(0, 280)
    );
  }
  if (!res.ok) {
    throw new PexelsApiError(
      `Pexels HTTP ${res.status}`,
      res.status,
      text.slice(0, 400)
    );
  }

  const photos = parsed.photos ?? [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const p of photos) {
    const candidate = p.src?.large2x ?? p.src?.large ?? p.src?.original ?? p.src?.medium;
    if (typeof candidate !== "string" || !candidate.startsWith("https://")) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    urls.push(candidate);
    if (urls.length >= maxUrls) break;
  }
  return {
    urls,
    rawTotal: typeof parsed.total_results === "number" ? parsed.total_results : undefined,
  };
}
