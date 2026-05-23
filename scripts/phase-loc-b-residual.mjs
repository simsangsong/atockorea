/**
 * Locale propagation Phase B residual — fix the 3 remaining offenders that
 * the loc-B main pass missed because of JSON quote-escape mismatch.
 *
 * Pattern: needle strings written with `\"` in JS source produce literal
 * `"` in the matcher, but the raw JSON file contains `\"` (backslash +
 * quote) because the source-of-truth is the raw JSON text. The fix is to
 * parse JSON first, mutate via property path, then write back.
 *
 * Targets:
 *   - jeju-west-south-full-day-authentic-tour zh L1116 + L2737 (2 sites)
 *   - jeju-west-south-full-day-authentic-tour es L2737 (1 site)
 *
 * The L1116/L2737 detail strings both sit under `.tour_overview.faq` and
 * `.tour_overview.routeContext.items[]` style paths — they have variable
 * depth. Walk the tree generically.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";

// Pre/post pairs — match on partial substring (without the escaped quotes).
// Using a function-based replacer that walks JSON tree string-values.
const REPLACEMENTS = {
  "jeju-west-south-full-day-authentic-tour": {
    zh: [
      // L1116 detail: starts with "本次旅游由..." includes Love Korea + Steven/Chloe/Sunny
      {
        anchor: "本次旅游由",
        nameKey: "Steven、Chloe与Sunny",
        replacementBuilder: (orig) =>
          "本次旅游与我们的\"南部UNESCO之旅\"出自同一运营商，沿用相同的运营标准。\"无购物\"条款与4个接客点系统同样适用，两款产品的导游品质始终如一。",
      },
      // L2737 detail: starts with "本次游览由..." includes Love Korea + Steven/Chloe/Sunny
      {
        anchor: "本次游览由",
        nameKey: "Steven、Chloe和Sunny",
        replacementBuilder: () =>
          "本次游览与我们的南部联合国教科文组织之旅出自同一运营商，沿用相同的运营标准。\"无购物\"条款和4个接送点系统同样适用，两款产品的导游品质保持一致。",
      },
    ],
    es: [
      // L2737 detail: "Este tour es operado..." with Steven, Chloe y Sunny
      {
        anchor: "Este tour es operado por el mismo operador",
        nameKey: "Steven, Chloe y Sunny",
        replacementBuilder: () =>
          "Este tour comparte el mismo operador y los mismos estándares que nuestro tour UNESCO del Sur. La cláusula de \"sin compras\" y el sistema de 4 puntos de recogida se mantienen, garantizando una calidad de guía consistente entre ambos productos.",
      },
    ],
  },
};

function walkAndReplace(node, replacements, counter) {
  if (Array.isArray(node)) {
    for (const child of node) walkAndReplace(child, replacements, counter);
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === "string") {
        for (const r of replacements) {
          if (v.includes(r.anchor) && v.includes(r.nameKey)) {
            const newVal = r.replacementBuilder(v);
            if (newVal !== v) {
              node[k] = newVal;
              counter.count++;
            }
          }
        }
      } else {
        walkAndReplace(v, replacements, counter);
      }
    }
  }
}

let total = 0;
for (const [slug, byLocale] of Object.entries(REPLACEMENTS)) {
  for (const [locale, replacements] of Object.entries(byLocale)) {
    const path = `${ROOT}/${slug}/${slug}.${locale}.json`;
    const txt = readFileSync(path, "utf8");
    const j = JSON.parse(txt);
    const counter = { count: 0 };
    walkAndReplace(j, replacements, counter);
    if (counter.count > 0) {
      writeFileSync(path, JSON.stringify(j, null, 2) + "\n", "utf8");
      console.log(`  ${slug}.${locale}.json: ${counter.count} swap${counter.count !== 1 ? "s" : ""}`);
      total += counter.count;
    } else {
      console.log(`  ${slug}.${locale}.json: 0 swaps (anchors not found)`);
    }
  }
}
console.log(`\nTOTAL: ${total} swaps`);
