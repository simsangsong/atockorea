/**
 * qa-perf-idle — 가만히 있는 사용자 1명이 만드는 **상시 비용**.
 *
 * 룸을 열어 두고 아무것도 하지 않은 채 N초를 보낸 뒤, 그동안 나간 요청을
 * 종류별로 센다. 폴링 간격은 소스에 상수로 적혀 있지만(GuideConsole 15초 ·
 * VehicleLocationCard 60초), **적혀 있는 것과 실제로 나가는 것은 다른 문제다** —
 * 이 트랙의 지배 결함이 "선언은 있는데 소비처가 없다/다르다" 였다.
 *
 * WebSocket(Supabase realtime)과 SSE 폴백도 구분해서 센다. 어느 쪽으로 붙었는지에
 * 따라 손님 1명당 서버 비용이 완전히 달라진다.
 *
 * 🔴 이 스크립트는 **아무것도 클릭하지 않는다.** 유휴 비용을 재는 것이라
 *    상호작용이 섞이면 측정이 아니라 시나리오가 된다.
 *
 * 사용:
 *   WALK_BASE=http://localhost:<port> node scripts/qa-perf-idle.mjs [--seconds 90] [--surface guest|guide]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const BASE = process.env.WALK_BASE ?? 'http://localhost:3175';
const SECONDS = Math.max(30, Number(flag('seconds', '90')));
const SURFACE = flag('surface', 'guest');

let fx;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  console.error('scripts/.sim-fixtures.json 이 없다. ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts');
  process.exit(1);
}
const target =
  SURFACE === 'guide'
    ? { url: fx.guideUrl, wait: '[data-testid="staff-shell"]', label: '가이드 콘솔' }
    : { url: fx.room1Url, wait: '[data-testid="room-tabbar"]', label: '손님 룸' };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 33.4996, longitude: 126.5312 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
await page.addInitScript(() => window.localStorage.setItem('tr_manual_seen_v2', String(Date.now())));

const sockets = [];
page.on('websocket', (ws) => sockets.push({ url: ws.url(), openedAt: Date.now() }));

await page.goto(BASE + target.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector(target.wait, { timeout: 120000 });
// 진입 폭풍이 가라앉을 시간. 이걸 안 주면 초기 로드를 유휴 비용으로 오해한다.
await page.waitForTimeout(8000);

// ── 여기부터가 측정 구간 ────────────────────────────────────────────────────
const reqs = [];
const onResponse = async (res) => {
  const url = res.url();
  if (!url.startsWith(BASE)) return;
  let bytes = 0;
  try {
    const s = await res.request().sizes();
    bytes = (s.responseBodySize ?? 0) + (s.responseHeadersSize ?? 0);
  } catch {
    /* 사라진 응답은 측정치가 아니다 */
  }
  reqs.push({ path: new URL(url).pathname, status: res.status(), bytes, at: Date.now() });
};
page.on('response', onResponse);

const startedAt = Date.now();
await page.waitForTimeout(SECONDS * 1000);
page.off('response', onResponse);
const elapsedSec = (Date.now() - startedAt) / 1000;
await browser.close();

// ── 집계 ────────────────────────────────────────────────────────────────────
const byPath = new Map();
for (const r of reqs) {
  // bookingId 같은 가변 세그먼트를 접어 같은 엔드포인트끼리 묶는다.
  const key = r.path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/{id}');
  const cur = byPath.get(key) ?? { n: 0, bytes: 0, statuses: new Set() };
  cur.n += 1;
  cur.bytes += r.bytes;
  cur.statuses.add(r.status);
  byPath.set(key, cur);
}
const rows = [...byPath.entries()]
  .map(([path, v]) => ({
    엔드포인트: path,
    횟수: v.n,
    '초당': +(v.n / elapsedSec).toFixed(3),
    '추정 간격(초)': v.n > 1 ? +(elapsedSec / v.n).toFixed(1) : '—',
    KB: +(v.bytes / 1024).toFixed(1),
    status: [...v.statuses].join(','),
  }))
  .sort((a, b) => b.횟수 - a.횟수);

