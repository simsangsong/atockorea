/**
 * qa-perf-routes — 손님 핵심 라우트의 p50/p95, 그리고 컨시어지 Tier1 응답시간.
 *
 *   #10 라우트 p50/p95 (손님 핵심)   — §F 예산표에 수치 없음, 베이스라인부터 만든다
 *   #7  컨시어지 Tier1 < 4s          — 🔴 실제 LLM 을 호출한다(비용 발생, 사장님 승인 2026-08-03)
 *
 * 🔴 인증을 흉내내지 않는다. Playwright 로 룸을 실제로 열어 join 을 태운 뒤,
 *    **페이지 안에서 fetch** 한다 — 앱과 똑같은 세션·쿠키·헤더로 나가야 잰 값이 의미가 있다.
 *    (룸 토큰을 스크립트가 직접 서명하려다 403 을 받는 것이 이 레포의 기록된 함정이다.)
 *
 * 사용:
 *   WALK_BASE=http://localhost:<port> node scripts/qa-perf-routes.mjs [--runs 7] [--tier1 3] [--no-llm]
 * 종료 코드: 표본 0건이면 1.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const BASE = process.env.WALK_BASE ?? 'http://localhost:3175';
const RUNS = Math.max(1, Number(flag('runs', '7')));
const TIER1_N = Math.max(0, Number(flag('tier1', '3')));
const NO_LLM = argv.includes('--no-llm');

let fx;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  console.error('scripts/.sim-fixtures.json 이 없다. ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts');
  process.exit(1);
}
const BOOKING = fx.booking1;
const RT = new URL(`http://x${fx.room1Url}`).searchParams.get('rt');
if (!RT) {
  console.error('room1Url 에 rt 토큰이 없다 — 재시드 필요.');
  process.exit(1);
}

/** 손님이 실제로 밟는 GET 라우트. 반복 호출해도 부작용이 없는 것만 골랐다. */
const GET_ROUTES = [
  'approach',
  'arrival-bundle',
  'captions',
  'day-summary',
  'dietary',
  'dining',
  'extras',
  'media',
  'messages',
  'morning-briefing',
  'my-seat',
  'plan',
  'region-scripts',
  'tour-itinerary',
  'vehicle-eta',
];

const stats = (xs) => {
  const v = xs.slice().sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return { n: v.length, p50: Math.round(q(0.5)), p95: Math.round(q(0.95)), max: Math.round(v[v.length - 1]) };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => window.localStorage.setItem('tr_manual_seen_v2', String(Date.now())));

/**
 * 🔴 룸 API 는 쿠키가 아니라 **`x-tour-room-auth` 헤더**로 인증한다
 * (`TourRoomClient` 가 join 응답의 `session` 을 그 헤더에 실어 보낸다).
 * 초판이 이걸 몰라 헤더 없이 fetch 했고, 전 라우트가 403 을 돌려줬다 —
 * 그런데도 응답 시간은 나오므로 **"빠른 거절"을 "빠른 라우트"로 오독할 뻔했다.**
 * 그래서 앱이 실제로 하는 join 을 가로채 세션을 얻는다.
 */
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
await page.waitForTimeout(2500); // join 정착
if (!SESSION) {
  console.error('FAIL: join 세션을 못 얻었다 — 인증 없이 잰 숫자는 라우트 성능이 아니다.');
  await browser.close();
  process.exit(1);
}

const rows = [];

