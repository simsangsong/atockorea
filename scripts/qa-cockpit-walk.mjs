/**
 * qa-cockpit-walk — headless walkthrough + vertical-budget measurement of the
 * cockpit (운전 모드), for §D-5 Part F (C6).
 *
 * Why it exists: the MCP browser pane cannot composite while hidden, so
 * in-pane screenshots are impossible in unattended sessions (documented
 * 2026-07-26 incident class). Playwright headless has no such limit.
 *
 * Why it MEASURES rather than only shooting: the owner's report was
 * "채팅 내용이 몇 줄밖에 안 보인다". That is a claim about a number, and the
 * plan's C5 (swapping the cockpit's own renderer for ChatFeed) is a large
 * structural change whose success is otherwise judged by vibes. So this prints
 * the vertical budget — header / destination / feed / bottom stack — and the
 * count of message bubbles actually inside the feed's visible box.
 *
 * Usage:
 *   1) dev server on :3180 with NEXT_PUBLIC_TOUR_MODE_V1=1
 *   2) COCKPIT_URL='<guide console url with ?rt=…>' (the walk taps 운행 시작)
 *   3) SHOT_DIR=<out> node scripts/qa-cockpit-walk.mjs
 *
 * Seed enough messages first or the count is meaningless — the room needs more
 * bubbles than fit, otherwise "visible" just means "all of them".
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const OUT = process.env.SHOT_DIR ?? '.';
const SHOTS = path.join(OUT, 'cockpit');
mkdirSync(SHOTS, { recursive: true });

const URL = process.env.COCKPIT_URL;
if (!URL) throw new Error('COCKPIT_URL is required (guide console url incl. ?rt=)');

/** Device profile: a common Android phone, the staff reality. */
const VIEWPORT = { width: 412, height: 915 };

/**
 * Cases worth separating. Text scale is in here because it was dead until C1
 * and is the setting the owner reached for; a regression would be invisible in
 * a single-scale shot.
 */
const CASES = [
  { label: 'dark-classic-scale3', settings: { theme: 'dark', skin: 'classic', textScale: 3 } },
  { label: 'dark-classic-scale1', settings: { theme: 'dark', skin: 'classic', textScale: 1 } },
  { label: 'dark-classic-scale5', settings: { theme: 'dark', skin: 'classic', textScale: 5 } },
  { label: 'dark-jeju-scale3', settings: { theme: 'dark', skin: 'jeju', textScale: 3 } },
  { label: 'light-classic-scale3', settings: { theme: 'light', skin: 'classic', textScale: 3 } },
];

/** Read the layout budget + how many bubbles are really on screen. */
const MEASURE = () => {
  const root = document.querySelector('[data-testid="driver-console"]');
  const feed = document.querySelector('[data-testid="driver-feed"]');
  if (!root || !feed) return { missing: true };
  const feedBox = feed.getBoundingClientRect();

  // Direct children of the feed are one message each (the cockpit renders
  // `recent.map(... <div key={message.id}>)`). Count the ones whose box is
  // wholly inside the feed's visible area — a half-clipped bubble is not a
  // message you can read at a glance while driving.
  const visible = [...feed.children].filter((child) => {
    const b = child.getBoundingClientRect();
    return b.height > 0 && b.top >= feedBox.top - 0.5 && b.bottom <= feedBox.bottom + 0.5;
  }).length;

  const heightOf = (sel) => {
    const el = document.querySelector(sel);
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  };
  const rootBox = root.getBoundingClientRect();
  const cs = getComputedStyle(root);
  return {
    skin: root.getAttribute('data-tr-skin'),
    fontScale: cs.getPropertyValue('--tr-font-scale').trim() || '(unset)',
    screenH: Math.round(rootBox.height),
    feedH: Math.round(feedBox.height),
    feedPct: Math.round((feedBox.height / rootBox.height) * 100),
    // Everything below the feed is the bottom stack (chips + composer + mic).
    bottomStackH: Math.round(rootBox.bottom - feedBox.bottom),
    aboveFeedH: Math.round(feedBox.top - rootBox.top),
    totalMessages: feed.children.length,
    visibleMessages: visible,
    // Per-block breakdown of everything above the feed. A total alone tells you
    // the budget moved; it does not tell you which block moved it, and that is
    // the only form of the number you can act on.
    partsAbove: (() => {
      // The feed may be nested (it gained a positioning wrapper in C3), so walk
      // up to whichever ancestor is a direct child of the root.
      let block = feed;
      while (block.parentElement && block.parentElement !== root) block = block.parentElement;
      return [...root.children]
        .slice(0, [...root.children].indexOf(block))
        .map((el) => Math.round(el.getBoundingClientRect().height));
    })(),
    composerH: heightOf('[data-testid="driver-text-input"]'),
    micH: heightOf('[data-testid="driver-mic"]'),
  };
};

