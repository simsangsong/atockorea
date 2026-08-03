/**
 * qa-perf-throttled — 스로틀 걸린 실사용 조건에서의 라우트 성능.
 *
 * 왜 이게 따로 있나: `qa-bundle-baseline.mjs` 가 라우트별 바이트·LCP 를 이미 재지만
 * **스로틀이 없다.** 그 문서가 스스로 못 박아 뒀다 —
 *   "LCP는 스로틀 없는 localhost 값이라 절대치로 쓰면 안 된다. 델타 감시용이다."
 * 그리고 `APP-SURFACE-CATALOG.md:80` 이 `A5 성능 … ✗ 3G LCP` 로 공백을 기록해 뒀다.
 * §F 성능 예산의 "룸 진입 첫 유의미 렌더 < 2.5s (4G)" 는 스로틀 없이는 판정 자체가 불가능하다.
 *
 * 이 스크립트는 그 공백만 닫는다. 바이트 회귀 감시는 계속 qa-bundle-baseline 이 한다.
 *
 * 🔴 스로틀은 실기기가 아니라 **재현 가능한 대리값**이다. 프로파일 수치를 출력에 박아서
 *    다음 세션이 다른 조건의 값과 섞어 비교하지 못하게 한다.
 *
 * 사용:
 *   1) npm run build   2) npx next start -p <port>
 *   3) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-lobby-booking.ts
 *   4) WALK_BASE=http://localhost:<port> node scripts/qa-perf-throttled.mjs [--profile 4g|slow4g|none]
 *                                                                          [--runs 3] [--out]
 * 종료 코드: 측정 실패 · 라우트 0건 · 지표 수집 실패 시 **1**. (게이트로 쓸 수 있어야 한다 —
 * 기존 워크 하니스들은 실패해도 exit 0 이라 게이트가 못 된다.)
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const BASE = process.env.WALK_BASE ?? 'http://localhost:3175';
const PROFILE = flag('profile', '4g');
const RUNS = Math.max(1, Number(flag('runs', '3')));
const WRITE = argv.includes('--out');

/** Chrome DevTools 스로틀 값. 숫자를 출력에 그대로 싣는다 — 조건 없는 측정치는 쓸모가 없다. */
const PROFILES = {
  // 한국 도심 LTE 근사. §F 예산이 말하는 "4G".
  '4g': { downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8, latency: 70, cpu: 4 },
  // 관광지·버스 이동 중 열화 구간. DevTools "Fast 3G" 와 동일 수치.
  slow4g: { downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150, cpu: 4 },
  none: null,
};
if (!(PROFILE in PROFILES)) {
  console.error(`unknown --profile ${PROFILE} (4g | slow4g | none)`);
  process.exit(1);
}
const P = PROFILES[PROFILE];

const readFx = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};
const fx = readFx('scripts/.sim-fixtures.json');
const lobby = readFx('scripts/.sim-lobby-fixtures.json');
if (!fx) {
  console.error('scripts/.sim-fixtures.json 이 없다. ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts');
  process.exit(1);
}

const ROUTES = [
  { name: '/tour-mode (entry)', url: '/tour-mode' },
  { name: '/tour-mode/room/[id] (guest, live)', url: fx.room1Url, wait: '[data-testid="room-tabbar"]' },
  lobby && { name: '/tour-mode/room/[id] (guest, lobby)', url: lobby.roomUrl, wait: '[data-testid="room-tabbar"]' },
  { name: '/tour-mode/guide (staff shell)', url: fx.guideUrl, wait: '[data-testid="staff-shell"]' },
  lobby && { name: '/tour-mode/plan/[id] (D-1 editor)', url: lobby.planUrl },
  { name: '/tour-ops (ops console)', url: '/tour-ops' },
].filter(Boolean);

/**
 * 한 번의 콜드 로드. 새 컨텍스트 = 빈 HTTP 캐시 = 처음 링크를 여는 손님의 상태.
 * long task 관찰자는 반드시 goto 이전에 심어야 한다(addInitScript) — 나중에 붙이면
 * 가장 비싼 초기 구간을 통째로 놓치고 "0건"을 조용히 보고한다.
 */
