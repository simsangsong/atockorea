/**
 * qa-smartapp-walk — headless real-browser walkthrough of the smart app
 * (guest room / drawer / dark, staff shell 4 tabs / announce / manual).
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
const BASE = 'http://localhost:3161';

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

try {
  // ── guest room: lands on HOME tab; first visit shows the manual sheet ──
  await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissManual();
  await shot('01-guest-home-light');

  await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click({ timeout: 10000 });
  await page.waitForSelector('[data-testid="chat-feed"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot('02-guest-chat-light');

  await page.click('[data-testid="room-drawer-open"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="room-drawer"]', { timeout: 8000 });
  await page.waitForTimeout(900);
  await shot('03-guest-drawer');
  await page.click('[data-testid="drawer-close"]');

  await page.click('[data-testid="theme-toggle"]'); // system → light
  await page.click('[data-testid="theme-toggle"]'); // light → dark
  await page.waitForTimeout(700);
  await shot('04-guest-chat-dark');
  await page.click('[data-testid="theme-toggle"]'); // → system

  // ── staff shell ──
  await page.goto(BASE + fx.guideUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="staff-shell"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('05-staff-chat-tab');

  await page.click('[data-testid="open-announce"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="guide-announce"]', { timeout: 15000 });
  await page.waitForTimeout(3000);
  await shot('06-staff-announce');
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
  await shot('07-staff-seats-tab');

  await page.click('[data-testid="staff-tab-btn-ops"]');
  await page.waitForTimeout(800);
  await shot('08-staff-ops-tab');

  await page.click('[data-testid="staff-tab-btn-settings"]');
  await page.waitForSelector('[data-testid="staff-settings"]', { timeout: 8000 });
  await page.click('[data-testid="staff-manual-toggle"]');
  await page.waitForTimeout(600);
  await shot('09-staff-settings-manual');

  await page.click('[data-testid="staff-theme-toggle"]'); // system → light
  await page.click('[data-testid="staff-theme-toggle"]'); // light → dark
  await page.waitForTimeout(600);
  await page.click('[data-testid="staff-tab-btn-chat"]');
  await page.waitForTimeout(700);
  await shot('10-staff-chat-dark');

  console.log('WALK OK');
} catch (e) {
  console.log('FAILED AT:', String(e).split('\n')[0]);
  try {
    await shot('99-failure-state');
  } catch {}
}
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
