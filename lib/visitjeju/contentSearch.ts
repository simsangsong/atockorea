/**
 * Visit Jeju (비짓제주) 관광정보 OPEN API — SearchList 호출 클라이언트.
 *
 * 공식 활용가이드(V1.0): GET `/vsjApi/contents/searchlist` + 필수 `apiKey`, `locale`, `page`(선택).
 * 환경 변수: VISIT_JEJU_TOUR_API (API 키), 선택 VISIT_JEJU_API_BASE (기본 https://api.visitjeju.net)
 *
 * @see https://www.visitjeju.net/kr/visitJejuApi (활용가이드 PDF)
 */

export const VISIT_JEJU_SEARCHLIST_PATH = "/vsjApi/contents/searchList";

export type VisitJejuSearchParams = {
  locale?: string;
  page?: number;
  /** 예: CONT_000000000500349 */
  cid?: string;
  /** 예: 관광지 코드 c1 (활용가이드 REST 예시) */
  category?: string;
  /** 명시적으로 키를 넘길 때(스크립트 외 테스트용). 평소엔 VISIT_JEJU_TOUR_API 사용 */
  apiKey?: string;
  baseUrl?: string;
  /** 활용 문서 외 추가 쿼리(신규 스펙 대비). 값은 문자열로만 전달됩니다 */
  extraQuery?: Record<string, string>;
};

export type VisitJejuPhotoIds = {
  photoid?: number | string;
  imgpath?: string;
  thumbnailpath?: string;
};

export type VisitJejuContentItem = {
  contentsid?: string;
  title?: string;
  repPhoto?: {
    descseo?: string;
    photoid?: VisitJejuPhotoIds;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type VisitJejuSearchListResponse = {
  result?: string | number;
  resultMessage?: string;
  totalCount?: number;
  resultCount?: number;
  pageSize?: number;
  pageCount?: number;
  currentPage?: number;
  items?: VisitJejuContentItem[];
};

export class VisitJejuApiError extends Error {
  constructor(
    message: string,
    public readonly payload?: VisitJejuSearchListResponse | null
  ) {
    super(message);
    this.name = "VisitJejuApiError";
  }
}

/** 문서 및 실제 값 기준 성공 결과 코드는 "200"(문자열) */
export function visitJejuResultIsOk(result: string | number | undefined): boolean {
  if (result === undefined) return false;
  const s = String(result);
  return s === "200" || s === "00";
}

/** 대표 등록 이미지: imgpath 우선, 없으면 thumbnail */
export function extractRepPhotoUrls(item: VisitJejuContentItem | null | undefined): string[] {
  if (!item?.repPhoto) return [];
  const p = item.repPhoto.photoid;
  if (!p || typeof p !== "object") return [];
  const urls = [p.imgpath, p.thumbnailpath].filter(
    (u): u is string => typeof u === "string" && u.startsWith("http")
  );
  return [...new Set(urls)];
}

/**
 * 항목 JSON 트리에서 `imgpath` / `thumbnailpath` 문자열 URL을 모두 수집합니다.
 * 갤러리 필드가 문서 외 형태로 내려오는 경우를 대비해 스크립트·데이터 보강용으로 사용합니다.
 */
export function collectAllImageUrlsDeep(item: unknown, maxUrls = 32): string[] {
  const out = new Set<string>();
  const walk = (node: unknown) => {
    if (out.size >= maxUrls) return;
    if (node == null) return;
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const lk = k.toLowerCase();
      if ((lk === "imgpath" || lk === "thumbnailpath") && typeof v === "string" && v.startsWith("http")) {
        out.add(v);
      } else {
        walk(v);
      }
    }
  };
  walk(item);
  return [...out];
}

function normalizeBase(raw: string | undefined): string {
  const s = (raw || "https://api.visitjeju.net").trim().replace(/\/+$/, "");
  return s.startsWith("http") ? s : `https://${s}`;
}

/**
 * 비짓제주 SearchList 1회 호출. 브라우저에 노출하지 말고 서버 전용 또는 로컬 스크립트에서만 사용할 것.
 */
export async function fetchVisitJejuSearchList(
  params: VisitJejuSearchParams = {},
  fetchImpl: typeof fetch = fetch
): Promise<VisitJejuSearchListResponse> {
  const apiKey =
    params.apiKey ||
    process.env.VISIT_JEJU_TOUR_API ||
    process.env.VISIT_JEJU_OPEN_API_KEY;
  if (!apiKey?.trim()) {
    throw new VisitJejuApiError(
      "Missing API key — set VISIT_JEJU_TOUR_API or pass apiKey."
    );
  }

  const baseUrl = normalizeBase(params.baseUrl || process.env.VISIT_JEJU_API_BASE);
  const locale = (params.locale || process.env.VISIT_JEJU_LOCALE || "kr").trim();
  const page = params.page ?? 1;

  const q = new URLSearchParams({
    apiKey: apiKey.trim(),
    locale,
    page: String(page),
  });
  if (params.cid?.trim()) q.set("cid", params.cid.trim());
  if (params.category?.trim()) q.set("category", params.category.trim());
  if (params.extraQuery) {
    for (const [k, v] of Object.entries(params.extraQuery)) {
      if (!k || v == null) continue;
      q.set(k, String(v));
    }
  }

  const url = `${baseUrl}${VISIT_JEJU_SEARCHLIST_PATH}?${q.toString()}`;

  const res = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "atockorea-visitjeju-pipeline/1.0 (+https://www.atockorea.com)",
    },
    cache: "no-store",
  });

  let body: VisitJejuSearchListResponse | null = null;
  const text = await res.text();
  try {
    body = JSON.parse(text) as VisitJejuSearchListResponse;
  } catch {
    throw new VisitJejuApiError(
      `Invalid JSON (${res.status}). First 240 chars: ${text.slice(0, 240)}`,
      null
    );
  }

  if (!res.ok && !visitJejuResultIsOk(body?.result)) {
    throw new VisitJejuApiError(`HTTP ${res.status}: ${text.slice(0, 500)}`, body);
  }

  if (!visitJejuResultIsOk(body?.result)) {
    throw new VisitJejuApiError(
      body.resultMessage ||
        String(body.result) ||
        "Visit Jeju SearchList reported an error.",
      body
    );
  }

  return body;
}
