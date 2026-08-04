/**
 * qa-hero-grid — the full combination grid for the three hero surfaces
 * (guest home / lobby / cockpit), full-app audit A2.
 *
 * Grid (plan §C-A2): guest surfaces {ko,en,de,ru} × {light,dark} ×
 * {classic,contrast,jeju} × {390,320} × text scale {3,5}; the cockpit is
 * Korean-only (driver console) so it runs the non-locale axes.
 *
 * Judges per combo — all machine, eyes only see failures:
 *   - CJK mid-glyph line break count (qa-cjk-render.mjs's measure, verbatim)
 *   - anything reaching PAST the viewport edge (horizontal scrollers exempt)
 *   - document-level horizontal overflow
 *   - visible .tr-numeral count ≤ 1 per screen
 *   - touch targets: visible button/tab/link controls with min(w,h) < 40px
 *   - console errors / pageerrors
 *
 * REPORTED but not judged: `overflowing` (an element wider than its own box).
 * At 320px with the largest text step that is the measured cost of
 * `word-break: keep-all`, not a defect — see the note in `measure`.
 *
 * Output: one JSON line per combo to stdout; failure screenshots only
 * (SHOT_DIR), per the plan's "결함 컷만" archive rule. Exits 2 if any surface
 * never became reachable — a run that silently skips reports a cheerful zero.
 *
 * Usage:
 *   1) dev server (WALK_BASE, default :3161) with NEXT_PUBLIC_TOUR_MODE_V1=1
 *   2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *      ALLOW_SIM_SEED=1 npx tsx scripts/sim-lobby-booking.ts
 *   3) SHOT_DIR=<out> node scripts/qa-hero-grid.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

/**
 * U1 coverage contract — read by `scripts/gen-uiux-coverage.mjs`.
 *
 * Every surface here is reached through a runtime fixture URL (`fx.room1Url`,
 * `fx.guideUrl`), so no reader of this source can tell which pages the walk
 * actually opens. This declaration is the only machine-readable record, and it
 * cannot quietly outlive the walk: `runSurface` exits 2 when a declared surface
 * never becomes reachable.
 */
export const COVERS = [
  '/tour-mode/room/[bookingId]', // surfaces `home` and `lobby` — same route, two states
  '/tour-mode/guide', // surface `cockpit` lives INSIDE the staff shell (운행 탭 → 운전 모드), not at /tour-mode/driver
];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';
const OUT = path.join(process.env.SHOT_DIR ?? '.', 'hero-grid');
mkdirSync(OUT, { recursive: true });

const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
const lobbyFx = JSON.parse(readFileSync('scripts/.sim-lobby-fixtures.json', 'utf8'));

const LOCALES = ['ko', 'en', 'de', 'ru'];
const SCHEMES = ['light', 'dark'];
const SKINS = ['classic', 'contrast', 'jeju'];
const WIDTHS = [390, 320];
const SCALES = [3, 5];