console.log(`\n[${target.label}] 유휴 ${elapsedSec.toFixed(0)}초 · 클릭 0회 · 진입 후 8초는 제외`);
if (!rows.length) {
  console.log('  요청 0건 — 유휴 상태에서 HTTP 폴링이 없다(WebSocket 만 쓰거나, 아무것도 안 한다).');
} else {
  console.table(rows);
}
const totalKB = +(reqs.reduce((a, r) => a + r.bytes, 0) / 1024).toFixed(1);
console.log(
  `  합계: ${reqs.length}건 · ${totalKB} KB · 분당 ${(reqs.length / (elapsedSec / 60)).toFixed(1)}건 / ${(totalKB / (elapsedSec / 60)).toFixed(1)} KB`,
);
console.log(`\n  WebSocket: ${sockets.length}개`);
for (const s of sockets) console.log(`    ${s.url.slice(0, 120)}`);
if (!sockets.length) {
  console.log('    🔴 없음 — realtime 이 안 붙었다는 뜻이고, 그러면 SSE/폴링이 그 일을 대신한다.');
}

/**
 * 🔴 "요청 0건" 은 두 가지 중 하나다 — **realtime 이 다 하고 있거나, 화면이 죽어 있거나.**
 * 이 스크립트는 유휴 비용을 세는 도구라 0 을 정상 결과로 출력하는데, 그 판정이 성립하려면
 * **일을 대신하는 채널이 실제로 존재해야** 한다. 그 단언이 없으면 시뮬 데이터가 사라져
 * 빈 화면을 재고 있을 때도 똑같이 "0건" 을 초록으로 낸다.
 *
 * (타 세션이 같은 함정을 먼저 밟았다: 예약이 지워진 뒤에도 하니스가 "컨트롤 13개, 위반 0" 을
 *  보고했는데 실제로는 "예약 없음" 화면을 재고 있었다. 2026-08-03.)
 */
if (!reqs.length && !sockets.length) {
  console.error(
    '\nFAIL: 요청도 0건이고 WebSocket 도 0개다. 이건 "효율적"이 아니라 "아무 일도 안 일어남"이다 —\n' +
      '      시뮬 데이터가 비었거나 화면이 죽었을 가능성이 높다. 시드 상태를 먼저 확인할 것.',
  );
  process.exit(1);
}

/**
 * `--check` — 유휴 상시 비용의 회귀 게이트.
 *
 * 이 지표가 게이트로 쓸 만한 이유는 **데이터 양에 안 흔들리기 때문**이다. 룸 진입 시간은
 * 시드된 방의 내용물에 비례해서(원장 P-12) 고정 상한을 걸기 어려운데, 유휴 폴링은
 * *"가만히 있을 때 몇 번 나가는가"* 라 코드가 정한다. 폴링이 하나 늘면 바로 보인다.
 *
 * 손님 룸의 현재 값은 **0건**이고 상한은 2다 — 0을 상한으로 걸면 나중에 정당한 폴링 하나가
 * 들어올 때 게이트가 이유 없이 막는다. 2를 넘으면 그건 realtime 이 빠졌다는 뜻이다.
 */
if (argv.includes('--check')) {
  let budget;
  try {
    budget = JSON.parse(readFileSync('docs/audit/PERF-BUDGET.json', 'utf8'));
  } catch (e) {
    console.error('FAIL: docs/audit/PERF-BUDGET.json 을 읽을 수 없다 — ' + String(e).slice(0, 120));
    process.exit(1);
  }
  const cap = budget.idleRequestsPerMinute?.[SURFACE];
  if (typeof cap !== 'number') {
    // 예산에 없는 표면을 조용히 통과시키지 않는다.
    console.error(`FAIL: 예산에 '${SURFACE}' 표면의 유휴 상한이 없다 (PERF-BUDGET.json 에 추가할 것).`);
    process.exit(1);
  }
  const perMin = reqs.length / (elapsedSec / 60);
  console.log(`\n예산 대조 — ${SURFACE} 유휴 ${perMin.toFixed(1)}건/분 · 상한 ${cap}`);
  if (perMin > cap) {
    console.error(
      `FAIL: 유휴 요청이 상한을 넘었다 (${perMin.toFixed(1)} > ${cap}).\n` +
        '      폴링이 늘었거나 realtime 이 안 붙는다. 고쳤다면 PERF-BUDGET.json 값을 내려라.',
    );
    process.exit(1);
  }
}
