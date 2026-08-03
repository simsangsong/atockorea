/**
 * qa-perf-payload — 이 라우트에서 폰이 **정확히 무엇을** 내려받는가.
 *
 * `qa-perf-throttled` 는 합계(JS KB · 총 KB)를 낸다. 합계가 움직였을 때 "무엇이 늘었나"는
 * 답하지 못하고, 그 질문이 대개 진짜 질문이다 — 원장 P-12 가 그 경우다(룸 총 전송이
 * 1,336 → 1,784 KB 로 뛰었는데 코드 변경인지 데이터 양인지 몰랐다).
 *
 * 종류별 합계 + 큰 응답 상위 N 을 낸다. 코드가 늘었으면 `.js` 가, 내용이 늘었으면
 * 이미지·API 응답이 올라간다 — 그 구분이 이 스크립트의 전부다.
 *
 * 사용:
 *   WALK_BASE=http://localhost:<port> node scripts/qa-perf-payload.mjs [--surface guest|lobby|guide] [--top 15]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const BASE = process.env.WALK_BASE ?? 'http://localhost:3175';
const SURFACE = flag('surface', 'guest');
const TOP = Math.max(1, Number(flag('top', '15')));

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
const target =
  SURFACE === 'lobby'
    ? { url: lobby?.roomUrl, wait: '[data-testid="room-tabbar"]', label: '손님 룸(로비)' }
    : SURFACE === 'guide'
      ? { url: fx.guideUrl, wait: '[data-testid="staff-shell"]', label: '가이드 콘솔' }
      : { url: fx.room1Url, wait: '[data-testid="room-tabbar"]', label: '손님 룸(진행 중)' };
if (!target.url) {
  console.error(`${SURFACE} 픽스처가 없다.`);
  process.exit(1);
}

/** content-type → 사람이 읽는 분류. 확장자보다 헤더가 정확하다. */
function kindOf(url, ctype) {
  const c = (ctype ?? '').toLowerCase();
  if (url.includes('/api/')) return 'API';
  if (c.includes('javascript') || /\.js(\?|$)/.test(url)) return 'JS';
  if (c.includes('css')) return 'CSS';
  if (c.startsWith('image/')) return '이미지';
  if (c.startsWith('font/') || c.includes('font')) return '폰트';
  if (c.includes('html')) return 'HTML';
  if (c.startsWith('video/') || c.startsWith('audio/')) return '미디어';
  return '기타';
}

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

const rows = [];
page.on('response', async (res) => {
  try {
    const headers = await res.allHeaders();
    let bytes = 0;
    try {
      const s = await res.request().sizes();
      bytes = (s.responseBodySize ?? 0) + (s.responseHeadersSize ?? 0);
    } catch {
      bytes = Number(headers['content-length'] ?? 0);
    }
    const url = res.url();
    rows.push({ url, kind: kindOf(url, headers['content-type']), bytes, status: res.status() });
  } catch {
    /* 사라진 응답은 측정치가 아니다 */
  }
});

await page.goto(BASE + target.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector(target.wait, { timeout: 120000 });
await page.waitForTimeout(6000); // 후속 로드까지 받는다 — 합계를 보려는 것이므로 창을 넉넉히
await browser.close();

if (!rows.length) {
  console.error('FAIL: 응답 0건 — 아무것도 안 재고 있다.');
  process.exit(1);
}

const byKind = new Map();
for (const r of rows) {
  const cur = byKind.get(r.kind) ?? { n: 0, bytes: 0 };
  cur.n += 1;
  cur.bytes += r.bytes;
  byKind.set(r.kind, cur);
}
const total = rows.reduce((a, r) => a + r.bytes, 0);

console.log(`\n[${target.label}] 응답 ${rows.length}건 · 합계 ${(total / 1024).toFixed(1)} KB`);
console.table(
  [...byKind.entries()]
    .map(([kind, v]) => ({ 종류: kind, 건수: v.n, KB: +(v.bytes / 1024).toFixed(1), '비중%': +((v.bytes / total) * 100).toFixed(1) }))
    .sort((a, b) => b.KB - a.KB),
);
console.log(`\n큰 응답 상위 ${TOP}`);
console.table(
  rows
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, TOP)
    .map((r) => ({
      KB: +(r.bytes / 1024).toFixed(1),
      종류: r.kind,
      status: r.status,
      // 도메인은 떼고 경로만 — 어느 파일인지가 요점이다.
      경로: r.url.replace(BASE, '').replace(/^https?:\/\/[^/]+/, '↗').slice(0, 95),
    })),
);
