/**
 * Cost/abuse guard for POST /api/admin/tour-content/generate (W3.7 / AR-1).
 *
 * The route fans out one OpenAI course generation (and optional TTS) per locale
 * key in `localePayloads`, with no cap on locale count, no allowlist on locale
 * keys, and no payload-size limit — an oversized or many-locale request could
 * run up a large OpenAI/TTS bill. This validates all three.
 */
export const KNOWN_LOCALES = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'] as const;

/** Max combined JSON size of the localePayloads object. */
export const MAX_CONTENT_PAYLOAD_BYTES = 256 * 1024;

export type ContentGenerateValidation =
  | { ok: true; locales: string[] }
  | { ok: false; error: string };

export function validateLocalePayloads(localePayloads: unknown): ContentGenerateValidation {
  if (!localePayloads || typeof localePayloads !== 'object' || Array.isArray(localePayloads)) {
    return { ok: false, error: 'localePayloads must be an object keyed by locale' };
  }
  const locales = Object.keys(localePayloads as Record<string, unknown>);
  if (locales.length === 0) {
    return { ok: false, error: 'At least one locale payload is required' };
  }
  if (locales.length > KNOWN_LOCALES.length) {
    return { ok: false, error: `Too many locales (max ${KNOWN_LOCALES.length})` };
  }
  const unknown = locales.filter((l) => !(KNOWN_LOCALES as readonly string[]).includes(l));
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown locale(s): ${unknown.join(', ')}` };
  }
  const bytes = Buffer.byteLength(JSON.stringify(localePayloads));
  if (bytes > MAX_CONTENT_PAYLOAD_BYTES) {
    return {
      ok: false,
      error: `Payload too large (${bytes} bytes, max ${MAX_CONTENT_PAYLOAD_BYTES}).`,
    };
  }
  return { ok: true, locales };
}
