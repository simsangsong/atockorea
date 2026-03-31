#!/usr/bin/env node

/**
 * FINAL 4 endpoint cache tests
 *
 * Purpose:
 * - isolate endpoint persistent-cache behavior from itinerary reuse noise
 * - keep the same signature within a pair
 * - change signature across cases
 * - jitter endpoint coordinates per script run so old endpoint cache rows are less likely to interfere
 *
 * Recommended usage:
 *   npm run dev
 *   node __itinerary_final_four_endpoint_cache_tests.mjs
 *
 * Optional env:
 *   ITINERARY_API_URL=http://localhost:3000/api/itinerary/generate
 *   ITINERARY_BEARER_TOKEN=...
 *   FORCE_FRESH=1                 // sets debugNoReuse:true (honored only when server NODE_ENV=development)
 *   SAVE_RAW=1                    // saves raw request/response JSON files
 *   REQUEST_DELAY_MS=250          // delay between calls
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL =
  process.env.ITINERARY_API_URL || 'http://localhost:3000/api/itinerary/generate';

const BEARER_TOKEN = process.env.ITINERARY_BEARER_TOKEN || '';
const FORCE_FRESH = process.env.FORCE_FRESH === '1';
const SAVE_RAW = process.env.SAVE_RAW === '1';
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 250);

const RUN_ID = makeRunId();
const OUT_DIR = path.join(process.cwd(), '.tmp', 'itinerary-final-four', RUN_ID);

// Base coordinates near Jeju City / Lotte City Hotel area.
const BASE_HOTEL = {
  lat: 33.490517,
  lng: 126.486491,
  regionGroup: 'jeju_city',
  kind: 'hotel',
  label: 'Fresh test hotel base',
};

const BASE_AIRPORT = {
  lat: 33.507078,
  lng: 126.493431,
  regionGroup: 'jeju_city',
  kind: 'airport',
  label: 'Fresh test airport base',
};

main().catch((err) => {
  console.error('\n[final-four] fatal error');
  console.error(err);
  process.exit(1);
});

async function main() {
  console.log(`[final-four] RUN_ID=${RUN_ID}`);
  console.log(`[final-four] API_URL=${API_URL}`);
  console.log(`[final-four] FORCE_FRESH=${FORCE_FRESH}`);

  if (SAVE_RAW) {
    await fs.mkdir(OUT_DIR, { recursive: true });
  }

  const nonceBase = buildNonceBase();

  const case1 = await runCaseSameHotelTwice({
    caseName: 'CASE1_same_hotel_twice',
    signatureNonce: nonceBase + 11,
    coordNonce: nonceBase + 101,
  });

  const case2 = await runCaseSameCoordsLabelChanged({
    caseName: 'CASE2_same_coords_label_changed',
    signatureNonce: nonceBase + 22,
    coordNonce: nonceBase + 202,
  });

  const case3 = await runCaseReusedPathStillUsesEndpointCache({
    caseName: 'CASE3_reused_path_endpoint_cache',
    signatureNonce: nonceBase + 33,
    coordNonce: nonceBase + 303,
  });

  const case4 = await runCaseRegionOnlyNoExactCacheWrite({
    caseName: 'CASE4_region_only_no_write',
    signatureNonce: nonceBase + 44,
  });

  const summaryRows = [
    summarizeCase1(case1),
    summarizeCase2(case2),
    summarizeCase3(case3),
    summarizeCase4(case4),
  ];

  console.log('\n=== FINAL 4 SUMMARY ===');
  console.table(summaryRows);

  console.log('\n=== PASS/FAIL DETAIL ===');
  for (const row of summaryRows) {
    console.log(`${row.case}: ${row.pass ? 'PASS' : 'FAIL'} — ${row.note}`);
  }

  console.log('\n=== RAW SNAPSHOT PATH ===');
  console.log(SAVE_RAW ? OUT_DIR : '(SAVE_RAW=1 not set)');
}

/* -------------------------------------------------------------------------- */
/*                                   CASES                                    */
/* -------------------------------------------------------------------------- */

async function runCaseSameHotelTwice({ caseName, signatureNonce, coordNonce }) {
  const coords = buildUniqueCoords(BASE_HOTEL, coordNonce);

  const body = buildBody({
    signatureNonce,
    startLocation: {
      ...coords,
      label: `${caseName} hotel`,
      kind: 'hotel',
      regionGroup: coords.regionGroup,
    },
    endLocation: {
      ...coords,
      label: `${caseName} hotel return`,
      kind: 'hotel',
      regionGroup: coords.regionGroup,
    },
    includeReturnToEndLocation: true,
    notesSuffix: `${caseName} baseline`,
  });

  const call1 = await callApi(`${caseName}_call1`, body);
  await sleep(REQUEST_DELAY_MS);
  const call2 = await callApi(`${caseName}_call2`, body);

  return { caseName, call1, call2, body };
}

