/**
 * 한국관광공사 Tour API — PhotoGalleryService1 (관광사진)
 * Base: https://apis.data.go.kr/B551011/PhotoGalleryService1
 *
 * 인증키는 코드에 넣지 말고 TOUR_API_SERVICE_KEY / TOUR_API_KEY 로 주입 (KorService2와 동일).
 */

import { extractXmlStyleErrorMessage } from './parsers';

export const PHOTO_GALLERY_BASE = 'https://apis.data.go.kr/B551011/PhotoGalleryService1';

export type PhotoGalleryClientOptions = {
  serviceKey: string;
  mobileApp?: string;
  mobileOS?: string;
  requestDelayMs?: number;
  requestTimeoutMs?: number;
  maxRetries?: number;
};

export type PhotoGalleryGetTextResult = {
  text: string;
  httpStatus: number;
  urlRedacted: string;
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

function compactParams(params: Record<string, string | number | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

function buildUrl(path: string, params: Record<string, string>, serviceKey: string): string {
  const u = new URL(PHOTO_GALLERY_BASE + path);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    sp.set(k, v);
  }
  sp.set('serviceKey', serviceKey);
  u.search = sp.toString();
  return u.toString();
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

export class PhotoGalleryClient {
  private readonly key: string;
  private readonly mobileApp: string;
  private readonly mobileOS: string;
  private readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(opts: PhotoGalleryClientOptions) {
    this.key = opts.serviceKey.trim();
    this.mobileApp = opts.mobileApp ?? 'AtocKoreaJejuImport';
    this.mobileOS = opts.mobileOS ?? 'ETC';
    this.delayMs = opts.requestDelayMs ?? 150;
    this.timeoutMs = opts.requestTimeoutMs ?? 60_000;
    this.maxRetries = Math.max(0, opts.maxRetries ?? 5);
  }

  private mobileBase(): Record<string, string> {
    return {
      MobileOS: this.mobileOS,
      MobileApp: this.mobileApp,
      _type: 'json',
    };
  }

  private async throttle(): Promise<void> {
    if (this.delayMs > 0) await sleep(this.delayMs);
  }

  async getText(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<PhotoGalleryGetTextResult> {
    const compact = compactParams(params);
    let attempt = 0;
    let lastErr: Error | null = null;

    while (attempt <= this.maxRetries) {
      await this.throttle();
      const url = buildUrl(path, compact, this.key);
      const urlRedacted = redactServiceKeyInUrl(url);

      if (attempt === 0) {
        console.debug(`[PhotoGallery] ${path}`, { params: compact, url: urlRedacted });
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
          console.error(`[PhotoGallery] INVALID_REQUEST_PARAMETER_ERROR`, {
            path,
            params: compact,
            url: urlRedacted,
          });
        }
        if (!text.trim().startsWith('{')) {
          const hint = parseErrorHintFromBody(text);
          if (hint) console.warn(`[PhotoGallery] non-JSON body on ${path}:`, hint);
        }

        return { text, httpStatus: res.status, urlRedacted };
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

    throw lastErr ?? new Error('Photo Gallery request failed after retries');
  }

  async gallerySearchList1(args: {
    keyword: string;
    pageNo: number;
    numOfRows: number;
  }): Promise<PhotoGalleryGetTextResult> {
    const base = this.mobileBase();
    return this.getText('/gallerySearchList1', {
      ...base,
      keyword: args.keyword,
      pageNo: args.pageNo,
      numOfRows: args.numOfRows,
    });
  }

  /**
   * 상세 사진 목록. 포털 가이드(v4.x)는 보통 `title`(갤러리 그룹 제목) 또는 `galContentId` 사용.
   */
  async galleryDetailList1(args: {
    pageNo: number;
    numOfRows: number;
    title?: string;
    galContentId?: string;
  }): Promise<PhotoGalleryGetTextResult> {
    const base = this.mobileBase();
    return this.getText('/galleryDetailList1', {
      ...base,
      pageNo: args.pageNo,
      numOfRows: args.numOfRows,
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.galContentId !== undefined ? { galContentId: args.galContentId } : {}),
    });
  }
}
