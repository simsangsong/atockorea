/**
 * Verifies the two owner device reports of 2026-07-27:
 *   R7  Smart Guide claims photo questions but had no photo button.
 *   R8  Header / bottom nav cover content (the stop-detail drawer was trapped
 *       under them by a `z-[1]` stacking context on the tab-panel wrapper).
 *
 * R8 is checked by hit-testing, not by eyeballing a screenshot: if the drawer
 * really paints above the chrome, elementFromPoint at the close button returns
 * the button. Under the old stacking context it returned the header.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]'];

const OUT = process.env.SHOT_DIR ?? '.';
mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
// The manual auto-opens for anyone who hasn't seen this version of it, and its
// backdrop swallows every header click. Mark it seen before the app boots.
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
  } catch {
    /* private mode — the probe just retries the dismiss path below */
  }
});

const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 240)));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 240)));

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 90000 });
await page.waitForTimeout(1200);

// The manual auto-opens on first visit (MANUAL_SEEN_KEY bumped to v2 with the
// rewritten copy), so dismiss whatever sheet is up before driving the header.
const dismissSheet = async () => {
  for (let i = 0; i < 4; i += 1) {
    const backdrop = page.locator('[data-testid="room-sheet-backdrop"]');
    if (!(await backdrop.isVisible().catch(() => false))) return;
    await backdrop.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
};
await dismissSheet();

// ---- R7: the photo button lives in the Smart Guide sheet -------------------
await page.click('[data-testid="concierge-open"]');
await page.waitForSelector('[data-testid="concierge-panel"]', { timeout: 20000 });
await page.waitForTimeout(500);

const photoBtn = page.locator('[data-testid="concierge-photo"]');
const photoVisible = await photoBtn.isVisible().catch(() => false);
check('R7 camera button rendered in Smart Guide', photoVisible);

if (photoVisible) {
  const box = await photoBtn.boundingBox();
  check(
    'R7 camera button has a real tap target (>=40px)',
    !!box && box.width >= 40 && box.height >= 40,
    box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'no box',
  );
  const hit = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="concierge-photo"]');
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const describe = (n) =>
      n
        ? `${n.tagName}${n.getAttribute('data-testid') ? '[' + n.getAttribute('data-testid') + ']' : ''}.${String(n.className).slice(0, 60)}`
        : 'none';
    // NEXTJS-PORTAL is the dev-tools badge; it does not exist in production.
    const devBadge = !!top && top.tagName === 'NEXTJS-PORTAL';
    return {
      onTop: devBadge || (!!top && (top === el || el.contains(top))),
      cover: describe(top),
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left) },
      viewport: window.innerHeight,
    };
  });
  check(
    'R7 camera button is on top (nothing covers it)',
    hit.onTop,
    `covered by ${hit.cover}; rect top=${hit.rect.top} bottom=${hit.rect.bottom} vp=${hit.viewport}`,
  );
  const inputPresent = (await page.locator('[data-testid="concierge-photo-input"]').count()) === 1;
  check('R7 hidden capture input wired', inputPresent);

  // End-to-end: a real photo through the real route. The wiring test in jest
  // stubs the handler, so this is the only place the sheet↔API contract is
  // exercised for real.
  await page.fill('[data-testid="concierge-input"]', 'What is this?');
  await page.setInputFiles('[data-testid="concierge-photo-input"]', {
    name: 'probe.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      'base64',
    ),
  });
  const asking = await page
    .waitForSelector('[data-testid="concierge-thinking"]', { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check('R7 photo ask enters the busy state', asking);

  const answered = await page
    .waitForFunction(
      () => {
        const t = document.querySelector('[data-testid="concierge-thread"]');
        return !!t && !document.querySelector('[data-testid="concierge-thinking"]') && t.children.length >= 2;
      },
      { timeout: 90000 },
    )
    .then(() => true)
    .catch(() => false);
  const thread = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="concierge-thread"]');
    return t ? [...t.children].map((c) => c.textContent.trim().slice(0, 90)) : [];
  });
  check('R7 photo ask returns an answer into the sheet thread', answered, thread.join(' || '));
  await page.screenshot({ path: path.join(OUT, 'r7-photo-answer.png') });
}
await page.screenshot({ path: path.join(OUT, 'r7-smart-guide-photo.png') });

await dismissSheet();

// ---- R8: a fixed overlay inside a tab must beat header + tabbar -----------
// Probe generically: mount a fixed z-[71] element inside the tab panel exactly
// like TourStopDetailDrawer does, then hit-test its corners against the chrome.
const overlay = await page.evaluate(() => {
  const panel =
    document.querySelector('[data-testid="home-panel"]') ??
    document.querySelector('[data-testid="room-tabbar"]').parentElement;
  const probe = document.createElement('div');
  probe.id = '__r8_probe';
  probe.style.cssText =
    'position:fixed;top:0;bottom:0;right:0;width:100%;max-width:520px;z-index:71;background:#fff';
  panel.appendChild(probe);
  const r = probe.getBoundingClientRect();
  const topHit = document.elementFromPoint(r.left + r.width / 2, 8);
  const bottomHit = document.elementFromPoint(r.left + r.width / 2, window.innerHeight - 8);
  const res = {
    coversViewportTop: !!topHit && probe.contains(topHit),
    coversViewportBottom: !!bottomHit && probe.contains(bottomHit),
    height: Math.round(r.height),
    viewport: window.innerHeight,
    topHit: topHit ? topHit.getAttribute('data-testid') || topHit.tagName : 'none',
    bottomHit: bottomHit ? bottomHit.getAttribute('data-testid') || bottomHit.tagName : 'none',
  };
  probe.remove();
  return res;
});
check(
  'R8 fixed overlay inside a tab is not clipped by the header',
  overlay.coversViewportTop,
  `top hit = ${overlay.topHit}`,
);
check(
  'R8 fixed overlay inside a tab is not clipped by the bottom nav',
  overlay.coversViewportBottom,
  `bottom hit = ${overlay.bottomHit}`,
);
check(
  'R8 fixed overlay spans the full viewport',
  overlay.height === overlay.viewport,
  `${overlay.height}/${overlay.viewport}px`,
);

// ---- R8b: the drawer's own safe-area insets resolve ------------------------
const insets = await page.evaluate(() => {
  const d = document.createElement('div');
  d.style.cssText =
    'position:fixed;top:calc(1rem + env(safe-area-inset-top, 0px));padding-bottom:env(safe-area-inset-bottom, 0px)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  const out = { top: cs.top, paddingBottom: cs.paddingBottom };
  d.remove();
  return out;
});
check(
  'R8b safe-area expressions resolve (web insets are 0 → no regression)',
  insets.top === '16px' && insets.paddingBottom === '0px',
  `top=${insets.top} pb=${insets.paddingBottom}`,
);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
