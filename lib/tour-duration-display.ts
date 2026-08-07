import type { Locale } from '@/lib/i18n';

/**
 * "5–9 hours" → { from: 5, to: 9 }. Ranges must be recognised BEFORE the
 * single-value patterns below, because `/(\d+(?:\.\d+)?)\s*hours?/` happily
 * matches the "9 hours" at the end of "5–9 hours" and silently returns the
 * upper bound.
 *
 * 🔴 That is not hypothetical. Measured 2026-08-07 on a real render: five
 * catalogue products carry a range, and every one of them showed only its
 * maximum on the card badge — `seoul-dmz-private-3rd-tunnel-suspension-bridge`
 * ("8–9 hours") read "9h", `jeju-grand-highlights-loop` ("10–10.5 hours") read
 * "10.5h". Worst on the new Busan city charter, where the badge sat next to the
 * cheapest cell of an hourly rate card: "9h · $160" reads as a nine-hour price
 * for what is the five-hour one.
 *
 * Separators cover the en/em dash the bundles actually use, plus hyphen, tilde
 * and the English word.
 */
const HOUR_RANGE =
  /^(\d+(?:\.\d+)?)\s*(?:[–—~-]|to)\s*(\d+(?:\.\d+)?)\s*(?:h(?:our)?s?|시간|時間|小时|小時)?$/;

function parseHourRange(raw: string): { from: number; to: number } | null {
  const m = HOUR_RANGE.exec(raw.trim().toLowerCase());
  if (!m) return null;
  const from = parseFloat(m[1]);
  const to = parseFloat(m[2]);
  // A "range" that runs backwards is a typo, not a range — fall through to the
  // single-value parser rather than printing "10–8h".
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return { from, to };
}

/** Trim a trailing ".0" so 9 renders "9", not "9.0"; 10.5 stays "10.5". */
const num = (n: number) => String(Number(n.toFixed(1)));

function formatRangeForLocale(from: number, to: number, locale: Locale): string {
  const span = `${num(from)}–${num(to)}`;
  if (locale === 'ko') return `${span}시간`;
  if (locale === 'ja') return `${span}時間`;
  if (locale === 'zh' || locale === 'zh-TW') return `${span}小时`;
  if (locale === 'es') return `${span} h`;
  return `${span}h`;
}

/** Parse common duration strings into display parts (hours may be decimal e.g. 9.5). */
function parseDurationParts(raw: string): { hours?: number; minutes?: number } | null {
  const s = raw.trim().toLowerCase();
  const combined = s.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?\s*(\d+)\s*m(?:in)?(?:ute)?s?/);
  if (combined) {
    return { hours: parseFloat(combined[1]), minutes: parseInt(combined[2], 10) };
  }
  const hDecWord = s.match(/(\d+(?:\.\d+)?)\s*hours?/);
  if (hDecWord) return { hours: parseFloat(hDecWord[1]) };
  const hDec = s.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?/);
  if (hDec) return { hours: parseFloat(hDec[1]) };
  const hInt = s.match(/^(\d+)\s*hours?$/);
  if (hInt) return { hours: parseInt(hInt[1], 10) };
  const mOnly = s.match(/(\d+)\s*m(?:in)?(?:ute)?s?/);
  if (mOnly) return { minutes: parseInt(mOnly[1], 10) };
  if (/^\d+h$/i.test(s)) return { hours: parseInt(s, 10) };
  if (/^\d+m$/i.test(s)) return { minutes: parseInt(s, 10) };
  return null;
}

function formatPartsForLocale(
  hours: number | undefined,
  minutes: number | undefined,
  locale: Locale
): string {
  const h = hours != null && !Number.isNaN(hours) ? hours : undefined;
  const m = minutes != null && !Number.isNaN(minutes) ? minutes : undefined;

  if (h != null && m != null) {
    if (locale === 'ko') return `${Math.floor(h)}시간 ${m}분`;
    if (locale === 'ja') return `${Math.floor(h)}時間${m}分`;
    if (locale === 'zh' || locale === 'zh-TW') return `${Math.floor(h)}小时${m}分钟`;
    if (locale === 'es') return `${Math.floor(h)} h ${m} min`;
    return `${Math.floor(h)}h ${m}m`;
  }
  if (h != null) {
    const whole = Math.floor(h);
    const frac = h - whole;
    if (frac > 0.001) {
      if (locale === 'ko') return `${h}시간`;
      if (locale === 'ja') return `${h}時間`;
      if (locale === 'zh' || locale === 'zh-TW') return `${h}小时`;
      if (locale === 'es') return `${h} h`;
      return `${h}h`;
    }
    if (locale === 'ko') return `${whole}시간`;
    if (locale === 'ja') return `${whole}時間`;
    if (locale === 'zh' || locale === 'zh-TW') return `${whole}小时`;
    if (locale === 'es') return `${whole} h`;
    return `${whole}h`;
  }
  if (m != null) {
    if (locale === 'ko') return `${m}분`;
    if (locale === 'ja') return `${m}分`;
    if (locale === 'zh' || locale === 'zh-TW') return `${m}分钟`;
    if (locale === 'es') return `${m} min`;
    return `${m}m`;
  }
  return '';
}

/**
 * Tour card duration: compact Latin for `en`, native units for Asian locales.
 * Falls back to a shortened raw string when parsing fails.
 */
export function formatTourDurationForCard(raw: string | null | undefined, locale: Locale): string {
  if (!raw || !raw.trim()) return '';
  const range = parseHourRange(raw);
  if (range) return formatRangeForLocale(range.from, range.to, locale);
  const parts = parseDurationParts(raw.trim());
  if (parts && (parts.hours != null || parts.minutes != null)) {
    const out = formatPartsForLocale(parts.hours, parts.minutes, locale);
    if (out) return out;
  }
  const short = raw.trim();
  return short.length <= 14 ? short : '';
}
