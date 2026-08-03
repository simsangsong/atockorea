/**
 * qa-uiux-flow — what it costs to walk through the door (U5).
 *
 * `docs/audit/feature-journey.md` already answers whether a door exists: it
 * counts endpoints per role per stage, and records "guest × 투어 중 = 24".
 * That is capability. Twenty-four endpoints can all be present and the guest
 * still never tells anyone they are running late, because it takes five taps
 * while walking.
 *
 * So this counts TAPS, not endpoints, for the things a guest actually has to
 * do mid-tour, starting from where the app leaves them — the room home tab.
 *
 * Judged (plan §4 D/H, §5 U5):
 *   taps        how many presses from the home tab to the task being done
 *   crossings   how many times the surface changes under them
 *   reachable   whether the path exists at all from the home tab
 *
 * 🔴 A task counted as 0 taps is a measurement failure, not a free feature —
 * see UX-000. Every task asserts a success marker, and a task whose marker
 * never appears is recorded as unreachable rather than as a cheap win.
 *
 * Usage:
 *   1) dev server (WALK_BASE, default :3181), NEXT_PUBLIC_TOUR_MODE_V1=1
 *   2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *   3) node scripts/qa-uiux-flow.mjs [--json]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]'];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

/**
 * Each task is the shortest path a guest can take, expressed as the taps they
 * make. `done` is the proof it happened — without it a mistyped selector
 * silently becomes "0 taps, very efficient".
 */
const TASKS = [
  {
    key: '늦는다고 알리기',
    why: '집합 시각에 못 맞출 때. 가장 시간에 쫓기는 조작',
    steps: ['[data-testid="room-tab-chat"]', '[data-testid="signal-running_late"]'],
    done: '[data-testid="confirm-sheet-ok"], [data-testid="chat-feed"]',
  },
  {
    key: '길을 잃었다고 알리기',
    why: '위치 공유가 붙는 신호. 손님이 가장 당황한 순간',
    steps: ['[data-testid="room-tab-chat"]', '[data-testid="signal-share_location"]'],
    done: '[data-testid="confirm-sheet-ok"], [data-testid="location-preview"]',
  },
  {
    key: '가이드에게 말 걸기',
    why: '자유 입력. 모든 미분류 요구가 여기로 온다',
    steps: ['[data-testid="room-tab-chat"]'],
    done: '[data-testid="chat-feed"]',
  },
  {
    key: '오늘 일정 보기',
    why: '"다음이 뭐죠"는 투어 중 가장 흔한 질문',
    steps: ['[data-testid="room-tab-schedule"]'],
    done: '[data-testid="schedule-panel"], [data-testid="tour-itinerary"], main',
  },
  {
    key: '집합 장소 열기',
    why: '지도 없이 못 찾는다. 홈에 칩이 있으면 1탭',
    steps: ['[data-testid="home-now-chip-meeting_point"]'],
    /**
     * 🔴 Wrong twice on this one task, and both times it read as an app defect.
     *
     * First guess was a map — location-preview / room-map / nav-chip. The chip
     * runs `setSheet('pickup')` (HomeTab.tsx:663). Second guess was therefore
     * the pickup board, and that failed too: the sheet branches by product
     * (M-D5). A private tour lets the guest set time and place, so it renders
     * LobbyCard; only join tours get the fixed PickupBoard. The simulator seeds
     * a private tour.
     *
     * Both failures looked exactly like a dead-end chip. A judge that invents
     * defects is abandoned as fast as one that hides them, so the marker now
     * accepts either branch — and the sheet itself, which is the real proof the
     * tap did something.
     */
    done: '[data-testid="room-sheet"]',
  },
  {
    key: '스마트가이드에 묻기',
    why: 'UX-002 가 사는 자리 — 13초를 치르기까지 몇 탭인가',
    steps: ['[data-testid="concierge-open"]'],
    done: '[data-testid="concierge-panel"], [data-testid="concierge-input"], textarea',
  },
  {
    key: '긴급 상황',
    why: '가장 비싼 실패. 탭이 하나라도 많으면 안 된다',
    steps: ['[data-testid="emergency-open"]'],
    done: '[data-testid="emergency-sheet"], [data-testid="sos-button"], [role="dialog"]',
  },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 37.5665, longitude: 126.978 },
  permissions: ['geolocation'],
});

const results = [];

for (const task of TASKS) {
  const page = await ctx.newPage();
  const surfaces = new Set();
  let taps = 0;
  let failure = null;
  try {
    await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const manual = page.locator('[data-testid="app-manual-dismiss"]');
    if (await manual.isVisible().catch(() => false)) {
      await manual.click({ timeout: 5000 }).catch(() => {});
      // The manual is a first-run cost, not part of the task. Counted separately.
      await page.waitForTimeout(400);
    }

    for (const sel of task.steps) {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout: 20000 });
      await el.click({ timeout: 20000 });
      taps += 1;
      await page.waitForTimeout(900);
      surfaces.add(await page.evaluate(() => document.querySelector('[data-tr-tab]')?.getAttribute('data-tr-tab') ?? location.hash ?? ''));
    }

    // 🔴 Proof, not assumption.
    await page.waitForSelector(task.done, { timeout: 20000 });
    results.push({ ...task, taps, crossings: surfaces.size, reachable: true });
  } catch (e) {
    failure = String(e).split('\n')[0].slice(0, 110);
    results.push({ ...task, taps, crossings: surfaces.size, reachable: false, failure });
  }
  await page.close();
}

await browser.close();

const out = { base: BASE, results };
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('손님 투어 중 과업 — 홈 탭에서 시작해 몇 번 눌러야 끝나는가\n');
  for (const r of results) {
    const mark = !r.reachable ? '🔴 도달 실패' : r.taps <= 2 ? '✅' : r.taps === 3 ? '⚠' : '🔴 깊다';
    console.log(`${mark}  ${String(r.taps).padStart(2)}탭  ${r.key}`);
    console.log(`        ${r.why}`);
    if (!r.reachable) console.log(`        실패: ${r.failure}`);
  }
  const ok = results.filter((r) => r.reachable);
  console.log(`\n도달 ${ok.length}/${results.length} · 평균 ${ok.length ? (ok.reduce((n, r) => n + r.taps, 0) / ok.length).toFixed(1) : '—'}탭`);
}

/** A run where nothing was reachable measured the harness, not the app. */
if (results.every((r) => !r.reachable)) {
  console.error('\n🔴 모든 과업이 도달 실패 — 시뮬이 비었거나 서버가 다른 코드를 서빙 중이다.');
  process.exit(2);
}
