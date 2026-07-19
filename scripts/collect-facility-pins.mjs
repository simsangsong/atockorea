#!/usr/bin/env node
/**
 * W3 — auto-collect restroom pins for attractions (facility-pins track).
 * Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md §F-2.
 *
 * For each is_attraction POI (optionally filtered to a pilot region), query
 * Google Places Nearby Search for nearby public restrooms and upsert the
 * closest few into poi_facility_pins as source='places_auto', is_verified=false.
 * A human then reviews/corrects them in /admin/facility-pins (which promotes
 * them to verified). Idempotent: existing place_ids are skipped, so re-runs add
 * only genuinely new restrooms and never clobber human corrections.
 *
 * ⚠️ Korea's Places "toilet" coverage is uneven — treat the output as a review
 * queue, not ground truth (that's why is_verified starts false).
 *
 * Usage:
 *   node --env-file=.env.local scripts/collect-facility-pins.mjs [--region=Jeju] [--limit=20] [--dry]
 */
import { createClient } from '@supabase/supabase-js';

const KIND = 'restroom';
const MAX_PER_POI = 3;
const MAX_RADIUS_M = 350; // rankby=distance can return far hits; cap them
const PLACES_DELAY_MS = 150; // gentle pacing for the Places QPS
// Korean keyword lands far better than the (unsupported) legacy `type=toilet`.
const KEYWORD = '화장실';

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}
const DRY = process.argv.includes('--dry');
const REGION = arg('region');
const LIMIT = arg('limit') ? Number(arg('limit')) : null;

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

async function nearbyRestrooms(lat, lng, apiKey) {
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}` +
    `&rankby=distance&keyword=${encodeURIComponent(KEYWORD)}&language=ko&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    console.warn(`  Places status=${json.status} ${json.error_message || ''}`);
    return [];
  }
  return (json.results || [])
    .map((r) => ({
      place_id: r.place_id,
      name: r.name,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    }))
    .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number' && r.place_id);
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey) throw new Error('Missing GOOGLE_MAPS_SERVER_API_KEY / GOOGLE_MAPS_API_KEY');
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
      `${REGION ? ` in ${REGION}` : ''}${DRY ? ' [DRY RUN]' : ''}\n`,
  );

  let inserted = 0;
  let skipped = 0;
  for (const poi of targets) {
    const pLat = Number(poi.lat);
    const pLng = Number(poi.lng);
    const candidates = await nearbyRestrooms(pLat, pLng, apiKey);
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
