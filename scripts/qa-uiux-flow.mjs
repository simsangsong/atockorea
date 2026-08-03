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
export const COVERS = ['/tour-mode/room/[bookingId]', '/tour-mode/guide'];

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

/**
 * Staff tasks. Same rule as the guest list: the marker proves the tap did
 * something, and it is read off the component rather than guessed — the guest
 * meeting-point task cost two false failures for guessing.
 */
const STAFF_TASKS = [
  {
    key: '[가이드] 오늘 도구 열기',
    why: '가이드가 투어 중 가장 자주 여는 서랍',
    url: () => fx.guideUrl,
    ready: '[data-testid="guide-console"], [data-testid="drive-hero"]',
    steps: ['[data-testid="daytools-open"]'],
    done: '[data-testid="daytools-sheet"]',
  },
  {
    key: '[가이드] 손님에게 방송하기',
    why: '일행 전체에 한 번에 알리는 유일한 길',
    url: () => fx.guideUrl,
    ready: '[data-testid="guide-console"], [data-testid="drive-hero"]',
    steps: ['[data-testid="guide-broadcast-mic"]'],
    done: '[data-testid="guide-recording-bar"], [data-testid="guide-target-picker"], [data-testid="guide-mic-note"]',
    /**
     * 🔴 Not a defect when this is missing. The button renders behind
     * `voiceSupported && sttBookingId`, and voiceSupported comes from
     * `isVoiceRecordingSupported()` — false in headless Chromium without a fake
     * media device. Reporting it as unreachable would file the harness's own
     * limitation as an app failure, which is the third time today a judge
     * nearly manufactured a defect. Measuring it for real needs
     * --use-fake-device-for-media-stream.
     */
    envRequires: { selector: '[data-testid="guide-broadcast-mic"]', note: '마이크 지원 (headless 미지원)' },
  },
  {
    key: '[기사] 운전 모드 진입',
    why: 'UX-D10 — 방 개수에 따라 경로가 갈린다',
    url: () => fx.guideUrl,
    ready: '[data-testid="drive-hero"], [data-testid="staff-tab-btn-ops"]',
    steps: ['[data-testid="drive-hero"]'],
    done: '[data-testid="driver-feed"], [data-testid="ops-drive"]',
  },
];

/**
 * 헛탭 — how many presses land on nothing while a surface is painted but not
 * yet listening.
 *
 * The performance track measured the window: the guide console paints at 676ms
 * and becomes usable at 2,454ms. That says how long. This says what it costs
 * the person standing there, who does not know the app is not ready and presses
 * again. A control that is rendered but inert is worse than one that is absent,
 * because the guide believes the tap landed and moves on.
 *
 * ⚠ Measured against a DEV server, not the production build the performance
 * track throttled. The count is not comparable to theirs and is used only as a
 * qualitative answer: does the window swallow taps at all.
 */
async function wastedTaps(ctx2, url, selector, proof, budgetMs = 15000) {
  const page = await ctx2.newPage();
  const t0 = Date.now();
  let taps = 0;
  let firstSeenAt = null;
  let landedAt = null;
  try {
    await page.goto(BASE + url, { waitUntil: 'commit', timeout: 120000 });
    while (Date.now() - t0 < budgetMs) {
      const el = page.locator(selector).first();
      const visible = await el.isVisible().catch(() => false);
      if (visible) {
        if (firstSeenAt === null) firstSeenAt = Date.now() - t0;
        await el.click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
        taps += 1;
        const ok = await page
          .locator(proof)
          .first()
          .waitFor({ state: 'visible', timeout: 250 })
          .then(() => true)
          .catch(() => false);
        if (ok) {
          landedAt = Date.now() - t0;
          break;
        }
      }
      await page.waitForTimeout(200);
    }
  } catch {
    /* recorded below as landedAt === null */
  }
  await page.close();
  return { taps, wasted: landedAt === null ? taps : taps - 1, firstSeenAt, landedAt };
}

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

// ── staff tasks ────────────────────────────────────────────────────────────
for (const task of STAFF_TASKS) {
  const page = await ctx.newPage();
  let taps = 0;
  try {
    await page.goto(BASE + task.url(), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector(task.ready, { timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    if (task.envRequires) {
      const present = await page.locator(task.envRequires.selector).first().count();
      if (!present) {
        results.push({ ...task, taps: 0, crossings: 0, envSkipped: task.envRequires.note });
        await page.close();
        continue;
      }
    }
    for (const sel of task.steps) {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout: 20000 });
      await el.click({ timeout: 20000 });
      taps += 1;
      await page.waitForTimeout(900);
    }
    await page.waitForSelector(task.done, { timeout: 25000 });
    results.push({ ...task, taps, crossings: 1, reachable: true });
  } catch (e) {
    results.push({ ...task, taps, crossings: 0, reachable: false, failure: String(e).split('\n')[0].slice(0, 110) });
  }
  await page.close();
}

// ── dead window (성능 트랙 ① 후속) ─────────────────────────────────────────
const dead = {
  guide: await wastedTaps(ctx, fx.guideUrl, '[data-testid="daytools-open"]', '[data-testid="daytools-sheet"]'),
  guest: await wastedTaps(ctx, fx.room1Url, '[data-testid="room-tab-chat"]', '[data-testid="chat-feed"]'),
};

await browser.close();

const out = { base: BASE, results, dead };
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('손님 투어 중 과업 — 홈 탭에서 시작해 몇 번 눌러야 끝나는가\n');
  for (const r of results) {
    const mark = r.envSkipped ? '⏭ 환경제약' : !r.reachable ? '🔴 도달 실패' : r.taps <= 2 ? '✅' : r.taps === 3 ? '⚠' : '🔴 깊다';
    console.log(`${mark}  ${String(r.taps).padStart(2)}탭  ${r.key}`);
    console.log(`        ${r.why}`);
    if (r.envSkipped) console.log(`        건너뜀: ${r.envSkipped} — 결함 아님`);
    else if (!r.reachable) console.log(`        실패: ${r.failure}`);
  }
  const ok = results.filter((r) => r.reachable);
  console.log(`\n도달 ${ok.length}/${results.length} · 평균 ${ok.length ? (ok.reduce((n, r) => n + r.taps, 0) / ok.length).toFixed(1) : '—'}탭`);

  console.log('\n헛탭 — 화면은 떴는데 아직 안 듣는 창 (⚠ dev 서버, 프로덕션 수치 아님)');
  for (const [who, d] of Object.entries(dead)) {
    const verdict = d.landedAt === null ? '🔴 예산 내 미반응' : d.wasted > 0 ? `🔴 ${d.wasted}번 삼켜짐` : '✅ 첫 탭에 반응';
    console.log(`  ${who.padEnd(6)} 버튼 등장 ${d.firstSeenAt ?? '—'}ms · 반응 ${d.landedAt ?? '—'}ms · 총 ${d.taps}탭 → ${verdict}`);
  }
}

/** A run where nothing was reachable measured the harness, not the app. */
if (results.every((r) => !r.reachable)) {
  console.error('\n🔴 모든 과업이 도달 실패 — 시뮬이 비었거나 서버가 다른 코드를 서빙 중이다.');
  process.exit(2);
}
