#!/usr/bin/env node
/**
 * Step 11 manual smoke T1–T9 against /api/itinerary/generate
 * Run: npm run dev  →  node __itinerary_endpoint_cache_t1_t9_smoke.mjs
 * Log: .tmp/endpoint-cache-t1-t9-<ts>.log
 *
 * Optional:
 *   FORCE_FRESH=1 — on T1/T2/T3/T7 only, sets debugNoReuse:true (dev server only) so run/template
 *   reuse does not mask persistent endpoint-cache metrics. Use when proving
 *   call1 write/live → call2 assemblyEndpointCacheFreshHits.
 */
import fs from 'node:fs';
import path from 'node:path';

const API_URL = process.env.ITINERARY_API_URL || 'http://localhost:3000/api/itinerary/generate';
const DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 500);
const FORCE_FRESH = process.env.FORCE_FRESH === '1';
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const LOG_PATH = path.join(process.cwd(), '.tmp', `endpoint-cache-t1-t9-${RUN_TS}.log`);
const lines = [];

function log(...args) {
  const s = args
    .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a, null, 0) : String(a)))
    .join(' ');
  console.log(s);
  lines.push(s);
}

function flushLog() {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, lines.join('\n'), 'utf8');
  console.log(`\n[smoke] log written: ${LOG_PATH}`);
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
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

function meta(json) {
  const gm = json?.generationMeta;
  const vm = gm?.validationMeta ?? {};
  return {
    error: json?.error ?? null,
    stopCount: json?.stops?.length ?? 0,
    reuseSource: gm?.reuseSource,
    reusedItinerary: gm?.reusedItinerary,
    assemblyEndpointCacheFreshHits: num(vm.assemblyEndpointCacheFreshHits),
    assemblyEndpointCacheStaleHits: num(vm.assemblyEndpointCacheStaleHits),
    assemblyEndpointCacheWrites: num(vm.assemblyEndpointCacheWrites),
    assemblyEndpointLiveRefreshes: num(vm.assemblyEndpointLiveRefreshes),
    assemblyEndpointEstimatedFallbacks: num(vm.assemblyEndpointEstimatedFallbacks),
    assemblyRegionFallbacks: num(vm.assemblyRegionFallbacks),
    assemblyFreshCacheHits: num(vm.assemblyFreshCacheHits),
    assemblyLiveRefreshes: num(vm.assemblyLiveRefreshes),
    finalTravelStatsIsolated: vm.finalTravelStatsIsolated === true,
  };
}

/** When FORCE_FRESH=1, use for T1/T2/T3/T7 only so T9 no-flag vs flag comparison stays valid. */
function applyForceFreshForEndpointCases(body) {
  if (!FORCE_FRESH) return body;
  return { ...body, debugNoReuse: true };
}

