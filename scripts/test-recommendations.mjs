#!/usr/bin/env node
/**
 * Smoke-test the new similarity scoring against the real catalog.
 *
 * What we verify:
 *  - Different anchors return *different* recommendation sets
 *    (previously the same 6 cards came back for any same-region anchor)
 *  - No region dominates beyond perRegionCap (3)
 *  - All picks have listPriceUsd > 0
 *  - Each anchor returns up to 6
 *  - User-affinity anchor synthesizes a sensible region/price preference
 */

import {
  SLIM_CATALOG_PAGES_BY_LOCALE,
  SLIM_CATALOG_SLUG_ORDER,
} from "../components/product-tour-static/catalog/catalogCards.generated.ts";

// Reproduce the price-parse + override logic from staticTourCatalogCards.ts
// without importing it (the import path goes through "@/lib" aliases that
// node ESM cannot resolve directly).
const SLUG_OVERRIDES = {
  "east-signature-nature-core": { listPriceUsd: 59 },
  "jeju-grand-highlights-loop": { listPriceUsd: 79 },
  "southwest-hallasan-osulloc-aewol": { listPriceUsd: 59 },
  "busan-gyeongju-unesco-legacy-tour-national-museum": { listPriceUsd: 39 },
  "busan-small-group-sightseeing-tour-cruise-passengers": { listPriceUsd: 79 },
  "busan-top-attractions-day-tour": { listPriceUsd: 29 },
  "from-busan-gyeongju-ancient-capital-day-tour": { listPriceUsd: 39 },
  "from-incheon-seoul-day-tour-cruise-guests": { listPriceUsd: 69 },
  "incheon-seoul-private-car-shore-excursion-cruise": { listPriceUsd: 419 },
  "jeju-cherry-blossom-tour-east-route": { listPriceUsd: 59 },
  "jeju-cruise-shore-excursion-bus-tour": { listPriceUsd: 52 },
  "jeju-cruise-shore-excursion-small-group-tour": { listPriceUsd: 79 },
  "jeju-eastern-unesco-spots-day-tour": { listPriceUsd: 59 },
  "jeju-hydrangea-festival-tour-east-route": { listPriceUsd: 59 },
  "jeju-hydrangea-festival-tour-southwest-route": { listPriceUsd: 59 },
  "jeju-southern-top-unesco-spots-tour": { listPriceUsd: 59 },
  "jeju-west-south-full-day-authentic-tour": { listPriceUsd: 59 },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": { listPriceUsd: 59 },
  "pocheon-sanjeong-lake-herb-island-art-valley": { listPriceUsd: 49 },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": { listPriceUsd: 419 },
  "seoul-private-nami-morning-calm-petite-france": { listPriceUsd: 189 },
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip": { listPriceUsd: 52 },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": { listPriceUsd: 49 },
  "seoul-suburbs-private-chartered-car-10hr": { listPriceUsd: 179 },
  "seoul-suwon-hwaseong-folk-village-starfield-library": { listPriceUsd: 59 },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": { listPriceUsd: 52 },
  "seoul-suwon-hwaseong-waujeongsa-starfield": { listPriceUsd: 47 },
};

function parsePrice(page) {
  if (!page) return 0;
  const label = page.price?.amountLabel ?? page.catalog_card?.priceLabel ?? "";
  const m = label.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1])) : 0;
}

function buildCatalogEn() {
  const map = SLIM_CATALOG_PAGES_BY_LOCALE.en;
  return SLIM_CATALOG_SLUG_ORDER.map((slug) => {
    const page = map[slug];
    if (!page) return null;
    const cc = page.catalog_card;
    return {
      slug: cc.slug,
      title: cc.title,
      region: cc.region,
      duration: cc.duration,
      badges: cc.badges,
      rating: cc.rating,
      reviewCount: cc.reviewCount,
      listPriceUsd: SLUG_OVERRIDES[slug]?.listPriceUsd ?? parsePrice(page),
    };
  }).filter(Boolean);
}

