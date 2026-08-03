/**
 * qa-perf-interactions — §F 성능 예산의 상호작용 지표를 잰다.
 *
 *   #5 메시지 전송 → 화면 반영  < 300ms (옵티미스틱)
 *   #6 카드 탭 → 시트 열림      < 150ms (터치 피드백 임계)
 *
 * `A0-perf-baseline.md` 가 이 둘을 "미측정 (6/10)" 으로 남기고 착수 조건을
 * *"dev 서버 + 실기기/스로틀 + 시뮬 데이터"* 라고 적어 뒀다. 그 조건이 갖춰져서 잰다.
 *
 * 🔴 계측은 **페이지 안에서** 한다. 150ms 예산에 Playwright 의 Node↔브라우저 왕복이
 *    섞이면 재는 게 앱이 아니라 하니스가 된다. click 과 대기를 한 evaluate 안에서 끝낸다.
 * 🔴 CPU 스로틀은 켠다(기본 4x). 손님은 데스크톱이 아니다.
 *    네트워크는 기본으로 걸지 **않는다** — 옵티미스틱 렌더는 정의상 왕복을 기다리지 않아야
 *    하고, 네트워크를 걸면 "안 기다린다"는 성질 자체를 검증할 수 없다. `--net` 으로 켤 수 있다.
 *
 * 사용:
 *   1) npm run build && npx next start -p <port>
 *   2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *   3) WALK_BASE=http://localhost:<port> node scripts/qa-perf-interactions.mjs [--runs 5] [--cpu 4] [--net]
 * 종료 코드: 측정 실패 · 표본 0건이면 1.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const BASE = process.env.WALK_BASE ?? 'http://localhost:3175';
const RUNS = Math.max(1, Number(flag('runs', '5')));
const CPU = Number(flag('cpu', '4'));
const NET = argv.includes('--net');

let fx;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  console.error('scripts/.sim-fixtures.json 이 없다. ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts');
  process.exit(1);
}

/**
 * 한 번의 상호작용을 페이지 안에서 잰다.
 * trigger 를 누른 순간부터 expect 가 DOM 에 나타날 때까지, rAF 로 폴링.
 * appearedOnly=true 면 "이미 있던 것"을 성공으로 오인하지 않도록 사전 존재를 확인한다.
 */
// 🔴 page.evaluate 는 인자를 **하나만** 넘긴다. 다인자 시그니처로 쓰면 두 번째부터 undefined 가
//    되고, 그러면 querySelectorAll(undefined) 가 0 을 돌려주며 "시간초과"로 보인다 —
//    앱이 느린 걸로 오해하기 딱 좋다(초판에서 실제로 그랬다). 그래서 객체 하나로 받는다.
const IN_PAGE_MEASURE = ({ triggerSel, expectSel }) =>
  new Promise((resolve) => {
    const trigger = document.querySelector(triggerSel);
    if (!trigger) return resolve({ error: `trigger 없음: ${triggerSel}` });
    const before = document.querySelectorAll(expectSel).length;
    if (before > 0) return resolve({ error: `이미 떠 있음(닫고 재시도 필요): ${expectSel}` });
    const t0 = performance.now();
    trigger.click();
    const tick = () => {
      if (document.querySelectorAll(expectSel).length > 0) return resolve({ ms: performance.now() - t0 });
      if (performance.now() - t0 > 8000) return resolve({ error: `시간초과: ${expectSel}` });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

const stats = (xs) => {
  const v = xs.slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return {
    n: v.length,
    p50: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    max: +v[v.length - 1].toFixed(1),
    // 🔴 첫 회를 뺀 값도 같이 낸다. 첫 열기는 코드 스플릿·이미지 등 1회성 비용을 포함하는데,
    //    n 이 작으면 p95 가 사실상 그 1회를 가리켜 "상시 느림"으로 오독된다.
    warm: xs.length > 1 ? +xs.slice(1).sort((a, b) => a - b)[Math.floor(0.5 * (xs.length - 1))].toFixed(1) : null,
    first: +xs[0].toFixed(1),
  };
};

const browser = await chromium.launch();
const results = [];
const failures = [];

async function openRoom() {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 33.4996, longitude: 126.5312 },
    permissions: ['geolocation'],
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => window.localStorage.setItem('tr_manual_seen_v2', String(Date.now())));
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  if (NET) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (4 * 1024 * 1024) / 8,
      uploadThroughput: (3 * 1024 * 1024) / 8,
      latency: 70,
    });
  }
  await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 120000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

