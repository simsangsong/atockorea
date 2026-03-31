/**
 * Robust parsers for KorService2 JSON (and occasional XML error bodies).
 */

import type { TourApiSearchItem } from './types';

export type ParsedApiEnvelope<T> = {
  ok: boolean;
  resultCode: string | null;
  resultMsg: string | null;
  items: T[];
  /** response.body.totalCount when present (list APIs). */
  totalCount?: number;
  rawTextSnippet: string;
  parseError?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    const r = asRecord(cur);
    if (!r) return undefined;
    cur = r[p];
  }
  return cur;
}

/** Normalize API item: array | single object | undefined | empty string */
export function normalizeItemList<T extends Record<string, unknown>>(raw: unknown): T[] {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) return raw.filter(Boolean) as T[];
  if (typeof raw === 'object') return [raw as T];
  return [];
}

export function parseTourApiJsonEnvelope(rawText: string): unknown {
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}

export function extractXmlStyleErrorMessage(rawText: string): string | null {
  const m =
    rawText.match(/<returnAuthMsg[^>]*>([^<]*)</i) ||
    rawText.match(/<errMsg[^>]*>([^<]*)</i) ||
    rawText.match(/resultMsg[^>]*>([^<]*)</i);
  if (m?.[1]) return m[1].trim();
  if (rawText.includes('Unauthorized')) return 'Unauthorized (XML/text body)';
  if (rawText.includes('Forbidden')) return 'Forbidden (XML/text body)';
  return null;
}

/** KorService2 may return "0000", 0, or "00" depending on serializer. */
export function isTourApiSuccessResultCode(code: string | null): boolean {
  if (code === null) return false;
  const c = code.trim();
  return c === '0000' || c === '00' || c === '0';
}

/**
 * Parse standard KorService2 JSON: response.header + response.body.items.item
 */
export function parseItemsEnvelope(rawText: string): ParsedApiEnvelope<TourApiSearchItem> {
  const snippet = rawText.slice(0, 500);
  const parsed = parseTourApiJsonEnvelope(rawText);
  if (!parsed) {
    const xmlErr = extractXmlStyleErrorMessage(rawText);
    const short = rawText.trim().slice(0, 200);
    const hint =
      xmlErr ??
      (short && !short.startsWith('{') ? short : null) ??
      'JSON parse failed';
    return {
      ok: false,
      resultCode: null,
      resultMsg: xmlErr,
      items: [],
      rawTextSnippet: snippet,
      parseError: hint,
    };
  }

  const response =
    asRecord(dig(parsed, ['response'])) ?? asRecord(dig(parsed, ['Response']));

  /** KorService2 sometimes returns flat JSON: `{ responseTime, resultCode, resultMsg }` without `response`. */
  const root = asRecord(parsed);
  if (!response && root && (root['resultCode'] !== undefined || root['resultcode'] !== undefined)) {
    const rc = String(root['resultCode'] ?? root['resultcode'] ?? '').trim();
    const rm = String(root['resultMsg'] ?? root['resultmsg'] ?? '');
    const okFlat = isTourApiSuccessResultCode(rc || null);
    return {
      ok: okFlat,
      resultCode: rc || null,
      resultMsg: rm,
      items: [],
      rawTextSnippet: snippet,
      parseError: okFlat ? undefined : rm || rc || 'Non-zero resultCode',
    };
  }

  if (!response) {
    return {
      ok: false,
      resultCode: null,
      resultMsg: extractXmlStyleErrorMessage(rawText),
      items: [],
      rawTextSnippet: snippet,
      parseError: 'Missing response',
    };
  }

  const header =
    asRecord(response['header']) ??
    asRecord(response['Header']) ??
    asRecord(response['HEADER']);
  const resultCodeRaw = header
    ? header['resultCode'] ?? header['resultcode'] ?? header['RESULTCODE']
    : null;
  const resultCode = header ? String(resultCodeRaw ?? '').trim() : null;
  const resultMsgRaw = header
    ? header['resultMsg'] ?? header['resultmsg'] ?? header['RESULTMSG']
    : null;
  const resultMsg = header ? String(resultMsgRaw ?? '') : null;

  const body = asRecord(response['body']) ?? asRecord(response['Body']);
  let totalCount: number | undefined;
  if (body) {
    const tc = body['totalCount'] ?? body['totalcount'] ?? body['TOTALCOUNT'];
    if (tc !== undefined && tc !== null && tc !== '') {
      const n = Number(tc);
      if (Number.isFinite(n)) totalCount = n;
    }
  }
  const itemsNode = body ? body['items'] ?? body['Items'] : undefined;
  const itemsRec = asRecord(itemsNode);
  const rawItem = itemsRec
    ? itemsRec['item'] ?? itemsRec['Item'] ?? itemsRec['ITEM']
    : undefined;
  const items = normalizeItemList<TourApiSearchItem>(rawItem);

  const ok = isTourApiSuccessResultCode(resultCode);

  return {
    ok,
    resultCode,
    resultMsg,
    items,
    totalCount,
    rawTextSnippet: snippet,
    parseError: ok ? undefined : resultMsg ?? resultCode ?? 'Non-zero resultCode',
  };
}

