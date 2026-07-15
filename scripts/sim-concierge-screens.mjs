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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console-error]', m.text().slice(0, 200)); });
  await page.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByTestId('chat-feed').waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);

  // 1. Header sparkle button exists → open the Smart Guide sheet
  await page.getByTestId('concierge-open').click();
  await page.getByTestId('concierge-panel').waitFor({ timeout: 5000 });
  await shot(page, 'concierge-sheet-open');

  // 2. Tap the next-stop chip (Tier 0, local)
  await page.getByTestId('concierge-chip-next_stop').click();
  await page.waitForTimeout(400);
  await shot(page, 'concierge-tier0-next-stop');

  // 3. Free text: restroom (Tier 0 keyword) — no arrival content seeded → honest fallback
  await page.getByTestId('concierge-input').fill('화장실이 어디에요?');
  await page.getByTestId('concierge-send').click();
  await page.waitForTimeout(400);
  await shot(page, 'concierge-tier0-restroom');

  // 4. Ops request → server escalation → system capsule should appear in the room feed
  await page.getByTestId('concierge-input').fill('일정 변경 가능해요?');
  await page.getByTestId('concierge-send').click();
  await page.waitForTimeout(2500);
  await shot(page, 'concierge-escalated');
  await page.getByTestId('room-sheet-close').click();
  await page.waitForTimeout(800);
  await shot(page, 'feed-escalation-capsule');

  // 5. Tier 1 free question (live LLM through the router)
  await page.getByTestId('concierge-open').click();
  await page.getByTestId('concierge-input').fill('Is it rude to tip the driver in Korea?');
  await page.getByTestId('concierge-send').click();
  await page.waitForTimeout(9000);
  await shot(page, 'concierge-tier1-llm');

  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
