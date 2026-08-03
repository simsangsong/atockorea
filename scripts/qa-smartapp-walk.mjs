/**
 * qa-smartapp-walk — headless real-browser walkthrough of the smart app
 * (guest room / drawer / dark / skins, staff shell 4 tabs / chat list /
 * daytools sheet / guest action sheet / roster / skin picker).
 *
 * Why this exists: the MCP browser pane cannot composite while hidden, so
 * in-pane screenshots are impossible in unattended sessions (documented
 * 2026-07-26 incident class). Playwright headless has no such limit.
 *
 * Usage:
 *   1) dev server on :3161  2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *   3) SHOT_DIR=<out> node scripts/qa-smartapp-walk.mjs
 * Cleanup: npx tsx scripts/sim-tour-day.ts --cleanup
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

const OUT = path.join(process.env.SHOT_DIR ?? '.', 'shots');
mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
// Override when :3161 is held by another session's server — shooting a
// DIFFERENT worktree's code is worse than failing.
const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  // M-D4 walk — the exact-location flow needs real geolocation grants.
  geolocation: { latitude: 37.5665, longitude: 126.978 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
const errors = [];
/**
 * Google Maps refuses localhost with RefererNotAllowedMapError because the API
 * key's referrer allowlist does not cover dev origins. That is a fact about
 * this machine, not about the product (same carve-out as qa-door-fixes-walk).
 * Letting it into `errors` would make this gate fail for a reason no code
 * change can fix, and a gate that cries wolf gets switched off.
 */
const ENV_NOISE = /Google Maps/;
page.on(
  'console',
  (m) => m.type() === 'error' && !ENV_NOISE.test(m.text()) && errors.push(m.text().slice(0, 300)),
);
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

let crashed = null;
let checksRun = 0;
/**
 * Records that a check actually happened, which `errors.push` alone could not:
 * an empty error list means "nothing was wrong" and "nothing was looked at"
 * equally well, and the exit code at the bottom needs to tell those apart.
 * Returns `ok` so it can stand in for the `if` it replaces.
 */
const check = (ok, message) => {
  checksRun += 1;
  if (!ok) errors.push(message);
  return ok;
};

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
};
const dismissManual = async () => {
  const d = page.locator('[data-testid="app-manual-dismiss"]');
  if (await d.isVisible().catch(() => false)) {
    await d.click({ timeout: 5000 });
    await page.waitForTimeout(500);
  }
};
/** T-D2 — headless Chromium never fires beforeinstallprompt; synthesize one
 *  so the install card / drawer tile / home row render for the camera. */
