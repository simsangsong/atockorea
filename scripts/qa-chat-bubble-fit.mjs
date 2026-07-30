/**
 * qa-chat-bubble-fit — does an outgoing bubble stay inside the screen at the
 * smallest width and the largest text step? (full-app audit FA-015)
 *
 * The measured defect: `ChatFeed`'s outgoing row is `flex justify-end pl-12` and
 * the bubble pair is capped at `max-w-[76%]`. The cap is a percentage of the row,
 * the padding is fixed, and the timestamp column is intrinsic — at 320px with
 * text step 5 that summed past the viewport (measured 324px of content in a 304px
 * row) and the bubble bled off the right edge.
 *
 * The hero grid judges the HOME tab, so it never saw this; the cockpit does show
 * a feed but its entry flow (staff shell → 운행 → 운전 모드) is fragile in a
 * headless walk. The guest chat tab renders the same component with the same
 * `mine` rows and is two taps away, so that is where this measures.
 *
 * Usage:
 *   1) dev server, 2) sim-tour-day + sim-populate (needs real messages)
 *   3) WALK_BASE=http://localhost:3161 node scripts/qa-chat-bubble-fit.mjs
 * Exits 1 if any combination bleeds.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';
const OUT = path.join(process.env.SHOT_DIR ?? '.', 'chat-fit');
mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

const WIDTHS = [320, 390];
const SCALES = [3, 5];

/** Bleed = a visible-overflow element wider than its box, anywhere in the feed. */
const measure = () => {
  const offenders = [];
  const feed = document.querySelector('[data-testid="chat-feed"]') ?? document.body;
  for (const el of feed.querySelectorAll('*')) {
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    if (getComputedStyle(el).overflowX !== 'visible') continue;
    offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 46)} ${el.scrollWidth}>${el.clientWidth}`);
  }
  // And the plain question: does anything stick out past the viewport edge?
  let pastEdge = 0;
  const vw = window.innerWidth;
  for (const el of feed.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) pastEdge += 1;
  }
  return {
    offenders: offenders.slice(0, 5),
    offenderCount: offenders.length,
    pastEdge,
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
};

const browser = await chromium.launch();
let bad = 0;
let judged = 0;
const rows = [];

for (const width of WIDTHS) {
  for (const scale of SCALES) {
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.addInitScript(
      (sc) => {
        window.localStorage.setItem('tour_mode_settings', JSON.stringify({ skin: 'classic', textScale: sc }));
        window.localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
      },
      scale,
    );
    const label = `chat-w${width}-s${scale}`;
    try {
      await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 45000 });
      // Second tab is chat in every locale (the bar is icon+label, order fixed).
      await page.locator('[data-testid="room-tabbar"] [role="tab"]').nth(1).click({ timeout: 15000 });
      await page.waitForTimeout(1500);
      // Send one message so an OUTGOING (`mine`) row definitely exists — that is
      // the row the cap applies to, and a room seeded with only staff messages
      // would measure nothing and pass.
      const input = page.locator('[data-testid="composer-input"], textarea, input[type="text"]').first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill('오늘 일정 중에 화장실 들를 수 있을까요? 아이가 급해서요 — 감사합니다');
        await page.keyboard.press('Enter');
        // Sending can re-render the whole feed; evaluating into a context that is
        // being torn down throws "Execution context was destroyed" and looks like
        // a layout failure. Settle first, then measure.
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        await page.waitForTimeout(2500);
      }
      let m;
      try {
        m = await page.evaluate(measure);
      } catch {
        await page.waitForTimeout(1500);
        m = await page.evaluate(measure);
      }
      judged += 1;
      const flagged = m.offenderCount > 0 || m.pastEdge > 0 || m.docOverflow;
      if (flagged) {
        bad += 1;
        await page.screenshot({ path: path.join(OUT, label + '.png') });
      }
      rows.push({ label, ...m });
      console.log(
        `${label.padEnd(18)} bleeding ${String(m.offenderCount).padStart(2)}  past-edge ${String(m.pastEdge).padStart(2)}  docOF ${m.docOverflow}` +
          (flagged ? `  🔴 ${m.offenders.join(' | ')}` : '  ✅'),
      );
    } catch (e) {
      console.log(`${label.padEnd(18)} UNREACHABLE ${String(e).slice(0, 120)}`);
      bad += 1;
    }
    await ctx.close();
  }
}

await browser.close();
console.log(judged === 0 ? '🔴 nothing was judged' : bad ? `🔴 ${bad} combination(s) bleed` : '✅ every combination fits');
process.exit(bad || judged === 0 ? 1 : 0);