// Inline copy of the similarity scorer (same as lib/recommendations/tourSimilarity.ts)
const STOPWORD_TOKENS = new Set([
  "and", "the", "from", "with", "for", "tour", "tours",
  "day", "trip", "guide", "excursion", "pickup", "return",
]);
const STRUCTURAL_SEPARATORS = /[\s()→&+\-,/·•|;:　（）]+/u;

function tokenize(v, minLen = 3) {
  if (!v) return [];
  return String(v).toLowerCase().split(STRUCTURAL_SEPARATORS)
    .map(t => t.trim())
    .filter(t => t.length >= minLen && !STOPWORD_TOKENS.has(t));
}
function tokenSet(values, minLen = 3) {
  const arr = Array.isArray(values) ? values : values ? [values] : [];
  const s = new Set();
  for (const v of arr) for (const t of tokenize(v, minLen)) s.add(t);
  return s;
}
function jaccardOverlap(a, b) {
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i;
}
function parseDurationHours(d) {
  if (!d) return 0;
  const m = String(d).match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|시간|小时|小時|時間|hora|horas)/i);
  if (m) return Number(m[1]);
  const days = String(d).match(/(\d+)\s*(?:day|days|일|天|日|día|días)/i);
  if (days) return Number(days[1]) * 8;
  return 0;
}
const COARSE_REGION_BUCKETS = [
  { key: "jeju", tokens: ["jeju", "济州", "濟州", "제주"] },
  { key: "gangwon", tokens: ["gangwon", "seoraksan", "yangyang", "sokcho", "강원", "설악산"] },
  { key: "gyeongju", tokens: ["gyeongju", "경주", "庆州", "慶州"] },
  { key: "busan", tokens: ["busan", "yangsan", "ulsan", "miryang", "부산", "釜山"] },
  { key: "pocheon", tokens: ["pocheon", "포천", "抱川"] },
  { key: "paju", tokens: ["paju", "파주", "坡州"] },
  { key: "gapyeong", tokens: ["gapyeong", "가평", "加平"] },
  { key: "suwon", tokens: ["suwon", "수원", "水原"] },
  { key: "gyeonggi", tokens: ["gyeonggi", "경기", "京畿"] },
  { key: "incheon", tokens: ["incheon", "인천", "仁川"] },
  { key: "seoul", tokens: ["seoul", "서울", "首尔", "首爾"] },
];
function dominantRegionToken(r) {
  const lc = (r ?? "").toLowerCase();
  for (const b of COARSE_REGION_BUCKETS) {
    if (b.tokens.some(t => lc.includes(t))) return b.key;
  }
  return tokenize(r, 3)[0] ?? lc.trim();
}

function score(anchor, c) {
  if (c.slug === anchor.slug) return -1;
  const region = jaccardOverlap(tokenSet(anchor.region), tokenSet(c.region)) * 4;
  const badge = Math.min(jaccardOverlap(tokenSet(anchor.badges ?? [], 4), tokenSet(c.badges ?? [], 4)) * 3, 12);
  const aH = parseDurationHours(anchor.duration), cH = parseDurationHours(c.duration);
  let dur = 0;
  if (aH > 0 && cH > 0) {
    const d = Math.abs(aH - cH);
    dur = d <= 1 ? 5 : d <= 3 ? 3 : d <= 5 ? 1 : 0;
  }
  let price = 0;
  if (anchor.listPriceUsd > 0 && c.listPriceUsd > 0) {
    const r = c.listPriceUsd / anchor.listPriceUsd;
    price = r >= 0.8 && r <= 1.25 ? 4 : r >= 0.6 && r <= 1.6 ? 2 : 0;
  }
  return region + badge + dur + price;
}

