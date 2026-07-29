/**
 * P7 harness — drive the PLANNER EDITOR and capture it.
 *
 * 🔴 Two gates stand between "open /tour-mode/plan" and "look at the editor",
 * and missing either means auditing a different screen (SESSION-STATE lesson
 * 19). Both are handled here so that never happens again:
 *
 *   ① The default simulation seeds a FIXED-ITINERARY product, which renders the
 *      READ-ONLY view. booking1 must point at a vehicle (charter) tour.
 *      Handled by the caller: see the tour_id UPDATE in the P7 runbook.
 *   ② A fresh browser profile is NOT the lead guest, so it only sees a banner.
 *      Handled here: we click [data-testid="plan-claim-lead"] and wait for the
 *      editor to actually appear before taking a single pixel.
 *
 * Usage:
 *   node scripts/qa-planner-walk.mjs --tag before
 *   node scripts/qa-planner-walk.mjs --tag after --locale ko --theme dark
 *
 * Output: docs/audit/shots/planner-<tag>-<locale>-<theme>-<view>.png
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? 'true' : arr[i + 1]]);
    return acc;
  }, []),
);

const TAG = args.tag ?? 'shot';
const LOCALE = args.locale ?? 'en';
const THEME = args.theme ?? 'light';
const BASE = args.base ?? process.env.WALK_BASE ?? 'http://localhost:3181';
const OUT = path.join(process.cwd(), 'docs', 'audit', 'shots');

const fixtures = JSON.parse(readFileSync(path.join(process.cwd(), 'scripts', '.sim-fixtures.json'), 'utf8'));
const BOOKING = fixtures.booking1;

/**
 * 🔴 Gate ⓪, which is not in the runbook and cost a debugging round:
 * `/tour-mode/plan/<booking>` with NO room token renders
 * "링크를 열 수 없어요" — a dead-link screen, not the planner. The planner is
 * reached from the invite email, so it needs the same `rt` the room uses.
 * Carrying the customer token also satisfies gate ②: that token IS the lead
 * guest, so no claim click is needed on a seeded booking.
 */
