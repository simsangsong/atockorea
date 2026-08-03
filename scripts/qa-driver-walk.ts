/**
 * qa-driver-walk — the driver's day, in a real browser, ending at the guest.
 *
 * The feature audit's F1 grid showed the driver empty at three of five journey
 * stages, and F4 found out why the remaining two were never trusted: nothing
 * OPERATES the driver's screen. What existed was
 *
 *   · qa-chrome-overlap  — loads /tour-mode/driver with `ready: 'body'`, layout only
 *   · qa-prod-tour-room  — POSTs /driver/link and checks the 401. API only
 *   · qa-ios-smoke       — walks the PIN gate, screenshots the console, stops there
 *
 * So the PIN was proven and the job was not. DriverConsole is 365 lines and
 * hands off to a 50-testid Cockpit, and no test had ever pressed anything in it.
 *
 * ## Why it ends at the guest
 *
 * A driver signal that nobody receives is this repo's dominant defect wearing
 * one more hat, and every earlier instance passed its own unit tests. Checking
 * that the POST returned 200 would repeat that mistake. So the walk opens a
 * SECOND browser context as the guest and looks for the message on their
 * screen. That crossing is the assertion; everything before it is setup.
 *
 * Usage:
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   WALK_BASE=http://localhost:3181 npx tsx scripts/qa-driver-walk.ts
 *
 * Exit: 0 = all checks passed · 1 = a check failed · 2 = preconditions absent
 *       (never a green run that skipped the console).
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { chromium, type Page } from 'playwright';
import { signDriverRoomToken } from '../lib/tour-room/token';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const OUT = process.env.WALK_OUT ?? 'scripts/.walk-driver';
const FIXTURES = path.join(__dirname, '.sim-fixtures.json');
const DELAY_MINUTES = 10;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✅' : '  🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

/** Google Maps refuses localhost referrers here; that is this machine, not the product. */
const ENV_NOISE = /Google Maps/;

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => undefined);
}

