import type { SmallGroupRouteStop } from './smallGroupDetailContent';

/** Empty or em-dash placeholder */
export function itineraryPlaceholder(value: string | undefined): boolean {
  const t = (value ?? '').trim();
  return t === '' || t === '—';
}

/** Time / stay chip for scan rows (first numeric chunk + min). */
export function itineraryStayChipLabel(stay: string): string {
  const m = stay.trim().match(/(\d+)/);
  if (m) return `${m[1]} min`;
  const t = stay.trim();
  return t || '';
}

const PURPOSE_MAX = 90;

function firstSentenceOrTrunc(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^.{1,220}?[.!?](?=\s|$)/);
  const first = m ? m[0].trim() : t;
  const use = first.length <= max + 14 ? first : t;
  if (use.length <= max) return use;
  return `${use.slice(0, max - 1).trim()}…`;
}

/**
 * One-line purpose for collapsed itinerary cards (why → card summary → description).
 */
export function stopPurposePreview(stop: SmallGroupRouteStop): string {
  if (!itineraryPlaceholder(stop.whyIncluded)) {
    const p = firstSentenceOrTrunc(stop.whyIncluded, PURPOSE_MAX);
    if (p) return p;
  }
  const cs = stop.cardSummary?.trim() ?? '';
  if (cs) return firstSentenceOrTrunc(cs, PURPOSE_MAX);
  const d = stop.description?.trim() ?? '';
  if (d) return firstSentenceOrTrunc(d, PURPOSE_MAX);
  return '';
}

/** Full narrative body for expanded view (card summary + description when both differ). */
export function fullStopNarrativeForExpanded(stop: SmallGroupRouteStop): string {
  const c = stop.cardSummary?.trim() ?? '';
  const d = stop.description?.trim() ?? '';
  if (c && d && c !== d) return `${c}\n\n${d}`;
  return c || d;
}