/** qa-cjk-render.mjs's in-page judge, verbatim (CJK breaks + overflow). */
const measure = () => {
  const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯ᄀ-ᇿ]/;
  const samples = [];
  let broken = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue ?? '';
    if (text.length < 2 || text.length > 400 || !CJK.test(text)) continue;
    range.selectNodeContents(node);
    if (range.getClientRects().length < 2) continue;
    let prevTop = null;
    for (let i = 0; i < text.length; i += 1) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (prevTop !== null && r.top > prevTop + 1) {
        const prev = text[i - 1];
        const cur = text[i];
        if (prev && !/\s/.test(prev) && !/\s/.test(cur) && CJK.test(prev) && CJK.test(cur)) {
          broken += 1;
          if (samples.length < 4) {
            samples.push(`${text.slice(Math.max(0, i - 8), i)}⏎${text.slice(i, i + 8)}`);
          }
        }
      }
      prevTop = r.top;
    }
  }

  const de = document.documentElement;
  let overflowing = 0;
  const overflowSamples = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    const cs = getComputedStyle(el);
    // Only VISIBLE bleed is a violation. auto/scroll scroll on purpose;
    // hidden/clip is designed truncation (`truncate`, ellipsis) — the
    // first grid run flagged h1.tr-title ellipsis on all 65 combos.
    if (cs.overflowX !== 'visible') continue;
    overflowing += 1;
    if (overflowSamples.length < 4) {
      overflowSamples.push(
        `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${el.scrollWidth}>${el.clientWidth}`,
      );
    }
  }

  /**
   * 🔴 The judgement that matters: does anything reach PAST THE SCREEN EDGE?
   *
   * `overflowing` above counts an element wider than its own box, and at 320px
   * with the largest text step that number is not zero and should not be — it is
   * the measured COST of `word-break: keep-all`. The default raises a CJK run's
   * min-content width from one glyph to its longest 어절 (§G-3b measured 14px →
   * 70px), so a bubble body can exceed its box by a few px while every pixel of
   * it is still on screen and readable. Clipping it would hide a guest's message;
   * letting it break mid-syllable would violate P1-5. Neither is an improvement.
   *
   * What a guest actually loses is text they cannot see, so that is the failure:
   * an element whose right edge is beyond the viewport. Measured separately, and
   * `overflowing` stays in the output as the cost figure it is.
   */
  let pastEdge = 0;
  const pastEdgeSamples = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= window.innerWidth + 1) continue;
    /**
     * ⚠ Two exemptions, both learned by measuring: the first version of this
     * judge flagged 128 of 216 combos and every one was a false positive.
     *
     * 1. SVG INTERIOR. The skin scenery is one full-bleed artwork; its `<path>`,
     *    `<g>` and `<ellipse>` boxes reach past the viewport by design because
     *    the `<svg>` element is the layout box and its geometry is not layout.
     *    Judge the root, never the drawing.
     * 2. A CLIPPING OR SCROLLING ANCESTOR. If something above it hides or
     *    scrolls the overflow, the guest never loses the pixels — that is the
     *    difference between a bug and a design.
     */
    if (el.closest('svg')) continue;
    let anc = el.parentElement;
    let contained = false;
    while (anc) {
      const ox = getComputedStyle(anc).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
        contained = true;
        break;
      }
      anc = anc.parentElement;
    }
    if (contained) continue;
    pastEdge += 1;
    if (pastEdgeSamples.length < 4) {
      pastEdgeSamples.push(
        `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 34)} right=${Math.round(r.right)}>vw=${window.innerWidth}`,
      );
    }
  }

  // visible numerals (plan: ≤1 per screen)
  let numerals = 0;
  for (const el of document.querySelectorAll('.tr-numeral')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) numerals += 1;
  }

  // touch targets — visible interactive controls under 40px on both axes
  let smallTargets = 0;
  const smallSamples = [];
  const controls = document.querySelectorAll('button, [role="button"], [role="tab"], a[href]');
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    if (Math.min(r.width, r.height) >= 40) continue;
    // inline text links inside paragraphs are conventionally exempt
    if (el.tagName === 'A' && el.closest('p')) continue;
    smallTargets += 1;
    if (smallSamples.length < 4) {
      const label = (el.getAttribute('data-testid') || el.textContent || '').trim().slice(0, 30);
      smallSamples.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }

  return {
    broken,
    samples,
    docOverflow: de.scrollWidth > de.clientWidth + 1,
    overflowing,
    overflowSamples,
    pastEdge,
    pastEdgeSamples,
    numerals,
    smallTargets,
    smallSamples,
  };
};

const browser = await chromium.launch();
let unreachable = 0;
let combos = 0;
let failures = 0;

/**
 * One surface, full grid. `prepare(page)` navigates from a fresh load to the
 * judged screen (dismiss manual, enter cockpit, …). Settings ride localStorage
 * so they are planted before goto and read at mount.
 */
