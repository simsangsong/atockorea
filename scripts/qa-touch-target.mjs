/**
 * qa-touch-target — does the global 44px floor turn short labels into blobs?
 *
 * `app/globals.css` sets `button, a { min-height: 44px; min-width: 44px }` for
 * every control in both route groups. §E lists 44px touch as invariant, so the
 * rule stays; the question X10 asks is what it does to a control whose label is
 * smaller than that. The owner photographed the answer once — the cockpit's
 * nav-app chips rendered as pale 44×44 blocks with an 11px label stuck in the
 * corner — and `NavBrandButton` fixed that one by separating the VISUAL from
 * the HIT AREA (transparent 44px anchor, inner pill sized to its own text).
 *
 * X10's brief was to sweep the app for the rest of them. This is the ruler for
 * that sweep, because the question cannot be answered from source: whether a
 * control is a blob depends on its computed `display` and on where the text
 * actually landed, and neither is visible in a class list.
 *
 * ## What it flags, and what it deliberately does not
 *
 *   flagged  — a control at least 43px in a dimension whose text run is much
 *              smaller AND is pinned to an edge instead of centred. That is the
 *              photographed symptom: empty box, label in the corner.
 *   ignored  — controls containing an icon (an icon-only button is *supposed*
 *              to fill its target), and `display: inline` anchors, where
 *              min-width/min-height do not apply at all per CSS 2.1 §10.
 *
 * The second exclusion is not a convenience. Measured on this repo, every
 * footer link renders with its box exactly equal to its text box — the rule
 * never touched them — so counting them would have produced a long list of
 * findings that are not findings.
 *
 * Usage:
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   BASE=http://localhost:3185 node scripts/qa-touch-target.mjs
 *
 * Exit: 0 = no blobs · 1 = blobs found · 2 = it could not measure enough to say.
 */
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]', '/tour-mode/guide'];

const BASE = process.env.BASE ?? 'http://localhost:3185';
const FIXTURES = 'scripts/.sim-fixtures.json';

/** Below this the sweep is not a sweep — see B-3. */
const MIN_CONTROLS = 150;

const surfaces = [
  ['marketing home', '/ko'],
  ['tours list', '/ko/tours/list'],
  ['tour product', '/ko/tour-product/jeju-grand-highlights-loop'],
];
if (existsSync(FIXTURES)) {
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  if (fx.room1Url) surfaces.push(['guest room', fx.room1Url]);
  if (fx.guideUrl) surfaces.push(['guide console', fx.guideUrl]);
} else {
  console.log('⚠ no scripts/.sim-fixtures.json — measuring the marketing surfaces only');
}

/** Runs in the page: every control, its box, and where its text actually is. */
const MEASURE = () => {
  const out = { controls: 0, inlineSkipped: 0, iconSkipped: 0, blobs: [] };
  for (const el of document.querySelectorAll('a, button')) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    out.controls += 1;
    const display = getComputedStyle(el).display;
    // CSS 2.1 §10.4: min-width/min-height do not apply to non-replaced inline
    // boxes, so the floor cannot have inflated these.
    if (display === 'inline') {
      out.inlineSkipped += 1;
      continue;
    }
    if (el.querySelector('svg, img')) {
      out.iconSkipped += 1;
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    if (!text.width || !text.height) continue;
    const slackX = box.width - text.width;
    const slackY = box.height - text.height;
    const offLeft = text.left - box.left;
    const offTop = text.top - box.top;
    const floored = box.width >= 43 || box.height >= 43;
    const tiny = text.width < 30 || text.height < 30;
    const cornered =
      (slackX > 12 && (offLeft < 4 || offLeft > slackX - 4)) ||
      (slackY > 12 && (offTop < 4 || offTop > slackY - 4));
    if (floored && tiny && cornered) {
      out.blobs.push({
        display,
        box: [Math.round(box.width), Math.round(box.height)],
        text: [Math.round(text.width), Math.round(text.height)],
        offset: [Math.round(offLeft), Math.round(offTop)],
        label: (el.textContent ?? '').trim().slice(0, 24),
        cls: (el.className ?? '').toString().slice(0, 60),
      });
    }
  }
  return out;
};

const browser = await chromium.launch();

/**
 * 🔴 The ruler goes first.
 *
 * A sweep that reports zero is only worth reading if it can report one, and
 * this repo has shipped several checkers that measured nothing while looking
 * green. So before touching the app, the detector runs against a page built to
 * contain exactly one blob and one control that merely looks like one: the
 * canary must catch the first and leave the second alone. If it does not, the
 * run stops here rather than reporting a clean app.
 */
async function canary() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.setContent(`
    <style>
      button, a { min-height: 44px; min-width: 44px }
      .blob { display: block }
      .fine { display: flex; align-items: center; justify-content: center }
    </style>
    <a class="blob" href="#">짧음</a>
    <a class="fine" href="#">짧음</a>
  `);
  const result = await page.evaluate(MEASURE);
  await context.close();
  const labels = result.blobs.map((b) => b.cls);
  const ok = labels.length === 1 && labels[0] === 'blob';
  console.log(`  ${ok ? '✅' : '🔴'} 카나리아 — 만들어 둔 덩어리 1개를 잡고 정상 1개는 지나친다 (잡은 것: ${labels.join(', ') || '없음'})`);
  return ok;
}

if (!(await canary())) {
  console.error('\n🔴 탐지기가 일부러 만든 덩어리를 못 봤다. 앱에 대한 0은 의미가 없다.');
  await browser.close();
  process.exit(2);
}

let controls = 0;
let blobs = 0;
let reached = 0;

for (const [name, path] of surfaces) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  const page = await context.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    // Wait for a control to exist rather than for a number of seconds: dev
    // compiles the route on first hit and a fixed sleep measures the spinner.
    await page.waitForSelector('a, button', { timeout: 120_000 });
    await page.waitForTimeout(2_500);
  } catch (error) {
    console.log(`  ⚠ ${name} — 도달 실패: ${String(error).slice(0, 70)}`);
    await context.close();
    continue;
  }
  const result = await page.evaluate(MEASURE);
  reached += 1;
  controls += result.controls;
  blobs += result.blobs.length;
  console.log(
    `  ${result.blobs.length ? '🔴' : '✅'} ${name.padEnd(15)} 컨트롤 ${String(result.controls).padStart(3)} ` +
      `(inline ${result.inlineSkipped} · 아이콘 ${result.iconSkipped} 제외) · 덩어리 ${result.blobs.length}`,
  );
  for (const blob of result.blobs) console.log('       ', JSON.stringify(blob));
  await context.close();
}
await browser.close();

console.log(`\n  표면 ${reached}/${surfaces.length} · 컨트롤 ${controls} · 🔴 덩어리 ${blobs}`);

if (reached === 0 || controls < MIN_CONTROLS) {
  console.error(
    `\n🔴 잰 것이 너무 적다 (컨트롤 ${controls} < ${MIN_CONTROLS}). ` +
      'dev 서버와 시드를 확인하라 — 0을 재고 "문제 없음"을 보고하는 것이 이 레포의 단골 실패다.',
  );
  process.exit(2);
}
process.exit(blobs > 0 ? 1 : 0);