const ROOM_TOKEN = new URL(`http://x${fixtures.room1Url}`).searchParams.get('rt');
if (!ROOM_TOKEN) {
  console.error('No rt token in .sim-fixtures.json room1Url — reseed the simulation.');
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `planner-${TAG}-${LOCALE}-${THEME}-${name}.png`), fullPage: false });

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: LOCALE,
  });

  // The Next dev overlay eats clicks; addStyleTag only survives one document.
  await ctx.addInitScript(() => {
    // Runs before the document exists on the first navigation, so appending
    // straight away throws (and that throw shows up as an app console error,
    // which is worse than useless in a harness that reports console errors).
    const inject = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none !important}';
      (document.head ?? document.documentElement).appendChild(style);
    };
    if (document.documentElement) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  });

  // Theme + locale live in the same device-scoped store the room settings use.
  await ctx.addInitScript(
    ([locale, theme]) => {
      try {
        localStorage.setItem('tr-theme', theme);
        localStorage.setItem('tr-locale', locale);
      } catch {
        /* first-run private mode — defaults are fine */
      }
    },
    [LOCALE, THEME],
  );

  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  const url = `${BASE}/tour-mode/plan/${BOOKING}?rt=${encodeURIComponent(ROOM_TOKEN)}&locale=${LOCALE}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // `.tr-plan-root` is the shell and appears instantly, so waiting on it proves
  // nothing about which screen we are on.
  await page.waitForSelector('.tr-plan-root', { timeout: 60_000 });

  /**
   * Gate ② — lead ownership. The FIRST customer device to join a booking takes
   * `is_lead`; every later device sees only a banner with "Edit on this
   * device". Each Playwright context is a new device, so on any re-run this
   * click is required. It must happen AFTER the shell has loaded (the button
   * is rendered from fetched state, so checking for it immediately after
   * `goto` finds nothing and silently proceeds to photograph the banner).
   */
  const claim = page.locator('[data-testid="plan-claim-lead"]');
  if (await claim.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false)) {
    await claim.click();
    await page.waitForTimeout(1500);
  }

  await page
    .waitForSelector('[data-testid^="plan-course-option-"]', { timeout: 60_000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500); // let images settle

  /**
   * 🔴 Prove we are on the EDITOR, not the read-only view. The read-only view
   * has no course options, so this count is the difference between the two
   * screens — and reporting a number from the wrong screen is exactly the
   * failure this harness exists to prevent.
   */
  const editorPresent = await page.locator('[data-testid^="plan-course-option-"]').count();
  if (editorPresent === 0) {
    console.error('NOT THE EDITOR — no plan-course-option-* found. Is booking1 a vehicle/charter tour?');
    await shot(page, '00-wrong-screen');
    await browser.close();
    process.exit(2);
  }

  await shot(page, '01-top');

  // Scroll metrics + what is actually on screen.
  const metrics = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const loaded = imgs.filter((i) => i.complete && i.naturalWidth > 0);
    return {
      scrollHeight: document.documentElement.scrollHeight,
      imgTotal: imgs.length,
      imgLoaded: loaded.length,
      imgBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      cards: document.querySelectorAll('.tr-card').length,
      skin: document.querySelector('.tr-plan-root')?.getAttribute('data-tr-skin') ?? null,
      fontScale: getComputedStyle(document.documentElement).getPropertyValue('--tr-font-scale').trim() || null,
      planFontScale:
        getComputedStyle(document.querySelector('.tr-plan-root') ?? document.documentElement)
          .getPropertyValue('--tr-font-scale')
          .trim() || null,
    };
  });

  // Second tab — the POI picker, where the thumbnails live.
  const pickTab = page.locator('.tr-plan-seg-item').nth(1);
  if (await pickTab.count()) {
    await pickTab.click();
    await page.waitForTimeout(2000);
    await shot(page, '02-picker');
  }

  const countThumbs = () =>
    page.evaluate(() => {
      const thumbs = Array.from(document.querySelectorAll('[data-testid="plan-poi-thumb"]'));
      return {
        thumbs: thumbs.length,
        photo: thumbs.filter((t) => t.getAttribute('data-thumb') === 'photo').length,
        swatch: thumbs.filter((t) => t.getAttribute('data-thumb') === 'swatch').length,
      };
    });

  const pickerMetrics = {
    ...(await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return {
        imgTotal: imgs.length,
        imgLoaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        imgBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      };
    })),
    ...(await countThumbs()),
  };

  /**
   * The other half of P7.1: 49 of 124 POIs have no photo at all, so the SWATCH
   * is a permanent state, not an error path. Search for one that is known to
   * have none and photograph it — otherwise the picker shot above only ever
   * proves the happy case.
   */
  let swatchMetrics = null;
  const search = page.locator('input[type="search"], input[placeholder*="lace"], input[placeholder*="장소"]').first();
  if (await search.count()) {
    const term = args.photoless ?? 'Sangumburi';
    await search.fill(term);
    await page.waitForTimeout(1500);
    const counts = await countThumbs();
    // 🔴 A search that matches nothing renders no thumbs at all, and reporting
    // "0 photo / 0 swatch" as a swatch proof is how the first attempt lied.
    swatchMetrics = { term, ...counts, matched: counts.thumbs > 0 };
    if (counts.thumbs > 0) await shot(page, '04-swatch');
    await search.fill('');
    await page.waitForTimeout(600);
  }

  /**
   * The SECOND wired thumbnail site: the course PREVIEW stop list
   * (`previewStops`), reached by tapping a course rather than applying it.
   *
   * ⚠ Not to be confused with the editable "Your day" rows (`stops.map`), which
   * carry a numbered tile and NO thumbnail at all. That is P7-D3 ④ and belongs
   * to P7.4, not here — saying P7.1 gave "every stop a thumbnail" would be
   * false.
   */
  let coursePreviewMetrics = null;
  const courseTab = page.locator('.tr-plan-seg-item').first();
  if (await courseTab.count()) {
    await courseTab.click();
    await page.waitForTimeout(1200);
    const option = page.locator('[data-testid="plan-course-option-1"]');
    if (await option.count()) {
      await option.click();
      await page.waitForTimeout(2500);
      await page.waitForLoadState('networkidle').catch(() => {});
      coursePreviewMetrics = await countThumbs();
      await shot(page, '05-course-preview');
    }
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await shot(page, '03-bottom');

  console.log(
    JSON.stringify(
      { tag: TAG, locale: LOCALE, theme: THEME, editorPresent, ...metrics, picker: pickerMetrics, swatch: swatchMetrics, coursePreview: coursePreviewMetrics, errors: errors.slice(0, 6) },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
