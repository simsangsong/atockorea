/**
 * Step 10 manual tests T1–T7 + Step 11 final 4 checks against localhost /api/itinerary/generate.
 * Run: node __itinerary_t1_t7_step10_tests.mjs
 * Requires: npm run dev (port 3000), .env with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import http from 'http';

function post(bodyObj) {
  const body = JSON.stringify(bodyObj);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/itinerary/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error(`Invalid JSON (status ${res.statusCode}): ${d.slice(0, 400)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

function meta(res) {
  const gm = res.generationMeta ?? {};
  const vm = gm.validationMeta ?? {};
  return {
    error: res.error ?? null,
    geminiModel: gm.geminiModel,
    usedFallback: gm.usedFallback,
    reusedItinerary: gm.reusedItinerary,
    reuseSource: gm.reuseSource,
    reusedRunId: gm.reusedRunId,
    reusedTemplateId: gm.reusedTemplateId,
    reuseSimilarityScore: gm.reuseSimilarityScore,
    candidateCount: gm.candidateCount,
    finalTravelStatsIsolated: vm.finalTravelStatsIsolated,
    endpointAwarePolishUsed: vm.endpointAwarePolishUsed,
    endpointAwareReorderUsed: vm.endpointAwareReorderUsed,
    drivePenaltyProfile: vm.drivePenaltyProfile,
    routePreferenceProfileUsed: vm.routePreferenceProfileUsed,
    assemblyFreshCacheHits: vm.assemblyFreshCacheHits,
    assemblyLiveRefreshes: vm.assemblyLiveRefreshes,
    assemblyStaleFallbacks: vm.assemblyStaleFallbacks,
    assemblyEstimateFallbacks: vm.assemblyEstimateFallbacks,
    assemblyRegionFallbacks: vm.assemblyRegionFallbacks,
    assemblyLegacyAssumedFallbacks: vm.assemblyLegacyAssumedFallbacks,
    assemblyEndpointCacheFreshHits: vm.assemblyEndpointCacheFreshHits,
    assemblyEndpointCacheStaleHits: vm.assemblyEndpointCacheStaleHits,
    assemblyEndpointLiveRefreshes: vm.assemblyEndpointLiveRefreshes,
    assemblyEndpointEstimatedFallbacks: vm.assemblyEndpointEstimatedFallbacks,
    assemblyEndpointCacheWrites: vm.assemblyEndpointCacheWrites,
    stopCount: res.stops?.length ?? 0,
    firstContentIds: (res.stops ?? []).slice(0, 4).map((s) => s.contentId),
  };
}

async function section(title, fn) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
  await fn();
}

async function main() {
  const base = {
    destination: 'Jeju',
    durationDays: 1,
    availableHours: 8,
    locale: 'ko',
    travelStyle: '성산 일대 하루 코스 조용히',
    pickupRegion: '성산',
    seniors: false,
    withChildren: false,
  };

  let r1;
  await section('T1 — Same body twice (expect 2nd reuseSource run if persist + signature)', async () => {
    r1 = await post(base);
    console.log('Call 1:', JSON.stringify(meta(r1), null, 2));
    await new Promise((r) => setTimeout(r, 800));
    const r2 = await post(base);
    console.log('Call 2:', JSON.stringify(meta(r2), null, 2));
    const pass =
      r2.generationMeta?.reuseSource === 'run' ||
      (r1.generationMeta?.reuseSource === 'fresh' && r2.generationMeta?.reuseSource === 'run');
    console.log(
      'T1 note: PASS if call2 shows reuseSource=run and reusedItinerary=true (needs DB persist). Otherwise SKIP/observed.',
    );
    console.log('T1 observed reuse on 2nd call:', r2.generationMeta?.reusedItinerary === true);
  });

  await section('T2 — Change seniors vs T1 body (expect fresh)', async () => {
    const r = await post({ ...base, seniors: true, travelStyle: '성산 일대 하루 코스 조용히' });
    console.log(JSON.stringify(meta(r), null, 2));
    console.log('T2: expect reuseSource fresh or no reuse when signature mismatch.');
  });

  await section('T5 — Endpoints for polish (start + return)', async () => {
    const r = await post({
      ...base,
      departureAt: new Date().toISOString(),
      startLocation: { lat: 33.45, lng: 126.92, regionGroup: '성산', kind: 'custom' },
      endLocation: { lat: 33.46, lng: 126.93, regionGroup: '성산', kind: 'custom' },
      includeReturnToEndLocation: true,
    });
    console.log(JSON.stringify(meta(r), null, 2));
  });

  await section('T6 — Assembly stats shape (single-route resolution)', async () => {
    const r = await post(base);
    const m = meta(r);
    const asm = [
      m.assemblyFreshCacheHits,
      m.assemblyLiveRefreshes,
      m.assemblyStaleFallbacks,
      m.assemblyEstimateFallbacks,
      m.assemblyRegionFallbacks,
      m.assemblyLegacyAssumedFallbacks,
    ];
    const sum = asm.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    console.log(JSON.stringify(m, null, 2));
    console.log('T6: sum(assembly* counters)=', sum, '| finalTravelStatsIsolated=', m.finalTravelStatsIsolated);
  });

  await section('Step 11 — Endpoint cache (same coords ×2; needs SUPABASE_SERVICE_ROLE_KEY)', async () => {
    const coordsBody = {
      ...base,
      departureAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
      startLocation: {
        lat: 33.4512,
        lng: 126.9234,
        kind: 'hotel',
        regionGroup: '성산',
        label: 'cache-smoke-hotel',
      },
    };
    const e1 = await post(coordsBody);
    console.log('Call 1 (expect live/estimate; cache writes):', JSON.stringify(meta(e1), null, 2));
    await new Promise((r) => setTimeout(r, 600));
    const e2 = await post(coordsBody);
    console.log('Call 2 (expect endpoint cache fresh hits if DB + service role OK):', JSON.stringify(meta(e2), null, 2));
    const fh2 = e2.generationMeta?.validationMeta?.assemblyEndpointCacheFreshHits ?? 0;
    const lr1 = e1.generationMeta?.validationMeta?.assemblyEndpointLiveRefreshes ?? 0;
    const lr2 = e2.generationMeta?.validationMeta?.assemblyEndpointLiveRefreshes ?? 0;
    console.log(
      'Step 11 note: PASS if call2 assemblyEndpointCacheFreshHits>0 and live refreshes drop vs call1 (or lr2=0).',
    );
    console.log('  assemblyEndpointCacheFreshHits call2:', fh2, '| assemblyEndpointLiveRefreshes call1/call2:', lr1, lr2);
    if (fh2 <= 0) {
      console.log(
        '  If 0: check NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the dev server env, then restart.',
      );
    }
  });

  await section('Step 11b — Return leg cache (includeReturnToEndLocation)', async () => {
    const retBody = {
      ...base,
      departureAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      startLocation: { lat: 33.452, lng: 126.924, kind: 'custom', regionGroup: '성산' },
      endLocation: { lat: 33.453, lng: 126.925, kind: 'custom', regionGroup: '성산' },
      includeReturnToEndLocation: true,
    };
    const rA = await post(retBody);
    console.log('Return test call 1:', JSON.stringify(meta(rA), null, 2));
    await new Promise((r) => setTimeout(r, 600));
    const rB = await post(retBody);
    console.log('Return test call 2:', JSON.stringify(meta(rB), null, 2));
    console.log('Step 11b: second call should show endpoint cache hits for first + return legs when coords+DB OK.');
  });

  await section('T7 — Weak parser text + body longDriveTolerance', async () => {
    const r = await post({
      destination: 'Jeju',
      durationDays: 1,
      travelStyle: 'x',
      longDriveTolerance: 1,
      regionPreference: 'west',
      iconicSpotPriority: 8,
    });
    console.log(JSON.stringify(meta(r), null, 2));
    console.log('T7: drivePenaltyProfile compact often when tolerance=1 (if deterministic path).');
  });

  await section('T3 / T4 — Skipped in HTTP-only script', async () => {
    console.log(
      'T3 (pool mismatch): requires a stored itinerary_run whose sequence contains a contentId NOT in current pool — inject via SQL or separate integration test.',
    );
    console.log(
      'T4 (rain + outdoor): requires stored sequence with is_indoor=false stops while needIndoorIfRain=true — inject or mock.',
    );
  });

  await section('FINAL 4 — Step 11 acceptance (run after server restart + env OK)', async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vm = (res) => res.generationMeta?.validationMeta ?? {};
    const results = [];

    // --- 1) Same hotel coords ×2: 1st live/estimate, 2nd persistent cache fresh hits ---
    const hotel2x = {
      ...base,
      departureAt: new Date(Date.now() + 100 * 3600000).toISOString(),
      startLocation: {
        lat: 33.4722,
        lng: 126.9322,
        kind: 'hotel',
        regionGroup: '성산',
        label: 'final4-hotel-A',
      },
    };
    const f1a = await post(hotel2x);
    await sleep(600);
    const f1b = await post(hotel2x);
    const v1a = vm(f1a);
    const v1b = vm(f1b);
    const m1b = meta(f1b);
    const hit2 = (v1b.assemblyEndpointCacheFreshHits ?? 0) > 0;
    const firstNoFresh =
      (v1a.assemblyEndpointCacheFreshHits ?? 0) === 0;
    const firstResolved =
      (v1a.assemblyEndpointLiveRefreshes ?? 0) > 0 ||
      (v1a.assemblyEndpointEstimatedFallbacks ?? 0) > 0;
    const pass1 = hit2 && firstNoFresh && firstResolved;
    results.push({
      id: '1',
      name: 'Same coords ×2 → 2nd assemblyEndpointCacheFreshHits > 0; 1st live/estimate',
      pass: pass1,
      detail: `call1 freshHits=${v1a.assemblyEndpointCacheFreshHits ?? '∅'} live=${v1a.assemblyEndpointLiveRefreshes ?? 0} est=${v1a.assemblyEndpointEstimatedFallbacks ?? 0} | call2 freshHits=${v1b.assemblyEndpointCacheFreshHits ?? 0}`,
    });

    // --- 2) Same coords, label/kind only changed → still cache hit ---
    const hotelRelabel = {
      ...hotel2x,
      startLocation: {
        lat: 33.4722,
        lng: 126.9322,
        kind: 'custom',
        regionGroup: '성산',
        label: 'final4-hotel-B-label-only',
      },
    };
    const f2 = await post(hotelRelabel);
    await sleep(400);
    const v2 = vm(f2);
    const pass2 = (v2.assemblyEndpointCacheFreshHits ?? 0) > 0;
    results.push({
      id: '2',
      name: 'Same coords, label/kind changed → still endpoint cache hit',
      pass: pass2,
      detail: `assemblyEndpointCacheFreshHits=${v2.assemblyEndpointCacheFreshHits ?? 0}`,
    });

    // --- 3) Reuse + polish: 2nd reusedItinerary=true, still endpoint cache + finalTravelStatsIsolated ---
    const reusePolish = {
      ...base,
      departureAt: new Date(Date.now() + 102 * 3600000).toISOString(),
      startLocation: {
        lat: 33.4833,
        lng: 126.9433,
        kind: 'hotel',
        regionGroup: '성산',
        label: 'final4-reuse-polish',
      },
      endLocation: { lat: 33.484, lng: 126.944, kind: 'custom', regionGroup: '성산' },
      includeReturnToEndLocation: true,
    };
    const f3a = await post(reusePolish);
    await sleep(900);
    const f3b = await post(reusePolish);
    const v3b = vm(f3b);
    const reused = f3b.generationMeta?.reusedItinerary === true;
    const pass3 =
      reused &&
      (v3b.assemblyEndpointCacheFreshHits ?? 0) > 0 &&
      v3b.finalTravelStatsIsolated === true;
    results.push({
      id: '3',
      name: 'Reuse path: reusedItinerary=true & endpoint cache hit & finalTravelStatsIsolated',
      pass: pass3,
      detail: `reused=${reused} freshHits=${v3b.assemblyEndpointCacheFreshHits ?? 0} isolated=${v3b.finalTravelStatsIsolated}`,
    });

    // --- 4) Region-only endpoint: no cache write, region-style resolution ---
    const regionOnly = {
      ...base,
      departureAt: new Date(Date.now() + 104 * 3600000).toISOString(),
      startLocation: { regionGroup: '성산', kind: 'hotel', label: 'no-lat-lng' },
    };
    const f4 = await post(regionOnly);
    const v4 = vm(f4);
    const writes = v4.assemblyEndpointCacheWrites ?? 0;
    const pass4 = writes === 0;
    results.push({
      id: '4',
      name: 'Region-only start: no endpoint cache write (writes=0)',
      pass: pass4,
      detail: `assemblyEndpointCacheWrites=${writes} assemblyRegionFallbacks=${v4.assemblyRegionFallbacks ?? '∅'} (expect region fallback for endpoint leg when POI region matches)`,
    });

    console.log('\n--- FINAL 4 summary ---\n');
    for (const r of results) {
      const tag = r.pass ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${r.id}. ${r.name}`);
      console.log(`       ${r.detail}\n`);
    }
    console.log('Full meta last calls (for debug):');
    console.log('  (1b)', JSON.stringify(m1b, null, 2));
    console.log('  (2) ', JSON.stringify(meta(f2), null, 2));
    console.log('  (3b)', JSON.stringify(meta(f3b), null, 2));
    console.log('  (4) ', JSON.stringify(meta(f4), null, 2));
    if (!results.every((r) => r.pass)) {
      console.log(
        '\nIf FAIL: ensure SUPABASE_SERVICE_ROLE_KEY loads in the Next dev process, table endpoint_travel_cache exists, and retry after restart.',
      );
    }
    if (!results[2].pass && f3b.generationMeta?.reusedItinerary !== true) {
      console.log(
        '\nNote on #3: reusedItinerary=false means DB reuse did not trigger (signature/pool); endpoint cache can still be tested via #1–2.',
      );
    }
  });

  console.log(`\n${'='.repeat(72)}\nDone.\n${'='.repeat(72)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
