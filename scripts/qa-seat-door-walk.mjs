/**
 * qa-seat-door-walk — the in-room seat picker, end to end, in a real browser.
 *
 * Needs a room whose tour is TOMORROW (guest seat writes close at 00:00 KST on
 * the day, C-11) and a vehicle with a layout attached to its tour-date group.
 * Set that up before running:
 *
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   -- then push the sim booking/room to tomorrow and insert one
 *      ops_room_vehicles row pointing at a seeded layout.
 *   WALK_BASE=http://localhost:3181 node scripts/qa-seat-door-walk.mjs
 *
 * Exits 2 when the preconditions are absent, rather than reporting a green run
 * that never opened the picker.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]'];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const OUT = process.env.WALK_OUT ?? 'scripts/.walk-seat-door';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
mkdirSync(OUT, { recursive: true });

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✅' : '  🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ko-KR',
});
page.on('console', (m) => {
  if (m.type() === 'error' && !/Google Maps/.test(m.text())) {
    console.log('    [console.error]', m.text().slice(0, 160));
  }
});
const dropDevOverlay = () =>
  page.addStyleTag({ content: 'nextjs-portal{pointer-events:none!important}' }).catch(() => undefined);

/** D-1 onboarding is a full-screen modal on a lobby room; step past it. */
async function clearOnboarding() {
  for (let i = 0; i < 8; i += 1) {
    if ((await page.locator('[data-testid="onboarding"]').count()) === 0) return;
    const next = page.locator('[data-testid="onboard-next"]');
    if ((await next.count()) === 0) return;
    await next.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

try {
  const res = await page.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!res || res.status() >= 400) {
    console.error(`🔴 room unreachable: ${res?.status()}`);
    process.exit(2);
  }
  await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
  await page.evaluate((id) => window.localStorage.setItem(`tour_mode_locale:${id}`, 'ko'), fx.booking1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
  await page.waitForTimeout(1800);
  await dropDevOverlay();
  await clearOnboarding();

  const card = page.locator('[data-testid="room-seat-card"]');
  if ((await card.count()) === 0) {
    console.error('🔴 seat card absent — no vehicle+layout for this room group. Preconditions not met.');
    await page.screenshot({ path: `${OUT}/00-no-card.png`, fullPage: true });
    process.exit(2);
  }

  const state = await card.getAttribute('data-seat-state');
  const tag = await card.evaluate((el) => el.tagName);
  record('좌석 카드가 홈에 있다', true, `state=${state} tag=${tag}`);
  record('선택 가능하면 버튼이다 (서버 can_pick 반영)', tag === 'BUTTON', `tag=${tag}`);
  await page.screenshot({ path: `${OUT}/01-home-seat-card.png`, fullPage: true });

  await card.click();
  await page.waitForSelector('[data-testid="room-seat-sheet"]', { timeout: 20_000 });
  // The board arrives from its own fetch — count it after it lands, or the
  // harness races the picker and reports zero seats on a working screen.
  await page.waitForSelector('[data-seat]', { timeout: 20_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/02-seat-sheet.png` });

  const seats = await page.locator('[data-seat]').count();
  record('좌석판이 실제로 그려졌다', seats > 0, `${seats}석`);
  record(
    '첫 조회 전 "차량 배정 대기"가 스치지 않는다',
    (await page.locator('[data-testid="room-seat-soon"]').count()) === 0,
  );

  // Party size is 2 — the picker must cap there and the server must accept both.
  const pick = async (n) => {
    await page.locator(`[data-seat="${n}"]`).click();
    await page.waitForTimeout(150);
  };
  await pick(1);
  await pick(2);
  await pick(3); // over the cap — must be ignored
  const countText = await page.locator('[data-testid="room-seat-count"]').innerText();
  record('일행 수를 넘겨 고를 수 없다', /2/.test(countText), countText);
  await page.screenshot({ path: `${OUT}/03-seats-selected.png` });

  await page.locator('[data-testid="room-seat-confirm"]').click();
  await page.waitForSelector('[data-testid="room-seat-done"]', { timeout: 20_000 });
  const done = await page.locator('[data-testid="room-seat-done"]').innerText();
  record('확정이 서버에 저장된다', true, done.replace(/\s+/g, ' ').slice(0, 60));
  await page.screenshot({ path: `${OUT}/04-seat-done.png` });

  // Close and reopen the room: the card must now report the assignment.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
  await page.waitForTimeout(1800);
  await clearOnboarding();
  const reState = await page.locator('[data-testid="room-seat-card"]').getAttribute('data-seat-state');
  const reText = await page.locator('[data-testid="room-seat-card"]').innerText();
  record('다시 들어오면 배정된 좌석이 보인다', reState === 'assigned', `${reState} · ${reText.replace(/\s+/g, ' ')}`);
  await page.screenshot({ path: `${OUT}/05-home-assigned.png`, fullPage: true });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT}/`);
process.exit(failed.length === 0 ? 0 : 1);