async function measureOnce(browser, route) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 33.4996, longitude: 126.5312 },
    permissions: ['geolocation'],
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
    window.__perf = { longTasks: [], cls: 0 };
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__perf.longTasks.push({ start: e.startTime, dur: e.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });

  const cdp = await ctx.newCDPSession(page);
  if (P) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: P.downloadThroughput,
      uploadThroughput: P.uploadThroughput,
      latency: P.latency,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  }

  const js = { count: 0, bytes: 0 };
  let totalBytes = 0;
  let reqCount = 0;
  const apiCalls = [];
  page.on('response', async (res) => {
    reqCount += 1;
    try {
      const headers = await res.allHeaders();
      // content-length 는 압축·청크 응답에서 없다. 소켓이 실제로 실어 온 바이트를 쓴다
      // (qa-bundle-baseline 이 이 함정으로 룸 전체를 "1.1KB" 로 보고한 적이 있다).
      let len = 0;
      try {
        const s = await res.request().sizes();
        len = (s.responseBodySize ?? 0) + (s.responseHeadersSize ?? 0);
      } catch {
        len = Number(headers['content-length'] ?? 0);
      }
      totalBytes += len;
      const url = res.url();
      if (/\.js(\?|$)/.test(url) || (headers['content-type'] ?? '').includes('javascript')) {
        js.count += 1;
        js.bytes += len;
      }
      if (url.startsWith(BASE) && url.includes('/api/')) apiCalls.push(new URL(url).pathname);
    } catch {
      /* 사라진 응답은 측정치가 아니다 */
    }
  });

  const t0 = Date.now();
  await page.goto(BASE + route.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // 🔴 "첫 유의미 렌더" = 손님이 실제로 쓸 수 있는 것이 화면에 있는 순간.
  // DOMContentLoaded 가 아니라 이 셀렉터가 §F 예산의 판정 지점이다.
  let meaningfulMs = null;
  if (route.wait) {
    await page.waitForSelector(route.wait, { timeout: 120000 });
    meaningfulMs = Date.now() - t0;
  }
  await page.waitForTimeout(3000); // LCP·CLS 가 안정될 시간

  /**
   * 🔴 대기 셀렉터가 없는 라우트(entry · plan · ops)는 **오류 화면도 그대로 잰다.**
   * 시뮬 예약이 사라지면 "예약을 찾을 수 없습니다" 한 장이 뜨는데, 그건 아주 빠르게 뜨므로
   * 숫자는 오히려 좋아 보인다 — 회귀를 개선으로 읽게 된다.
   * 그래서 렌더된 내용이 실제로 있는지 최소한으로 단언한다.
   * (타 세션이 같은 함정을 밟았다: 예약이 지워진 뒤에도 "위반 0" 을 초록으로 보고했다. 2026-08-03)
   */
  const reached = await page.evaluate(() => {
    const text = document.body?.innerText ?? '';
    const dead = /예약을 찾을 수 없|찾을 수 없습니다|not found|링크를 열 수 없/i.test(text);
    return { chars: text.trim().length, nodes: document.querySelectorAll('*').length, dead };
  });
  if (reached.dead || reached.chars < 80 || reached.nodes < 60) {
    throw new Error(
      `도달 실패: ${route.name} — 화면에 내용이 없다(chars ${reached.chars} · nodes ${reached.nodes}` +
        `${reached.dead ? ' · "찾을 수 없음" 문구' : ''}). 시드 상태를 확인할 것.`,
    );
  }

  const m = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = null;
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) lcp = e.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {}
        setTimeout(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const fcp = performance.getEntriesByName('first-contentful-paint')[0];
          const lt = window.__perf?.longTasks ?? [];
          resolve({
            ttfb: nav ? Math.round(nav.responseStart) : null,
            fcp: fcp ? Math.round(fcp.startTime) : null,
            lcp: lcp === null ? null : Math.round(lcp),
            dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
            load: nav ? Math.round(nav.loadEventEnd) : null,
            cls: +(window.__perf?.cls ?? 0).toFixed(3),
            longTasks: lt.length,
            // TBT 근사: long task 의 50ms 초과분 합. FCP 이후만 세는 정식 정의와 다르므로 이름에 표시.
            tbtApprox: Math.round(lt.reduce((a, t) => a + Math.max(0, t.dur - 50), 0)),
          });
        }, 600);
      }),
  );

  const dupes = apiCalls.reduce((a, p) => ((a[p] = (a[p] ?? 0) + 1), a), {});
  await ctx.close();
  return {
    ...m,
    meaningfulMs,
    jsReqs: js.count,
    jsKB: +(js.bytes / 1024).toFixed(1),
    totalKB: +(totalBytes / 1024).toFixed(1),
    reqCount,
    apiCalls: apiCalls.length,
    repeatedApi: Object.entries(dupes)
      .filter(([, n]) => n > 1)
      .map(([p, n]) => `${p}×${n}`),
  };
}

const median = (xs) => {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
};

const browser = await chromium.launch();
const rows = [];
const failures = [];

for (const route of ROUTES) {
  const runs = [];
  let err = null;
  for (let i = 0; i < RUNS; i += 1) {
    try {
      runs.push(await measureOnce(browser, route));
    } catch (e) {
      err = String(e).split('\n')[0].slice(0, 140);
      break;
    }
  }
  if (err || !runs.length) {
    failures.push(`${route.name}: ${err ?? 'no runs'}`);
    rows.push({ route: route.name, error: err ?? 'no runs' });
    continue;
  }
  const last = runs[runs.length - 1];
  rows.push({
    route: route.name,
    runs: runs.length,
    ttfb: median(runs.map((r) => r.ttfb)),
    fcp: median(runs.map((r) => r.fcp)),
    lcp: median(runs.map((r) => r.lcp)),
    meaningful: median(runs.map((r) => r.meaningfulMs)),
    tbtApprox: median(runs.map((r) => r.tbtApprox)),
    longTasks: median(runs.map((r) => r.longTasks)),
    cls: last.cls,
    jsKB: last.jsKB,
    totalKB: last.totalKB,
    reqCount: last.reqCount,
    apiCalls: last.apiCalls,
    repeatedApi: last.repeatedApi.join(' ') || '',
  });
}
await browser.close();

