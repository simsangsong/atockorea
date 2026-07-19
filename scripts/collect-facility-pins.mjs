#!/usr/bin/env node
/**
 * W3 — auto-collect restroom pins for attractions (facility-pins track).
 * Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md §F-2.
 *
 * For each is_attraction POI (optionally filtered to a pilot region), query a
 * map provider for nearby public restrooms and insert the closest few into
 * poi_facility_pins as source='places_auto', is_verified=false. A human then
 * reviews/corrects them in /admin/facility-pins (which promotes them to
 * verified). Idempotent: existing place_ids are skipped, so re-runs add only
 * genuinely new restrooms and never clobber human corrections.
 *
 * Providers (--provider=):
 *   google (default) — Places API (New) searchText + includedType=public_bathroom.
 *                      High precision, but sparse recall for Korean restrooms.
 *   kakao            — Kakao Local keyword search. Far denser Korean coverage;
 *                      needs KAKAO_REST_API_KEY. ⚠️ ToS gate: showing Kakao POI
 *                      data on a non-Kakao (Google) map may breach Kakao's terms.
 *
 * ⚠️ Coverage is uneven either way — treat the output as a review queue, not
 * ground truth (that's why is_verified starts false).
 *
 * Usage:
 *   node --env-file=.env.local scripts/collect-facility-pins.mjs [--provider=kakao] [--region=jeju] [--limit=20] [--dry]
 */
import { createClient } from '@supabase/supabase-js';

const KIND = 'restroom';
const MAX_PER_POI = 3;
const PLACES_DELAY_MS = 150; // gentle pacing for the provider QPS
// Korean keyword lands far better than the (unsupported) legacy `type=toilet`.
const KEYWORD = '화장실';

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}
const DRY = process.argv.includes('--dry');
const REGION = arg('region');
const LIMIT = arg('limit') ? Number(arg('limit')) : null;
const PROVIDER = arg('provider', 'google'); // 'google' (Places API New) | 'kakao' (Local keyword)
const MAX_RADIUS_M = arg('radius') ? Number(arg('radius')) : 350; // search + cap radius (m)

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

// Places API (New) Text Search — the legacy nearbysearch is disabled on this
// GCP project. Text search with a location bias is robust and needs no special
// "toilet" type (which the legacy API lacked anyway).
async function nearbyRestrooms(lat, lng, apiKey) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
    },
    body: JSON.stringify({
      textQuery: KEYWORD,
      // Constrain to actual restroom places (New Places API type) — cuts the
      // text-search false positives (restaurants/cafés that merely mention 화장실).
      includedType: 'public_bathroom',
      languageCode: 'ko',
      maxResultCount: 10,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: MAX_RADIUS_M },
      },
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
      name: p.displayName?.text || '화장실',
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    }))
    .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number' && r.place_id);
}

// Kakao Local — keyword search. Korea's map data has far denser public-restroom
// coverage than Google here. Coordinates come back as WGS84 x(lng)/y(lat), so
// they plot on the same Google Static map with no conversion.
// ⚠️ ToS: displaying Kakao-sourced POI data on a non-Kakao map may breach Kakao's
// terms — that's a human/legal gate (this provider is opt-in via --provider=kakao).
async function kakaoRestrooms(lat, lng, restKey) {
  const url =
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(KEYWORD)}` +
    `&y=${lat}&x=${lng}&radius=${MAX_RADIUS_M}&sort=distance&size=15`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`  Kakao ${res.status}: ${body.slice(0, 140)}`);
    return [];
  }
  const json = await res.json();
  return (json.documents || [])
    // Keep only places actually named 화장실 (drops cafés/shops that merely rank
    // for the keyword) — the review pass in /admin/facility-pins catches the rest.
    .filter((d) => String(d.place_name || '').includes('화장실'))
    .map((d) => ({
      place_id: `kakao:${d.id}`, // namespaced so it never collides with a Google place id
      name: d.place_name,
      lat: Number(d.y),
      lng: Number(d.x),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.place_id);
}

/** Provider dispatch. */
function findRestrooms(lat, lng, keys) {
  return PROVIDER === 'kakao'
    ? kakaoRestrooms(lat, lng, keys.kakao)
    : nearbyRestrooms(lat, lng, keys.google);
}

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
  if (PROVIDER === 'kakao' && !keys.kakao) {
    throw new Error('Missing KAKAO_REST_API_KEY (get a REST key at developers.kakao.com)');
  }
  if (PROVIDER === 'google' && !keys.google) {
    throw new Error('Missing GOOGLE_MAPS_SERVER_API_KEY / GOOGLE_MAPS_API_KEY');
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let q = sb
    .from('match_pois')
    .select('poi_key, name_en, name_ko, region, lat, lng')
    .eq('is_attraction', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('poi_key');
  if (REGION) q = q.eq('region', REGION);
  const { data: pois, error } = await q;
  if (error) throw error;

  const targets = LIMIT ? pois.slice(0, LIMIT) : pois;
  console.log(
    `Collecting restrooms for ${targets.length} attraction(s)` +
      `${REGION ? ` in ${REGION}` : ''} via ${PROVIDER}${DRY ? ' [DRY RUN]' : ''}\n`,
  );

  let inserted = 0;
  let skipped = 0;
  for (const poi of targets) {
    const pLat = Number(poi.lat);
    const pLng = Number(poi.lng);
    const candidates = await findRestrooms(pLat, pLng, keys);
    await sleep(PLACES_DELAY_MS);

    const near = candidates
      .map((c) => ({ ...c, distance_m: Math.round(haversineM(pLat, pLng, c.lat, c.lng)) }))
      .filter((c) => c.distance_m <= MAX_RADIUS_M)
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, MAX_PER_POI);

    // Idempotency: skip place_ids that already exist for this POI+kind (any
    // source) so re-runs never duplicate or clobber human-corrected rows.
    const { data: existing } = await sb
      .from('poi_facility_pins')
      .select('place_id')
      .eq('poi_key', poi.poi_key)
      .eq('kind', KIND);
    const seen = new Set((existing || []).map((r) => r.place_id).filter(Boolean));

    const fresh = near.filter((c) => !seen.has(c.place_id));
    const label = poi.name_ko || poi.name_en || poi.poi_key;
    if (fresh.length === 0) {
      console.log(`· ${label}: ${near.length} nearby, none new`);
      skipped += near.length;
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
      is_verified: false,
      is_active: true,
      sort_order: i,
    }));

    if (DRY) {
      console.log(`+ ${label}: would add ${rows.length} — ${rows.map((r) => `${r.name}(${r.distance_m}m)`).join(', ')}`);
      inserted += rows.length;
      continue;
    }
    const { error: insErr } = await sb.from('poi_facility_pins').insert(rows);
    if (insErr) {
      console.warn(`! ${label}: insert failed — ${insErr.message}`);
      continue;
    }
    console.log(`+ ${label}: added ${rows.length} — ${rows.map((r) => `${r.name}(${r.distance_m}m)`).join(', ')}`);
    inserted += rows.length;
  }

  console.log(`\nDone. ${DRY ? 'Would add' : 'Added'} ${inserted} pin(s); ${skipped} already present.`);
  console.log('Review & correct in /admin/facility-pins → corrections promote them to verified.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
