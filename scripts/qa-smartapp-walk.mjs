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
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));

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
  if (!(await page.locator('[data-testid="install-card"]').count())) {
    errors.push('WALK: install card missing on home after synthetic beforeinstallprompt');
  }

  await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click({ timeout: 10000 });
  await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot('02-guest-chat-classic');

  // header diet: theme toggle must be GONE from the header
  if (await page.locator('[data-testid="theme-toggle"]').count()) {
    errors.push('HEADER-DIET VIOLATION: theme-toggle still in header');
  }

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
    if (skin === 'contrast' && (await page.locator('[data-testid="skin-scenery"]').count())) {
      errors.push('WALK: contrast skin must not render scenery');
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

  // ── L-D8 — app-language spot checks: French + German (register, tab-label
  // width: "Einstellungen"/"Impostazioni" are the longest labels). ──
  await page.waitForSelector('[data-testid="app-locale-fr"]', { timeout: 8000 });
  await page.click('[data-testid="app-locale-fr"]');
  // A locale change re-joins the room → the shell REMOUNTS onto Home.
  await page.waitForTimeout(900);
  await shot('08h-guest-home-fr');
  await page.locator('[data-testid="room-tabbar"] [role="tab"]').last().click();
  await page.waitForSelector('[data-testid="app-locale-de"]', { timeout: 8000 });
  await shot('08-guest-settings-fr');
  await page.click('[data-testid="app-locale-de"]');
  await page.waitForTimeout(900);
  await shot('09h-guest-home-de');
  await page.locator('[data-testid="room-tabbar"] [role="tab"]').last().click();
  await page.waitForSelector('[data-testid="app-locale-en"]', { timeout: 8000 });
  await shot('09-guest-settings-de');
  await page.click('[data-testid="app-locale-en"]');
  await page.waitForTimeout(700);

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
  if (await more.count()) {
    await more.click();
    await page.waitForSelector('[data-testid="guest-action-sheet"]', { timeout: 8000 });
    await page.waitForTimeout(700);
    await shot('12-staff-guest-action-sheet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    errors.push('WALK: no room-more button (no rooms seeded?)');
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
      if (opened) {
        await page.waitForTimeout(1200);
        await page.click('[data-testid="cockpit-actions-toggle"]');
        await page.waitForTimeout(500);
        const scheduleAction = page.locator('text=일정·도착').first();
        if (await scheduleAction.count()) {
          await scheduleAction.click();
          const arrival = page.locator('[data-testid="cockpit-open-arrival"]').first();
          if (await arrival.count()) {
            await arrival.click();
            await page.waitForSelector('[data-testid="arrival-time-input"]', { timeout: 10000 });
            await page.waitForTimeout(700);
            await shot('19-cockpit-arrival-timewheel');
            await page.keyboard.press('Escape');
          } else {
            errors.push('WALK: no arrival button (schedule empty?)');
          }
        }
        await page.click('[data-testid="cockpit-exit"]').catch(() => {});
      } else {
        errors.push('WALK: cockpit did not open from 운전 모드');
      }
    }
  }

  console.log('WALK OK');
} catch (e) {
  console.log('FAILED AT:', String(e).split('\n')[0]);
  try {
    await shot('99-failure-state');
  } catch {}
}
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
