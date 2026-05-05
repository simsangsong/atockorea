/**
 * Unsplash Photo API — 검색 결과에서 이미지 URL만 추출 (서버·로컬 스크립트 전용).
 *
 * 인증: `Authorization: Client-ID <ACCESS_KEY>` (공개 검색에는 Secret 불필요)
 * 환경: UNSPLASH_ACCESS_KEY
 *
 * https://unsplash.com/documentation#search-photos
 */

export class UnsplashApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bodySnippet?: string
  ) {
    super(message);
    this.name = "UnsplashApiError";
  }
}

type UnsplashSearchJson = {
  results?: ReadonlyArray<{
    urls?: {
      raw?: string;
      full?: string;
      regular?: string;
      small?: string;
    };
    links?: { html?: string };
    user?: { name?: string; links?: { html?: string } };
  }>;
  total?: number;
};

/** landscape 기준 검색 후 `regular`(보통 약 1080px 폭) URL 최대 maxUrls개 */
export async function searchUnsplashPhotoUrls(options: {
  query: string;
  /** 기본 10 */
  perPage?: number;
  maxUrls?: number;
  accessKey?: string;
  /** 기본 landscape */
  orientation?: "landscape" | "portrait" | "squarish";
  fetchImpl?: typeof fetch;
}): Promise<{ urls: string[]; rawTotal?: number }> {
  const key =
    options.accessKey?.trim() ||
    process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) {
    throw new UnsplashApiError(
      "Missing Unsplash Access Key — set UNSPLASH_ACCESS_KEY in .env.local (Search uses Client-ID auth; UNSPLASH_SECRET_KEY is only for OAuth flows)."
    );
  }

  const perPage = Math.min(Math.max(options.perPage ?? 10, 1), 30);
  const maxUrls = Math.min(Math.max(options.maxUrls ?? 10, 1), perPage);

  const u = new URL("https://api.unsplash.com/search/photos");
  u.searchParams.set("query", options.query.trim());
  u.searchParams.set("per_page", String(perPage));
  u.searchParams.set("page", "1");
  if (options.orientation) u.searchParams.set("orientation", options.orientation);

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(u.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Client-ID ${key}`,
      "Accept-Version": "v1",
      "User-Agent": "atockorea-unsplash-pipeline/1.0 (+https://www.atockorea.com)",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: UnsplashSearchJson | null = null;
  try {
    parsed = JSON.parse(text) as UnsplashSearchJson;
  } catch {
    throw new UnsplashApiError(
      `Unsplash invalid JSON (${res.status})`,
      res.status,
      text.slice(0, 280)
    );
  }

  if (!res.ok) {
    throw new UnsplashApiError(
      parsed && typeof parsed === "object" && "errors" in parsed
        ? `Unsplash error: ${JSON.stringify((parsed as { errors?: unknown }).errors)}`
        : `Unsplash HTTP ${res.status}`,
      res.status,
      text.slice(0, 400)
    );
  }

  const results = parsed?.results ?? [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    const uu = r.urls?.regular ?? r.urls?.small ?? r.urls?.full ?? r.urls?.raw;
    if (typeof uu === "string" && uu.startsWith("https://") && !seen.has(uu)) {
      seen.add(uu);
      urls.push(uu);
      if (urls.length >= maxUrls) break;
    }
  }

  return { urls, rawTotal: typeof parsed?.total === "number" ? parsed.total : undefined };
}