// ── #6 카드 탭 → 시트 열림 (서랍) ────────────────────────────────────────────
// 룸 하나를 열어 두고 열기/닫기를 반복한다. 매번 새 룸을 여는 것보다 훨씬 싸고,
// 재는 대상(탭→시트 애니메이션 시작~DOM 등장)은 동일하다.
try {
  const { ctx, page } = await openRoom();
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const r = await page.evaluate(IN_PAGE_MEASURE, {
      triggerSel: '[data-testid="room-drawer-open"]',
      expectSel: '[data-testid="room-drawer"]',
    });
    if (r.error) {
      failures.push(`#6 drawer run${i}: ${r.error}`);
      break;
    }
    samples.push(r.ms);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(600);
  }
  if (samples.length) results.push({ metric: '#6 카드 탭 → 시트 열림 (서랍)', budget: 150, ...stats(samples) });
  await ctx.close();
} catch (e) {
  failures.push('#6 drawer: ' + String(e).split('\n')[0].slice(0, 120));
}

// ── #5 메시지 전송 → 화면 반영 (옵티미스틱) ─────────────────────────────────
// 퀵리플라이 칩은 한 번의 탭으로 즉시 전송한다(Composer `tapPreset`) — 텍스트 입력
// 포커스/타이핑 변수를 빼고 전송 경로만 재기에 가장 깨끗한 트리거다.
// 판정 대상은 `bubble-sending`(옵티미스틱 버블). 서버 왕복이 아니라 화면 반영이 예산이다.
try {
  const { ctx, page } = await openRoom();
  await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click({ timeout: 20000 });
  await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const r = await page.evaluate(
      ([expect]) =>
        new Promise((resolve) => {
          const chips = document.querySelectorAll('[data-testid="quick-replies"] button');
          if (!chips.length) return resolve({ error: 'quick-replies 칩 없음' });
          const chip = chips[Math.floor(Math.random() * chips.length)];
          const before = document.querySelectorAll(expect).length;
          const t0 = performance.now();
          chip.click();
          const tick = () => {
            if (document.querySelectorAll(expect).length > before) return resolve({ ms: performance.now() - t0 });
            if (performance.now() - t0 > 8000) return resolve({ error: '옵티미스틱 버블이 안 나타남' });
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      ['[data-testid="bubble-sending"]'],
    );
    if (r.error) {
      failures.push(`#5 send run${i}: ${r.error}`);
      break;
    }
    samples.push(r.ms);
    await page.waitForTimeout(1500); // 이전 전송이 정착할 시간
  }
  if (samples.length) results.push({ metric: '#5 메시지 전송 → 화면 반영 (옵티미스틱)', budget: 300, ...stats(samples) });
  await ctx.close();
} catch (e) {
  failures.push('#5 send: ' + String(e).split('\n')[0].slice(0, 120));
}

await browser.close();

// 🔴 비-공허 단정 — 0개를 재고 초록으로 끝내지 않는다.
if (!results.length) {
  console.error('FAIL: 측정된 지표가 0건이다.');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}

console.log(`\nCPU ${CPU}x · 네트워크 ${NET ? '4G 스로틀' : '무스로틀(옵티미스틱 검증 목적)'} · runs=${RUNS}`);
console.table(
  results.map((r) => ({
    지표: r.metric,
    예산: r.budget + 'ms',
    첫회: r.first,
    'warm p50': r.warm,
    p50: r.p50,
    p95: r.p95,
    max: r.max,
    n: r.n,
    판정: r.p95 <= r.budget ? 'PASS' : 'FAIL',
  })),
);
for (const f of failures) console.log('  ⚠ ' + f);

const over = results.filter((r) => r.p95 > r.budget);
if (over.length) console.log('\n예산 초과: ' + over.map((r) => `${r.metric} p95=${r.p95}ms > ${r.budget}ms`).join(' · '));
else console.log('\n측정한 상호작용 지표는 전부 예산 안.');

// 🔴 못 잰 지표가 있으면 실패다. "일부만 재고 초록" 은 이 레포가 이미 값을 치른 실패 모양이다
//    — 초판이 #6 을 통째로 못 재고도 exit 0 을 돌려줬다.
if (failures.length) {
  console.error('\nFAIL: 측정하지 못한 지표가 있다.');
  process.exit(1);
}