async function runCaseSameCoordsLabelChanged({ caseName, signatureNonce, coordNonce }) {
  const coords = buildUniqueCoords(BASE_HOTEL, coordNonce);

  const body1 = buildBody({
    signatureNonce,
    startLocation: {
      ...coords,
      label: `${caseName} alpha label`,
      kind: 'hotel',
      regionGroup: coords.regionGroup,
    },
    endLocation: {
      ...coords,
      label: `${caseName} alpha label return`,
      kind: 'hotel',
      regionGroup: coords.regionGroup,
    },
    includeReturnToEndLocation: true,
    notesSuffix: `${caseName} alpha`,
  });

  const body2 = buildBody({
    signatureNonce,
    startLocation: {
      ...coords,
      label: `${caseName} beta label changed only`,
      kind: 'custom',
      regionGroup: coords.regionGroup,
    },
    endLocation: {
      ...coords,
      label: `${caseName} beta return changed only`,
      kind: 'custom',
      regionGroup: coords.regionGroup,
    },
    includeReturnToEndLocation: true,
    notesSuffix: `${caseName} beta`,
  });

  const call1 = await callApi(`${caseName}_call1`, body1);
  await sleep(REQUEST_DELAY_MS);
  const call2 = await callApi(`${caseName}_call2`, body2);

  return { caseName, call1, call2, body1, body2 };
}

async function runCaseReusedPathStillUsesEndpointCache({
  caseName,
  signatureNonce,
  coordNonce,
}) {
  const startCoords = buildUniqueCoords(BASE_HOTEL, coordNonce);
  const endCoords = buildUniqueCoords(BASE_AIRPORT, coordNonce + 17);

  const body = buildBody({
    signatureNonce,
    startLocation: {
      ...startCoords,
      label: `${caseName} hotel`,
      kind: 'hotel',
      regionGroup: startCoords.regionGroup,
    },
    endLocation: {
      ...endCoords,
      label: `${caseName} airport`,
      kind: 'airport',
      regionGroup: endCoords.regionGroup,
    },
    includeReturnToEndLocation: true,
    notesSuffix: `${caseName} reuse warmup`,
    // Case 3 must exercise reuse; do not send debugNoReuse
    debugNoReuse: false,
  });

  const warm1 = await callApi(`${caseName}_warm1`, body);
  await sleep(REQUEST_DELAY_MS);

  const warm2 = await callApi(`${caseName}_warm2`, body);

  return { caseName, warm1, warm2, body };
}

async function runCaseRegionOnlyNoExactCacheWrite({ caseName, signatureNonce }) {
  const body = buildBody({
    signatureNonce,
    startLocation: {
      kind: 'hotel',
      regionGroup: 'east',
      label: `${caseName} region only`,
    },
    endLocation: {
      kind: 'hotel',
      regionGroup: 'east',
      label: `${caseName} region only return`,
    },
    includeReturnToEndLocation: true,
    notesSuffix: `${caseName} region only`,
  });

  const call1 = await callApi(`${caseName}_call1`, body);
  return { caseName, call1, body };
}

/* -------------------------------------------------------------------------- */
/*                                 ASSERTIONS                                 */
/* -------------------------------------------------------------------------- */

function summarizeCase1(result) {
  const m1 = result.call1.metrics;
  const m2 = result.call2.metrics;

  const call1Fresh =
    asBool(m1.reusedItinerary) === false || m1.reuseSource === 'fresh';
  const call1DidWork =
    num(m1.assemblyEndpointLiveRefreshes) > 0 ||
    num(m1.assemblyEndpointEstimateFallbacks) > 0 ||
    num(m1.assemblyEndpointCacheWrites) > 0 ||
    num(m1.assemblyEndpointCacheFreshHits) > 0;
  const call2Hit = num(m2.assemblyEndpointCacheFreshHits) > 0;

  return {
    case: result.caseName,
    pass: call1Fresh && call1DidWork && call2Hit,
    note: `call1 reuse=${fmt(m1.reuseSource)} fresh=${fmtBool(call1Fresh)} work=${fmtBool(
      call1DidWork,
    )}; call2 freshHits=${num(m2.assemblyEndpointCacheFreshHits)}`,
  };
}

function summarizeCase2(result) {
  const m2 = result.call2.metrics;
  const hit = num(m2.assemblyEndpointCacheFreshHits) > 0;

  return {
    case: result.caseName,
    pass: hit,
    note: `same coords + label/kind changed only -> call2 freshHits=${num(
      m2.assemblyEndpointCacheFreshHits,
    )}`,
  };
}

