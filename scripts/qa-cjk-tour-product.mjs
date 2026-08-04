#!/usr/bin/env node
/**
 * qa-cjk-tour-product — CLAUDE.md P1-5 measured on the CUSTOMER product pages.
 *
 * qa-cjk-render.mjs walks the smart-app routes and needs the tour-day simulator;
 * it never looks at /tour-product/<slug>, so the catalogue side of the invariant
 * was unmeasured. Same detector as that script: for every text node containing
 * CJK, did a line break land BETWEEN two CJK characters with no space between
 * them? At mobile width, because that is where narrow boxes force the break.
 *
 * A live product (Busan small-group) is walked in the same run as a control.
 * Without it a number like "58 breaks in ja" reads as a regression when it is
 * the site's standing condition — the control said 44 on a page nobody touched.
 * The run also reports how many CJK text nodes it scanned and exits 2 if that
 * is zero, because a scan of nothing is not a clean bill.
 *
 * Needs a dev server:
 *   BASE=http://localhost:3000 node scripts/qa-cjk-tour-product.mjs
 *
 * Exit 0 clean · 1 breaks found · 2 scanned nothing.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:58535";
const SLUGS = [
  ["NEW gapyeong", "seoul-gapyeong-nami-morning-calm-petite-france-day-tour"],
  ["NEW winter", "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour"],
  ["CONTROL busan", "busan-small-group-yonggungsa-skycapsule-gamcheon-tour"],
];
const LOCALES = ["ko", "ja", "zh-CN", "zh-TW"];

const measure = () => {
  const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯ᄀ-ᇿ]/;
  const samples = [];
  let broken = 0;
  let scanned = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue ?? "";
    if (text.length < 2 || text.length > 400 || !CJK.test(text)) continue;
    range.selectNodeContents(node);
    if (range.getClientRects().length < 2) continue;
    scanned += 1;
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
          if (samples.length < 5) {
            samples.push(`${text.slice(Math.max(0, i - 8), i)}⏎${text.slice(i, i + 8)}`);
          }
        }
      }
      prevTop = r.top;
    }
  }
  return { broken, scanned, samples };
};

const browser = await chromium.launch();
let totalBroken = 0;
let totalScanned = 0;

for (const [label, slug] of SLUGS) {
  for (const loc of LOCALES) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/${loc}/tour-product/${slug}`, {
        waitUntil: "networkidle",
        timeout: 90000,
      });
      await page.waitForTimeout(700);
      const r = await page.evaluate(measure);
      totalBroken += r.broken;
      totalScanned += r.scanned;
      const flag = r.broken ? "✗" : r.scanned === 0 ? "…" : "✓";
      console.log(
        `${flag} ${label.padEnd(15)} ${loc.padEnd(6)} scanned=${String(r.scanned).padStart(4)} broken=${r.broken}` +
          (r.broken ? `  ${r.samples.join(" | ")}` : ""),
      );
    } catch (e) {
      console.log(`! ${label} ${loc}: ${String(e.message).slice(0, 70)}`);
    }
    await ctx.close();
  }
}
await browser.close();

console.log(`\nscanned ${totalScanned} CJK text nodes, ${totalBroken} illegal breaks`);
if (totalScanned === 0) {
  console.log("✗ scanned nothing — the result is vacuous, not clean");
  process.exit(2);
}
process.exit(totalBroken ? 1 : 0);
