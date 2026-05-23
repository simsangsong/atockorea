// Phase 5 EN sweep: numeric / factual corrections.
// Per user 2026-05-23 directive #8 + audit doc §H6 / §M.

import fs from "node:fs";

const root = "components/product-tour-static";

const subs = [
  // 5.1 Bomun Lake cherry trees — was 9,000 (inflated); Visit Gyeongju cites ~2,800.
  { from: "9,000+ cherry trees", to: "approximately 2,800 cherry trees" },
  { from: "9,000 cherry trees", to: "approximately 2,800 cherry trees" },
  { from: "8 km cherry blossom loop, 9,000 trees", to: "8 km cherry blossom loop, approximately 2,800 trees" },

  // 5.2 Hallim Park's Hyeopjaegul Cave — Jeju volcanism is ~1.8 Myr; "25 million years" is impossible.
  // KTO sources put cave-formation age at the order of tens of thousands of years; using ~250,000 yr as conservative.
  { from: "Hyeopjaegul Cave (~200m × 10m × 5m, ~25 million years old)", to: "Hyeopjaegul Cave (~200m × 10m × 5m, ~250,000 years old)" },

  // 5.3 Suwon Hwaseong — "Korea's only walled fortress" (false) → "only walled fortress city built with original Uigwe records"
  // The body description in many tours already uses the longer correct phrasing; only the short hero tagline and a few captions
  // use the bare "Korea's only walled fortress".
  { from: '"Korea\'s only walled fortress, a folk village,', to: '"Korea\'s only walled fortress city built with its original Uigwe records, a folk village,' },
  { from: '"Korea\'s only walled fortress, a former gold mine reborn as art,', to: '"Korea\'s only walled fortress city built with its original Uigwe records, a former gold mine reborn as art,' },
  // Headings/captions that just say "Korea's only walled fortress city" (no qualifier) — the existing body usually already
  // says "city preserved with its original 10-volume construction record" so we leave those. The targeted strings above
  // catch the bare overclaim in the heros.

  // 5.4 "Jewel in the Palace" 50M viewers (impossible — Korea pop ~48M; peak ratings ~57%).
  { from: "50 million domestic viewers across 54 episodes", to: "peak ratings around 57% in Korea across 54 episodes" },
  { from: "the iconic Joseon-era hit with 50 million domestic viewers", to: "the iconic Joseon-era hit (peak ratings around 57% in Korea)" },
  { from: "the iconic Joseon hit with 50 million domestic viewers", to: "the iconic Joseon hit (peak ratings around 57% in Korea)" },

  // 5.5 Camellia Hill adult admission ₩12,000 (user-confirmed). Existing accordions wrote ₩10,000 (the youth/senior price).
  { from: "Camellia Hill ₩10,000", to: "Camellia Hill ₩12,000 adult" },
  { from: "Camellia Hill (10,000 KRW)", to: "Camellia Hill (12,000 KRW adult)" },
  // Plain budget-list entries — bump to the adult figure (and re-do the rounding for the summary line):
  { from: "Hallim Park 15,000, Camellia Hill 10,000, Jusangjeolli 2,000, Cheonjeyeon 2,500, Osulloc free.", to: "Hallim Park 15,000, Camellia Hill 12,000 (adult), Jusangjeolli 2,000, Cheonjeyeon 2,500, Osulloc free." },
  { from: "Budget ≈30,000 KRW per person: Hallim Park 15,000, Camellia Hill 12,000 (adult)", to: "Budget ≈32,000 KRW per person (adult): Hallim Park 15,000, Camellia Hill 12,000 (adult)" },
  { from: "Budget ≈30,000 KRW per person across all admissions (Jusangjeolli 2,000 + Cheonjeyeon 2,500 round it out).", to: "Budget ≈32,000 KRW per person (adult) across all admissions (Jusangjeolli 2,000 + Cheonjeyeon 2,500 round it out)." },
];

const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !["_shared", "catalog", "_skills"].includes(d.name)).map((d) => d.name);

let totalFiles = 0;
let totalReplacements = 0;
for (const t of dirs) {
  const f = `${root}/${t}/${t}.en.json`;
  if (!fs.existsSync(f)) continue;
  let txt = fs.readFileSync(f, "utf8");
  JSON.parse(txt);
  let fileChanges = 0;
  for (const { from, to } of subs) {
    const before = txt.split(from).length - 1;
    if (before === 0) continue;
    txt = txt.split(from).join(to);
    JSON.parse(txt);
    fileChanges += before;
    console.log(`  ${t}: "${from.slice(0, 60)}…" × ${before}`);
  }
  if (fileChanges > 0) {
    fs.writeFileSync(f, txt, "utf8");
    totalFiles++;
    totalReplacements += fileChanges;
  }
}
console.log(`\n=== ${totalFiles} files changed, ${totalReplacements} total replacements ===`);

// Residual scan
console.log("\nResidual scan (these should all be 0 except where mid-sentence context differs):");
const residuals = [
  "9,000+ cherry",
  "9,000 cherry",
  "25 million years",
  "50 million domestic viewers",
  '"Korea\'s only walled fortress,',
  "Camellia Hill ₩10,000",
  "Camellia Hill (10,000 KRW)",
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
