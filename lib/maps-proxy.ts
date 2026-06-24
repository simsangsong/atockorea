/**
 * Query sanitizer for the Google Static Maps proxy (N19).
 *
 * `/api/maps/static` forwards a client-supplied query string to Google with our
 * billable key attached. Without a parameter whitelist, a caller can append
 * anything (huge `size`, many `markers`, arbitrary `style`/`path` payloads) and
 * run up our Maps billing. We keep the proxy public (used by pickup-detail
 * cards) but only forward known Static Maps parameters, drop any caller-supplied
 * `key`, and cap the request size.
 *
 * Reference: Google Maps Static API request parameters.
 */

/** Parameters the Static Maps API accepts. `key` is intentionally excluded —
 *  the server attaches its own and must never honor a caller-supplied key. */
export const ALLOWED_STATIC_MAP_PARAMS = new Set<string>([
  'center',
  'zoom',
  'size',
  'scale',
  'format',
  'maptype',
  'language',
  'region',
  'markers',
  'path',
  'visible',
  'style',
  'map_id',
]);

/** Defensive caps so a single proxied request can't balloon. */
export const MAX_STATIC_MAP_PARAMS = 60;
export const MAX_STATIC_MAP_QUERY_LENGTH = 4096;

export type SanitizeResult =
  | { ok: true; search: string }
  | { ok: false; reason: 'too_large' | 'no_valid_params' };

/**
 * Filter a raw query string down to the allowed Static Maps parameters.
 *
 * @param rawSearch The incoming query string, with or without a leading `?`.
 * @returns `{ ok, search }` where `search` includes a leading `?` (without the
 *          API key — the route appends that), or an error reason.
 */
export function sanitizeStaticMapSearch(rawSearch: string): SanitizeResult {
  const raw = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  if (raw.length > MAX_STATIC_MAP_QUERY_LENGTH) {
    return { ok: false, reason: 'too_large' };
  }

  const incoming = new URLSearchParams(raw);
  const out = new URLSearchParams();
  let count = 0;

  for (const [key, value] of incoming.entries()) {
    if (!ALLOWED_STATIC_MAP_PARAMS.has(key)) continue;
    count += 1;
    if (count > MAX_STATIC_MAP_PARAMS) return { ok: false, reason: 'too_large' };
    out.append(key, value);
  }

  if ([...out.keys()].length === 0) {
    return { ok: false, reason: 'no_valid_params' };
  }

  return { ok: true, search: `?${out.toString()}` };
}
