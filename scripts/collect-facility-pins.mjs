#!/usr/bin/env node
/**
 * Auto-collect POI-scoped map pins (facility-pins track).
 * Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md.
 *
 * For each POI, query a map provider for nearby places of a given --kind and
 * insert them into poi_facility_pins as source='places_auto', is_verified=false.
 * A human reviews/corrects them in /admin/facility-pins (which promotes them to
 * verified). Idempotent: existing place_ids are skipped, so re-runs add only new
 * places and never clobber human corrections.
 *
 * --kind=restroom (default):
 *   kakao (recommended) — Kakao Local keyword "화장실"; densest Korean coverage.
 *   google              — Places API (New) searchText + includedType=public_bathroom.
 *   Ranked nearest-first.
 *
 * --kind=restaurant:
 *   Always Google Places (New) searchNearby (Kakao Local has no rating). Filters
 *   to rating>=--minRating and reviews>=--minReviews, ranks by rating × log(reviews)
 *   — "많은 리뷰 + 높은 평점" first. Stores rating + review_count.
 *
 * ⚠️ Coverage is uneven — treat output as a review queue, not ground truth.
 * ⚠️ Kakao ToS: showing Kakao POI data on a non-Kakao map may breach Kakao's terms.
 *
 * Usage:
 *   node --env-file=.env.local scripts/collect-facility-pins.mjs \
 *     [--kind=restaurant] [--provider=kakao] [--region=jeju] [--all-pois] \
 *     [--radius=600] [--max=3] [--minRating=4.0] [--minReviews=50] [--limit=20] [--dry]
 */
import { createClient } from '@supabase/supabase-js';

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}
const DRY = process.argv.includes('--dry');
const ALL_POIS = process.argv.includes('--all-pois');
const REGION = arg('region');
const LIMIT = arg('limit') ? Number(arg('limit')) : null;
const KIND = arg('kind', 'restroom'); // 'restroom' | 'restaurant'
// Restaurants need ratings → always Google; restrooms honor --provider (default google).
const PROVIDER = KIND === 'restaurant' ? 'google' : arg('provider', 'google');
const MAX_RADIUS_M = arg('radius') ? Number(arg('radius')) : KIND === 'restaurant' ? 800 : 350;
const MAX_PER_POI = arg('max') ? Number(arg('max')) : 3;
const MIN_RATING = arg('minRating') ? Number(arg('minRating')) : 4.0;
const MIN_REVIEWS = arg('minReviews') ? Number(arg('minReviews')) : 50;
const DELAY_MS = 150; // gentle pacing for the provider QPS
const RESTROOM_KEYWORD = '화장실';

if (KIND !== 'restroom' && KIND !== 'restaurant') {
  throw new Error(`--kind must be restroom or restaurant (got ${KIND})`);
}

function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Providers ----------------------------------------------------------------

// Google Places (New) Text Search — restrooms (legacy nearbysearch is disabled).
async function googleRestrooms(lat, lng, apiKey) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
    },
    body: JSON.stringify({
      textQuery: RESTROOM_KEYWORD,
      includedType: 'public_bathroom',
      languageCode: 'ko',
      maxResultCount: 10,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: MAX_RADIUS_M } },
    }),
  });
  const json = await res.json();
  if (json.error) {
    console.warn(`  Places(New) ${json.error.status || res.status}: ${json.error.message || ''}`);
    return [];
  }
  return (json.places || [])
    .map((p) => ({ place_id: p.id, name: p.displayName?.text || '화장실', lat: p.location?.latitude, lng: p.location?.longitude }))
    .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number' && r.place_id);
}