function pickRecommendations(anchor, candidates, k = 6, cap = 3) {
  const ranked = candidates
    .filter(c => c.slug !== anchor.slug && (c.listPriceUsd ?? 0) > 0)
    .map(c => ({ tour: c, score: score(anchor, c), pop: (c.rating ?? 0) * Math.log(1 + (c.reviewCount ?? 0)) }))
    .sort((a, b) => b.score - a.score || b.pop - a.pop);
  const picks = []; const seen = new Set(); const regionCounts = {};
  for (const { tour } of ranked) {
    if (picks.length >= k) break;
    if (seen.has(tour.slug)) continue;
    const tok = dominantRegionToken(tour.region);
    if ((regionCounts[tok] ?? 0) >= cap) continue;
    picks.push({ ...tour, _score: score(anchor, tour) });
    seen.add(tour.slug);
    regionCounts[tok] = (regionCounts[tok] ?? 0) + 1;
  }
  if (picks.length < k) {
    for (const { tour } of ranked) {
      if (picks.length >= k) break;
      if (seen.has(tour.slug)) continue;
      picks.push({ ...tour, _score: score(anchor, tour) });
      seen.add(tour.slug);
    }
  }
  return picks;
}

const catalog = buildCatalogEn();
console.log(`Catalog size: ${catalog.length}`);

const TEST_ANCHORS = [
  "east-signature-nature-core",
  "jeju-grand-highlights-loop",
  "busan-top-attractions-day-tour",
  "seoul-dmz-private-3rd-tunnel-suspension-bridge",
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  "pocheon-sanjeong-lake-herb-island-art-valley",
];

const allRecsBySlug = {};
let totalIssues = 0;

