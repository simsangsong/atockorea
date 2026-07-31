/**
 * qa-bundle-baseline — what does each smart-app route actually make the phone
 * download, and how long until it shows something? (full-app audit A5)
 *
 * §P-3 #6 left "first-load JS 델타 미계측" as an open debt, and this repo has
 * been burned by reasoning about sizes instead of measuring them (a 700KB claim
 * that measured 423KB). Next 16's build output no longer prints a First Load JS
 * column and emits no app-build-manifest.json, so the honest number is the one
 * the network actually carries: run a production server, load each route with a
 * cold cache, and add up the bytes.
 *
 * Measures per route: JS requests + transferred bytes (JS / total), LCP,
 * DOMContentLoaded, and the number of same-origin /api calls the first paint
 * costs (the N+1 question).
 *
 * Usage:
 *   1) npm run build   2) npx next start -p <port>
 *   3) WALK_BASE=http://localhost:<port> node scripts/qa-bundle-baseline.mjs
 * Writes docs/audit/BUNDLE-BASELINE.md when BASELINE_OUT=1.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3175';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
const lobby = JSON.parse(readFileSync('scripts/.sim-lobby-fixtures.json', 'utf8'));

const ROUTES = [
  { name: '/tour-mode (entry)', url: '/tour-mode' },
  { name: '/tour-mode/room/[id] (guest, live)', url: fx.room1Url, wait: '[data-testid="room-tabbar"]' },
  { name: '/tour-mode/room/[id] (guest, lobby)', url: lobby.roomUrl, wait: '[data-testid="room-tabbar"]' },
  { name: '/tour-mode/guide (staff shell)', url: fx.guideUrl, wait: '[data-testid="staff-shell"]' },
  { name: '/tour-mode/plan/[id] (D-1 editor)', url: lobby.planUrl },
  { name: '/tour-ops (ops console)', url: '/tour-ops' },
];

const browser = await chromium.launch();
const rows = [];

for (const route of ROUTES) {
  // Fresh context per route = cold HTTP cache, the state a first-time guest is in.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 37.5665, longitude: 126.978 },
    permissions: ['geolocation'],
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
  });

  const js = { count: 0, bytes: 0 };
  let totalBytes = 0;
  const apiCalls = [];
  page.on('response', async (res) => {
    const url = res.url();
    try {
      const headers = await res.allHeaders();
      // content-length is absent on compressed/chunked responses — the first run
      // of this script reported 1.1KB of JS for the whole room because of it.
      // request().sizes() reports what the socket actually carried.
      let len = 0;
      try {
        const s = await res.request().sizes();
        len = (s.responseBodySize ?? 0) + (s.responseHeadersSize ?? 0);
      } catch {
        len = Number(headers['content-length'] ?? 0);
      }
      totalBytes += len;
      if (/\.js(\?|$)/.test(url) || (headers['content-type'] ?? '').includes('javascript')) {
        js.count += 1;
        js.bytes += len;
      }
      if (url.startsWith(BASE) && url.includes('/api/')) {
        apiCalls.push(new URL(url).pathname);
      }
    } catch {
      /* a response that vanished mid-flight is not a measurement */
    }
  });

  let lcp = null;
  try {
    await page.goto(BASE + route.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (route.wait) await page.waitForSelector(route.wait, { timeout: 45000 });
    await page.waitForTimeout(2500);
    lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let v = null;
          try {
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) v = e.startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
          } catch {
            /* unsupported */
          }
          setTimeout(() => resolve(v), 400);
        }),
    );
  } catch (e) {
    rows.push({ route: route.name, error: String(e).slice(0, 90) });
    await ctx.close();
    continue;
  }

  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null;
  });

  const dupes = apiCalls.reduce((acc, p) => ((acc[p] = (acc[p] ?? 0) + 1), acc), {});
  const repeated = Object.entries(dupes).filter(([, n]) => n > 1);

  rows.push({
    route: route.name,
    jsReqs: js.count,
    jsKB: +(js.bytes / 1024).toFixed(1),
    totalKB: +(totalBytes / 1024).toFixed(1),
    lcpMs: lcp === null ? '—' : Math.round(lcp),
    dclMs: nav?.dcl ?? '—',
    apiCalls: apiCalls.length,
    repeatedApi: repeated.length ? repeated.map(([p, n]) => `${p}×${n}`).join(' ') : '',
  });
  await ctx.close();
}

await browser.close();
console.table(rows);

if (process.env.BASELINE_OUT === '1') {
  const head = `# BUNDLE-BASELINE — 라우트별 실측 (풀 오디트 A5)\n\n` +
    `> [실측] \`scripts/qa-bundle-baseline.mjs\` · production build + \`next start\` · 390px 모바일 · 콜드 캐시.\n` +
    `> Next 16 빌드 출력에는 First Load JS 열이 없고 \`app-build-manifest.json\`도 없다 —\n` +
    `> 그래서 **네트워크가 실제로 실어 온 바이트**가 정본이다. 델타는 이 표를 기준으로 잰다.\n\n` +
    `| 라우트 | JS 요청 | JS KB | 총 KB | LCP ms | DCL ms | API 호출 | 중복 API |\n|---|---|---|---|---|---|---|---|\n`;
  const body = rows
    .map((r) =>
      r.error
        ? `| ${r.route} | — | — | — | — | — | — | 측정 실패: ${r.error} |`
        : `| ${r.route} | ${r.jsReqs} | ${r.jsKB} | ${r.totalKB} | ${r.lcpMs} | ${r.dclMs} | ${r.apiCalls} | ${r.repeatedApi || '—'} |`,
    )
    .join('\n');
  writeFileSync('docs/audit/BUNDLE-BASELINE.md', head + body + '\n');
  console.log('→ docs/audit/BUNDLE-BASELINE.md');
}