// Kakao Local keyword search — restrooms. WGS84 coords plot on Google maps as-is.
async function kakaoRestrooms(lat, lng, restKey) {
  const url =
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(RESTROOM_KEYWORD)}` +
    `&y=${lat}&x=${lng}&radius=${MAX_RADIUS_M}&sort=distance&size=15`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`  Kakao ${res.status}: ${body.slice(0, 140)}`);
    return [];
  }
  const json = await res.json();
  return (json.documents || [])
    .filter((d) => String(d.place_name || '').includes('화장실'))
    .map((d) => ({ place_id: `kakao:${d.id}`, name: d.place_name, lat: Number(d.y), lng: Number(d.x) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.place_id);
}

// Google Places (New) Nearby Search — restaurants, with rating + review count.
async function googleRestaurants(lat, lng, apiKey) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
      languageCode: 'en', // English names for foreign guests where available
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: MAX_RADIUS_M } },
    }),
  });
  const json = await res.json();
  if (json.error) {
    console.warn(`  Places(New) ${json.error.status || res.status}: ${json.error.message || ''}`);
    return [];
  }
  return (json.places || [])
    .map((p) => ({
      place_id: p.id,
      name: p.displayName?.text || 'Restaurant',
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      rating: typeof p.rating === 'number' ? p.rating : null,
      review_count: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    }))
    .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number' && r.place_id);
}

function findCandidates(lat, lng, keys) {
  if (KIND === 'restaurant') return googleRestaurants(lat, lng, keys.google);
  return PROVIDER === 'kakao' ? kakaoRestrooms(lat, lng, keys.kakao) : googleRestrooms(lat, lng, keys.google);
}

/** "많은 리뷰 + 높은 평점": reward both a high rating and a large sample. */
function restaurantScore(c) {
  return (c.rating || 0) * Math.log10((c.review_count || 0) + 1);
}

/** Kind-specific ranking + cap over the distance-annotated candidates. */
function rankCandidates(withDist) {
  if (KIND === 'restaurant') {
    return withDist
      .filter((c) => (c.rating ?? 0) >= MIN_RATING && (c.review_count ?? 0) >= MIN_REVIEWS)
      .sort((a, b) => restaurantScore(b) - restaurantScore(a))
      .slice(0, MAX_PER_POI);
  }
  return withDist.sort((a, b) => a.distance_m - b.distance_m).slice(0, MAX_PER_POI);
}

// --- Main ---------------------------------------------------------------------

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  const keys = {
    google:
      process.env.GOOGLE_MAPS_SERVER_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    kakao: process.env.KAKAO_REST_API_KEY,
  };
  if (PROVIDER === 'kakao' && !keys.kakao) throw new Error('Missing KAKAO_REST_API_KEY (developers.kakao.com REST key)');
  if (PROVIDER === 'google' && !keys.google) throw new Error('Missing GOOGLE_MAPS_SERVER_API_KEY / GOOGLE_MAPS_API_KEY');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let q = sb
    .from('match_pois')
    .select('poi_key, name_en, name_ko, region, lat, lng')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('poi_key');
  if (!ALL_POIS) q = q.eq('is_attraction', true);
  if (REGION) q = q.eq('region', REGION);
  const { data: pois, error } = await q;
  if (error) throw error;

  const targets = LIMIT ? pois.slice(0, LIMIT) : pois;
  console.log(
    `Collecting ${KIND} for ${targets.length} POI(s)` +
      `${REGION ? ` in ${REGION}` : ALL_POIS ? ' (all POIs)' : ''} via ${PROVIDER} @${MAX_RADIUS_M}m${DRY ? ' [DRY RUN]' : ''}\n`,
  );

  let inserted = 0;
  let skipped = 0;
  for (const poi of targets) {
    const pLat = Number(poi.lat);
    const pLng = Number(poi.lng);
    const candidates = await findCandidates(pLat, pLng, keys);
    await sleep(DELAY_MS);

    const withDist = candidates
      .map((c) => ({ ...c, distance_m: Math.round(haversineM(pLat, pLng, c.lat, c.lng)) }))
      .filter((c) => c.distance_m <= MAX_RADIUS_M);
    const ranked = rankCandidates(withDist);

    // Idempotency: skip place_ids that already exist for this POI+kind.
    const { data: existing } = await sb
      .from('poi_facility_pins')
      .select('place_id')
      .eq('poi_key', poi.poi_key)
      .eq('kind', KIND);
    const seen = new Set((existing || []).map((r) => r.place_id).filter(Boolean));

    const fresh = ranked.filter((c) => !seen.has(c.place_id));
    const label = poi.name_ko || poi.name_en || poi.poi_key;
    const describe = (r) =>
      KIND === 'restaurant' ? `${r.name}(★${r.rating ?? '?'}·${r.review_count ?? 0})` : `${r.name}(${r.distance_m}m)`;

    if (fresh.length === 0) {
      console.log(`· ${label}: ${ranked.length} nearby, none new`);
      skipped += ranked.length;
      continue;
    }

    const rows = fresh.map((c, i) => ({
      poi_key: poi.poi_key,
      kind: KIND,
      lat: c.lat,
      lng: c.lng,
      name: c.name,
      source: 'places_auto',
      place_id: c.place_id,
      distance_m: c.distance_m,
      rating: c.rating ?? null,
      review_count: c.review_count ?? null,
      is_verified: false,
      is_active: true,
      sort_order: i,
    }));

    if (DRY) {
      console.log(`+ ${label}: would add ${rows.length} — ${fresh.map(describe).join(', ')}`);
      inserted += rows.length;
      continue;
    }
    const { error: insErr } = await sb.from('poi_facility_pins').insert(rows);
    if (insErr) {
      console.warn(`! ${label}: insert failed — ${insErr.message}`);
      continue;
    }
    console.log(`+ ${label}: added ${rows.length} — ${fresh.map(describe).join(', ')}`);
    inserted += rows.length;
  }

  console.log(`\nDone. ${DRY ? 'Would add' : 'Added'} ${inserted} ${KIND} pin(s); ${skipped} already present.`);
  console.log('Review & correct in /admin/facility-pins → corrections promote them to verified.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
