/**
 * qa-door-fixes-walk — did the three "the feature exists, the door doesn't" fixes
 * actually land ON SCREEN?
 *
 * Each of these was invisible to unit tests because the defect was a missing
 * caller, not a wrong function. So this drives a real browser:
 *
 *   A-2  the location opt-in must SURVIVE a tab change. It used to live in the
 *        map tab, which RoomShell unmounts — the guest turned it on, opened
 *        Chat, and the arrival geofence quietly died. The check flips it, walks
 *        away, comes back, and reads the switch.
 *   A-2b the home tab must offer that switch at all (it never did).
 *   A-1  the seat card must appear and tell the truth about the seat.
 *   P1-5 no line may break between two CJK characters in the new cards.
 *
 * Usage:  dev server + ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *         WALK_BASE=http://localhost:3181 node scripts/qa-door-fixes-walk.mjs
 * Exits 2 if the room could not be reached — a walk that silently skips the
 * page reports a cheerful zero.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]'];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const OUT = process.env.WALK_OUT ?? 'scripts/.walk-door-fixes';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

mkdirSync(OUT, { recursive: true });

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✅' : '  🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * The P1-5 invariant stated as a measurement: for every text node with CJK,
 * did a line box boundary land between two CJK characters with no space?
 * Range rects per character; a y jump between adjacent CJK chars is a break.
 */
const CJK_PROBE = `(root) => {
  const CJK = /[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]/;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const broken = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue ?? '';
    if (text.trim().length < 2 || !CJK.test(text)) continue;
    for (let i = 0; i < text.length - 1; i += 1) {
      if (!CJK.test(text[i]) || !CJK.test(text[i + 1])) continue;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 2);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
      if (rects.length > 1 && Math.abs(rects[0].top - rects[rects.length - 1].top) > 1) {
        broken.push(text.slice(Math.max(0, i - 6), i + 1) + '⏎' + text.slice(i + 1, i + 7));
      }
    }
  }
  return broken;
}`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ko-KR',
  permissions: ['geolocation'],
  geolocation: { latitude: 33.4586, longitude: 126.9425 },
});

page.on('console', (m) => {
  if (m.type() === 'error') console.log('    [console.error]', m.text().slice(0, 160));
});

/**
 * The Next dev-tools indicator is a portal pinned bottom-left — exactly over
 * the tab bar at 390px, where it silently eats clicks on the first tabs. It is
 * dev-only chrome, not our UI, so the walk takes it out of the hit test rather
 * than force-clicking through it (a force click would also pass if OUR overlay
 * were covering the tabs, which is a bug we want to see).
 */
const dropDevOverlay = () =>
  page.addStyleTag({ content: 'nextjs-portal{pointer-events:none!important}' }).catch(() => undefined);

try {
  const url = `${BASE}${fx.room1Url}`;
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!res || res.status() >= 400) {
    console.error(`🔴 room unreachable: ${res?.status()}`);
    process.exit(2);
  }
  await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
  // Korean UI — the CJK invariant is only testable in a CJK locale.
  await page.evaluate((id) => {
    window.localStorage.setItem(`tour_mode_locale:${id}`, 'ko');
  }, fx.booking1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await dropDevOverlay();

  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

  // ── A-2b: the home tab offers the arrival-commentary switch ──────────────
  const unlock = page.locator('[data-testid="arrival-unlock-card"]');
  const unlockVisible = await unlock.count();
  record('A-2b  홈 탭에 도착 해설 켜기 카드가 있다', unlockVisible > 0,
    unlockVisible ? await unlock.locator('p').first().innerText() : '카드 없음');

  // ── A-1: the seat card tells the truth (or correctly says nothing) ───────
  const seatCard = page.locator('[data-testid="room-seat-card"]');
  const seatCount = await seatCard.count();
  record('A-1   좌석 카드 상태', true,
    seatCount === 0
      ? '렌더 안 함 (이 투어엔 좌석 배치 없음 = 정직한 침묵)'
      : `state=${await seatCard.getAttribute('data-seat-state')} tag=${await seatCard.evaluate((el) => el.tagName)}`);

  // ── P1-5 on the new cards ────────────────────────────────────────────────
  const homeBroken = await page.locator('[data-testid="home-tab"]').evaluate(eval(`(${CJK_PROBE})`));
  record('P1-5  홈 탭 CJK 글자단위 줄바꿈 0', homeBroken.length === 0, homeBroken.join(' · ') || '0건');

  // ── A-2: the opt-in must survive leaving the map tab ─────────────────────
  if (unlockVisible > 0) {
    await unlock.locator('[data-testid="arrival-unlock-enable"]').click();
    await page.waitForTimeout(800);
    const goneAfterEnable = (await unlock.count()) === 0;
    record('A-2   켜면 넛지 카드가 스스로 사라진다', goneAfterEnable);
  }

  const readSwitch = async () => {
    await dropDevOverlay();
    await page.locator('[data-testid="room-tab-map"]').click();
    await page.waitForSelector('[data-testid="location-toggle"]', { timeout: 20_000 });
    await page.waitForTimeout(600);
    return page.locator('[data-testid="location-toggle"]').getAttribute('aria-checked');
  };

  const afterEnable = await readSwitch();
  record('A-2   지도 탭 스위치가 켜져 있다', afterEnable === 'true', `aria-checked=${afterEnable}`);
  await page.screenshot({ path: `${OUT}/02-map-sharing-on.png` });

  // The regression itself: leave the map tab, come back.
  await dropDevOverlay();
  await page.locator('[data-testid="room-tab-chat"]').click();
  await page.waitForTimeout(900);
  const afterRoundTrip = await readSwitch();
  record(
    '🔴 A-2  탭을 떠났다 돌아와도 공유가 유지된다 (이게 원래 버그였다)',
    afterRoundTrip === 'true',
    `aria-checked=${afterRoundTrip}`,
  );

  // And across a reload, since a mid-tour refresh used to silently disarm it.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const afterReload = await readSwitch();
  record('A-2   새로고침 후에도 유지된다', afterReload === 'true', `aria-checked=${afterReload}`);
  await page.screenshot({ path: `${OUT}/03-map-after-roundtrip.png` });

  const mapBroken = await page.locator('body').evaluate(eval(`(${CJK_PROBE})`));
  record('P1-5  지도 탭 CJK 글자단위 줄바꿈 0', mapBroken.length === 0, mapBroken.join(' · ') || '0건');
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT}/`);
process.exit(failed.length === 0 ? 0 : 1);
