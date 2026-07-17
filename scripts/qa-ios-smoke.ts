/**
 * iOS-emulated QA harness — Playwright WebKit (Safari engine) + iPhone 13
 * profile against the local dev server. Drives every smart-guide surface,
 * runs stress scenarios, captures console/page errors, and saves screenshots
 * for visual review. Sim data only.
 *
 * Run: npx tsx scripts/qa-ios-smoke.ts [shotDir]  (dev server on :3160 + sim-tour-day fixtures required)
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { webkit, devices, type BrowserContext, type Page } from '@playwright/test';
import { signGuideRoomToken, signDriverRoomToken } from '../lib/tour-room/token';

const BASE = 'http://localhost:3160';
const SHOTS = process.argv[2] || path.join(process.cwd(), '.qa-shots');
mkdirSync(SHOTS, { recursive: true });

const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
const errors: Array<{ where: string; type: string; text: string }> = [];
const notes: string[] = [];

function watch(page: Page, where: string) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Noise filter: dev-mode React warnings about props we intentionally pass
      if (text.includes('Download the React DevTools')) return;
      errors.push({ where, type: 'console', text: text.slice(0, 400) });
    }
  });
  page.on('pageerror', (err) => errors.push({ where, type: 'pageerror', text: String(err).slice(0, 400) }));
  page.on('requestfailed', (req) => {
    if (req.url().startsWith(BASE) && !req.url().includes('sockjs')) {
      errors.push({ where, type: 'requestfailed', text: `${req.method()} ${req.url().slice(0, 200)} — ${req.failure()?.errorText}` });
    }
  });
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}
async function fullShot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function main() {
  loadEnvConfig(process.cwd());
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Fresh tokens for the (re-pointed) booking1 tour.
  const { data: b1 } = await service
    .from('bookings')
    .select('id, tour_id, tour_date, contact_email')
    .eq('id', fx.booking1)
    .single();
  if (b1!.contact_email !== 'sim-tour-mode@atockorea.test') throw new Error('not sim');
  const guideToken = signGuideRoomToken({ tourId: b1!.tour_id, tourDate: b1!.tour_date, displayName: 'Sim Guide' }).token;
  const driverToken = signDriverRoomToken({ tourId: b1!.tour_id, tourDate: b1!.tour_date, displayName: '기사님' }).token;

  // Idempotent re-runs: wipe booking1's plan/ledger/feed state (sim only).
  {
    const { data: rooms } = await service.from('tour_rooms').select('id').eq('booking_id', fx.booking1);
    for (const room of rooms ?? []) {
      for (const table of ['tour_room_messages', 'tour_room_events', 'tour_room_pins', 'tour_room_extras', 'tour_room_locations', 'tour_room_participants']) {
        await service.from(table).delete().eq('room_id', room.id);
      }
    }
    await service.from('tour_day_plans').delete().eq('booking_id', fx.booking1);
    await service.from('bookings').update({ itinerary: null }).eq('id', fx.booking1);
  }

  // Sim bus detail → LobbyCard vehicle line + driver PIN gate (plate 3456).
  await service.from('tour_bus_details').upsert(
    {
      tour_id: b1!.tour_id,
      tour_date: b1!.tour_date,
      payload: { vehicle_model: 'Hyundai Solati', color: 'Black', vehicle_number: '12가 3456', driver_name: 'Mr. Kim' },
    },
    { onConflict: 'tour_id,tour_date' },
  );

  const roomUrl = new URL(fx.room1Url, BASE).toString();
  const planUrl = roomUrl.replace('/room/', '/plan/');
  const guideUrl = `${BASE}/tour-mode/guide?rt=${encodeURIComponent(guideToken)}`;
  const driverUrl = `${BASE}/tour-mode/driver?rt=${encodeURIComponent(driverToken)}`;

  const browser = await webkit.launch();
  const iphone = devices['iPhone 13'];

  const mkCtx = (over: Record<string, unknown> = {}): Promise<BrowserContext> =>
    browser.newContext({ ...iphone, locale: 'en-US', timezoneId: 'Asia/Seoul', ...over });

  // ── 1. Guest /plan — full editor flow ─────────────────────────────────────
  {
    const ctx = await mkCtx();
    const page = await ctx.newPage();
    watch(page, 'plan');
    await page.goto(planUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await fullShot(page, '01-plan-initial');

    // Tab ①: apply first template
    const useCourse = page.getByRole('button', { name: /Start with this course/i }).first();
    if (await useCourse.isVisible().catch(() => false)) {
      page.once('dialog', (d) => void d.accept());
      await useCourse.click();
      await page.waitForTimeout(800);
      await fullShot(page, '02-plan-template-applied');
    } else {
      notes.push('plan: no template button visible');
    }

    // Tab ②: search + add a POI
    await page.getByRole('tab', { name: /Pick places/i }).click();
    await page.waitForTimeout(600);
    await shot(page, '03-plan-pick-tab');
    const addButtons = page.getByRole('button', { name: /^Add$/ });
    if ((await addButtons.count()) > 0) {
      await addButtons.first().click();
      await page.waitForTimeout(400);
    }

    // Stress: long memo + XSS-ish text in a stop memo
    const memo = page.getByPlaceholder(/Request for this stop/i).first();
    if (await memo.isVisible().catch(() => false)) {
      await memo.fill('<img src=x onerror=alert(1)> very long memo ' + 'x'.repeat(180));
    }

    // Needs: children + dietary + allergy → allergy card should appear
    const childrenInput = page.locator('input[type="number"]').nth(1);
    await childrenInput.fill('2');
    await page.waitForTimeout(300);
    await page.getByPlaceholder(/e\.g\. 5, 8/i).fill('5, 8');
    await page.getByRole('button', { name: 'Halal' }).click();
    await page.getByPlaceholder(/Allergies/i).fill('Peanuts (severe)');
    await page.getByRole('button', { name: 'Stroller' }).click();
    await page.waitForTimeout(3200); // autosave debounce fires
    await fullShot(page, '04-plan-needs-allergy');

    // Submit
    await page.getByRole('button', { name: /Send to my guide/i }).click();
    await page.waitForTimeout(1500);
    await fullShot(page, '05-plan-submitted');

    // Member device (2nd context): read-only view
    const ctx2 = await mkCtx();
    const page2 = await ctx2.newPage();
    watch(page2, 'plan-member');
    await page2.goto(planUrl, { waitUntil: 'networkidle' });
    await page2.waitForTimeout(2200);
    await fullShot(page2, '06-plan-member-readonly');
    await ctx2.close();
    await ctx.close();
  }

  // ── 2. Guide console — review → confirm → mutate → ledger ────────────────
  {
    const ctx = await mkCtx();
    const page = await ctx.newPage();
    watch(page, 'guide');
    await page.goto(guideUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await fullShot(page, '10-guide-initial');

    // Open the plan panel of the draft room (초안 검토 chip)
    const planToggles = page.getByTestId('plan-toggle');
    const count = await planToggles.count();
    let opened = false;
    for (let i = 0; i < count; i += 1) {
      await planToggles.nth(i).click();
      await page.waitForTimeout(900);
      if (await page.getByTestId('guide-plan-panel').isVisible().catch(() => false)) {
        const text = await page.getByTestId('guide-plan-panel').innerText();
        if (text.includes('검토') || text.includes('희망')) {
          opened = true;
          break;
        }
        await planToggles.nth(i).click(); // close and try next
      }
    }
    if (!opened && count > 0) {
      await planToggles.first().click();
      await page.waitForTimeout(900);
    }
    await fullShot(page, '11-guide-plan-panel');

    const confirm = page.getByTestId('plan-confirm');
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      await page.waitForTimeout(1500);
      await fullShot(page, '12-guide-plan-confirmed');
    } else {
      notes.push('guide: confirm button not visible');
    }

    // Skip the first stop with a reason, then save (MUTATE)
    const skip = page.getByTestId('skip-toggle').first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(600);
      await fullShot(page, '13-guide-skip-suggestions');
      const save = page.getByTestId('plan-save');
      if (await save.isVisible().catch(() => false)) {
        await save.click();
        await page.waitForTimeout(1200);
      }
    }

    // Ledger: log an expense, then summary
    await page.getByTestId('ledger-toggle').first().click();
    await page.waitForTimeout(800);
    await page.locator('input[placeholder*="항목"]').fill('입장권 4매');
    await page.locator('input[placeholder="₩"]').fill('48000');
    await page.getByTestId('extra-log').click();
    await page.waitForTimeout(1200);
    await fullShot(page, '14-guide-ledger');
    const summary = page.getByTestId('settlement-summary');
    if (await summary.isVisible().catch(() => false)) {
      await summary.click();
      await page.waitForTimeout(800);
    }

    // Free-time timer 1 minute from now (rally soon) — for room banner QA
    const nowKst = new Date(Date.now() + 9 * 3600_000 + 60_000);
    const hhmm = `${String(nowKst.getUTCHours()).padStart(2, '0')}:${String(nowKst.getUTCMinutes()).padStart(2, '0')}`;
    await page.locator('input[placeholder="복귀 장소"]').fill('주차장 2번 게이트');
    // custom timer: reuse 30분 button? use meeting notice instead with exact time
    await page.locator('input[type="time"]').first().fill(hhmm);
    await page.locator('input[placeholder*="집합 장소"]').fill('주차장 2번 게이트');
    await page.getByTestId('meeting-send').click();
    await page.waitForTimeout(1000);
    await ctx.close();
  }

  // ── 3. Guest room — banners, signals, ledger card, offline ───────────────
  {
    const ctx = await mkCtx();
    const page = await ctx.newPage();
    watch(page, 'room');
    await page.goto(roomUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await fullShot(page, '20-room-initial');

    // Ledger card confirm (the 48,000 expense)
    const confirmBtn = page.getByTestId('extra-confirm').last();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(900);
      await shot(page, '21-room-extra-confirmed');
    } else {
      notes.push('room: extra confirm button not visible (scroll?)');
    }

    // Quick signals — rapid double-tap stress on rest_stop
    const rest = page.getByTestId('signal-rest_stop');
    if (await rest.isVisible().catch(() => false)) {
      await rest.click().catch(() => undefined);
      await rest.click({ force: true }).catch(() => undefined); // double-tap race
      await page.waitForTimeout(1200);
      await shot(page, '22-room-signal-sent');
    } else {
      notes.push('room: quick signal bar not visible');
    }

    // Rally banner (meeting notice set ~1min out) — wait for countdown visible
    await page.waitForTimeout(1500);
    await shot(page, '23-room-rally-banner');

    // Offline: flip the context offline → OfflineInfoCard
    await ctx.setOffline(true);
    await page.waitForTimeout(1500);
    await shot(page, '24-room-offline-card');
    await ctx.setOffline(false);
    await page.waitForTimeout(1000);

    // Dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(600);
    await fullShot(page, '25-room-dark');
    await ctx.close();
  }

  // ── 4. Driver console — PIN gate → console ───────────────────────────────
  {
    const ctx = await mkCtx();
    const page = await ctx.newPage();
    watch(page, 'driver');
    await page.goto(driverUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await fullShot(page, '30-driver-pin-gate');

    // Wrong PIN first (stress), then the right one (plate 3456)
    const pinInput = page.locator('input').first();
    if (await pinInput.isVisible().catch(() => false)) {
      await pinInput.fill('0000');
      await page.getByRole('button', { name: '확인' }).click();
      await page.waitForTimeout(1500);
      await shot(page, '31-driver-pin-wrong');
      await pinInput.fill('3456');
      await page.getByRole('button', { name: '확인' }).click();
      await page.waitForTimeout(3000);
    }
    await fullShot(page, '32-driver-console');
    await ctx.close();
  }

  // ── 5. Broken/expired token + coming-soon flag paths ─────────────────────
  {
    const ctx = await mkCtx();
    const page = await ctx.newPage();
    watch(page, 'bad-token');
    await page.goto(`${BASE}/tour-mode/room/${fx.booking1}?rt=broken-token`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await shot(page, '40-room-bad-token');
    await page.goto(`${BASE}/tour-mode/plan/${fx.booking1}?rt=broken-token`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await shot(page, '41-plan-bad-token');
    await ctx.close();
  }

  // ── 6. Locale sweep: ko room (booking2, ja) + plan ko ────────────────────
  {
    const ctx = await mkCtx({ locale: 'ko-KR' });
    const page = await ctx.newPage();
    watch(page, 'room-ja');
    await page.goto(new URL(fx.room2Url, BASE).toString(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await fullShot(page, '50-room2-ja-booking');
    await ctx.close();
  }

  await browser.close();

  console.log('\n=== QA NOTES ===');
  for (const note of notes) console.log('-', note);
  console.log('\n=== ERRORS (' + errors.length + ') ===');
  for (const e of errors) console.log(`[${e.where}][${e.type}] ${e.text}`);
  console.log('\nshots →', SHOTS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
