/**
 * qa-perf-dining — §F 예산 #8/#9 (다이닝 카드 HIT / MISS).
 *
 *   #8 HIT  : < 600ms, **외부 API 0회**  ← §5.7 핵심 계약
 *   #9 MISS : **미확정** — 플랜이 *"8s 는 근거 없는 추정이었다 … 예산은 측정 후에 쓴다"* 고
 *             적어 뒀다. 이 스크립트가 그 측정을 만든다.
 *
 * 🔴 MISS 는 **실제 Kakao + Google + 번역 LLM 을 소모한다.** 기본 1회만 돈다(`--miss N`).
 *    HIT 는 캐시만 읽으므로 자유롭게 반복해도 된다.
 *
 * 🔴 "외부 API 0회" 는 시간으로 판정하지 않는다. `ops_kakao_cell_index` 가 셀마다
 *    `kakao_calls` · `google_calls` 를 들고 있으므로, **호출 전후로 그 합이 그대로인지**를
 *    본다(스크립트 밖에서 SQL 로 대조 — 이 스크립트는 시간과 응답만 낸다).
 *
 * 사용:
 *   WALK_BASE=http://localhost:<port> node scripts/qa-perf-dining.mjs [--hit 5] [--miss 1]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const BASE = process.env.WALK_BASE ?? 'http://localhost:3175';
const HIT_N = Math.max(1, Number(flag('hit', '5')));
const MISS_N = Math.max(0, Number(flag('miss', '1')));

let fx;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  console.error('scripts/.sim-fixtures.json 이 없다. ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts');
  process.exit(1);
}

/**
 * WARM 은 `ops_kakao_cell_index` 에 실제로 적재된 셀의 중심이다(2026-08-03 실측,
 * 전부 2026-10 까지 유효). COLD 는 어느 셀 반경(800~1500m)에도 안 걸리는 좌표다.
 */
const WARM = { lat: 33.3856736, lng: 126.8014635, label: '제주 성산권 (cell wvfjvmw · 15 places)' };
const COLD = { lat: 34.8118, lng: 126.3922, label: '전남 목포 (셀 없음)' };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => window.localStorage.setItem('tr_manual_seen_v2', String(Date.now())));

let SESSION = null;
page.on('response', async (res) => {
  if (SESSION || !res.url().includes('/join')) return;
  try {
    const j = await res.json();
    if (j?.session) SESSION = j.session;
  } catch {
    /* join 이 아닌 응답 */
  }
});
await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 120000 });
await page.waitForTimeout(2500);
if (!SESSION) {
  console.error('FAIL: join 세션을 못 얻었다 — 인증 없이 잰 숫자는 라우트 성능이 아니다.');
  await browser.close();
  process.exit(1);
}

async function call(spot, meal) {
  return page.evaluate(
    async ({ booking, session, lat, lng, meal }) => {
      const t0 = performance.now();
      try {
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(booking)}/dining`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-tour-room-auth': session },
          body: JSON.stringify({ lat, lng, meal, post: false }),
        });
        const body = await res.json().catch(() => ({}));
        return {
          ms: performance.now() - t0,
          status: res.status,
          // card:null 은 오류가 아니다(라우트 주석 §5.7) — 그래도 구분해서 보여준다.
          hasCard: Boolean(body?.card),
          places: Array.isArray(body?.card?.places) ? body.card.places.length : null,
        };
      } catch (e) {
        return { error: String(e).slice(0, 90) };
      }
    },
    { booking: fx.booking1, session: SESSION, lat: spot.lat, lng: spot.lng, meal },
  );
}

const stats = (xs) => {
  const v = xs.slice().sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return { n: v.length, p50: Math.round(q(0.5)), p95: Math.round(q(0.95)), max: Math.round(v[v.length - 1]) };
};

const rows = [];
const failures = [];
const GAP_MS = Math.max(0, Number(flag('gap', '2500')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 🔴 이 라우트는 레이트 리밋이 빡빡하다(주석 §5.7 — MISS 한 번이 유료 쿼터를 쓰므로 의도된 것).
 *    빠르게 연타하면 **429 가 섞이는데 응답 시간은 멀쩡히 나온다** — 그걸 통계에 넣으면
 *    "거절 속도"가 "다이닝 카드 속도"로 둔갑한다. 2xx 만 통계에 넣고 429 는 따로 센다.
 */
async function measure(spot, n, label, budget) {
  const ok = [];
  let throttled = 0;
  let lastOk = null;
  const statuses = [];
  for (let i = 0; i < n; i += 1) {
    if (i > 0) await sleep(GAP_MS);
    const r = await call(spot, 'lunch');
    if (r.error) {
      failures.push(`${label} run${i}: ${r.error}`);
      break;
    }
    statuses.push(r.status);
    if (r.status === 429) {
      throttled += 1;
      continue;
    }
    if (r.status >= 200 && r.status < 300) {
      ok.push(r.ms);
      lastOk = r;
    }
  }
  if (!ok.length) {
    failures.push(`${label}: 2xx 표본 0건 (status ${statuses.join(',')})`);
    return;
  }
  const s = stats(ok);
  rows.push({
    측정: label,
    예산: budget === null ? '미확정' : `${budget}ms`,
    ...s,
    첫회: Math.round(ok[0]),
    '429': throttled,
    카드: lastOk.hasCard ? `있음(${lastOk.places ?? '?'}곳)` : '없음(card:null)',
    판정: budget === null ? '—(베이스라인)' : s.p95 <= budget ? 'PASS' : 'FAIL',
  });
}

await measure(WARM, HIT_N, `#8 HIT — ${WARM.label}`, 600);
if (MISS_N > 0) await measure(COLD, MISS_N, `#9 MISS — ${COLD.label}`, null);

await browser.close();

if (!rows.length) {
  console.error('FAIL: 측정된 것이 0건이다.');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`\nHIT ${HIT_N}회 · MISS ${MISS_N}회 · 로컬 프로덕션 서버(네트워크 스로틀 없음)`);
console.table(rows);
for (const f of failures) console.log('  ⚠ ' + f);
console.log(
  '\n🔴 "외부 API 0회" 는 이 표로 판정하지 않는다 — 실행 전후로 아래를 대조할 것:\n' +
    '   select sum(kakao_calls) k, sum(google_calls) g, count(*) cells from ops_kakao_cell_index;',
);
if (failures.length) process.exit(1);
