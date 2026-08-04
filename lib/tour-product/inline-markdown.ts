/**
 * The light `**bold**` markup tour copy is authored in.
 *
 * Every `tour_product_pages` row carries these markers — stop descriptions,
 * highlights, why-on-route, accordion copy, FAQ answers. That is by design;
 * what was not by design is that only some of the surfaces reading those
 * fields knew about them. `TourStopDetailDrawer` has always parsed them, so
 * stop descriptions looked right, while the accordion preview, the accordion
 * body, the FAQ answer and the FAQPage structured data printed the asterisks
 * verbatim to guests: "This tour departs **on Mondays, Thursdays and Saturdays
 * only**".
 *
 * Two helpers, because the surfaces genuinely differ. A renderer wants the
 * segments so it can emphasise them; a plain-text sink — structured data, a
 * truncated one-line preview, a meta description — wants the markers gone,
 * since it has no way to show emphasis and the characters are just noise.
 *
 * Deliberately not a markdown parser. The corpus uses exactly this one marker,
 * and a general parser would start interpreting the asterisks, underscores and
 * brackets that appear in ordinary prose.
 */

/** Matches a `**bold**` run that does not span a line break. */
const BOLD_RE = /(\*\*[^*\n]+\*\*)/g;

const isBold = (part: string): boolean =>
  part.startsWith("**") && part.endsWith("**") && part.length > 4;

export type InlineSegment = { text: string; bold: boolean };

/**
 * Split authored copy into segments for a renderer. Runs that are not
 * well-formed bold are returned as-is, so a lone asterisk in prose survives
 * untouched rather than eating the rest of the sentence.
 */
export function splitInlineBold(text: string | null | undefined): InlineSegment[] {
  if (!text) return [];
  return text
    .split(BOLD_RE)
    .filter((part) => part !== "")
    .map((part) => (isBold(part) ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}

/** Drop the markers, keep the words. For sinks that cannot show emphasis. */
export function stripInlineBold(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(BOLD_RE, (part) => (isBold(part) ? part.slice(2, -2) : part));
}

/** True when the string still carries markup a guest should never see. */
export function hasInlineMarkup(text: string | null | undefined): boolean {
  return !!text && BOLD_RE.test(text) && (BOLD_RE.lastIndex = 0) === 0;
}
