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

/**
 * N5 — every skin, dark, because the cockpit is the one dark-FIXED surface and
 * §E R6 records the trap: a skin's light block ties the base dark block on
 * specificity and sits later in the file, so a token the skin sets only in its
 * light block keeps the LIGHT value in dark mode. The static skinContrast gate
 * catches that for the token pairs it lists; it cannot see what the rendered
 * cockpit does with `.tr-card`'s new border + rim on a near-black canvas.
 * Set SKIN_SWEEP=0 to skip (it costs one full navigation per skin).
 */
const SKIN_SWEEP = [
  'classic', 'sky', 'winter', 'forest', 'meadow',
  'jeju', 'seoul', 'busan', 'blossom', 'contrast',
];

/** Read the layout budget + how many bubbles are really on screen. */
const MEASURE = () => {
  const root = document.querySelector('[data-testid="driver-console"]');
  const feed = document.querySelector('[data-testid="driver-feed"]');
  if (!root || !feed) return { missing: true };
  const feedBox = feed.getBoundingClientRect();

  // C5 moved the bubbles into the shared ChatFeed, which stamps `data-msg-id`
  // on each message wrapper. That is a more honest anchor than "direct children
  // of the feed" was anyway — it counts messages, not layout nodes.
  const bubbles = [...feed.querySelectorAll('[data-msg-id]')];
  // Wholly inside the feed's visible box: a half-clipped bubble is not a
  // message you can read at a glance while driving.
  const visible = bubbles.filter((child) => {
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
    totalMessages: bubbles.length,
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

/**
 * N5 — the material probe. The 2026-07-28 elevation upgrade gave `.tr-card` a
 * hairline border, a rim highlight and a two-layer shadow GLOBALLY, and the
 * cockpit is the only dark-fixed surface in the app. Shadows are nearly free of
 * information on a near-black canvas, so what actually separates a card there is
 * the rim and the border — and both are declared in the dark block, which a
 * skin's light block can outrank (§E R6).
 *
 * So this reports the numbers that would move if that happened: how far a card's
 * fill sits from the canvas behind it (WCAG 1.4.11 wants ≥3.0 for a control, but
 * a passive card legitimately sits lower — the value here is the BEFORE/AFTER
 * and the skin-to-skin spread, not a pass/fail line), and whether the card's own
 * text still clears 4.5:1 on it.
 */
const MATERIAL = () => {
  const root = document.querySelector('[data-testid="driver-console"]');
  if (!root) return { missing: true };
  const cs = getComputedStyle(root);
  const tr = window.__tr;

  const sample = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const surface = tr.surfaceVsBackdrop(el);
    const boundary = tr.boundaryOf(el);
    return {
      surfaceVsCanvas: surface.ratio,
      surface: surface.surface,
      backdrop: surface.backdrop,
      approx: surface.approx,
      // The number that answers "does this read as a control": fill OR border,
      // whichever the eye can actually find. Shadows excluded on purpose.
      boundary: boundary.ratio,
      boundaryVia: boundary.via,
      borderWidth: boundary.borderWidth,
      hasShadow: boundary.hasShadow,
      // The rim is an INSET shadow; the elevation layers are not. Distinguishing
      // them matters because on dark the rim is the part you can actually see.
      hasRim: /inset/.test(s.boxShadow || ''),
    };
  };

  /** Deepest text-bearing descendant, so ink is measured where it is painted. */
  const inkIn = (el) => {
    if (!el) return null;
    const node = [...el.querySelectorAll('*')].find(
      (n) => n.children.length === 0 && (n.textContent || '').trim().length > 1,
    );
    return node ? tr.inkVsSurface(node) : null;
  };

  const card = document.querySelector('[data-testid="driver-console"] .tr-card');
  const chip = document.querySelector('[data-testid="driver-quick-rest_stop"]');
  const feed = document.querySelector('[data-testid="driver-feed"]');
  const bubble = feed ? feed.querySelector('[data-msg-id]') : null;

  return {
    skin: root.getAttribute('data-tr-skin'),
    // The cockpit is dark-fixed (A5). If this ever says false on a light-theme
    // device the guard below fires — that is a regression, not a preference.
    darkClass: root.classList.contains('dark') || Boolean(root.closest('.dark')),
    canvas: tr.hex(tr.surfaceOf(root).color),
    // .tr-atmos is the light source added on 2026-07-28; N-j says the cockpit
    // was never checked for it. Presence is a fact, not a judgement.
    atmos: Boolean(document.querySelector('[data-testid="driver-console"] .tr-atmos, .tr-atmos')),
    cardCount: document.querySelectorAll('[data-testid="driver-console"] .tr-card').length,
    card: sample(card),
    cardInk: inkIn(card),
    chip: sample(chip),
    chipInk: chip ? tr.inkVsSurface(chip) : null,
    bubble: sample(bubble),
    bubbleInk: bubble ? inkIn(bubble) : null,
    header: (() => {
      const h = root.querySelector('header') ?? root.firstElementChild;
      return sample(h);
    })(),
    fontScale: cs.getPropertyValue('--tr-font-scale').trim() || '(unset)',
  };
};

/**
 * 🔴 Navigation. This used to be `click(drive-hero) → wait(driver-feed)` and it
 * had stopped working: 운행 시작 does not open the cockpit, it switches the staff
 * shell to the 운행 tab, where each room carries its own 운전 모드 button. The
 * harness therefore timed out for anyone who ran it — a harness failure that
 * reads exactly like an app failure (the G-d incident class, again).
 */
async function openCockpit(page) {
  await page.waitForSelector('[data-testid="staff-shell"]', { timeout: 120_000 });
  const hero = page.locator('[data-testid="drive-hero"]').first();
  if (await hero.count()) {
    await hero.click();
    await page.waitForTimeout(1_500);
  }
  const drive = page.locator('[data-testid="ops-drive"]').first();
  await drive.waitFor({ state: 'visible', timeout: 60_000 });
  await drive.click();
  await page.waitForSelector('[data-testid="driver-feed"]', { timeout: 90_000 });
}

const browser = await chromium.launch();
const results = [];
const materials = [];
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
  await ctx.addInitScript({ path: path.join('scripts', 'qa-lib', 'contrast-inject.js') });
  // The dev overlay eats clicks; addInitScript (not addStyleTag) so it survives
  // client-side navigation — G-d, which cost a walk 30s of retries and then died.
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
    if (m.type() === 'error') errors.push(`${testCase.label}: ${m.text()}`);
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await openCockpit(page);
  // The feed pins itself to the bottom after load; measure once it settles.
  await page.waitForTimeout(4_000);

  const measured = await page.evaluate(MEASURE);
  results.push({ case: testCase.label, ...measured });
  materials.push({
    case: testCase.label,
    // A5 is "dark FIRST", not "dark always": 'system' and 'dark' both resolve
    // dark, and an explicit 'light' is allowed to lift it (header chip). So the
    // regression to guard is "dark was expected and did not happen".
    expectDark: testCase.settings.theme !== 'light',
    ...(await page.evaluate(MATERIAL)),
  });
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

/**
 * N5 skin sweep — dark only, one shot each, material numbers only. Separate
 * from CASES because the question is different: CASES asks "does the cockpit
 * still fit", this asks "did a global material change break the one surface that
 * cannot follow the theme".
 */
if (process.env.SKIN_SWEEP !== '0') {
  for (const skin of SKIN_SWEEP) {
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'ko-KR',
      permissions: ['microphone'],
    });
    await ctx.addInitScript((s) => {
      try {
        localStorage.setItem('tour_mode_settings', JSON.stringify(s));
      } catch {
        /* defaults */
      }
    }, { theme: 'dark', skin, textScale: 3 });
    await ctx.addInitScript({ path: path.join('scripts', 'qa-lib', 'contrast-inject.js') });
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
      if (m.type() === 'error') errors.push(`skin:${skin}: ${m.text()}`);
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await openCockpit(page);
    await page.waitForTimeout(3_000);
    materials.push({ case: `skin:${skin}`, expectDark: true, ...(await page.evaluate(MATERIAL)) });
    await page.screenshot({ path: path.join(SHOTS, `skin-${skin}-dark.png`), fullPage: false });
    await ctx.close();
  }
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

console.log('\nMATERIAL (N5) — card fill vs canvas, and ink on it:');
console.table(
  materials.map((m) => ({
    case: m.case,
    skin: m.skin,
    dark: m.darkClass,
    canvas: m.canvas,
    atmos: m.atmos,
    cards: m.cardCount,
    'card fill': m.card ? m.card.surface : '—',
    'card vs canvas': m.card ? m.card.surfaceVsCanvas : '—',
    'card border': m.card ? m.card.borderWidth : '—',
    rim: m.card ? m.card.hasRim : '—',
    'card ink': m.cardInk ? m.cardInk.ratio : '—',
    'chip fill': m.chip ? m.chip.surfaceVsCanvas : '—',
    'chip boundary': m.chip ? `${m.chip.boundary} (${m.chip.boundaryVia})` : '—',
    'chip ink': m.chipInk ? m.chipInk.ratio : '—',
  })),
);

/**
 * The regression this run exists to catch. Ink below 4.5:1 in the cockpit is a
 * hard fail — a driver reads this at arm's length in a moving vehicle. Losing
 * dark-fixed is a hard fail too: it means a skin's light block won the cascade.
 */
const materialFailures = [];
for (const m of materials) {
  if (m.missing) {
    materialFailures.push(`${m.case}: cockpit did not render`);
    continue;
  }
  if (m.expectDark && !m.darkClass) {
    materialFailures.push(`${m.case}: cockpit lost its dark-first default (A5)`);
  }
  if (m.cardInk && m.cardInk.ratio !== null && m.cardInk.ratio < 4.5) {
    materialFailures.push(`${m.case}: card ink ${m.cardInk.ratio} < 4.5`);
  }
  if (m.chipInk && m.chipInk.ratio !== null && m.chipInk.ratio < 4.5) {
    materialFailures.push(`${m.case}: chip ink ${m.chipInk.ratio} < 4.5`);
  }
  if (m.bubbleInk && m.bubbleInk.ratio !== null && m.bubbleInk.ratio < 4.5) {
    materialFailures.push(`${m.case}: bubble ink ${m.bubbleInk.ratio} < 4.5`);
  }
  // WCAG 1.4.11 for a control the driver taps while moving. N1 closed exactly
  // this on the guest chips; the cockpit row was never measured until N5.
  if (m.chip && m.chip.boundary !== null && m.chip.boundary < 3.0) {
    materialFailures.push(
      `${m.case}: quick-reply chip boundary ${m.chip.boundary} < 3.0 (via ${m.chip.boundaryVia})`,
    );
  }
}
if (materialFailures.length) {
  console.log('\n🔴 MATERIAL FAILURES:');
  for (const f of materialFailures) console.log('  ', f);
} else {
  console.log('\nmaterial: no ink below 4.5 and dark-fixed held in every case');
}

if (errors.length) {
  console.log('\nCONSOLE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log(' ', e);
} else {
  console.log('\nconsole clean');
}

writeFileSync(
  path.join(SHOTS, 'measurements.json'),
  JSON.stringify({ layout: results, material: materials, errors }, null, 2),
);
console.log(`\nshots + measurements.json → ${SHOTS}`);
if (materialFailures.length) process.exitCode = 1;
