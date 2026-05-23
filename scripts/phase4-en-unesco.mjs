// Phase 4 EN sweep: UNESCO factual cleanup.
// Per user 2026-05-23 directives #5 + #6 and audit doc tour-product-en-content-audit-2026-05-23.md §H1–H3.
// All edits are safe text substitutions with JSON re-validation per file.

import fs from "node:fs";

const root = "components/product-tour-static";

// ───────────────────────────────────────────────────────────
// Substitutions: longest/most-specific first so we don't break
// the context of broader patterns.
// ───────────────────────────────────────────────────────────
const subs = [
  // 4.1 Seoraksan — "only UNESCO Biosphere Reserve" → "first"
  //   Covers "Korea's only…", "the country's only…", "5th national park (1970) and only UNESCO…"
  { from: "only UNESCO Biosphere Reserve", to: "first UNESCO Biosphere Reserve" },

  // 4.2 Tongildaebul — "world's largest seated bronze Buddha" → "Korea's largest seated bronze Buddha"
  { from: "world's largest seated bronze Buddha", to: "Korea's largest seated bronze Buddha" },
  { from: "world's largest seated bronze", to: "Korea's largest seated bronze" }, // catch-all fallback

  // 4.3 Sinheungsa — anachronistic "world's oldest Seon temple" + wrong "head temple"
  //     Sinheungsa was founded 652 CE (pre-Seon, which arrived in Korea ~9th c.) and is a branch temple
  //     under Woljeongsa head district of the Jogye Order, not a head temple itself.
  { from: "head temple of the Jogye Order; world's oldest Seon (Zen) temple", to: "one of Korea's oldest active Buddhist temples and a Jogye Order monastery" },
  { from: "world's oldest Seon (Zen) temple", to: "one of Korea's oldest active Buddhist temples" },
  { from: "world's oldest Seon temple", to: "one of Korea's oldest active Buddhist temples" },
  { from: "head temple of the Jogye Order", to: "a Jogye Order temple" },

  // 4.4 Seongeup Folk Village — Korean national heritage, NOT UNESCO
  { from: "Seongeup Folk Village (UNESCO heritage)", to: "Seongeup Folk Village (Korean National Folklore Cultural Heritage)" },
  { from: "Seongeup Folk Village (UNESCO)", to: "Seongeup Folk Village (Korean National Folklore Cultural Heritage)" },

  // 4.5 Micheon Cave (Ilchul Land) — separate commercial show cave, NOT same lava tube as Manjanggul
  { from: "**Manjanggul UNESCO alternate** — same lava-tube system; opens when Manjanggul closes", to: "**Alternative show cave** — visited when Manjanggul (the UNESCO-designated lava tube on the other side of the island) is closed for seasonal preservation. Note: Micheon is a separate, privately-operated cave; it is not part of the Geomunoreum Lava Tube System inscription." },
  { from: "Manjanggul UNESCO alternate", to: "alternate to Manjanggul when closed" },
  // The bare "same lava-tube system" already gets replaced by the longer pattern above when it co-occurs;
  // catch any standalone remnant:
  { from: "same lava-tube system", to: "a separate volcanic show cave" },

  // 4.6 Seongsan / Hallasan — "triple-UNESCO site" is overclaim (Biosphere/Geopark are island-wide)
  { from: "Seongsan Ilchulbong: triple-UNESCO site (World Natural Heritage 2007 + Biosphere Reserve + Global Geopark)", to: "Seongsan Ilchulbong: UNESCO World Natural Heritage component (2007); also within Jeju's island-wide UNESCO Biosphere Reserve (2002) and UNESCO Global Geopark (2010)" },
  { from: "triple-UNESCO Seongsan Ilchulbong", to: "UNESCO World Natural Heritage component Seongsan Ilchulbong" },
  { from: "Seongsan's triple-UNESCO geology", to: "Seongsan's UNESCO World Heritage volcanic geology" },
  { from: "Seongsan carries simultaneous triple-UNESCO designation", to: "Seongsan is a UNESCO World Heritage component within Jeju's island-wide Biosphere and Geopark designations" },
  { from: "triple-UNESCO", to: "UNESCO World Heritage" }, // catch remaining

  // Hallasan "Triple Natural designation" — conflates KOREAN National Park (1970) with UNESCO programs.
  { from: "**Hallasan = only Korean site with Triple Natural designation**: UNESCO World Heritage 2007 + Biosphere 2002 + National Park 1970", to: "**Hallasan = UNESCO World Heritage component (2007) within Jeju's island-wide UNESCO Biosphere Reserve (2002); also designated a Korean National Park (1970)**" },
  { from: "UNESCO Volcanic Geology — Hallasan Lower Trail (Triple Natural designation)", to: "UNESCO Volcanic Geology — Hallasan Lower Trail" },
  { from: "Hallasan Triple Natural designation", to: "Hallasan UNESCO World Heritage + Korean National Park status" },
  { from: "Triple Natural designation", to: "UNESCO + Korean National Park status" }, // catch remaining
];

// Get all EN bundles (including the retired sokcho slug — we still clean for consistency
// in case any cache or alias path serves it).
const dirs = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !["_shared", "catalog", "_skills"].includes(d.name))
  .map((d) => d.name);

const stats = { filesChanged: 0, totalReplacements: 0 };

for (const t of dirs) {
  const f = `${root}/${t}/${t}.en.json`;
  if (!fs.existsSync(f)) continue;
  let txt = fs.readFileSync(f, "utf8");
  JSON.parse(txt); // pre-validate
  let fileChanges = 0;
  for (const { from, to } of subs) {
    const before = txt.split(from).length - 1;
    if (before === 0) continue;
    txt = txt.split(from).join(to);
    JSON.parse(txt); // re-validate after each substitution
    fileChanges += before;
    console.log(`  ${t}: "${from.slice(0, 60)}…" × ${before}`);
  }
  if (fileChanges > 0) {
    fs.writeFileSync(f, txt, "utf8");
    stats.filesChanged++;
    stats.totalReplacements += fileChanges;
  }
}

console.log(`\n=== ${stats.filesChanged} files changed, ${stats.totalReplacements} total replacements ===`);

// Residual scan — these strings should be gone from EN customer-facing copy.
console.log("\nResidual scan (should be empty):");
const residuals = [
  "only UNESCO Biosphere Reserve",
  "world's largest seated bronze",
  "world's oldest Seon",
  "head temple of the Jogye",
  "Seongeup Folk Village (UNESCO)",
  "Seongeup Folk Village (UNESCO heritage)",
  "Manjanggul UNESCO alternate",
  "triple-UNESCO",
  "Triple Natural designation",
];
for (const t of dirs) {
  const f = `${root}/${t}/${t}.en.json`;
  if (!fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, "utf8");
  for (const p of residuals) {
    const c = txt.split(p).length - 1;
    if (c) console.log(`  ⚠ ${t}: "${p}" × ${c}`);
  }
}
