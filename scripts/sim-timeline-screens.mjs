import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3150';
const OUT_DIR = process.env.SIM_OUT;
const fx = JSON.parse(readFileSync(path.resolve('scripts/.sim-fixtures.json'), 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) }); console.log('saved', name); };
const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console-error]', m.text().slice(0, 200)); });
  await page.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByTestId('chat-feed').waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);

  // 1. Travel Timeline entry card exists in the feed
  await page.getByTestId('timeline-open').waitFor({ timeout: 10000 });
  await shot(page, 'timeline-entry-card');

  // 2. Open the recap sheet — stops + photos + reward + review CTA
  await page.getByTestId('timeline-open').click();
  await page.getByTestId('timeline-panel').waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await shot(page, 'timeline-sheet-open');

  // 3. Complete timeline → claim offered; invite guest has no account →
  //    the endpoint answers login_required honestly.
  await page.getByTestId('timeline-claim').click();
  await page.getByTestId('timeline-reward').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
  await shot(page, 'timeline-claim-result');

  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
