/**
 * Pressure probe for the dining collection funnel (§5.7 R-3).
 *
 * Counts survivors at every stage for one coordinate so we can see WHERE the
 * candidates are lost, instead of guessing from the final row count.
 *
 *   node --env-file=.env.local --import tsx scripts/probe-dining-funnel.ts <lat> <lng> [radius]
 */
import { kakaoCategorySearch } from '@/lib/ops/dining/kakao.server';
import { googleNearbyRestaurants } from '@/lib/ops/dining/google.server';
import { mergeKakaoGoogle } from '@/lib/ops/dining/merge.server';
import { qualityFilter } from '@/lib/ops/dining/places';

const lat = Number(process.argv[2] ?? 33.45806);
const lng = Number(process.argv[3] ?? 126.9425);
const radiusM = Number(process.argv[4] ?? 1500);

async function main() {
  console.log(`probe @ ${lat},${lng} r=${radiusM}m\n`);

  const fd6 = await kakaoCategorySearch({ lat, lng, radiusM, group: 'FD6' });
  const ce7 = await kakaoCategorySearch({ lat, lng, radiusM, group: 'CE7' });
  const kakaoDocs = [...fd6, ...ce7];
  console.log(`① kakao   FD6=${fd6.length} CE7=${ce7.length} → ${kakaoDocs.length} docs`);

  const google = await googleNearbyRestaurants({ lat, lng, radiusM });
  const rated = google.filter((g) => typeof g.rating === 'number');
  console.log(`② google  ${google.length} places (${rated.length} with a rating)`);

  const merged = mergeKakaoGoogle(kakaoDocs, google, { centerLat: lat, centerLng: lng });
  const withRating = merged.filter((m) => typeof m.rating === 'number');
  console.log(`③ merge   ${merged.length} rows (${withRating.length} carry a google rating)`);
  console.log(`   → google places DROPPED for want of a kakao match: ${google.length - withRating.length}`);

  const filtered = qualityFilter(merged);
  console.log(`④ quality ${filtered.places.length} survive (unrated-fallback=${filtered.unrated})`);

  console.log('\n--- survivors ---');
  for (const p of filtered.places.slice(0, 10)) {
    console.log(`  ${p.name}  ★${p.rating ?? '-'}/${p.review_count ?? '-'}  ${p.cuisine ?? ''}`);
  }

  console.log('\n--- google places with a rating that found NO kakao twin (first 10) ---');
  const mergedGoogleIds = new Set(merged.map((m) => m.google_place_id).filter(Boolean));
  const orphans = rated.filter((g) => !mergedGoogleIds.has(g.id));
  for (const g of orphans.slice(0, 10)) {
    // `displayName` is already flattened to a string by normalizeGooglePlace —
    // reading `.text` off it yielded undefined and printed the opaque place id.
    console.log(`  ${g.displayName ?? g.id}  ★${g.rating}/${g.userRatingCount ?? '-'}`);
  }
  console.log(`  (total orphaned: ${orphans.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