// 🔴 비-공허 단정. 0개를 재면서 초록인 게이트를 만들지 않는다 — 이 레포가 그걸 한 번 했다.
const measured = rows.filter((r) => !r.error);
if (!measured.length) {
  console.error('FAIL: 측정된 라우트가 0건이다.');
  process.exit(1);
}
const noMetric = measured.filter((r) => r.lcp === null && r.fcp === null);
if (noMetric.length) {
  console.error('FAIL: 지표를 하나도 못 얻은 라우트 — ' + noMetric.map((r) => r.route).join(', '));
  process.exit(1);
}

console.log(`\nprofile=${PROFILE}` + (P ? ` (${(P.downloadThroughput * 8) / 1024 / 1024}Mbps↓ / RTT ${P.latency}ms / CPU ${P.cpu}x)` : ' (스로틀 없음)') + `  runs=${RUNS} (중앙값)`);
console.table(measured.map(({ repeatedApi, ...r }) => r));
for (const r of measured) if (r.repeatedApi) console.log(`  중복 API — ${r.route}: ${r.repeatedApi}`);

if (WRITE) {
  mkdirSync('docs/audit', { recursive: true });
  const cond = P
    ? `${(P.downloadThroughput * 8) / 1024 / 1024} Mbps↓ · ${(P.uploadThroughput * 8) / 1024 / 1024} Mbps↑ · RTT ${P.latency}ms · CPU ${P.cpu}x`
    : '스로틀 없음';
  const head =
    `# PERF-THROTTLED — 스로틀 조건 실측 (프로파일 \`${PROFILE}\`)\n\n` +
    `> [실측] \`scripts/qa-perf-throttled.mjs\` · production build + \`next start\` · 390px 모바일 · 콜드 캐시 · ${RUNS}회 중앙값.\n` +
    `> **조건: ${cond}** — 실기기가 아니라 **재현 가능한 대리값**이다. 다른 조건의 숫자와 섞어 비교하지 말 것.\n` +
    `> 무스로틀 바이트 베이스라인은 \`BUNDLE-BASELINE.md\` 가 정본이다.\n\n` +
    `| 라우트 | TTFB | FCP | LCP | **첫 유의미** | TBT≈ | longTask | CLS | JS KB(창내) | 총 KB(창내) | 요청 | API |\n` +
    `|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const body = rows
    .map((r) =>
      r.error
        ? `| ${r.route} | — | — | — | — | — | — | — | — | — | — | 측정 실패: ${r.error} |`
        : `| ${r.route} | ${r.ttfb ?? '—'} | ${r.fcp ?? '—'} | ${r.lcp ?? '—'} | **${r.meaningful ?? '—'}** | ${r.tbtApprox ?? '—'} | ${r.longTasks ?? '—'} | ${r.cls} | ${r.jsKB} | ${r.totalKB} | ${r.reqCount} | ${r.apiCalls} |`,
    )
    .join('\n');
  const notes =
    `\n\n## 읽는 법\n\n` +
    `- **첫 유의미** = 손님이 실제로 쓸 수 있는 것이 뜬 순간(룸은 \`room-tabbar\`, 가이드는 \`staff-shell\`).\n` +
    `  §F 예산 "룸 진입 첫 유의미 렌더 < 2.5s (4G)" 의 판정 지점은 **이 열**이다. LCP 가 아니다.\n` +
    `- 셀렉터 대기가 없는 라우트(entry · plan · ops)는 첫 유의미가 \`—\` 다 — 측정 안 함이지 0 이 아니다.\n` +
    `- **TBT≈** 는 long task 의 50ms 초과분 합. FCP 이후만 세는 정식 TBT 와 다르므로 근사 표기.\n` +
    `- 시간은 ${RUNS}회 중앙값, 바이트·요청 수는 마지막 회차 값.\n` +
    `- 🔴 **"창내" = 관측창(DOMContentLoaded + 3초) 안에 도착한 바이트만**이다. 스로틀이 걸리면\n` +
    `  이미지·후속 청크가 창 밖으로 밀려 **총량이 과소 집계된다**(실측: \`/tour-ops\` 무스로틀 768 KB →\n` +
    `  4G 창내 537 KB). **전송량의 정본은 \`BUNDLE-BASELINE.md\`(무스로틀·완주)** 이고,\n` +
    `  이 표의 바이트 열은 "손님이 쓸 수 있게 된 시점까지 실제로 내려온 양"으로만 읽는다.\n`;
  writeFileSync(`docs/audit/PERF-THROTTLED-${PROFILE}.md`, head + body + notes);
  console.log(`→ docs/audit/PERF-THROTTLED-${PROFILE}.md`);
}

if (failures.length) {
  console.error('\nFAILED ROUTES:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('\nPERF WALK OK');
