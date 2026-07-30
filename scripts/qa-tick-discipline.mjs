/**
 * qa-tick-discipline — do the room's timers actually stop when the screen is
 * not being looked at? (full-app audit A5)
 *
 * 13 setInterval sites live in the room UI (30s / 60s / ladder cadence). The
 * plan's claim to verify is "≤10분 1초틱이 화면 밖에서 멈추는지". Source
 * inspection cannot answer it: a timer that keeps a visibilitychange listener
 * may still fire, and one that fires may still be cheap. So this counts real
 * callbacks in a real engine.
 *
 * Method: patch setInterval/setTimeout/requestAnimationFrame before any app
 * code runs, tally per-cadence callback counts, then compare a foreground
 * window against a background one of the same length. Chromium throttles
 * background timers to ~1/min by design, so the honest judgement is a RATIO,
 * not zero: a timer set to 30s that fires 20× in a hidden 60s window is a bug;
 * firing 1-2× is the platform floor.
 *
 * Usage:
 *   1) dev server (WALK_BASE, default :3161), 2) sim seed
 *   3) node scripts/qa-tick-discipline.mjs [windowSeconds=60]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';
const WINDOW_S = Number(process.argv[2] ?? '60');
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

const INSTRUMENT = () => {
  const stats = { intervals: [], timeouts: 0, rafs: 0, calls: {} };
  window.__tickStats = stats;
  const realSI = window.setInterval.bind(window);
  const realST = window.setTimeout.bind(window);
  const realRAF = window.requestAnimationFrame.bind(window);
  window.setInterval = (fn, ms, ...rest) => {
    const key = String(ms);
    stats.intervals.push(ms);
    stats.calls[key] = stats.calls[key] ?? 0;
    const wrapped = (...a) => {
      stats.calls[key] += 1;
      return typeof fn === 'function' ? fn(...a) : undefined;
    };
    return realSI(wrapped, ms, ...rest);
  };
  window.setTimeout = (fn, ms, ...rest) => {
    stats.timeouts += 1;
    return realST(fn, ms, ...rest);
  };
  window.requestAnimationFrame = (fn) => {
    stats.rafs += 1;
    return realRAF(fn);
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 37.5665, longitude: 126.978 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
await page.addInitScript(INSTRUMENT);
await page.addInitScript(() => {
  window.localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
});
await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 45000 });
await page.waitForTimeout(3000);

const snapshot = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__tickStats)));

const before = await snapshot();
await page.waitForTimeout(WINDOW_S * 1000);
const afterForeground = await snapshot();

// Hide the page the way a phone does when the guest pockets it. Playwright has
// no "background this tab": opening a second page in the same context makes the
// first one lose focus but NOT visibility, so the only faithful signal is
// document.visibilityState + the visibilitychange event, which is exactly what
// the app's own listeners key off. (CDP's setWebLifecycleState only accepts
// 'frozen'/'active' in this build, so it cannot express "hidden".)
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
const hiddenStart = await snapshot();
await page.waitForTimeout(WINDOW_S * 1000);
const hiddenEnd = await snapshot();
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});

const delta = (a, b) => {
  const out = {};
  for (const k of new Set([...Object.keys(a.calls), ...Object.keys(b.calls)])) {
    out[k] = (b.calls[k] ?? 0) - (a.calls[k] ?? 0);
  }
  return out;
};

const fg = delta(before, afterForeground);
const bg = delta(hiddenStart, hiddenEnd);

console.log(`window = ${WINDOW_S}s each`);
console.log(
  `intervals registered: ${before.intervals.length} at rest → ${afterForeground.intervals.length} after fg → ${hiddenEnd.intervals.length} after hidden` +
    (hiddenEnd.intervals.length > hiddenStart.intervals.length
      ? `  🔴 +${hiddenEnd.intervals.length - hiddenStart.intervals.length} NEW timers registered while hidden`
      : ''),
);
console.log(`cadences (ms): ${[...new Set(afterForeground.intervals)].sort((a, b) => a - b).join(', ')}`);
console.log(
  '⚠ against `next dev` the 2500ms/5000ms cadences are Next.js HMR (on-demand-entries-client),\n' +
    '  not app code — measure against `next start` for a verdict on app timers.',
);
console.log('');
console.log('cadence(ms)   foreground   hidden   expected-fg   verdict');
let bad = 0;
for (const k of Object.keys({ ...fg, ...bg }).sort((a, b) => Number(a) - Number(b))) {
  const expected = Math.floor((WINDOW_S * 1000) / Number(k));
  const h = bg[k] ?? 0;
  // Chromium's background floor is ~1/min; anything beyond 2× that in a hidden
  // window means the timer is not being suspended.
  const floor = Math.max(2, Math.ceil(WINDOW_S / 60) * 2);
  const verdict = h > floor ? `🔴 hidden ${h} > floor ${floor}` : 'ok';
  if (h > floor) bad += 1;
  console.log(
    `${String(k).padStart(11)}   ${String(fg[k] ?? 0).padStart(10)}   ${String(h).padStart(6)}   ${String(expected).padStart(11)}   ${verdict}`,
  );
}
console.log('');
console.log(`rAF registered: ${afterForeground.rafs} → ${hiddenEnd.rafs} (hidden growth ${hiddenEnd.rafs - hiddenStart.rafs})`);
console.log(`setTimeout registered: ${afterForeground.timeouts} → ${hiddenEnd.timeouts} (hidden growth ${hiddenEnd.timeouts - hiddenStart.timeouts})`);
console.log(bad ? `🔴 ${bad} cadence(s) kept firing while hidden` : '✅ every cadence fell to the platform floor while hidden');

await browser.close();
process.exit(bad ? 1 : 0);