function summarizeCase3(result) {
  const m2 = result.warm2.metrics;
  const reused =
    asBool(m2.reusedItinerary) === true ||
    ['run', 'template'].includes(String(m2.reuseSource || ''));
  const isolated = asBool(m2.finalTravelStatsIsolated) === true;
  const cacheUsed =
    num(m2.assemblyEndpointCacheFreshHits) > 0 ||
    num(m2.assemblyEndpointCacheWrites) > 0 ||
    num(m2.assemblyEndpointLiveRefreshes) > 0;

  return {
    case: result.caseName,
    pass: reused && isolated && cacheUsed,
    note: `warm2 reuse=${fmt(m2.reuseSource)} reused=${fmtBool(reused)} isolated=${fmtBool(
      isolated,
    )} endpointFreshHits=${num(m2.assemblyEndpointCacheFreshHits)}`,
  };
}

function summarizeCase4(result) {
  const m1 = result.call1.metrics;
  const noWrites = num(m1.assemblyEndpointCacheWrites) === 0;
  const regionFallback = num(m1.assemblyRegionFallbacks) > 0;

  return {
    case: result.caseName,
    pass: noWrites && regionFallback,
    note: `region-only writes=${num(m1.assemblyEndpointCacheWrites)} regionFallbacks=${num(
      m1.assemblyRegionFallbacks,
    )}`,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  REQUESTS                                  */
/* -------------------------------------------------------------------------- */

function buildBody({
  signatureNonce,
  startLocation,
  endLocation,
  includeReturnToEndLocation,
  notesSuffix,
  debugNoReuse: debugNoReuseOverride,
}) {
  const sig = buildSignatureOverrides(signatureNonce);

  const useFresh =
    debugNoReuseOverride !== undefined ? debugNoReuseOverride : FORCE_FRESH ? true : false;

  const body = {
    destination: 'Jeju',
    durationDays: 1,
    availableHours: 8,
    locale: 'ko',
    travelStyle: `제주 1일 일정 테스트입니다. 이동은 너무 길지 않게, 사진도 잘 나오고 무난한 첫 방문 코스. ${notesSuffix}`,
    theme: `FINAL_FOUR endpoint-cache ${RUN_ID} nonce ${signatureNonce}`,
    seniors: sig.withSeniors,
    withChildren: sig.withChildren,
    indoorOutdoor: 'any',

    regionPreference: sig.regionPreference,
    maxWalkingLevel: sig.maxWalkingLevel,
    ageBand: sig.ageBand,

    quickPhotoMode: sig.quickPhotoMode,
    firstVisit: sig.firstVisit,
    needIndoorIfRain: sig.needIndoorIfRain,
    longDriveTolerance: sig.longDriveTolerance,

    iconicSpotPriority: sig.iconicSpotPriority,
    hiddenGemPriority: sig.hiddenGemPriority,
    naturePriority: sig.naturePriority,
    culturePriority: sig.culturePriority,
    foodPriority: sig.foodPriority,
    cafePriority: sig.cafePriority,
    shoppingPriority: sig.shoppingPriority,

    departureAt: buildDepartureAt(),

    startLocation,
    endLocation,
    includeReturnToEndLocation,

    debugNoReuse: useFresh ? true : undefined,
  };

  return stripUndefinedDeep(body);
}

function buildSignatureOverrides(signatureNonce) {
  const n = Math.abs(signatureNonce);

  return {
    regionPreference: ['east', 'west', 'south', 'jeju_city'][n % 4],
    withSeniors: false,
    withChildren: false,
    ageBand: n % 2 === 0 ? '30s_40s' : '40s_50s',
    maxWalkingLevel: ['easy', 'moderate'][n % 2],
    quickPhotoMode: ((n >> 1) & 1) === 1,
    firstVisit: ((n >> 2) & 1) === 1,
    needIndoorIfRain: false,
    longDriveTolerance: 1 + (n % 5),
    iconicSpotPriority: 1 + (n % 5),
    hiddenGemPriority: 1 + ((n >> 1) % 5),
    naturePriority: 1 + ((n >> 2) % 5),
    culturePriority: 1 + ((n >> 3) % 5),
    foodPriority: 1 + ((n >> 4) % 5),
    cafePriority: 1 + ((n >> 5) % 5),
    shoppingPriority: (n >> 6) % 5,
  };
}

async function callApi(label, body) {
  const startedAt = Date.now();

  if (SAVE_RAW) {
    await writeJson(`${label}.request.json`, body);
  }

  const headers = {
    'content-type': 'application/json',
  };
  if (BEARER_TOKEN) headers.authorization = `Bearer ${BEARER_TOKEN}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    json = { __rawText: text, __parseError: String(err) };
  }

  if (SAVE_RAW) {
    await writeJson(`${label}.response.json`, {
      status: res.status,
      ok: res.ok,
      body: json,
    });
  }

  const metrics = extractMetrics(json);
  const out = {
    label,
    status: res.status,
    ok: res.ok,
    elapsedMs: Date.now() - startedAt,
    metrics,
    body: json,
  };

  console.log(`\n[${label}] status=${res.status} ok=${res.ok} elapsedMs=${out.elapsedMs}`);
  console.table([
    {
      reusedItinerary: metrics.reusedItinerary,
      reuseSource: metrics.reuseSource,
      finalTravelStatsIsolated: metrics.finalTravelStatsIsolated,
      endpointAwarePolishUsed: metrics.endpointAwarePolishUsed,
      assemblyEndpointCacheFreshHits: metrics.assemblyEndpointCacheFreshHits,
      assemblyEndpointCacheWrites: metrics.assemblyEndpointCacheWrites,
      assemblyEndpointLiveRefreshes: metrics.assemblyEndpointLiveRefreshes,
      assemblyEndpointEstimateFallbacks: metrics.assemblyEndpointEstimateFallbacks,
      assemblyRegionFallbacks: metrics.assemblyRegionFallbacks,
    },
  ]);

  return out;
}

/* -------------------------------------------------------------------------- */
/*                                 EXTRACTION                                 */
/* -------------------------------------------------------------------------- */

function extractMetrics(payload) {
  const gm =
    payload && typeof payload === 'object' && payload.generationMeta && typeof payload.generationMeta === 'object'
      ? payload.generationMeta
      : null;
  const vmRoot = gm?.validationMeta ?? payload;

  return {
    geminiModel: findFirstKey(payload, ['geminiModel', 'model', 'deterministicMode']),
    reusedItinerary: gm?.reusedItinerary ?? findFirstKey(payload, ['reusedItinerary']),
    reuseSource: gm?.reuseSource ?? findFirstKey(payload, ['reuseSource']),
    reusedRunId: gm?.reusedRunId ?? findFirstKey(payload, ['reusedRunId']),
    reusedTemplateId: gm?.reusedTemplateId ?? findFirstKey(payload, ['reusedTemplateId']),
    reuseSimilarityScore: gm?.reuseSimilarityScore ?? findFirstKey(payload, ['reuseSimilarityScore']),
    finalTravelStatsIsolated: findFirstKey(vmRoot, ['finalTravelStatsIsolated']),
    endpointAwarePolishUsed: findFirstKey(vmRoot, ['endpointAwarePolishUsed']),

    assemblyEndpointCacheFreshHits: findFirstKey(vmRoot, ['assemblyEndpointCacheFreshHits']),
    assemblyEndpointCacheStaleHits: findFirstKey(vmRoot, ['assemblyEndpointCacheStaleHits']),
    assemblyEndpointCacheWrites: findFirstKey(vmRoot, ['assemblyEndpointCacheWrites']),
    assemblyEndpointLiveRefreshes: findFirstKey(vmRoot, [
      'assemblyEndpointLiveRefreshes',
      'assemblyEndpointLiveRefreshCount',
    ]),
    assemblyEndpointEstimateFallbacks: findFirstKey(vmRoot, [
      'assemblyEndpointEstimateFallbacks',
      'assemblyEndpointEstimatedFallbacks',
    ]),
    assemblyRegionFallbacks: findFirstKey(vmRoot, ['assemblyRegionFallbacks', 'regionFallbacks']),
  };
}

function findFirstKey(root, keys) {
  if (!root || typeof root !== 'object') return undefined;
  const queue = [root];
  const seen = new Set();

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object') continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(cur, key)) {
        return cur[key];
      }
    }

    for (const value of Object.values(cur)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return undefined;
}

/* -------------------------------------------------------------------------- */
/*                                   UTILS                                    */
/* -------------------------------------------------------------------------- */

function buildUniqueCoords(base, nonce) {
  const latOffset = ((nonce % 7) + 1) * 0.00021 + ((nonce >> 3) % 5) * 0.00003;
  const lngOffset = ((nonce % 5) + 1) * 0.00019 + ((nonce >> 2) % 7) * 0.00002;

  return {
    lat: round6(base.lat + latOffset),
    lng: round6(base.lng + lngOffset),
    regionGroup: base.regionGroup,
  };
}

function buildDepartureAt() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  d.setUTCHours(2, 30, 0, 0);
  return d.toISOString();
}

function buildNonceBase() {
  const now = Date.now();
  return Math.abs((now % 997) + Number(String(now).slice(-3)));
}

function makeRunId() {
  const d = new Date();
  return (
    d.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '_' + Math.random().toString(36).slice(2, 8)
  );
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function asBool(v) {
  return v === true;
}

function fmt(v) {
  return v == null ? 'null' : String(v);
}

function fmtBool(v) {
  return v ? 'true' : 'false';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out;
  }
  return value;
}

async function writeJson(filename, data) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
}
