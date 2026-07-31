/**
 * qa-cjk-narrow-cell — prove the ONE thing the global CJK default cannot do.
 *
 * `html { word-break: keep-all }` protects a CJK run only while the box is at
 * least as wide as the run. Narrower than that and `overflow-wrap: break-word`
 * splits it mid-syllable anyway — §G-3b measured this with `준비전` in a 36px tab
 * and named `/admin/orders`'s `미선택` in a 64px cell as the live instance.
 *
 * The full-page harness (`qa-cjk-render.mjs`) cannot prove a fix here, because
 * whether that cell renders at all depends on whether today's bookings happen to
 * have no pickup point — the audit measured 18 breaks one day and 0 nodes the
 * next, from the same code. So this measures the CSS behaviour directly: the same
 * word, the same width, with and without `.text-cjk-safe`, on a page that has the
 * app's real stylesheet loaded.
 *
 * Usage: WALK_BASE=http://localhost:3161 node scripts/qa-cjk-narrow-cell.mjs
 * Exits 1 if the guarded variant still breaks between two CJK characters.
 */
import { chromium } from 'playwright';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';
/** Any page that loads globals.css; the content is irrelevant. */
const PAGE = process.env.CJK_PROBE_PAGE ?? '/ko';

/**
 * Cases: [label, className, cellPx, word, asCell].
 *
 * ⚠ `cellPx` is the BORDER box. The real cell carries `px-5 py-4`, so 40px of it
 * is padding and the text gets what is left — that squeeze, not the nominal
 * width, is what breaks the run. A probe with the nominal 64px and no padding
 * measured 0 breaks and proved nothing.
 */
const CASES = [
  // The live instance: /admin/orders' pickup cell, padding included.
  ['미선택 · TD 64px (content 24) · unguarded', '', 64, '미선택', true],
  ['미선택 · TD 64px (content 24) · .text-cjk-safe', 'text-cjk-safe', 64, '미선택', true],
  ['미선택 · TD 104px (content 64) · unguarded', '', 104, '미선택', true],
  ['미선택 · TD 104px (content 64) · .text-cjk-safe', 'text-cjk-safe', 104, '미선택', true],
  // Same width with no cell rule, to show the global default alone does hold.
  ['미선택 · div 24px · unguarded', '', 24, '미선택', false],
];

const probe = ({ className, cellPx, word, asCell }) => {
  /**
   * 🔴 The environment is the point. A bare `<div>` at 64px does NOT split the
   * run — `keep-all` holds it and the text simply overflows. What splits it is
   * the companion rule this repo needs for tables, `td, th { overflow-wrap:
   * anywhere }`: inside a real cell, `anywhere` overrides the inherited
   * protection and breaks between syllables. The first version of this probe
   * used a div, measured 0 breaks, and would have "proved" a fix for a defect it
   * never reproduced.
   */
  const host = document.createElement(asCell ? 'table' : 'div');
  host.style.cssText = `position:fixed;left:0;top:0;font-size:12px;z-index:99999;table-layout:fixed;width:${cellPx}px`;
  let box = host;
  if (asCell) {
    const tr = host.insertRow();
    const td = tr.insertCell();
    td.style.width = `${cellPx}px`;
    // The real cell's padding — `px-5 py-4` in the orders table.
    td.style.padding = '16px 20px';
    box = td;
  } else {
    host.style.width = `${cellPx}px`;
  }
  const span = document.createElement('span');
  if (className) span.className = className;
  span.textContent = word;
  box.appendChild(span);
  document.body.appendChild(host);

  const CJK = /[가-힣ᄀ-ᇿ぀-ヿ一-鿿]/;
  const node = span.firstChild;
  const range = document.createRange();
  let broken = 0;
  let prevTop = null;
  for (let i = 0; i < word.length; i += 1) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (prevTop !== null && r.top > prevTop + 1) {
      const prev = word[i - 1];
      const cur = word[i];
      if (prev && CJK.test(prev) && CJK.test(cur)) broken += 1;
    }
    prevTop = r.top;
  }
  range.selectNodeContents(node);
  const lines = range.getClientRects().length;
  const clipped = span.scrollWidth > span.clientWidth + 1;
  host.remove();
  return { broken, lines, clipped };
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE + PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1200);

console.log('case                                        breaks  lines  clipped');
let bad = 0;
for (const [label, className, cellPx, word, asCell] of CASES) {
  const r = await page.evaluate(probe, { className, cellPx, word, asCell });
  const guarded = className.includes('text-cjk-safe');
  if (guarded && r.broken > 0) bad += 1;
  console.log(
    `${label.padEnd(43)} ${String(r.broken).padStart(6)} ${String(r.lines).padStart(6)} ${String(r.clipped).padStart(8)}` +
      (guarded && r.broken > 0 ? '  🔴' : ''),
  );
}

await browser.close();
console.log(
  bad
    ? `🔴 ${bad} guarded case(s) still split a CJK run`
    : '✅ the guarded variant holds the run on one line; the unguarded numbers above are why the class is needed',
);
process.exit(bad ? 1 : 0);
