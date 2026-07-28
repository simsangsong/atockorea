/**
 * P0 / §M-3 — the live half of the course-classification gate.
 *
 * The jest half sweeps the product bundles checked into this repo. That is not
 * enough on its own, because `tour_product_pages.detail_payload` is normally
 * edited through the admin UI and never passes through git — so a new charter
 * product, or a stop losing its clock time, can change the classification with
 * no commit anywhere. "It is in the repo" and "it is live" are different claims
 * (§8 lesson 2), and this script asks the second one.
 *
 * What it prevents, concretely: a charter product published without times is
 * silently classified as course-options, and a guest who booked a fixed
 * itinerary is asked to pick a route that does not exist. Or the reverse — the
 * Jeju charter drops out of the classification and the original 2026-07-27
 * report ("코스 네 개가 관광지 네 곳으로 들어앉는다") is back, with every unit
 * test still green.
 *
 * Usage:  npx tsx scripts/qa-course-classification.ts
 * Exit:   0 = the set matches · 1 = drift · 2 = could not ask (never a silent 0)
 */
import { createClient } from '@supabase/supabase-js';
import {
  classificationDrift,
  classifyProduct,
  describeDrift,
  EXPECTED_COURSE_OPTION_SLUGS,
  type ClassifiedProduct,
} from '../lib/tour-room/courseClassification';
import type { ItineraryStop } from '../components/product-tour-static/_shared/tourProductDetailSectionTypes';

async function main(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // 🔴 exit 2, never 0. `qa-admin-cjk` used to report "0 issues" when it could
    // not authenticate, which is indistinguishable from a clean run and is how a
    // broken gate becomes a trusted one.
    console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — cannot check');
    return 2;
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('tour_product_pages')
    .select('slug, locale, detail_payload')
    .eq('locale', 'en');

  if (error) {
    console.error('query failed:', error.message);
    return 2;
  }

  const rows = (data ?? []) as Array<{ slug: string; detail_payload: { itineraryStops?: ItineraryStop[] } | null }>;
  if (rows.length === 0) {
    console.error('no product pages returned — refusing to call that "no drift"');
    return 2;
  }

  const classified: ClassifiedProduct[] = rows.map((row) =>
    classifyProduct(row.slug, Array.isArray(row.detail_payload?.itineraryStops)
      ? (row.detail_payload!.itineraryStops as ItineraryStop[])
      : []),
  );

  const courses = classified.filter((c) => c.isCourseOptions);
  console.log(`checked ${classified.length} live products (locale=en)\n`);
  console.log('classified as COURSE OPTIONS:');
  for (const c of courses.sort((a, b) => a.slug.localeCompare(b.slug))) {
    console.log(`  ${c.slug}  (${c.stops} stops, time ${c.withTime}, duration ${c.withDuration})`);
  }
  if (courses.length === 0) console.log('  (none)');

  // The near-misses are the interesting part: a fixed product whose times are
  // the ONLY thing keeping it out of the course bucket is one careless edit away.
  const fragile = classified.filter(
    (c) => !c.isCourseOptions && c.stops >= 2 && c.withTime + c.withDuration <= 1,
  );
  if (fragile.length) {
    console.log('\none edit away from reclassification (stops >= 2, almost no time/duration):');
    for (const c of fragile) {
      console.log(`  ${c.slug}  (${c.stops} stops, time ${c.withTime}, duration ${c.withDuration})`);
    }
  }

  const drift = classificationDrift(classified);
  const problems = describeDrift(drift);
  if (problems.length === 0) {
    console.log(`\nno drift — set matches EXPECTED_COURSE_OPTION_SLUGS (${EXPECTED_COURSE_OPTION_SLUGS.length})`);
    return 0;
  }
  console.log('\n🔴 DRIFT:');
  for (const line of problems) console.log(`  - ${line}`);
  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  });