function buildBody(sigNonce, extra) {
  const n = Math.abs(sigNonce);
  return stripUndefinedDeep({
    destination: 'Jeju',
    durationDays: 1,
    availableHours: 8,
    locale: 'ko',
    travelStyle: `T1-T9 endpoint smoke ${RUN_TS} sig ${sigNonce}`,
    theme: `smoke-${sigNonce}-${n}`,
    seniors: false,
    withChildren: false,
    indoorOutdoor: 'any',
    regionPreference: ['east', 'west', 'south', 'jeju_city'][n % 4],
    maxWalkingLevel: 'easy',
    ageBand: '30s_40s',
    quickPhotoMode: false,
    firstVisit: true,
    longDriveTolerance: 3,
    iconicSpotPriority: 3,
    hiddenGemPriority: 3,
    naturePriority: 3,
    culturePriority: 3,
    foodPriority: 3,
    cafePriority: 3,
    shoppingPriority: 2,
    departureAt: new Date(Date.now() + 72 * 3600000).toISOString(),
    ...extra,
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function post(label, body) {
  const t0 = Date.now();
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { parseError: true, raw: text.slice(0, 400) };
  }
  log(`[${label}] status=${res.status} elapsedMs=${Date.now() - t0}`, meta(json));
  return { status: res.status, json };
}

async function main() {
  log('=== Step 11 endpoint cache smoke T1–T9 ===');
  log('API_URL=', API_URL);
  log('REQUEST_DELAY_MS=', DELAY_MS);
  log('FORCE_FRESH=', FORCE_FRESH, FORCE_FRESH ? '(T1/T2/T3/T7: debugNoReuse — dev only)' : '');
  log('startedAt=', new Date().toISOString());

  // Health
  try {
    const h = await fetch('http://localhost:3000/', { method: 'GET' });
    log('GET / health status=', h.status);
  } catch (e) {
    log('GET / failed — is npm run dev running?', String(e));
  }

  // --- T1: same start twice ---
  log('\n--- T1 same startLocation ×2 (expect 2nd: endpoint cache fresh hits) ---');
  const t1Start = {
    lat: 33.4722,
    lng: 126.9322,
    kind: 'hotel',
    regionGroup: '성산',
    label: 't1-smoke-hotel',
  };
  const b1 = applyForceFreshForEndpointCases(buildBody(1001, { startLocation: t1Start }));
  const t1a = await post('T1_call1', b1);
  await sleep(DELAY_MS);
  const t1b = await post('T1_call2_same_body', b1);
  log(
    'T1 note:',
    num(t1b.json?.generationMeta?.validationMeta?.assemblyEndpointCacheFreshHits) > 0
      ? 'OBSERVED freshHits on call2 (persistent cache likely hit)'
      : 'NO freshHits on call2 (check SUPABASE_SERVICE_ROLE_KEY + migration, or cold cache)',
  );

  // --- T2: return leg ---
  log('\n--- T2 endLocation + includeReturnToEndLocation (return leg uses poi_to_endpoint cache path) ---');
  const b2 = applyForceFreshForEndpointCases(
    buildBody(1002, {
      startLocation: { ...t1Start, label: 't2-start' },
      endLocation: {
        lat: 33.507078,
        lng: 126.493431,
        kind: 'airport',
        regionGroup: 'jeju_city',
        label: 't2-airport',
      },
      includeReturnToEndLocation: true,
    }),
  );
  const t2a = await post('T2_call1', b2);
  await sleep(DELAY_MS);
  await post('T2_call2', b2);

  // --- T3: label only change ---
  log('\n--- T3 same lat/lng, label/kind changed only ---');
  const b3a = applyForceFreshForEndpointCases(
    buildBody(1003, {
      startLocation: {
        lat: 33.461,
        lng: 126.91,
        kind: 'hotel',
        regionGroup: '성산',
        label: 'alpha-label',
      },
    }),
  );
  const b3b = applyForceFreshForEndpointCases(
    buildBody(1003, {
      startLocation: {
        lat: 33.461,
        lng: 126.91,
        kind: 'custom',
        regionGroup: '성산',
        label: 'beta-label-changed',
      },
    }),
  );
  await post('T3_call1', b3a);
  await sleep(DELAY_MS);
  await post('T3_call2_same_coords_diff_label', b3b);
  log('T3 note: endpoint_key is coord-only (v1|lat|lng); 2nd call may hit persistent cache.');

  // --- T4: tiny jitter (within 4dp rounding) ---
  log('\n--- T4 coordinate jitter within ~4dp ---');
  const b4a = buildBody(1004, {
    startLocation: {
      lat: 33.450001,
      lng: 126.920002,
      kind: 'hotel',
      regionGroup: '성산',
      label: 'jitter-a',
    },
  });
  const b4b = buildBody(1004, {
    startLocation: {
      lat: 33.450003,
      lng: 126.920004,
      kind: 'hotel',
      regionGroup: '성산',
      label: 'jitter-b',
    },
  });
  await post('T4_call1', b4a);
  await sleep(DELAY_MS);
  await post('T4_call2_jitter', b4b);

  // --- T5: same regionGroup, far coordinates ---
  log('\n--- T5 same regionGroup, different area coords ---');
  const b5a = buildBody(1005, {
    startLocation: {
      lat: 33.255,
      lng: 126.185,
      kind: 'hotel',
      regionGroup: 'jeju_city',
      label: 'south-area',
    },
  });
  const b5b = buildBody(1005, {
    startLocation: {
      lat: 33.492,
      lng: 126.498,
      kind: 'hotel',
      regionGroup: 'jeju_city',
      label: 'north-area',
    },
  });
  await post('T5_a', b5a);
  await sleep(DELAY_MS);
  await post('T5_b', b5b);
  log('T5 note: expect different endpoint_key (v1|…).');

  // --- T6: region-only ---
  log('\n--- T6 region-only start (no lat/lng) — no exact cache write path ---');
  const b6 = buildBody(1006, {
    startLocation: { kind: 'hotel', regionGroup: 'east', label: 'region-only-east' },
  });
  const t6 = await post('T6_region_only', b6);
  log('T6 expect: endpoint cache writes 0; region fallback when no coords', meta(t6.json));

  // --- T7: reuse path (same body twice) ---
  log('\n--- T7 reuse path: identical request ×2 ---');
  const b7 = applyForceFreshForEndpointCases(
    buildBody(1007, {
      startLocation: {
        lat: 33.44,
        lng: 126.905,
        kind: 'hotel',
        regionGroup: '성산',
        label: 'reuse-hotel',
      },
    }),
  );
  const t7a = await post('T7_warm1', b7);
  await sleep(DELAY_MS + 200);
  const t7b = await post('T7_warm2_same', b7);
  log('T7 note:', {
    warm1_reuse: t7a.json?.generationMeta?.reuseSource,
    warm2_reuse: t7b.json?.generationMeta?.reuseSource,
    warm2_endpointFresh: num(t7b.json?.generationMeta?.validationMeta?.assemblyEndpointCacheFreshHits),
  });

  // --- T8: final meta only (documentary) ---
  log('\n--- T8 final-travel-stats isolation (documentary) ---');
  log(
    'Exploratory assemble-route stats are discarded; API merges assembly* from computeFinalTravelStatsForDraftStops (+ polish recompute when improved). Check assemblyEndpoint* in responses above.',
  );

  // --- T9: debugNoReuse vs omit (dev only) ---
  log('\n--- T9 debugNoReuse: compare reuse behavior (dev server only) ---');
  const b9 = buildBody(1009, {
    startLocation: {
      lat: 33.42,
      lng: 126.88,
      kind: 'hotel',
      regionGroup: '성산',
      label: 't9-body',
    },
    debugNoReuse: undefined,
  });
  const b9dbg = { ...b9, debugNoReuse: true };
  await post('T9_no_flag_call1', b9);
  await sleep(DELAY_MS);
  const t9second = await post('T9_no_flag_call2', b9);
  await sleep(DELAY_MS);
  const t9dbg = await post('T9_debugNoReuse_true', b9dbg);
  log('T9 note: debugNoReuse=true should skip reuse lookup in development; signatures not exposed in JSON.', {
    call2_no_flag_reuse: t9second.json?.generationMeta?.reuseSource,
    debug_call_reuse: t9dbg.json?.generationMeta?.reuseSource,
  });

  log('\n=== done ===', new Date().toISOString());
  flushLog();
}

main().catch((e) => {
  console.error(e);
  try {
    lines.push('FATAL: ' + String(e));
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.writeFileSync(LOG_PATH, lines.join('\n'), 'utf8');
  } catch {
    /* ignore */
  }
  process.exit(1);
});
