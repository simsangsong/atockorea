/**
 * @jest-environment node
 *
 * P0 / §M-3 — the half of the standing gate that runs in CI.
 *
 * It sweeps every checked-in product bundle, classifies each one, and fails if
 * the SET of course-option products changes in either direction. Not a fixture
 * test: fixtures only contain data we already knew about, and the whole risk
 * here is data we do not.
 *
 * The other half (`scripts/qa-course-classification.ts`) asks the live database
 * the same question, because these payloads are usually edited through the admin
 * UI and never touch this repo. Neither half can replace the other.
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import {
  EXPECTED_COURSE_OPTION_SLUGS,
  classificationDrift,
  classifyProduct,
  describeDrift,
  type ClassifiedProduct,
} from '@/lib/tour-room/courseClassification';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';

const ROOT = path.join(process.cwd(), 'components', 'product-tour-static');

function loadBundles(): ClassifiedProduct[] {
  const out: ClassifiedProduct[] = [];
  for (const dir of readdirSync(ROOT)) {
    const file = path.join(ROOT, dir, `${dir}.en.json`);
    if (!existsSync(file)) continue;
    const json = JSON.parse(readFileSync(file, 'utf8')) as { itineraryStops?: ItineraryStop[] };
    const stops = Array.isArray(json.itineraryStops) ? json.itineraryStops : [];
    out.push(classifyProduct(dir, stops));
  }
  return out;
}

describe('course-option classification is pinned (P0 / M-3)', () => {
  const classified = loadBundles();

  it('actually found the products — an empty sweep proves nothing', () => {
    // The failure mode this guards: a moved directory or a renamed field makes
    // the sweep read zero products, and zero products drift from nothing.
    expect(classified.length).toBeGreaterThanOrEqual(30);
    expect(classified.some((c) => c.stops > 0)).toBe(true);
  });

  it('🔴 the set of course-option products has not changed', () => {
    const drift = classificationDrift(classified);
    expect(describeDrift(drift)).toEqual([]);
  });

  it('the charter products are classified for the reason we think they are', () => {
    // Pinning the mechanism, not just the outcome: if one of these ever passes
    // for a different reason (say, an empty itinerary), the gate above would
    // still be green while the classifier had quietly changed meaning.
    const found = EXPECTED_COURSE_OPTION_SLUGS.map((slug) =>
      classified.find((c) => c.slug === slug),
    ).filter(Boolean) as ClassifiedProduct[];
    // If the sweep saw none of them, the two tests above are asserting over an
    // empty intersection and would pass no matter what the classifier did.
    expect(found.length).toBeGreaterThan(0);
    for (const hit of found) {
      expect({ slug: hit.slug, time: hit.withTime, duration: hit.withDuration }).toEqual({
        slug: hit.slug,
        time: 0,
        duration: 0,
      });
      expect(hit.stops).toBeGreaterThanOrEqual(2);
      expect(hit.isCourseOptions).toBe(true);
    }
  });

  it('🔴 a fixed-itinerary product that loses its times would be caught', () => {
    // The exact scenario M-P2 describes: Seoul DMZ is a fixed route and avoids
    // reclassification only because someone typed clock times into it.
    const stripped: ClassifiedProduct[] = [
      ...classified.filter((c) => c.slug !== 'seoul-dmz-private-3rd-tunnel-suspension-bridge'),
      classifyProduct('seoul-dmz-private-3rd-tunnel-suspension-bridge', [
        { number: 1, name: 'Imjingak' },
        { number: 2, name: '3rd Tunnel' },
      ] as ItineraryStop[]),
    ];
    const drift = classificationDrift(stripped);
    expect(drift.unexpected).toContain('seoul-dmz-private-3rd-tunnel-suspension-bridge');
    expect(describeDrift(drift).join(' ')).toMatch(/choose a course that does not exist/);
  });

  it('🔴 a charter that stops being detected would also be caught', () => {
    // Silent regression in the other direction — every existing test stays green
    // while the reported bug comes back.
    const timed: ClassifiedProduct[] = classified.map((c) =>
      c.slug === EXPECTED_COURSE_OPTION_SLUGS[0] ? { ...c, isCourseOptions: false } : c,
    );
    const drift = classificationDrift(timed);
    expect(drift.missing).toEqual([EXPECTED_COURSE_OPTION_SLUGS[0]]);
    expect(describeDrift(drift).join(' ')).toMatch(/report is back/);
  });
});