async function runSurface({ name, url, bookingId, locales, prepare }) {
  for (const width of WIDTHS) {
    for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: scheme,
        geolocation: { latitude: 37.5665, longitude: 126.978 },
        permissions: ['geolocation'],
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
      page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

      for (const locale of locales) {
        for (const skin of SKINS) {
          for (const scale of SCALES) {
            errors.length = 0;
            const combo = `${name}-${locale}-${scheme}-${skin}-w${width}-s${scale}`;
            try {
              await page.addInitScript(
                ({ bid, loc, sk, sc }) => {
                  if (bid && loc) window.localStorage.setItem(`tour_mode_locale:${bid}`, loc);
                  window.localStorage.setItem(
                    'tour_mode_settings',
                    JSON.stringify({ skin: sk, textScale: sc }),
                  );
                  // lib/tour-room/appManual.ts MANUAL_SEEN_KEY — keeps the
                  // first-visit sheet out of every combo's frame.
                  window.localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
                },
                { bid: bookingId, loc: locale, sk: skin, sc: scale },
              );
              await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
              await prepare(page);
              await page.waitForTimeout(600);
              const m = await page.evaluate(measure);
              combos += 1;
              // `overflowing` is reported, not judged — see the note in `measure`.
              const bad =
                m.broken > 0 || m.docOverflow || m.pastEdge > 0 || m.numerals > 1 || m.smallTargets > 0 || errors.length > 0;
              const row = { combo, ...m, consoleErrors: errors.slice(0, 3) };
              console.log(JSON.stringify(row));
              if (bad) {
                failures += 1;
                await page.screenshot({ path: path.join(OUT, combo + '.png') });
              }
            } catch (e) {
              unreachable += 1;
              console.log(JSON.stringify({ combo, unreachable: String(e).slice(0, 160) }));
              await page.screenshot({ path: path.join(OUT, combo + '-unreachable.png') }).catch(() => {});
            }
          }
        }
      }
      await ctx.close();
    }
  }
}

const dismissManual = async (page) => {
  const d = page.locator('[data-testid="app-manual-dismiss"]');
  if (await d.isVisible().catch(() => false)) {
    await d.click({ timeout: 5000 });
    await page.waitForTimeout(300);
  }
};

/** GRID_ONLY=cockpit re-verifies one surface without paying for all 216. */
const ONLY = process.env.GRID_ONLY ?? '';
const wanted = (name) => !ONLY || ONLY.split(',').includes(name);

if (wanted('home'))
await runSurface({
  name: 'home',
  url: fx.room1Url,
  bookingId: fx.booking1,
  locales: LOCALES,
  prepare: async (page) => {
    await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 45000 });
    await dismissManual(page);
  },
});

if (wanted('lobby'))
await runSurface({
  name: 'lobby',
  url: lobbyFx.roomUrl,
  bookingId: lobbyFx.bookingId,
  locales: LOCALES,
  prepare: async (page) => {
    await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 45000 });
    await dismissManual(page);
  },
});

if (wanted('cockpit'))
await runSurface({
  name: 'cockpit',
  url: fx.guideUrl,
  bookingId: null,
  locales: ['ko'],
  prepare: async (page) => {
    /**
     * staff shell → 운행 탭 → per-room 운전 모드.
     *
     * 🔴 Two things made this the least reliable step in the grid, and both were
     * measurement failures reported as "unreachable" — which is worse than a red,
     * because it looks like the surface, not the harness:
     *
     *   1. It clicked `drive-hero` and hoped that switched tabs. The hero is only
     *      rendered in some states, so on a run where it was absent the walk
     *      stayed on 대화 and then waited 30s for a button that lives in 운행.
     *      The tab bar is always there, so select the tab BY KEY instead.
     *   2. `waitFor` defaults to VISIBLE, and at 320px the per-room button sits
     *      below the fold — so the six combos this grid exists to judge were the
     *      exact six it could not reach. Attach first, then scroll it into view.
     */
    await page.waitForSelector('[data-testid="staff-shell"]', { timeout: 60000 });
    const opsTab = page.locator('[data-testid="staff-tab-btn-ops"]');
    await opsTab.waitFor({ state: 'attached', timeout: 45000 });
    await opsTab.scrollIntoViewIfNeeded().catch(() => undefined);
    await opsTab.click({ timeout: 15000 });
    await page.waitForSelector('[data-testid="staff-tab-ops"]', { timeout: 30000 });
    const drive = page.locator('[data-testid="ops-drive"]').first();
    await drive.waitFor({ state: 'attached', timeout: 45000 });
    await drive.scrollIntoViewIfNeeded({ timeout: 15000 });
    await drive.click({ timeout: 15000 });
    await page.waitForSelector('[data-testid="driver-feed"]', { timeout: 60000 });
  },
});

await browser.close();
console.log(
  JSON.stringify({ summary: true, combos, failures, unreachable }),
);
if (unreachable > 0) process.exit(2);
