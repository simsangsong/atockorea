/**
 * qa-home-walk — I2's before/after instrument for the guest home tab.
 *
 * §I-3 states the problem as a number: the home screen offers 7 tiles + 5 tabs +
 * 3 header actions, and the guest solves that puzzle every time they open the
 * app. A redesign that claims to reduce choices has to show the count moving,
 * and — far more important — has to prove it did not DELETE anything on the way.
 *
 * So this reports two things:
 *
 *   1. how many things are tappable on first paint (the number I2 is moving), and
 *   2. the full set of data-testids present, expanded and collapsed.
 *
 * The second is the safety line. U-D25: `더 보기` must hold the entire old grid.
 * If a testid that exists today is absent after the change, a guest lost a
 * destination, and to them that is not a redesign — it is a deleted feature.
 *
 * Usage:
 *   ROOM_URL='<room url incl. ?rt=>' SHOT_DIR=<out> node scripts/qa-home-walk.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const OUT = process.env.SHOT_DIR ?? '.qa-shots-home';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.WALK_BASE ?? 'http://localhost:3178';
const ROOM_URL =
  process.env.ROOM_URL ??
  (() => {
    const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
    return BASE + fx.room1Url;
  })();

const VIEWPORT = { width: 390, height: 840 };

const CASES = [
  { label: 'light-classic', settings: { theme: 'light', skin: 'classic', textScale: 3 }, locale: 'en-US' },
  { label: 'dark-classic', settings: { theme: 'dark', skin: 'classic', textScale: 3 }, locale: 'en-US' },
  { label: 'light-jeju-ko', settings: { theme: 'light', skin: 'jeju', textScale: 3 }, locale: 'ko-KR' },
];

/**
 * "Choices" counts what a guest could plausibly tap, not every DOM node with a
 * handler: hidden things are not choices, and neither is a 0x0 element.
 */
const MEASURE = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const root = document.querySelector('[data-testid="home-tab"]') ?? document.body;
  const tappables = [...root.querySelectorAll('button, a, [role="button"], [role="tab"]')].filter(visible);
  const ids = [...document.querySelectorAll('[data-testid]')]
    .map((e) => e.getAttribute('data-testid'))
    .filter(Boolean);
  return {
    homeChoices: tappables.length,
    homeLabels: tappables.map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean),
    testids: [...new Set(ids)].sort(),
    textChars: (root.textContent || '').replace(/\s+/g, ' ').trim().length,
    scrollHeight: Math.round(root.scrollHeight),
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
    locale: testCase.locale,
  });
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem('tour_mode_settings', JSON.stringify(s));
    } catch {
      /* defaults */
    }
  }, testCase.settings);
  // addInitScript, not addStyleTag: the latter attaches to one document and the
  // dev overlay comes back after a client navigation (G-d).
  await ctx.addInitScript(() => {
    const inject = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none !important}';
      (document.head ?? document.documentElement)?.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  });

  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${testCase.label}: ${m.text().slice(0, 160)}`);
  });
  page.on('pageerror', (e) => errors.push(`${testCase.label}: ${e.message.slice(0, 160)}`));

  await page.goto(ROOM_URL, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForTimeout(14_000);

  const collapsed = await page.evaluate(MEASURE);
  await page.screenshot({ path: path.join(OUT, `${testCase.label}-home.png`), fullPage: false });
  await page.screenshot({ path: path.join(OUT, `${testCase.label}-home-full.png`), fullPage: true });

  // Expand whatever "more" affordance exists, so the testid set below is the
  // FULL set of destinations rather than only the ones on first paint.
  let expanded = null;
  const more = page.locator('[data-testid="home-more-toggle"]').first();
  if (await more.count()) {
    await more.click().catch(() => {});
    await page.waitForTimeout(1200);
    expanded = await page.evaluate(MEASURE);
    await page.screenshot({ path: path.join(OUT, `${testCase.label}-home-expanded.png`), fullPage: true });
  }

  results.push({ case: testCase.label, collapsed, expanded });
  await ctx.close();
}

await browser.close();

console.table(
  results.map((r) => ({
    case: r.case,
    'choices (first paint)': r.collapsed.homeChoices,
    'choices (expanded)': r.expanded ? r.expanded.homeChoices : '—',
    'text chars': r.collapsed.textChars,
    'scroll px': r.collapsed.scrollHeight,
    testids: r.collapsed.testids.length,
  })),
);

const allIds = new Set();
for (const r of results) {
  for (const id of r.collapsed.testids) allIds.add(id);
  for (const id of r.expanded?.testids ?? []) allIds.add(id);
}
console.log(`\ndistinct testids reachable: ${allIds.size}`);
console.log([...allIds].join(', '));

if (errors.length) {
  console.log('\nCONSOLE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log(' ', e);
} else {
  console.log('\nconsole clean');
}

writeFileSync(
  path.join(OUT, 'home-measurements.json'),
  JSON.stringify({ results, testids: [...allIds].sort(), errors }, null, 2),
);
console.log(`\nshots + home-measurements.json → ${OUT}`);
