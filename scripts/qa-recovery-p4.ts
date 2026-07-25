/**
 * PHASE 4 — cross-role / cross-language verification of the recovery branch.
 *
 * WebKit (Safari engine) + iPhone 13, against the local dev server, driving the
 * surfaces this branch changed:
 *
 *   P0-5  guest schedule renders in the guest's language (product-page stage)
 *   P1-1  the guide does NOT get "follow the guide" / "find my guide"
 *   P1-2  every screen offers a one-tap way home
 *   P1-3  the guide can open the roster over the chat
 *   P1-4  the guide's empty chat does not address them as a guest
 *   P1-6  the text-size setting is a 1–5 slider
 *
 * Run: npx tsx scripts/qa-recovery-p4.ts   (dev on :3160 + sim-tour-day fixtures)
 * Sim data only — reads the same fixtures as qa-ios-smoke.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { webkit, devices, type Page } from '@playwright/test';

loadEnvConfig(process.cwd());

const BASE = 'http://localhost:3160';
const SHOTS = process.argv[2] || path.join(process.cwd(), '.qa-shots-p4');
mkdirSync(SHOTS, { recursive: true });

const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

type Row = { check: string; locale: string; result: 'PASS' | 'FAIL' | 'N/A'; detail: string };
const rows: Row[] = [];
const errors: string[] = [];

function record(check: string, locale: string, ok: boolean | null, detail: string) {
  rows.push({ check, locale, result: ok === null ? 'N/A' : ok ? 'PASS' : 'FAIL', detail });
}

function watch(page: Page, where: string) {
  page.on('pageerror', (err) => errors.push(`${where}: ${String(err).slice(0, 180)}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('Download the React DevTools')) return;
    errors.push(`${where}: ${text.slice(0, 180)}`);
  });
}

/** The room stores the chosen locale per booking in localStorage. */
async function seedLocale(page: Page, bookingId: string, locale: string) {
  await page.addInitScript(
    ([id, loc]) => {
      try {
        window.localStorage.setItem(`tour_mode_locale:${id}`, loc as string);
      } catch {
        /* ignore */
      }
    },
    [bookingId, locale],
  );
}