// ── #10 GET 라우트 p50/p95 ──────────────────────────────────────────────────
for (const route of GET_ROUTES) {
  const r = await page.evaluate(
    async ({ booking, route, runs, session }) => {
      const url = `/api/tour-rooms/${encodeURIComponent(booking)}/${route}`;
      const times = [];
      let status = null;
      let bytes = 0;
      for (let i = 0; i < runs; i += 1) {
        const t0 = performance.now();
        try {
          const res = await fetch(url, { headers: { accept: 'application/json', 'x-tour-room-auth': session } });
          const text = await res.text();
          times.push(performance.now() - t0);
          status = res.status;
          bytes = text.length;
        } catch (e) {
          return { error: String(e).slice(0, 80) };
        }
      }
      return { times, status, bytes };
    },
    { booking: BOOKING, route, runs: RUNS, session: SESSION },
  );
  if (r.error) {
    rows.push({ route, status: 'ERR', note: r.error });
    continue;
  }
  // 🔴 2xx 가 아니면 잰 것은 라우트의 작업 시간이 아니라 거절 시간이다. 섞어 보고하지 않는다.
  rows.push({
    route,
    status: r.status,
    kb: +(r.bytes / 1024).toFixed(1),
    ...stats(r.times),
    ...(r.status >= 200 && r.status < 300 ? {} : { note: r.status === 405 ? 'GET 미지원' : '비-2xx (성능 아님)' }),
  });
}

// ── #7 컨시어지 Tier1 (실 LLM) ──────────────────────────────────────────────
let tier1 = null;
if (!NO_LLM && TIER1_N > 0) {
  // Tier0 는 퀵칩 키워드를 네트워크 0회로 처리한다. 그걸 피해 **에스컬레이션을 강제**하는
  // 질문이어야 Tier1 을 재는 것이 된다. 매 회 다른 질문을 써서 응답 캐시도 피한다.
  const QUESTIONS = [
    'Why is the basalt on this coast hexagonal rather than rounded?',
    'What did the haenyeo divers historically trade, and with whom?',
    'How did this island’s volcanic soil change what farmers could grow here?',
    'What is the oldest surviving building near this route and who built it?',
    'Why do the stone walls here have gaps instead of being solid?',
  ];
  const r = await page.evaluate(
    async ({ booking, token, n, questions }) => {
      const out = [];
      for (let i = 0; i < n; i += 1) {
        const t0 = performance.now();
        try {
          const res = await fetch(`/api/tour-rooms/${encodeURIComponent(booking)}/concierge`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ question: questions[i % questions.length], locale: 'en', token }),
          });
          const body = await res.json().catch(() => ({}));
          out.push({
            ms: performance.now() - t0,
            status: res.status,
            tier: body?.tier ?? body?.source ?? null,
            answered: Boolean(body?.answer ?? body?.text ?? body?.reply),
          });
        } catch (e) {
          out.push({ error: String(e).slice(0, 90) });
        }
      }
      return out;
    },
    { booking: BOOKING, token: RT, n: TIER1_N, questions: QUESTIONS },
  );
  tier1 = r;
}

await browser.close();

const measured = rows.filter((r) => typeof r.p50 === 'number');
if (!measured.length) {
  console.error('FAIL: 측정된 라우트가 0건이다.');
  process.exit(1);
}

console.log(`\n손님 핵심 GET 라우트 — 브라우저 세션 내 fetch · ${RUNS}회 · 로컬 프로덕션 서버(네트워크 스로틀 없음)`);
console.table(rows);

if (tier1) {
  console.log(`\n컨시어지 Tier1 — 실 LLM 호출 ${TIER1_N}회 (예산 4,000ms)`);
  console.table(
    tier1.map((t, i) =>
      t.error
        ? { '#': i + 1, error: t.error }
        : { '#': i + 1, ms: Math.round(t.ms), status: t.status, tier: t.tier ?? '—', 답변있음: t.answered, 판정: t.ms <= 4000 ? 'PASS' : 'FAIL' },
    ),
  );
  const okTimes = tier1.filter((t) => !t.error).map((t) => t.ms);
  if (okTimes.length) {
    const s = stats(okTimes);
    console.log(`  p50 ${s.p50}ms · max ${s.max}ms · 예산 4000ms → ${s.max <= 4000 ? 'PASS' : 'FAIL'}`);
  }
}
