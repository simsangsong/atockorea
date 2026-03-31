/**
 * Sequential manual tests for /api/itinerary/generate (UTF-8 JSON).
 * Run: node __itinerary_manual_tests.mjs
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
function env(name) {
  const m = envText.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return m ? m[1].trim() : '';
}
const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

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
            reject(new Error(`Invalid JSON: ${d.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

async function fetchLatestParseLogMerged() {
  const url = `${SUPABASE_URL}/rest/v1/request_parse_logs?select=merged_result&order=created_at.desc&limit=1`;
  const r = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const rows = await r.json();
  return rows[0]?.merged_result ?? null;
}

async function contentIdsForPoiIdsChunked(poiIds) {
  const ids = [...new Set((poiIds ?? []).filter((n) => n != null))];
  const set = new Set();
  const chunk = 40;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const q = slice.join(',');
    const url = `${SUPABASE_URL}/rest/v1/poi_search_profile?select=content_id&poi_id=in.(${q})`;
    const r = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      set.add(String(row.content_id));
    }
  }
  return set;
}

/** Resolve SQL pool from request_parse_logs for this exact travelStyle (raw_text). */
async function fetchPoolForRawText(rawText) {
  const enc = encodeURIComponent(rawText);
  const url = `${SUPABASE_URL}/rest/v1/request_parse_logs?raw_text=eq.${enc}&select=merged_result&order=created_at.desc&limit=1`;
  const r = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const rows = await r.json();
  const merged = rows[0]?.merged_result;
  const poiIds = merged?.candidatePoiIds ?? [];
  const candidatePoiIdCount = Array.isArray(poiIds) ? poiIds.length : 0;
  const contentSet = await contentIdsForPoiIdsChunked(poiIds);
  return { contentSet, candidatePoiIdCount, merged };
}

/** When SQL pool is empty, route uses legacy candidates — subset vs SQL pool is N/A. */
function assertStopsSubsetPool(label, stopIds, poolContent, candidatePoiIdCount) {
  if (candidatePoiIdCount === 0) {
    console.log(
      `[${label}] Pool subset: SKIP (merged_result.candidatePoiIds empty — legacy path; generationMeta.candidateCount is legacy fetch size, not SQL pool)`,
    );
    return;
  }
  const bad = stopIds.filter((id) => !poolContent.has(id));
  console.log(`[${label}] SQL pool size (content_ids):`, poolContent.size);
  console.log(
    `[${label}] Stops ⊆ pool:`,
    bad.length === 0 ? 'PASS' : `FAIL: ${bad.join(',')}`,
  );
  if (bad.length) process.exitCode = 1;
}

function assertContract(res, label) {
  const keys = Object.keys(res).sort().join(',');
  const expected = 'generationMeta,routeMetrics,stops,tourSummary,tourTitle,warnings';
  if (keys !== expected) {
    throw new Error(`[${label}] Bad top-level keys: ${keys}`);
  }
}

async function main() {
  console.log('=== Test 1: First-visit east + seniors ===\n');
  const t1 = await post({
    destination: 'jeju',
    durationDays: 1,
    travelStyle: '부모님과 첫 제주인데 많이 안 걷고 동쪽 위주로',
    seniors: true,
  });
  if (t1.error) throw new Error(t1.error);
  assertContract(t1, 'T1');
  const stopIds = (t1.stops ?? []).map((s) => String(s.contentId));
  console.log('candidateCount:', t1.generationMeta?.candidateCount);
  console.log('stops:', stopIds.length, stopIds);
  await new Promise((r) => setTimeout(r, 500));
  const travelStyle = '부모님과 첫 제주인데 많이 안 걷고 동쪽 위주로';
  const pool1 = await fetchPoolForRawText(travelStyle);
  console.log('merged_result.candidatePoiIds count:', pool1.candidatePoiIdCount);
  assertStopsSubsetPool('T1', stopIds, pool1.contentSet, pool1.candidatePoiIdCount);

  console.log('\n=== Test 2: Hidden gem ===\n');
  const t2 = await post({
    destination: 'jeju',
    durationDays: 1,
    travelStyle: '뻔한 데보다 감성 있고 덜 관광지스러운 곳',
  });
  if (t2.error) throw new Error(t2.error);
  assertContract(t2, 'T2');
  const m2 = await fetchLatestParseLogMerged();
  console.log('hidden_gem_priority (merged):', m2?.values?.hidden_gem_priority ?? m2?.values?.hidden_gem);
  console.log('avoid_overly_touristy:', m2?.values?.avoid_overly_touristy);
  console.log('stops:', (t2.stops ?? []).length);
  await new Promise((r) => setTimeout(r, 500));
  const ts2 = '뻔한 데보다 감성 있고 덜 관광지스러운 곳';
  const pool2 = await fetchPoolForRawText(ts2);
  console.log('merged_result.candidatePoiIds count:', pool2.candidatePoiIdCount);
  assertStopsSubsetPool(
    'T2',
    (t2.stops ?? []).map((s) => String(s.contentId)),
    pool2.contentSet,
    pool2.candidatePoiIdCount,
  );

  console.log('\n=== Test 3: Rainy relaxed morning ===\n');
  const t3 = await post({
    destination: 'jeju',
    durationDays: 1,
    travelStyle: '비 와도 괜찮고 오전부터 여유 있게',
  });
  if (t3.error) throw new Error(t3.error);
  assertContract(t3, 'T3');
  const m3 = await fetchLatestParseLogMerged();
  console.log('need_indoor_if_rain / morning:', m3?.values?.need_indoor_if_rain, m3?.values?.morning_preference);
  console.log('stops:', (t3.stops ?? []).length);
  await new Promise((r) => setTimeout(r, 500));
  const ts3 = '비 와도 괜찮고 오전부터 여유 있게';
  const pool3 = await fetchPoolForRawText(ts3);
  console.log('merged_result.candidatePoiIds count:', pool3.candidatePoiIdCount);
  assertStopsSubsetPool(
    'T3',
    (t3.stops ?? []).map((s) => String(s.contentId)),
    pool3.contentSet,
    pool3.candidatePoiIdCount,
  );

  console.log('\n=== Test 4: Quick photo ===\n');
  const t4 = await post({
    destination: 'jeju',
    durationDays: 1,
    travelStyle: '사진 위주로 빡세지 않게',
    quickPhotoMode: true,
  });
  if (t4.error) throw new Error(t4.error);
  assertContract(t4, 'T4');
  const durations = (t4.stops ?? []).map((s) => s.plannedDurationMin).filter((n) => n != null);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  console.log('stops:', (t4.stops ?? []).length, 'avg plannedDurationMin:', avg.toFixed(1));
  await new Promise((r) => setTimeout(r, 500));
  const ts4 = '사진 위주로 빡세지 않게';
  const pool4 = await fetchPoolForRawText(ts4);
  console.log('merged_result.candidatePoiIds count:', pool4.candidatePoiIdCount);
  assertStopsSubsetPool(
    'T4',
    (t4.stops ?? []).map((s) => String(s.contentId)),
    pool4.contentSet,
    pool4.candidatePoiIdCount,
  );

  console.log('\n=== Test 5: Contract only ===\n');
  const t5 = await post({ destination: 'jeju', durationDays: 1, travelStyle: 'test' });
  if (t5.error) throw new Error(t5.error);
  assertContract(t5, 'T5');
  console.log('Top-level keys OK:', Object.keys(t5).sort().join(', '));

  console.log('\n=== All sequential tests finished ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