/**
 * Same envelope as `parseItemsEnvelope`, but items are untyped records (Photo Gallery, Odii, etc.).
 */
export function parseGenericItemsEnvelope(rawText: string): ParsedApiEnvelope<Record<string, unknown>> {
  const snippet = rawText.slice(0, 500);
  const parsed = parseTourApiJsonEnvelope(rawText);
  if (!parsed) {
    const xmlErr = extractXmlStyleErrorMessage(rawText);
    const short = rawText.trim().slice(0, 200);
    const hint =
      xmlErr ??
      (short && !short.startsWith('{') ? short : null) ??
      'JSON parse failed';
    return {
      ok: false,
      resultCode: null,
      resultMsg: xmlErr,
      items: [],
      rawTextSnippet: snippet,
      parseError: hint,
    };
  }

  const response =
    asRecord(dig(parsed, ['response'])) ?? asRecord(dig(parsed, ['Response']));

  const root = asRecord(parsed);
  if (!response && root && (root['resultCode'] !== undefined || root['resultcode'] !== undefined)) {
    const rc = String(root['resultCode'] ?? root['resultcode'] ?? '').trim();
    const rm = String(root['resultMsg'] ?? root['resultmsg'] ?? '');
    const okFlat = isTourApiSuccessResultCode(rc || null);
    return {
      ok: okFlat,
      resultCode: rc || null,
      resultMsg: rm,
      items: [],
      rawTextSnippet: snippet,
      parseError: okFlat ? undefined : rm || rc || 'Non-zero resultCode',
    };
  }

  if (!response) {
    return {
      ok: false,
      resultCode: null,
      resultMsg: extractXmlStyleErrorMessage(rawText),
      items: [],
      rawTextSnippet: snippet,
      parseError: 'Missing response',
    };
  }

  const header =
    asRecord(response['header']) ??
    asRecord(response['Header']) ??
    asRecord(response['HEADER']);
  const resultCodeRaw = header
    ? header['resultCode'] ?? header['resultcode'] ?? header['RESULTCODE']
    : null;
  const resultCode = header ? String(resultCodeRaw ?? '').trim() : null;
  const resultMsgRaw = header
    ? header['resultMsg'] ?? header['resultmsg'] ?? header['RESULTMSG']
    : null;
  const resultMsg = header ? String(resultMsgRaw ?? '') : null;

  const body = asRecord(response['body']) ?? asRecord(response['Body']);
  let totalCount: number | undefined;
  if (body) {
    const tc = body['totalCount'] ?? body['totalcount'] ?? body['TOTALCOUNT'];
    if (tc !== undefined && tc !== null && tc !== '') {
      const n = Number(tc);
      if (Number.isFinite(n)) totalCount = n;
    }
  }
  const itemsNode = body ? body['items'] ?? body['Items'] : undefined;
  const itemsRec = asRecord(itemsNode);
  const rawItem = itemsRec
    ? itemsRec['item'] ?? itemsRec['Item'] ?? itemsRec['ITEM']
    : undefined;
  const items = normalizeItemList<Record<string, unknown>>(rawItem);

  const ok = isTourApiSuccessResultCode(resultCode);

  return {
    ok,
    resultCode,
    resultMsg,
    items,
    totalCount,
    rawTextSnippet: snippet,
    parseError: ok ? undefined : resultMsg ?? resultCode ?? 'Non-zero resultCode',
  };
}

/** Lowercase keys for intro/detail common field access */
export function keyMapLoose(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}