async function main(): Promise<number> {
  loadEnvConfig(process.cwd());
  mkdirSync(OUT, { recursive: true });

  if (!existsSync(FIXTURES)) {
    console.error('🔴 no scripts/.sim-fixtures.json — run sim-tour-day.ts then sim-populate.ts');
    return 2;
  }
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8')) as { booking1: string; room1Url: string };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('🔴 missing Supabase env — cannot mint a driver token');
    return 2;
  }
  const service = createClient(url, key, { auth: { persistSession: false } });

  const { data: booking } = await service
    .from('bookings')
    .select('id, tour_id, tour_date, sim_tag')
    .eq('id', fx.booking1)
    .maybeSingle();
  const b = booking as { tour_id: string; tour_date: string; sim_tag: string | null } | null;
  if (!b?.tour_id || !b?.tour_date) {
    console.error('🔴 seeded booking has no tour_id/tour_date');
    return 2;
  }
  if (!b.sim_tag) {
    // Refusing rather than proceeding: this walk sends a delay notice, and the
    // recipients of a real booking's notice are real people.
    console.error('🔴 booking1 is not sim-tagged — refusing to signal into a real room');
    return 2;
  }

  const driverToken = signDriverRoomToken({
    tourId: b.tour_id,
    tourDate: b.tour_date,
    displayName: '기사님',
  }).token;

  // The PIN is the last four of a dispatched plate. With no vehicle on file the
  // server requires none (ops genuinely may not know the plate until morning),
  // so the walk reports which of the two worlds it is in rather than assuming.
  const { data: vehicles } = await service
    .from('ops_room_vehicles')
    .select('plate_number, room_id')
    .not('plate_number', 'is', null);
  const { data: rooms } = await service.from('tour_rooms').select('id').eq('booking_id', fx.booking1);
  const roomIds = new Set((rooms ?? []).map((r) => (r as { id: string }).id));
  const plate = (vehicles ?? []).find((v) =>
    roomIds.has((v as { room_id: string | null }).room_id ?? ''),
  ) as { plate_number: string } | undefined;
  const expectedPin = plate?.plate_number?.replace(/\D+/g, '').slice(-4) ?? null;

  const browser = await chromium.launch();
  const errors: string[] = [];

  // ── the driver ────────────────────────────────────────────────────────────
  const driverCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'ko-KR',
    permissions: ['geolocation'],
    geolocation: { latitude: 33.4996, longitude: 126.5312 },
  });
  const driver = await driverCtx.newPage();
  driver.on('console', (m) => {
    if (m.type() === 'error' && !ENV_NOISE.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  driver.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

  const res = await driver.goto(`${BASE}/tour-mode/driver?rt=${encodeURIComponent(driverToken)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  if (!res || res.status() >= 400) {
    console.error(`🔴 driver console unreachable: ${res?.status()}`);
    await browser.close();
    return 2;
  }
  /**
   * 🔴 Fixed sleeps caught the loading screen on the first run and reported
   * three failures that were not real: dev compiles the route on first hit, and
   * "불러오는 중…" satisfies a testid-presence check just fine. Wait for the
   * thing being tested to exist, never for a number of seconds.
   */
  await driver
    .waitForSelector(
      '[data-testid="driver-pin-input"], [data-testid="driver-start"], [data-testid="cockpit-actions-toggle"]',
      { timeout: 120_000 },
    )
    .catch(() => undefined);
  await shot(driver, '01-driver-entry');

  const pinInput = driver.locator('[data-testid="driver-pin-input"]');
  if ((await pinInput.count()) > 0) {
    if (!expectedPin) {
      check('PIN 게이트', false, '화면은 PIN 을 묻는데 배차된 번호판이 없다 — 기사가 못 들어간다');
    } else {
      await pinInput.fill(expectedPin);
      await driver.getByRole('button', { name: '확인' }).first().click().catch(() => undefined);
      await driver.waitForTimeout(2_500);
      check('PIN 게이트 통과', (await pinInput.count()) === 0, `번호판 뒤4자리 ${expectedPin}`);
    }
  } else {
    check('PIN 게이트', true, '배차 전이라 PIN 불필요 (서버 판정)');
  }

  const start = driver.locator('[data-testid="driver-start"]');
  if ((await start.count()) > 0) {
    // The audio-unlock tap. Present before the tour starts; absent once running.
    check('운행 시작 버튼이 있다', true);
    await start.first().click().catch(() => undefined);
  } else {
    check('운행 시작 버튼', true, '이미 운행 중이라 표시되지 않음');
  }

  const actions = driver.locator('[data-testid="cockpit-actions-toggle"]');
  await actions.first().waitFor({ state: 'visible', timeout: 120_000 }).catch(() => undefined);
  await shot(driver, '02-driver-cockpit');

  if (!check('콕핏이 조작 가능한 상태로 떴다', (await actions.count()) > 0)) {
    await browser.close();
    return report(errors);
  }
  await actions.first().click();
  await driver.waitForTimeout(1_200);
  await shot(driver, '03-driver-actions');

  /**
   * `exact` matters here. A quick-reply chip reads "차량 문제로 조금 지연되고
   * 있습니다", so a substring match finds it first, clicks it, and the walk then
   * fails looking for a sheet that was never asked to open — reported as a
   * missing chip rather than as the wrong button.
   */
  const delayAction = driver.getByRole('button', { name: '지연', exact: true }).first();
  if (!check('「지연」 버튼에 손이 닿는다', (await delayAction.count()) > 0)) {
    await browser.close();
    return report(errors);
  }
  await delayAction.click();
  await driver.waitForTimeout(900);
  await shot(driver, '04-driver-delay-sheet');

  // The chip reads "+10분", not "10" — the sheet asks "몇 분 늦나요?" and the
  // buttons answer in deltas.
  const minuteBtn = driver.getByRole('button', { name: `+${DELAY_MINUTES}분`, exact: true }).first();
  if (!check(`+${DELAY_MINUTES}분 칩이 있다`, (await minuteBtn.count()) > 0)) {
    await browser.close();
    return report(errors);
  }
  await minuteBtn.click();
  await driver.waitForTimeout(3_500);
  await shot(driver, '05-driver-signal-sent');

  // ── the guest — the only assertion that matters ───────────────────────────
  const guestCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'en-US',
  });
  const guest = await guestCtx.newPage();
  await guest.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await guest.waitForTimeout(6_000);
  const chatTab = guest.locator('[data-testid="room-tab-chat"]');
  if ((await chatTab.count()) > 0) {
    await chatTab.first().click().catch(() => undefined);
    await guest.waitForTimeout(3_000);
  }
  await shot(guest, '06-guest-sees-delay');

  const body = (await guest.locator('body').innerText().catch(() => '')) ?? '';
  const sawDelay = new RegExp(`${DELAY_MINUTES}\\s*(minutes?|분)`).test(body) && /late|늦/i.test(body);
  check(
    '🔴 손님 화면에 지연 안내가 도착했다',
    sawDelay,
    sawDelay ? `"${DELAY_MINUTES}분/minutes" + late/늦` : '기사는 보냈는데 손님에게 없다',
  );

  await browser.close();
  return report(errors);
}

function report(errors: string[]): number {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT}/`);
  if (errors.length > 0) {
    console.log('\n  콘솔 에러:');
    for (const e of errors.slice(0, 8)) console.log('   ', e);
  }
  if (results.length === 0) {
    console.error('\n🔴 아무것도 검사하지 않았다 — 시드가 없거나 셀렉터가 바뀌었다.');
    return 2;
  }
  if (failed.length > 0 || errors.length > 0) return 1;
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(2);
  });