const armInstallPrompt = async () => {
  await page.evaluate(() => {
    const ev = new Event('beforeinstallprompt');
    ev.prompt = () => Promise.resolve();
    Object.defineProperty(ev, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(300);
};
/** Pick a skin via the guest Settings tab (assumes room is open). */
const pickGuestSkin = async (skin) => {
  await page.locator('[data-testid="room-tabbar"] [role="tab"]').last().click({ timeout: 10000 });
  await page.waitForSelector('[data-testid="skin-picker"]', { timeout: 10000 });
  await page.click(`[data-testid="skin-${skin}"]`);
  await page.waitForTimeout(400);
};

try {
  // ── guest room: lands on HOME tab; first visit shows the manual sheet ──
  await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissManual();
  await armInstallPrompt();
  await shot('01-guest-home-light');
  check(
    (await page.locator('[data-testid="install-card"]').count()) > 0,
    'WALK: install card missing on home after synthetic beforeinstallprompt',
  );

  await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click({ timeout: 10000 });
  await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot('02-guest-chat-classic');

  // header diet: theme toggle must be GONE from the header
  check(
    (await page.locator('[data-testid="theme-toggle"]').count()) === 0,
    'HEADER-DIET VIOLATION: theme-toggle still in header',
  );

  // ── M-D4 meet-exactly: [Meet me here] → confirm → pin + one photo ──
  await page.click('[data-testid="signal-share_location"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="confirm-sheet-ok"]', { timeout: 8000 });
  // The sheet's action row sits low enough that the bottom tab bar can
  // intercept a real click at this viewport; dispatch directly (same
  // workaround the dev N-indicator needs elsewhere in this walk).
  await page.$eval('[data-testid="confirm-sheet-ok"]', (el) => el.click());
  await page.waitForSelector('[data-testid="location-preview"]', { timeout: 20000 });
  // the one-photo follow-up: feed a tiny PNG through the capture input
  const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.setInputFiles('[data-testid="meet-photo-input"]', {
    name: 'spot.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  });
  await page.waitForTimeout(2500);
  await shot('02b-guest-meet-here-pin-photo');
  const guestChips = await page.locator('[data-testid="nav-chip-google"]').count();
  check(guestChips > 0, 'MEET-EXACTLY: guest nav chips missing on location preview');

  await page.click('[data-testid="room-drawer-open"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="room-drawer"]', { timeout: 8000 });
  await page.waitForTimeout(900);
  await shot('03-guest-drawer');

  // drawer 화면 모드 tile: system → light → dark (stays open while cycling)
  await page.click('[data-testid="drawer-theme-tile"]');
  await page.click('[data-testid="drawer-theme-tile"]');
  await page.waitForTimeout(700);
  await shot('04-guest-chat-dark-via-drawer');
  await page.click('[data-testid="drawer-theme-tile"]'); // → system
  await page.click('[data-testid="drawer-close"]');
  await page.waitForTimeout(400);

  // ── skins on the guest chat (scenery band + palette per skin) ──
  for (const skin of ['sky', 'winter', 'forest', 'meadow', 'jeju', 'seoul', 'busan', 'blossom', 'contrast']) {
    await pickGuestSkin(skin);
    await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click();
    await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 15000 });
    await page.waitForTimeout(600);
    await shot(`05-guest-chat-skin-${skin}`);
    if (skin === 'contrast') {
      check(
        (await page.locator('[data-testid="skin-scenery"]').count()) === 0,
        'WALK: contrast skin must not render scenery',
      );
    }
  }
  // scenery on the home canvas (launcher grammar) for two landmark skins.
  // Home is the BOTTOM-LEFT tab — exactly under Next dev's "N" indicator in
  // headless, so dispatch the click on the element directly (prod-irrelevant).
  for (const skin of ['jeju', 'busan']) {
    await pickGuestSkin(skin);
    await page.$eval('[data-testid="room-tabbar"] [role="tab"]', (el) => el.click());
    await page.waitForTimeout(700);
    await shot(`05h-guest-home-skin-${skin}`);
  }
  // night scene: jeju dark via the drawer 화면 모드 tile
  await pickGuestSkin('jeju');
  await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click();
  await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 15000 });
  await page.click('[data-testid="room-drawer-open"]');
  await page.waitForSelector('[data-testid="drawer-theme-tile"]', { timeout: 8000 });
  await page.click('[data-testid="drawer-theme-tile"]'); // system → light
  await page.click('[data-testid="drawer-theme-tile"]'); // light → dark
  await page.click('[data-testid="drawer-close"]');
  await page.waitForTimeout(700);
  await shot('05n-guest-chat-jeju-dark');
  await page.click('[data-testid="room-drawer-open"]');
  await page.waitForSelector('[data-testid="drawer-theme-tile"]', { timeout: 8000 });
  await page.click('[data-testid="drawer-theme-tile"]'); // dark → system
  await page.click('[data-testid="drawer-close"]');
  await page.waitForTimeout(400);
  // contrast + dark = the 고대비 look (re-pick: the night-scene block above
  // left the skin on jeju)
  await pickGuestSkin('contrast');
  await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click();
  await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 15000 });
  await page.click('[data-testid="room-drawer-open"]');
  await page.waitForSelector('[data-testid="drawer-theme-tile"]', { timeout: 8000 });
  await page.click('[data-testid="drawer-theme-tile"]'); // system → light
  await page.click('[data-testid="drawer-theme-tile"]'); // light → dark
  await page.click('[data-testid="drawer-close"]');
  await page.waitForTimeout(600);
  await shot('06-guest-chat-contrast-dark');
  // restore for the staff walk: back to classic + system
  await page.click('[data-testid="room-drawer-open"]');
  await page.waitForSelector('[data-testid="drawer-theme-tile"]', { timeout: 8000 });
  await page.click('[data-testid="drawer-theme-tile"]'); // dark → system
  await page.click('[data-testid="drawer-close"]');
  await pickGuestSkin('classic');
  await shot('07-guest-settings-skin-picker');

  // ── L-D8 — app-language spot checks: French + German (register, and tab-label
  // width: "Einstellungen"/"Impostazioni" are the longest labels). ──
  //
  // R3v2 replaced the flag-chip grid with a dropdown (`LanguageSelect`), so the
  // per-locale testids this block used to click no longer exist; it also still
  // asked for `zh-TW`, which has not been a room locale since the 5→9 change.
  const pickAppLocale = async (code) => {
    await page.waitForSelector('[data-testid="app-language-select"]', { timeout: 8000 });
    await page.click('[data-testid="app-language-select"]');
    await page.waitForSelector(`[data-testid="app-language-select-option-${code}"]`, { timeout: 8000 });
    await page.click(`[data-testid="app-language-select-option-${code}"]`);
    // A locale change re-joins the room → the shell REMOUNTS onto Home.
    await page.waitForTimeout(1000);
  };
  const backToSettings = async () =>
    page.locator('[data-testid="room-tabbar"] [role="tab"]').last().click();

  await pickAppLocale('fr');
  await shot('08h-guest-home-fr');
  await backToSettings();
  await page.waitForTimeout(600);
  await shot('08-guest-settings-fr');

  await pickAppLocale('de');
  await shot('09h-guest-home-de');
  await backToSettings();
  await page.waitForTimeout(600);
  await shot('09-guest-settings-de');

  // Simplified Chinese closes the sweep, then back to English for the rest.
  await pickAppLocale('zh');
  await shot('09t-guest-home-zh');
  await backToSettings();
  await page.waitForTimeout(600);
  await shot('09s-guest-settings-zh');
  await pickAppLocale('en');

  // ── staff shell ──
  await page.goto(BASE + fx.guideUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="staff-shell"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await armInstallPrompt();
  await shot('10-staff-chat-list');

  // pinned rows: 전체 공지 sheet (daytools) with target picker + presets
  await page.click('[data-testid="daytools-open"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="daytools-sheet"]', { timeout: 8000 });
  await page.waitForTimeout(800);
  await shot('11-staff-daytools-sheet');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // per-guest ⋮ action sheet
  const more = page.locator('[data-testid="room-more"]').first();
  if (check((await more.count()) > 0, 'WALK: no room-more button (no rooms seeded?)')) {
    await more.click();
    await page.waitForSelector('[data-testid="guest-action-sheet"]', { timeout: 8000 });
    await page.waitForTimeout(700);
    await shot('12-staff-guest-action-sheet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // announce (wa.me / mailto) sheet still reachable from its pinned row
  await page.click('[data-testid="open-announce"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="guide-announce"]', { timeout: 15000 });
  await page.waitForTimeout(3000);
  await shot('13-staff-announce');
  console.log(
    'announce — recipients:',
    await page.locator('[data-testid="announce-recipient"]').count(),
    'wa:',
    await page.locator('[data-testid="announce-wa"]').count(),
    'mail:',
    await page.locator('[data-testid="announce-mail"]').count(),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ── M-D2: the SAME pin, seen by staff — Kakao chips, not Google ──
  const roomHref = await page.locator('[data-testid="room-chat"]').first().getAttribute('href');
  if (check(Boolean(roomHref), 'MEET-EXACTLY: no room-chat link to open as staff')) {
    await page.goto(BASE + roomHref, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 30000 });
    // operator rooms have no Home tab — they LAND on chat (no click needed;
    // the bottom-left tab is under the dev N-indicator anyway).
    await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 15000 });
    await page.waitForTimeout(1200);
    const kakao = await page.locator('[data-testid="nav-chip-kakao-navi"]').count();
    check(kakao > 0, 'MEET-EXACTLY: staff kakao chips missing in guide room view');
    await page.locator('[data-testid="location-preview"]').last().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await shot('13b-staff-room-kakao-chips');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="staff-shell"]', { timeout: 30000 });
    await page.waitForTimeout(800);
  }

  await page.click('[data-testid="staff-tab-btn-seats"]');
  await page.waitForTimeout(1800);
  await shot('14-staff-roster');

  await page.click('[data-testid="staff-tab-btn-ops"]');
  await page.waitForTimeout(800);
  await shot('15-staff-ops-tab');

  await page.click('[data-testid="staff-tab-btn-settings"]');
  await page.waitForSelector('[data-testid="staff-settings"]', { timeout: 8000 });
  await page.waitForSelector('[data-testid="skin-picker"]', { timeout: 8000 });
  await shot('16-staff-settings');

  // staff skin: winter, then dark via the settings segmented control
  await page.click('[data-testid="skin-winter"]');
  await page.waitForTimeout(400);
  // Next dev's "N" indicator overlays the bottom-left tab in headless; a
  // forced click still hits the overlay, so dispatch on the element directly
  // (dev-only overlay; production has no such element).
  await page.$eval('[data-testid="staff-tab-btn-chat"]', (el) => el.click());
  await page.waitForTimeout(700);
  await shot('17-staff-chat-skin-winter');

  await page.click('[data-testid="staff-tab-btn-settings"]');
  await page.waitForSelector('[data-testid="staff-theme-dark"]', { timeout: 8000 });
  await page.click('[data-testid="staff-theme-dark"]');
  await page.waitForTimeout(400);
  await page.$eval('[data-testid="staff-tab-btn-chat"]', (el) => el.click());
  await page.waitForTimeout(700);
  await shot('18-staff-chat-winter-dark');

  // restore
  await page.click('[data-testid="staff-tab-btn-settings"]');
  await page.waitForSelector('[data-testid="skin-classic"]', { timeout: 8000 });
  await page.click('[data-testid="skin-classic"]');
  await page.click('[data-testid="staff-theme-system"]');

  // ── cockpit: compact TimeWheel (T-D3) via ⋮ → 운전 모드 → 일정·도착 ──
  await page.$eval('[data-testid="staff-tab-btn-chat"]', (el) => el.click());
  await page.waitForTimeout(600);
  const more2 = page.locator('[data-testid="room-more"]').first();
  if (await more2.count()) {
    await more2.click();
    await page.waitForSelector('[data-testid="guest-action-sheet"]', { timeout: 8000 });
    const driveBtn = page.locator('[data-testid="guest-action-sheet"] >> text=운전 모드').first();
    if (await driveBtn.count()) {
      await driveBtn.click();
      const opened = await page
        .waitForSelector('[data-testid="cockpit-actions-toggle"]', { timeout: 20000 })
        .catch(() => null);
      if (check(Boolean(opened), 'WALK: cockpit did not open from 운전 모드')) {
        await page.waitForTimeout(1200);
        await page.click('[data-testid="cockpit-actions-toggle"]');
        await page.waitForTimeout(500);
        const scheduleAction = page.locator('text=일정·도착').first();
        if (await scheduleAction.count()) {
          await scheduleAction.click();
          const arrival = page.locator('[data-testid="cockpit-open-arrival"]').first();
          if (check((await arrival.count()) > 0, 'WALK: no arrival button (schedule empty?)')) {
            await arrival.click();
            await page.waitForSelector('[data-testid="arrival-time-input"]', { timeout: 10000 });
            await page.waitForTimeout(700);
            await shot('19-cockpit-arrival-timewheel');
            await page.keyboard.press('Escape');
          }
        }
        await page.click('[data-testid="cockpit-exit"]').catch(() => {});
      }
    }
  }

  console.log('WALK OK');
} catch (e) {
  console.log('FAILED AT:', String(e).split('\n')[0]);
  crashed = String(e).split('\n')[0];
  try {
    await shot('99-failure-state');
  } catch {}
}
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();

/**
 * 🔴 This script used to end here, so it exited 0 no matter what it saw.
 *
 * It was never a screenshot tool: it makes nine real checks — install card,
 * header diet, guest nav chips, skin/scenery, room-more button, staff kakao
 * chips, room-chat link, arrival button, cockpit entry — and pushes a message
 * onto `errors` when one fails. It just printed them and left. The catch above
 * swallowed exceptions the same way: "FAILED AT: …" and then a clean exit.
 *
 * Anything checking this by exit code — a gate, CI, a future `npm run gate`
 * entry — read green every single time. Same shape as FA-008: the gate was
 * alive, nobody was reading what it said.
 */
if (crashed) {
  console.error(`\n🔴 WALK FAILED — ${crashed}`);
  process.exit(1);
}
if (errors.length > 0) {
  console.error(`\n🔴 ${errors.length} problem(s) — see the list above.`);
  process.exit(1);
}
if (checksRun === 0) {
  // A run that asserted nothing is not a pass. If the seed is missing or the
  // shell changed, this reports the silence instead of dressing it as success.
  console.error('\n🔴 walk asserted nothing — seed missing or selectors moved.');
  process.exit(2);
}
console.log(`\n✅ ${checksRun} checks, 0 problems.`);
