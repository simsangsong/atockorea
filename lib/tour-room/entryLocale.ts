/**
 * N6 — one locale decision that the server and the browser can both make.
 *
 * The 2026-07-18 fix made the SERVER deterministic (`typeof window === 'undefined'`
 * → always `'en'`) because Node ≥21 exposes a global `navigator` carrying the
 * SERVER's locale, which was leaking into SSR. That stopped the leak, but it did
 * not stop the mismatch: the browser's FIRST render still reads the device
 * locale, so the entry screen's server HTML said "Tour Mode" and the client's
 * hydration pass said "투어모드". Measured 2026-07-28 on `/tour-mode`:
 *
 *   ko-KR → Hydration failed … · fr-FR → Hydration failed … · en-US → clean
 *
 * Which is to say the app's public entry screen threw away its server render and
 * rebuilt the tree for every guest who is not English — i.e. almost all of them,
 * on the slowest screen in the funnel (FCP 5.9s).
 *
 * The fix is not to make the client render English first. It is to let the
 * SERVER know what the client will pick. Both sources are already on the
 * request: the `NEXT_LOCALE` cookie (what the client checks first) and
 * `Accept-Language` (what `navigator.language` is derived from). Resolving them
 * here means the correct language is in the first byte of HTML — the mismatch
 * disappears as a side effect of being right, not by deferring.
 *
 * Pure and dependency-free on purpose: a server component, a client hook and a
 * unit test all need the same answer, and a second copy of a locale list in this
 * repo has never once stayed in sync.
 */
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

/**
 * Map any BCP-47-ish tag onto a room locale, or null when we do not serve it.
 * Null rather than a fallback so callers decide what "unknown" means.
 */
export function normalizeEntryLocale(value: string | undefined | null): RoomLocale | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (!lower) return null;
  // Traditional-script Chinese devices land on zh-TW (mirrors normalizeRoomLocale).
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo' || lower.startsWith('zh-hant')) {
    return 'zh-TW';
  }
  const base = lower.split('-')[0];
  // §D A4.1 — 정본은 ROOM_LOCALES 하나다. 사본은 순서까지 달랐다.
  return ROOM_LOCALES.find((l) => l === base) ?? null;
}

/** Pull `NEXT_LOCALE` out of a raw Cookie header. */
export function entryLocaleFromCookieHeader(cookieHeader: string | undefined | null): RoomLocale | null {
  if (!cookieHeader) return null;
  const match = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/.exec(cookieHeader);
  return normalizeEntryLocale(match?.[1]);
}

/**
 * Best supported locale from an `Accept-Language` header, honouring q-values.
 *
 * Order matters more than it looks: a phone set to Korean with English as a
 * fallback sends `ko-KR,ko;q=0.9,en;q=0.8`, and picking the wrong end of that
 * list is how you serve English to a Korean guest while `navigator.language`
 * says otherwise — reintroducing the exact mismatch this module removes.
 */
export function entryLocaleFromAcceptLanguage(header: string | undefined | null): RoomLocale | null {
  if (!header) return null;
  const entries = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => /^\s*q=([\d.]+)\s*$/i.exec(p))
        .find(Boolean)?.[1];
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim(), q: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((e) => e.tag && e.q > 0)
    // Stable sort by descending q; equal q keeps the header's own order.
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => (b.q - a.q) || (a.i - b.i));

  for (const entry of entries) {
    if (entry.tag === '*') continue;
    const hit = normalizeEntryLocale(entry.tag);
    if (hit) return hit;
  }
  return null;
}

/**
 * The single decision. Cookie first (an explicit choice the guest made in this
 * app beats the phone's setting), then the phone, then English.
 * Mirrors `detectEntryLocale()`'s client-side order exactly — if these two ever
 * disagree, the hydration error comes straight back.
 */
export function resolveEntryLocale(input: {
  cookieHeader?: string | null;
  acceptLanguage?: string | null;
}): RoomLocale {
  return (
    entryLocaleFromCookieHeader(input.cookieHeader) ??
    entryLocaleFromAcceptLanguage(input.acceptLanguage) ??
    'en'
  );
}
