/**
 * KorService2 HTTP client: endpoint-specific param builders, JSON-first, retry/backoff.
 * Base: https://apis.data.go.kr/B551011/KorService2
 */

import { extractXmlStyleErrorMessage } from './parsers';

export const KOR_SERVICE2_BASE = 'https://apis.data.go.kr/B551011/KorService2';

export type TourApiClientOptions = {
  serviceKey: string;
  mobileApp?: string;
  mobileOS?: string;
  /** ms between successful request starts (throttle) */
  requestDelayMs?: number;
  /** fetch timeout ms */
  requestTimeoutMs?: number;
  maxRetries?: number;
  onApiError?: (info: { path: string; message: string }) => void;
};

export type TourApiRequestMeta = {
  path: string;
  endpointName: string;
  params: Record<string, string>;
  urlRedacted: string;
};

export type TourApiGetTextResult = {
  text: string;
  httpStatus: number;
  requestMeta: TourApiRequestMeta;
};

export type MobileAppIds = {
  mobileApp: string;
  mobileOS: string;
};

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function redactServiceKeyInUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('serviceKey')) {
      const raw = u.searchParams.get('serviceKey') ?? '';
      const masked =
        raw.length <= 8 ? '***' : `${raw.slice(0, 4)}…${raw.slice(-4)} (len=${raw.length})`;
      u.searchParams.set('serviceKey', masked);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function compactParams(
  params: Record<string, string | number | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

/** JSON 응답 요청용 공통 (_type=json). listYN 등 레거시 파라미터는 넣지 않음. */
export function buildJsonBaseParams(mobile: MobileAppIds): Record<string, string> {
  return {
    MobileOS: mobile.mobileOS,
    MobileApp: mobile.mobileApp,
    _type: 'json',
  };
}

export type AreaBasedListParamsOptions = {
  numOfRows: number;
  arrange: string;
  contentTypeId: number;
  lDongRegnCd?: number;
  lDongSignguCd?: number;
  areaCode?: number;
  sigunguCode?: number;
};

/**
 * /areaBasedList2 쿼리 파라미터 (pageNo 제외 시 pageNo만 바꿔 페이지 순회).
 */
export function buildAreaBasedListParams(
  pageNo: number,
  base: Record<string, string>,
  opts: AreaBasedListParamsOptions,
): Record<string, string> {
  const out: Record<string, string> = {
    ...base,
    pageNo: String(pageNo),
    numOfRows: String(opts.numOfRows),
    arrange: opts.arrange,
    contentTypeId: String(opts.contentTypeId),
  };
  if (opts.lDongRegnCd !== undefined) out.lDongRegnCd = String(opts.lDongRegnCd);
  if (opts.lDongSignguCd !== undefined) out.lDongSignguCd = String(opts.lDongSignguCd);
  if (opts.areaCode !== undefined) out.areaCode = String(opts.areaCode);
  if (opts.sigunguCode !== undefined) out.sigunguCode = String(opts.sigunguCode);
  return out;
}

/** /detailCommon2 */
export function buildDetailCommonParams(
  contentId: string,
  base: Record<string, string>,
): Record<string, string> {
  return {
    ...base,
    pageNo: '1',
    numOfRows: '10',
    contentId,
  };
}

/** /detailIntro2 */
export function buildDetailIntroParams(
  contentId: string,
  contentTypeId: string | number,
  base: Record<string, string>,
): Record<string, string> {
  return {
    ...base,
    pageNo: '1',
    numOfRows: '10',
    contentId,
    contentTypeId: String(contentTypeId),
  };
}

/** /detailInfo2 */
export function buildDetailInfoParams(
  contentId: string,
  contentTypeId: string | number,
  base: Record<string, string>,
): Record<string, string> {
  return {
    ...base,
    pageNo: '1',
    numOfRows: '10',
    contentId,
    contentTypeId: String(contentTypeId),
  };
}

function endpointLabel(path: string): string {
  const base = path.replace(/^\//, '');
  return base || path;
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 502 || status === 504;
}

function parseErrorHintFromBody(text: string): string | null {
  const xml = extractXmlStyleErrorMessage(text);
  if (xml) return xml;
  const t = text.trim().slice(0, 400);
  if (t && !t.startsWith('{')) return t;
  return null;
}

function buildUrl(path: string, params: Record<string, string>, serviceKey: string): string {
  const u = new URL(KOR_SERVICE2_BASE + path);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    sp.set(k, v);
  }
  sp.set('serviceKey', serviceKey);
  u.search = sp.toString();
  return u.toString();
}

function buildSearchKeywordParams(
  base: Record<string, string>,
  args: {
    keyword: string;
    pageNo: number;
    numOfRows: number;
    arrange: string;
    areaCode?: number;
  },
): Record<string, string> {
  return {
    ...base,
    pageNo: String(args.pageNo),
    numOfRows: String(args.numOfRows),
    keyword: args.keyword,
    arrange: args.arrange,
    ...(args.areaCode !== undefined ? { areaCode: String(args.areaCode) } : {}),
  };
}

export class TourApiClient {
  private readonly key: string;
  private readonly mobileApp: string;
  private readonly mobileOS: string;
  private readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly onApiError?: TourApiClientOptions['onApiError'];

  constructor(opts: TourApiClientOptions) {
    this.key = opts.serviceKey.trim();
    this.mobileApp = opts.mobileApp ?? 'AtocKoreaJejuImport';
    this.mobileOS = opts.mobileOS ?? 'ETC';
    this.delayMs = opts.requestDelayMs ?? 120;
    this.timeoutMs = opts.requestTimeoutMs ?? 60_000;
    this.maxRetries = Math.max(0, opts.maxRetries ?? 5);
    this.onApiError = opts.onApiError;
  }

  private mobileBase(): Record<string, string> {
    return buildJsonBaseParams({ mobileApp: this.mobileApp, mobileOS: this.mobileOS });
  }

  private async throttle(): Promise<void> {
    if (this.delayMs > 0) await sleep(this.delayMs);
  }

  /**
   * Raw body + HTTP status (Tour API often returns 200 with JSON error in body).
   * Retry on 429, timeout, transient network errors with exponential backoff.
   */
  async getText(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<TourApiGetTextResult> {
    const compact = compactParams(params);
    const endpointName = endpointLabel(path);
    let attempt = 0;
    let lastErr: Error | null = null;

    while (attempt <= this.maxRetries) {
      await this.throttle();
      const url = buildUrl(path, compact, this.key);
      const requestMeta: TourApiRequestMeta = {
        path,
        endpointName,
        params: compact,
        urlRedacted: redactServiceKeyInUrl(url),
      };

      if (attempt === 0) {
        console.debug(`[TourAPI] ${endpointName}`, {
          path,
          params: requestMeta.params,
          url: requestMeta.urlRedacted,
        });
      } else {
        console.debug(`[TourAPI] ${endpointName} retry ${attempt}`, {
          url: requestMeta.urlRedacted,
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timer);
        const text = await res.text();

        if (res.status === 429 || isRetryableHttpStatus(res.status)) {
          lastErr = new Error(`HTTP ${res.status}`);
          const backoff = Math.min(30_000, 500 * 2 ** attempt + Math.floor(Math.random() * 400));
          attempt += 1;
          if (attempt <= this.maxRetries) {
            await sleep(backoff);
            continue;
          }
        }

        if (text.includes('INVALID_REQUEST_PARAMETER_ERROR')) {
          console.error(`[TourAPI] INVALID_REQUEST_PARAMETER_ERROR on ${endpointName}`, {
            params: requestMeta.params,
            url: requestMeta.urlRedacted,
          });
        }
        if (!text.trim().startsWith('{')) {
          const hint = parseErrorHintFromBody(text);
          if (hint) {
            console.warn(`[TourAPI] non-JSON body on ${endpointName}:`, hint);
          }
        }

        return { text, httpStatus: res.status, requestMeta };
      } catch (e) {
        clearTimeout(timer);
        const err = e instanceof Error ? e : new Error(String(e));
        lastErr = err;
        const retryable =
          err.name === 'AbortError' ||
          /fetch|network|ECONNRESET|ETIMEDOUT|socket/i.test(err.message);
        if (retryable && attempt < this.maxRetries) {
          const backoff = Math.min(30_000, 500 * 2 ** attempt + Math.floor(Math.random() * 400));
          attempt += 1;
          await sleep(backoff);
          continue;
        }
        throw err;
      }
    }

    throw lastErr ?? new Error('Tour API request failed after retries');
  }

  emitError(path: string, message: string): void {
    this.onApiError?.({ path, message });
  }

  async searchKeyword2(args: {
    keyword: string;
    numOfRows?: number;
    pageNo?: number;
    arrange?: string;
    areaCode?: number;
  }): Promise<TourApiGetTextResult> {
    const base = this.mobileBase();
    const params = buildSearchKeywordParams(base, {
      keyword: args.keyword,
      pageNo: args.pageNo ?? 1,
      numOfRows: args.numOfRows ?? 50,
      arrange: args.arrange ?? 'A',
      ...(args.areaCode !== undefined ? { areaCode: args.areaCode } : {}),
    });
    return this.getText('/searchKeyword2', params);
  }

  async areaBasedList2(args: {
    pageNo: number;
    numOfRows: number;
    arrange: string;
    contentTypeId: number;
    lDongRegnCd?: number;
    lDongSignguCd?: number;
    areaCode?: number;
    sigunguCode?: number;
  }): Promise<TourApiGetTextResult> {
    const base = this.mobileBase();
    const params = buildAreaBasedListParams(args.pageNo, base, {
      numOfRows: args.numOfRows,
      arrange: args.arrange,
      contentTypeId: args.contentTypeId,
      lDongRegnCd: args.lDongRegnCd,
      lDongSignguCd: args.lDongSignguCd,
      areaCode: args.areaCode,
      sigunguCode: args.sigunguCode,
    });
    return this.getText('/areaBasedList2', params);
  }

  async detailCommon2(args: { contentId: string }): Promise<TourApiGetTextResult> {
    const base = this.mobileBase();
    const params = buildDetailCommonParams(args.contentId, base);
    return this.getText('/detailCommon2', params);
  }

  async detailIntro2(args: { contentId: string; contentTypeId: string }): Promise<TourApiGetTextResult> {
    const base = this.mobileBase();
    const params = buildDetailIntroParams(args.contentId, args.contentTypeId, base);
    return this.getText('/detailIntro2', params);
  }

  async detailInfo2(args: { contentId: string; contentTypeId: string }): Promise<TourApiGetTextResult> {
    const base = this.mobileBase();
    const params = buildDetailInfoParams(args.contentId, args.contentTypeId, base);
    return this.getText('/detailInfo2', params);
  }
}