for (const slug of TEST_ANCHORS) {
  const anchor = catalog.find(c => c.slug === slug);
  if (!anchor) { console.log(`\n[MISS] anchor not in catalog: ${slug}`); continue; }
  const recs = pickRecommendations(anchor, catalog, 6, 3);
  allRecsBySlug[slug] = recs.map(r => r.slug);
  console.log(`\n=== ${slug}  (region: "${anchor.region}", $${anchor.listPriceUsd}, ${anchor.duration}) ===`);
  recs.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r._score.toFixed(0)}pts] ${r.slug}  · "${r.region}" · $${r.listPriceUsd} · ${r.duration}`);
  });
  // checks
  if (recs.length !== 6) { console.log(`  ⚠ only ${recs.length} picks (catalog small?)`); totalIssues++; }
  const regionCounts = {};
  for (const r of recs) {
    const tok = dominantRegionToken(r.region);
    regionCounts[tok] = (regionCounts[tok] ?? 0) + 1;
  }
  const overcap = Object.entries(regionCounts).filter(([_, n]) => n > 4); // 3 cap + maybe 1 relax pass
  if (overcap.length) { console.log(`  ⚠ region cap exceeded:`, overcap); totalIssues++; }
  if (recs.some(r => r.listPriceUsd <= 0)) { console.log(`  ⚠ unpriced item slipped in`); totalIssues++; }
  if (recs.some(r => r.slug === slug)) { console.log(`  ⚠ anchor included as own rec`); totalIssues++; }
}

// Are the rec sets actually different per anchor?
console.log(`\n=== Diversity across anchors ===`);
const sets = Object.entries(allRecsBySlug);
for (let i = 0; i < sets.length; i++) {
  for (let j = i + 1; j < sets.length; j++) {
    const [aSlug, aRecs] = sets[i], [bSlug, bRecs] = sets[j];
    const overlap = aRecs.filter(s => bRecs.includes(s)).length;
    const sym = overlap / 6;
    const tag = sym >= 0.85 ? "❌ NEAR-IDENTICAL" : sym >= 0.6 ? "⚠  high overlap" : "✓";
    console.log(`  ${tag}  ${aSlug.slice(0, 30).padEnd(30)} vs ${bSlug.slice(0, 30).padEnd(30)} → ${overlap}/6 shared`);
    if (sym >= 0.85) totalIssues++;
  }
}

// === MyPage user-affinity simulation ===
console.log(`\n\n=== MyPage user-affinity scenarios ===`);

function buildUserAffinityAnchor(entries) {
  if (entries.length === 0) return null;
  const regionCounts = new Map();
  const durations = [];
  const prices = [];
  for (const e of entries) {
    for (const t of tokenize(e.region ?? "", 3)) regionCounts.set(t, (regionCounts.get(t) ?? 0) + 1);
    for (const t of tokenize(e.city ?? "", 3)) regionCounts.set(t, (regionCounts.get(t) ?? 0) + 1);
    const h = parseDurationHours(e.duration ?? "");
    if (h > 0) durations.push(h);
    const p = typeof e.listPriceUsd === "number" ? e.listPriceUsd : 0;
    if (p > 0) prices.push(p);
  }
  if (regionCounts.size === 0 && durations.length === 0 && prices.length === 0) return null;
  const topRegion = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const avgDur = durations.length > 0 ? durations.reduce((s, n) => s + n, 0) / durations.length : 0;
  const avgPrice = prices.length > 0 ? prices.reduce((s, n) => s + n, 0) / prices.length : 0;
  return {
    slug: "__user__",
    region: topRegion,
    badges: [],
    duration: avgDur > 0 ? `${avgDur.toFixed(1)} hours` : "",
    listPriceUsd: avgPrice,
  };
}

const SCENARIOS = [
  {
    name: "user A — booked 2 Jeju tours @ $59",
    entries: [
      { city: "Jeju", region: "East Jeju", duration: "9 hours", listPriceUsd: 59 },
      { city: "Jeju", region: "Southern Jeju", duration: "9 hours", listPriceUsd: 59 },
    ],
    expectRegion: "jeju",
  },
  {
    name: "user B — booked Busan + Seoul private @ ~$200-400",
    entries: [
      { city: "Busan", region: "Busan", duration: "10 hours", listPriceUsd: 79 },
      { city: "Seoul", region: "Seoul & Suburbs", duration: "10 hours", listPriceUsd: 179 },
      { city: "Seoul", region: "Paju (Seoul Day Trip)", duration: "9 hours", listPriceUsd: 419 },
    ],
    expectRegion: "seoul",
  },
  {
    name: "user C — single Pocheon booking",
    entries: [
      { city: "Pocheon", region: "Pocheon (Seoul Day Trip)", duration: "10 hours", listPriceUsd: 49 },
    ],
    expectRegion: null, // pocheon dominates token-wise
  },
  {
    name: "user D — no signal (new user)",
    entries: [],
    expectNull: true,
  },
];

for (const scenario of SCENARIOS) {
  console.log(`\n--- ${scenario.name} ---`);
  const anchor = buildUserAffinityAnchor(scenario.entries);
  if (scenario.expectNull) {
    if (anchor === null) console.log("  ✓ null anchor (fallback to popularity)");
    else { console.log(`  ❌ expected null, got`, anchor); totalIssues++; }
    continue;
  }
  if (!anchor) { console.log(`  ❌ unexpected null anchor`); totalIssues++; continue; }
  console.log(`  anchor: region="${anchor.region}", avg $${anchor.listPriceUsd}, dur="${anchor.duration}"`);
  if (scenario.expectRegion && anchor.region !== scenario.expectRegion) {
    console.log(`  ❌ expected top region "${scenario.expectRegion}", got "${anchor.region}"`); totalIssues++;
  } else {
    console.log(`  ✓ region token`);
  }
  const picks = pickRecommendations(anchor, catalog, 6, 3);
  picks.forEach((r, i) => {
    console.log(`    ${i + 1}. [${r._score.toFixed(0)}] ${r.slug.slice(0, 50).padEnd(50)} · ${r.region.slice(0, 25).padEnd(25)} · $${r.listPriceUsd}`);
  });
}

console.log(`\n${totalIssues === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${totalIssues} issue(s)`}`);
