/**
 * Visual check for the guest composer's "+" tray and the elegant tone palette.
 *
 * Run: npx tsx scripts/qa-guest-tray.ts   (dev on :3160 + sim-tour-day)
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { webkit, devices, type Page } from '@playwright/test';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]'];

loadEnvConfig(process.cwd());

const BASE = 'http://localhost:3160';
const SHOTS = process.argv[2] || path.join(process.cwd(), '.qa-shots-guest-tray');
mkdirSync(SHOTS, { recursive: true });
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

async function dismiss(page: Page) {
  // App manual, the install nudge and the push opt-in all overlay the composer
  // on a first visit; close whatever is present.
  for (const id of ['app-manual-dismiss', 'install-banner-dismiss', 'push-optin-banner']) {
    const el = page.getByTestId(id);
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(350);
    }
  }
  const dialog = page.getByRole('dialog').filter({ hasText: /홈 화면에 추가/ });
  if (await dialog.isVisible().catch(() => false)) {
    const close = dialog.getByRole('button').last();
    await close.click().catch(() => {});
    await page.waitForTimeout(350);
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
    await page.addInitScript(
      ([t, id]) => {
        window.localStorage.setItem('tour_mode_settings', JSON.stringify({ theme: t }));
        window.localStorage.setItem(`tour_mode_locale:${id}`, 'ko');
        // Pre-dismiss the A2HS nudge — it overlays the composer on a first
        // visit and there is no test id on its close control.
        window.localStorage.setItem('atoc-tour-mode-a2hs-dismissed', '1');
        window.localStorage.setItem(`tour_mode_a2hs_shown:${id}`, '1');
        window.localStorage.setItem(`tour_mode_push_optin:${id}`, 'dismissed');
      },
      [theme, fx.booking1],
    );
    await page.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await dismiss(page);

    // Land on the chat tab, where the composer lives.
    const chatTab = page.getByRole('tab').filter({ hasText: /채팅/ }).first();
    if (await chatTab.isVisible().catch(() => false)) {
      await chatTab.click().catch(() => {});
      await page.waitForTimeout(900);
    }

    const toggle = page.getByTestId('composer-actions-toggle');
    const reachable = await toggle.isVisible().catch(() => false);
    notes.push(`${theme}: guest "+" visible = ${reachable}`);
    await page.screenshot({ path: path.join(SHOTS, `guest-${theme}-folded.png`) });

    if (reachable) {
      await toggle.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(SHOTS, `guest-${theme}-tray.png`) });
      const tiles = await page.getByTestId('action-grid').locator('button').count();
      notes.push(`${theme}: guest tray tiles = ${tiles}`);
    }

    await ctx.close();
  }

  await browser.close();
  for (const note of notes) console.log('-', note);
  console.log(`shots → ${SHOTS}`);
}

main().catch((error) => {
  console.error('guest tray check failed:', error);
  process.exit(1);
});