const browser = await chromium.launch();
const results = [];
const errors = [];

for (const testCase of CASES) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    /**
     * 🔴 Without this the numbers lie. MicPrime ("마이크 허용" + its explainer)
     * renders only while microphone permission is unresolved, and it is ~130px
     * of bottom stack. A headless context always looks unresolved, so an
     * ungranted run measures a bottom stack no real driver sees after their
     * first tour. Granted = the steady state we are actually designing for.
     */
    permissions: ['microphone'],
  });
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem('tour_mode_settings', JSON.stringify(s));
    } catch {
      /* private mode — the case still renders at defaults */
    }
  }, testCase.settings);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${testCase.label}: ${m.text()}`);
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('[data-testid="drive-hero"]', { timeout: 90_000 });
  await page.click('[data-testid="drive-hero"]');
  await page.waitForSelector('[data-testid="driver-feed"]', { timeout: 60_000 });
  // The feed pins itself to the bottom after load; measure once it settles.
  await page.waitForTimeout(4_000);

  const measured = await page.evaluate(MEASURE);
  results.push({ case: testCase.label, ...measured });
  await page.screenshot({ path: path.join(SHOTS, `${testCase.label}.png`), fullPage: false });

  /**
   * Focus mode is the answer to "몇 줄밖에 안 보인다" — it folds the bottom
   * stack away and widens the window from 8 messages to 80. It existed before
   * this track with no affordance at all, so it is measured separately: the
   * collapsed number is the glance view, this one is the read view.
   */
  const expand = page.locator('[data-testid="cockpit-chat-expand"]');
  if (await expand.count()) {
    await expand.click();
    await page.waitForTimeout(1_500);
    const expanded = await page.evaluate(MEASURE);
    results.push({ case: `${testCase.label} [focus]`, ...expanded });
    await page.screenshot({ path: path.join(SHOTS, `${testCase.label}-focus.png`), fullPage: false });
    const collapse = page.locator('[data-testid="cockpit-chat-collapse"]');
    if (await collapse.count()) await collapse.click();
    await page.waitForTimeout(800);
  }

  // Composer with a draft — the send control's presence changes the row.
  const input = page.locator('[data-testid="driver-text-input"]');
  if (await input.count()) {
    await input.fill('타이핑 테스트');
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(SHOTS, `${testCase.label}-draft.png`),
      clip: { x: 0, y: VIEWPORT.height - 260, width: VIEWPORT.width, height: 260 },
    });
  }
  await ctx.close();
}

await browser.close();

const table = results.map((r) => ({
  case: r.case,
  scale: r.fontScale,
  skin: r.skin,
  'feed px': r.feedH,
  'feed %': r.feedPct,
  'above': r.aboveFeedH,
  'bottom stack': r.bottomStackH,
  'msgs visible': `${r.visibleMessages}/${r.totalMessages}`,
}));
console.table(table);
if (errors.length) {
  console.log('\nCONSOLE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log(' ', e);
} else {
  console.log('\nconsole clean');
}

writeFileSync(path.join(SHOTS, 'measurements.json'), JSON.stringify(results, null, 2));
console.log(`\nshots + measurements.json → ${SHOTS}`);
