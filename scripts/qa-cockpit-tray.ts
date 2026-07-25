/**
 * Visual check for the cockpit's action tray (KakaoTalk-style "+" panel).
 *
 * Drives the driver cockpit on WebKit/iPhone and captures the folded state,
 * the open tray in light and dark, so the colour tones can be reviewed by eye
 * rather than asserted blind.
 *
 * Run: npx tsx scripts/qa-cockpit-tray.ts   (dev on :3160 + sim-tour-day)
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { webkit, devices, type Page } from '@playwright/test';

loadEnvConfig(process.cwd());

const BASE = 'http://localhost:3160';
const SHOTS = process.argv[2] || path.join(process.cwd(), '.qa-shots-tray');
mkdirSync(SHOTS, { recursive: true });
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

async function dismiss(page: Page) {
  const manual = page.getByTestId('app-manual-dismiss');
  if (await manual.isVisible().catch(() => false)) {
    await manual.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  for (let i = 0; i < 3; i += 1) {
    const sheet = page.getByTestId('room-sheet');
    if (!(await sheet.isVisible().catch(() => false))) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

async function main() {
  const browser = await webkit.launch();
  const notes: string[] = [];

  for (const theme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    // The room theme is a device setting, not a media query.
    await page.addInitScript(
      ([t]) => {
        window.localStorage.setItem('tour_mode_settings', JSON.stringify({ theme: t }));
      },
      [theme],
    );
    await page.goto(`${BASE}${fx.guideUrl}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await dismiss(page);

    // Enter drive mode (the cockpit) from the guide console.
    const drive = page.getByRole('button', { name: /운전|드라이브|drive/i }).first();
    if (await drive.isVisible().catch(() => false)) {
      await drive.click().catch(() => {});
      await page.waitForTimeout(3000);
      await dismiss(page);
    } else {
      notes.push(`${theme}: drive-mode entry not found on the guide console`);
    }

    const toggle = page.getByTestId('cockpit-actions-toggle');
    const reachable = await toggle.isVisible().catch(() => false);
    notes.push(`${theme}: "+" toggle visible = ${reachable}`);
    await page.screenshot({ path: path.join(SHOTS, `cockpit-${theme}-folded.png`) });

    if (reachable) {
      await toggle.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(SHOTS, `cockpit-${theme}-tray.png`) });
      const tiles = await page.getByTestId('action-grid').locator('button').count();
      notes.push(`${theme}: tray tiles = ${tiles}`);
    }

    await ctx.close();
  }

  await browser.close();
  for (const note of notes) console.log('-', note);
  console.log(`shots → ${SHOTS}`);
}

main().catch((error) => {
  console.error('tray check failed:', error);
  process.exit(1);
});
