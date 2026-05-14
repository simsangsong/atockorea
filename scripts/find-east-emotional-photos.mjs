/**
 * One-off: search Unsplash + Pixabay for emotional, high-res photos for the
 * `east-signature-nature-core` hero + atmosphere gallery (7 slots).
 *
 * Reads env from .env.local. Prints best 3 candidates per slot with dimensions.
 *
 *   node scripts/find-east-emotional-photos.mjs
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(join(root, ".env.local"));

async function unsplashSearch(query, perPage = 8) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const u = new URL("https://api.unsplash.com/search/photos");
  u.searchParams.set("query", query);
  u.searchParams.set("per_page", String(perPage));
  u.searchParams.set("orientation", "landscape");
  u.searchParams.set("order_by", "relevant");
  const r = await fetch(u, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.results ?? []).map((x) => ({
    url: x.urls.raw + "&w=2400&q=85&fm=jpg&fit=max",
    full: x.urls.full,
    width: x.width,
    height: x.height,
    likes: x.likes ?? 0,
    desc: (x.alt_description || x.description || "").slice(0, 80),
    src: "unsplash",
  }));
}

async function pixabaySearch(query, perPage = 8) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const u = new URL("https://pixabay.com/api/");
  u.searchParams.set("key", key);
  u.searchParams.set("q", query.slice(0, 100));
  u.searchParams.set("per_page", String(Math.max(perPage, 3)));
  u.searchParams.set("image_type", "photo");
  u.searchParams.set("orientation", "horizontal");
  u.searchParams.set("safesearch", "true");
  u.searchParams.set("min_width", "1600");
  u.searchParams.set("order", "popular");
  const r = await fetch(u);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.hits ?? []).map((x) => ({
    url: x.largeImageURL,
    full: x.largeImageURL,
    width: x.imageWidth,
    height: x.imageHeight,
    likes: x.likes ?? 0,
    desc: (x.tags || "").slice(0, 80),
    src: "pixabay",
  }));
}

async function searchSlot(label, queries) {
  const out = [];
  for (const q of queries) {
    const u = await unsplashSearch(q, 5);
    out.push(...u.map((x) => ({ ...x, query: q })));
  }
  for (const q of queries) {
    const p = await pixabaySearch(q, 5);
    out.push(...p.map((x) => ({ ...x, query: q })));
  }
  // Dedupe by URL
  const seen = new Set();
  const uniq = out.filter((x) => {
    if (seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });
  // Sort: prefer high width then likes
  uniq.sort((a, b) => {
    if (b.width !== a.width) return (b.width || 0) - (a.width || 0);
    return (b.likes || 0) - (a.likes || 0);
  });
  console.log(`\n=== ${label} ===`);
  uniq.slice(0, 5).forEach((x, i) => {
    console.log(`  ${i + 1}. [${x.src}] ${x.width}x${x.height} likes=${x.likes} q="${x.query}"`);
    console.log(`     desc: ${x.desc}`);
    console.log(`     url:  ${x.url}`);
  });
}

const slots = [
  {
    label: "HERO + THUMBNAIL (Seongsan Ilchulbong tour signature)",
    queries: [
      "Seongsan Ilchulbong sunrise crater",
      "Jeju sunrise volcanic crater aerial",
      "Seongsan Ilchulbong Jeju Korea",
    ],
  },
  {
    label: "Gallery 1 — Route Overview (East Jeju, day starts)",
    queries: [
      "Jeju Island morning landscape aerial",
      "Jeju east coast green field sunrise",
    ],
  },
  {
    label: "Gallery 2 — Stone Culture Opening (Jeju Stone Park)",
    queries: [
      "Jeju dolhareubang stone statue moody",
      "Korean stone park volcanic basalt",
      "Jeju Stone Culture Park atmospheric",
    ],
  },
  {
    label: "Gallery 3 — Ilchulland Lava Tube Garden (cooler enclosed)",
    queries: [
      "lava cave atmospheric tunnel light Jeju",
      "Jeju lava tube cave dramatic",
      "Jeju botanical garden lush green path",
    ],
  },
  {
    label: "Gallery 4 — Village Finale (Seongeup folk village)",
    queries: [
      "Korean traditional village thatched roof atmospheric",
      "Seongeup folk village Jeju hanok",
      "Korean hanok village stone wall traditional",
    ],
  },
  {
    label: "Gallery 5 — Crater and Coast (Seongsan strongest highlight)",
    queries: [
      "Seongsan Ilchulbong dramatic crater",
      "Jeju volcanic crater golden hour",
    ],
  },
  {
    label: "Gallery 6 — Open Coastline (Seopjikoji)",
    queries: [
      "Seopjikoji Jeju cliff coast",
      "Jeju east coast cliff dramatic",
      "Jeju coastline canola flower lighthouse",
    ],
  },
];

(async () => {
  for (const s of slots) {
    await searchSlot(s.label, s.queries);
    await new Promise((r) => setTimeout(r, 600));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
