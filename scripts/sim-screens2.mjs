import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3130';
const OUT_DIR = process.env.SIM_OUT || path.resolve('.sim-screens');
const ADMIN_EMAIL = 'sim-tour-ops-admin@atockorea.test';
const ADMIN_PW = process.env.SIM_ADMIN_PW || 'SimOps!2026aBc';
mkdirSync(OUT_DIR, { recursive: true });

async function login(page) {
  await page.goto(`${BASE}/signin?redirect=/admin/tour-ops`, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
  await page.waitForTimeout(3000);
  // Dismiss the welcome coupon popup if it rode along from /signin.
  const dismiss = page.getByRole('button', { name: /다음에 할게요|닫기|Close/i }).first();
  if (await dismiss.count()) await dismiss.click().catch(() => {});
  await page.waitForTimeout(500);
}

const run = async () => {
  const browser = await chromium.launch();
  for (const [label, vp] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const ctx = await browser.newContext({
      viewport: vp, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
      geolocation: { latitude: 35.1795, longitude: 129.0756 }, permissions: ['geolocation'],
    });
    const page = await ctx.newPage();
    await login(page);

    // Room drawer — click the SOS room card on the dashboard.
    await page.getByTestId('ops-room-card').first().click().catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, `ops-drawer-${label}.png`) });
    console.log('saved drawer', label);
    // Close drawer (Escape) then go to Map tab.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /지도/ }).first().click().catch(() => {});
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT_DIR, `ops-map-${label}.png`) });
    console.log('saved map', label);
    await ctx.close();
  }
  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
