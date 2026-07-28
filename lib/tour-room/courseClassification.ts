/**
 * P0 / §M-3 — the standing gate around the course-option classifier.
 *
 * The classifier itself is structural and correct: an itinerary where NO stop
 * carries `time` and none carries `duration` is a list of route CHOICES, not a
 * sequence of stops. Verified against live, it picks out exactly the two
 * charter products and nothing else.
 *
 * 🔴 The danger is not the rule. It is what the rule depends on.
 *
 * Charter products went from 2 to 5. The three that do NOT trip the rule avoid
 * it only because somebody happened to type clock times into them — the Seoul
 * DMZ product is a fixed itinerary whose stops all have times, and that is the
 * only reason it reads as a stop list. The day a charter product is published
 * without times, it is silently reclassified, and a guest opening a fixed-route
 * product is asked to "choose a course" that does not exist.
 *
 * A fixture test cannot catch that: fixtures are the data we already knew about.
 * So the classification is pinned as a SET, and the set changing is a failure —
 * whether something joined it or something left it. Leaving matters as much:
 * if the Jeju charter dropped out, the reported bug would be back and every
 * existing test would still be green.
 */
import { isCourseOptionItinerary } from '@/lib/tour-room/courseOptions';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';

/**
 * The slugs whose itinerary is a set of route choices, verified against live on
 * 2026-07-28.
 *
 * To change this list you must be able to say which product changed and why.
 * That sentence is the point of the gate — not the list.
 */
export const EXPECTED_COURSE_OPTION_SLUGS: readonly string[] = [
  'jeju-island-private-car-charter-tour',
  'seoul-suburbs-private-chartered-car-10hr',
];

export interface ClassifiedProduct {
  slug: string;
  stops: number;
  withTime: number;
  withDuration: number;
  isCourseOptions: boolean;
}

export function classifyProduct(slug: string, stops: readonly ItineraryStop[]): ClassifiedProduct {
  const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  return {
    slug,
    stops: stops.length,
    withTime: stops.filter((s) => hasText(s?.time)).length,
    withDuration: stops.filter((s) => hasText(s?.duration)).length,
    isCourseOptions: isCourseOptionItinerary(stops),
  };
}

export interface ClassificationDrift {
  /** Classified as course-options but not expected — a fixed tour now asks guests to choose. */
  unexpected: string[];
  /** Expected but no longer classified — the original reported bug is back. */
  missing: string[];
}

export function classificationDrift(
  classified: readonly ClassifiedProduct[],
  expected: readonly string[] = EXPECTED_COURSE_OPTION_SLUGS,
): ClassificationDrift {
  const actual = new Set(classified.filter((c) => c.isCourseOptions).map((c) => c.slug));
  const seen = new Set(classified.map((c) => c.slug));
  return {
    unexpected: [...actual].filter((slug) => !expected.includes(slug)).sort(),
    // Only report a slug as missing if we actually looked at it — a product
    // absent from the source being checked is not evidence of anything.
    missing: expected.filter((slug) => seen.has(slug) && !actual.has(slug)).sort(),
  };
}

/** Human-readable failure text, shared by the jest gate and the live script. */
export function describeDrift(drift: ClassificationDrift): string[] {
  const lines: string[] = [];
  for (const slug of drift.unexpected) {
    lines.push(
      `${slug}: newly classified as COURSE OPTIONS. If this is a fixed-itinerary product, ` +
        'its guests are now being asked to choose a course that does not exist — give its stops ' +
        'times/durations. If it really is a charter, add it to EXPECTED_COURSE_OPTION_SLUGS.',
    );
  }
  for (const slug of drift.missing) {
    lines.push(
      `${slug}: NO LONGER classified as course options. The 2026-07-27 report is back — its four ` +
        'route choices will be imported into the planner as four sightseeing stops.',
    );
  }
  return lines;
}
