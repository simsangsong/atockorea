/**
 * Capture the tour-room + ops-center screens at mobile and desktop viewports
 * using Playwright (far more reliable headless than the in-app browser pane).
 *
 * Reads scripts/.sim-fixtures.json for the room URLs; logs into the ops console
 * with the sim admin (email/password). Writes PNGs to the path in OUT_DIR.
 *
 * Run: node scripts/sim-screens.mjs
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.SIM_BASE || 'http://localhost:3130';
const OUT_DIR = process.env.SIM_OUT || path.resolve('.sim-screens');
const ADMIN_EMAIL = 'sim-tour-ops-admin@atockorea.test';
const ADMIN_PW = process.env.SIM_ADMIN_PW || 'SimOps!2026aBc';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

const fx = JSON.parse(readFileSync(path.resolve('scripts/.sim-fixtures.json'), 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  console.log('  saved', name);
};

async function opsLogin(page) {
  await page.goto(`${BASE}/signin?redirect=/admin/tour-ops`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Reveal the email/password form.
  const another = page.getByText(/sign in another way|다른 방법|비밀번호로/i).first();
  if (await another.count()) await another.click().catch(() => {});
  await page.waitForTimeout(500);
  const emailPw = page.getByText(/password instead|비밀번호로 로그인|sign in with password/i).first();
  if (await emailPw.count()) await emailPw.click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/admin\/tour-ops/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function run() {
  const browser = await chromium.launch();

  for (const [label, vp] of [['mobile', MOBILE], ['desktop', DESKTOP]]) {
    console.log(`== ${label} ==`);
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 2,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      geolocation: { latitude: 35.1795, longitude: 129.0756 },
      permissions: ['geolocation'],
    });
    const page = await ctx.newPage();

    // --- customer room (JA guest, has an SOS) ---
    await page.goto(`${BASE}${fx.room2Url}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.getByTestId('chat-feed').waitFor({ timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, `room-chat-${label}`);
    // expand the emergency card to show SOS control
    await page.getByRole('button', { name: /Emergency|긴급/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, `room-emergency-${label}`);

    // --- ops console ---
    await opsLogin(page);
    await shot(page, `ops-dashboard-${label}`);

    // SOS tab
    await page.getByRole('button', { name: /SOS/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, `ops-sos-${label}`);

    // Settings tab
    await page.getByRole('button', { name: /설정/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, `ops-settings-${label}`);

    // Back to dashboard → open the SOS room drawer
    await page.getByRole('button', { name: /대시보드/ }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.getByTestId('ops-room-card').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, `ops-drawer-${label}`);

    await ctx.close();
  }

  await browser.close();
  console.log('done →', OUT_DIR);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