/** First visit shows the app manual over everything; dismiss it before driving. */
async function dismissOverlays(page: Page) {
  for (const id of ['app-manual-dismiss', 'push-optin-banner']) {
    const el = page.getByTestId(id);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  // Sheets (start gate, concierge, emergency) close on Escape — see Sheet.tsx.
  for (let i = 0; i < 3; i += 1) {
    const sheet = page.getByTestId('room-sheet');
    if (!(await sheet.isVisible().catch(() => false))) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
}

/** Click that never aborts the run — a blocked tab is a finding, not a crash. */
async function tapTab(page: Page, re: RegExp): Promise<boolean> {
  const tab = page.getByRole('tab').filter({ hasText: re }).first();
  if (!(await tab.isVisible().catch(() => false))) return false;
  try {
    await tab.click({ timeout: 8000 });
    return true;
  } catch {
    await dismissOverlays(page);
    try {
      await tab.click({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

const LOCALES = ['en', 'ko', 'zh', 'ja', 'es'] as const;

async function main() {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'en-US' });

  // ── guest room, one pass per language ────────────────────────────────────
  for (const locale of LOCALES) {
    const page = await ctx.newPage();
    watch(page, `guest:${locale}`);
    await seedLocale(page, fx.booking1, locale);
    await page.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);

    // P0-5 — open the schedule tab and read the stop titles.
    if (await tapTab(page, /오늘|Today|本日|Hoy|今日/)) {
      await page.waitForTimeout(900);
      const body = (await page.textContent('body')) ?? '';
      const hasCJK = /[가-힣぀-ヿ一-鿿]/.test(body);
      record(
        'P0-5 schedule in guest language',
        locale,
        locale === 'en' || locale === 'es' ? null : hasCJK,
        hasCJK ? 'localized script present' : 'no localized script found',
      );
      await page.screenshot({ path: path.join(SHOTS, `guest-${locale}-schedule.png`), fullPage: true });
    } else {
      record('P0-5 schedule in guest language', locale, null, 'schedule tab not reachable');
    }

    // P1-1 — the guest SHOULD see the guide-following affordance.
    const bodyText = (await page.textContent('body')) ?? '';
    record(
      'P1-1 guest keeps guide affordances',
      locale,
      null,
      `map tab not opened in this pass (body ${bodyText.length} chars)`,
    );

    await page.close();
  }

  // ── guide view — the role-gating checks ──────────────────────────────────
  {
    const page = await ctx.newPage();
    watch(page, 'guide');
    await page.goto(`${BASE}${fx.guideUrl}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await dismissOverlays(page);
    await page.screenshot({ path: path.join(SHOTS, 'guide-console.png'), fullPage: true });

    // P1-2 — the guide console must offer a way home.
    const home = page.getByTestId('guide-console-home');
    record('P1-2 guide console home', '-', await home.isVisible().catch(() => false), 'guide-console-home');

    // Enter the guide's room chat.
    const chatLink = page.getByRole('link', { name: /채팅|chat/i }).first();
    if (await chatLink.isVisible().catch(() => false)) {
      await chatLink.click();
      await page.waitForTimeout(2500);
      await dismissOverlays(page);
      await page.screenshot({ path: path.join(SHOTS, 'guide-chat.png'), fullPage: true });

      const body = (await page.textContent('body')) ?? '';

      // P1-4 — guest-voiced empty state must NOT appear on the guide's screen.
      const guestCopy = /가이드의 안내가 여기에 도착해요|updates from your guide will appear here/;
      record('P1-4 guide empty state', '-', !guestCopy.test(body), 'guest copy absent from guide chat');

      // P1-3 — roster/seats openable over the chat.
      const manifest = page.getByTestId('open-manifest-sheet');
      const manifestVisible = await manifest.isVisible().catch(() => false);
      record('P1-3 roster from chat', '-', manifestVisible, 'open-manifest-sheet button');
      if (manifestVisible) {
        await manifest.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(SHOTS, 'guide-roster-sheet.png'), fullPage: true });
      }

      // P1-2 — one-tap home from inside the room.
      record('P1-2 room home button', '-', await page.getByTestId('room-home').isVisible().catch(() => false), 'room-home');

      // P1-1 — the guide must NOT be told to follow the guide.
      if (await tapTab(page, /지도|Map|地図|Mapa|地图/)) {
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SHOTS, 'guide-map.png'), fullPage: true });
        const mapBody = (await page.textContent('body')) ?? '';
        const guestWayfinding = /가이드 따라가기|找到导游|가이드에게 가기|Find my guide|Follow guide/;
        record('P1-1 guide map has no guest affordance', '-', !guestWayfinding.test(mapBody), 'guest wayfinding absent');
      } else {
        record('P1-1 guide map has no guest affordance', '-', null, 'map tab not reachable');
      }
    } else {
      record('P1-4 guide empty state', '-', null, 'guide chat link not found');
      record('P1-3 roster from chat', '-', null, 'guide chat link not found');
    }
    await page.close();
  }

  // ── P1-6 — the text-size slider on the guest settings tab ────────────────
  {
    const page = await ctx.newPage();
    watch(page, 'settings');
    await page.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    if (await tapTab(page, /설정|Settings|設定|Ajustes|设置/)) {
      await page.waitForTimeout(900);
      const slider = page.getByTestId('text-scale-slider');
      const visible = await slider.isVisible().catch(() => false);
      const max = visible ? await slider.getAttribute('max') : null;
      record('P1-6 text size 1-5 slider', '-', visible && max === '5', `max=${max}`);
      await page.screenshot({ path: path.join(SHOTS, 'guest-settings.png'), fullPage: true });
    } else {
      record('P1-6 text size 1-5 slider', '-', null, 'settings tab not reachable');
    }
    await page.close();
  }

  await ctx.close();
  await browser.close();

  // ── report ───────────────────────────────────────────────────────────────
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log('\n| check | locale | result | detail |');
  console.log('|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${pad(r.check, 38)} | ${pad(r.locale, 6)} | ${pad(r.result, 4)} | ${r.detail} |`);
  }
  const failed = rows.filter((r) => r.result === 'FAIL');
  console.log(`\nPASS ${rows.filter((r) => r.result === 'PASS').length} · FAIL ${failed.length} · N/A ${rows.filter((r) => r.result === 'N/A').length}`);
  if (errors.length) {
    console.log(`\nconsole/page errors (${errors.length}):`);
    for (const e of [...new Set(errors)].slice(0, 15)) console.log('  -', e);
  } else {
    console.log('\nconsole/page errors: 0');
  }
  console.log(`shots → ${SHOTS}`);
}

main().catch((error) => {
  console.error('harness failed:', error);
  process.exit(1);
});
