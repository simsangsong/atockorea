/**
 * Housekeeping for the directories `apply-picks.mjs` writes into.
 *
 * 1. REPOINT — a curated frame is often the same source photo the site already shipped,
 *    just re-encoded (and sometimes cropped). Those old files become silent duplicates,
 *    and any reference still pointing at them would break once they are removed. Match by
 *    filename stem (the new files carry an `NN-` position prefix) and rewrite references.
 * 2. SWEEP — delete WebPs in those directories that nothing references any more.
 *
 * References are collected from BOTH the repo (locale tour JSONs, any other tracked file)
 * and the database (`tour_product_pages.detail_payload`, `tours`, `match_pois`), because a
 * file can be live in the DB while absent from the JSONs.
 *
 *   node scripts/photo-curation/gc-orphans.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const NEW = /^(\d\d)-(.*)\.webp$/;
const picks = JSON.parse(readFileSync(join(__dirname, "picks.json"), "utf8"));
const slugs = Object.entries(picks)
  .filter(([, p]) => p.hero)
  .map(([s]) => s);

/** old public path → new public path */
const repoint = new Map();
/** every file we may sweep */
const candidates = [];

for (const slug of slugs) {
  const dir = join(ROOT, "public", "images", "tours", slug);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".webp"));
  const byStem = new Map();
  for (const f of files) {
    const m = f.match(NEW);
    if (m) byStem.set(m[2], f);
  }
  for (const f of files) {
    // Every WebP in a curated folder is a sweep candidate — including `NN-` ones. A pick
    // that gets re-chosen (the owner supplying a real photo for a POI that had none)
    // leaves its predecessor behind under the same numbering, and an earlier version of
    // this sweep skipped exactly those. The reference scan below is what protects live
    // files, so widening the candidate set is safe.
    candidates.push({ slug, file: f, path: join(dir, f) });
    if (NEW.test(f)) continue;
    const stem = f.replace(/\.webp$/i, "");
    const replacement = byStem.get(stem);
    if (replacement) {
      repoint.set(`/images/tours/${slug}/${f}`, `/images/tours/${slug}/${replacement}`);
    }
  }
}

console.log(`superseded duplicates to repoint: ${repoint.size}`);
console.log(`legacy files in curated folders : ${candidates.length}`);

// ── 1. repoint references in the repo ───────────────────────────────────────
const TEXT_DIRS = ["components", "app", "lib", "data", "scripts", "messages", "__tests__"];
const rewrittenFiles = [];

function rewriteTree(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      rewriteTree(p);
      continue;
    }
    if (!/\.(json|ts|tsx|js|jsx|mjs|md|sql)$/i.test(ent.name)) continue;
    if (statSync(p).size > 12 * 1024 * 1024) continue;
    let txt;
    try {
      txt = readFileSync(p, "utf8");
    } catch {
      continue;
    }
    let out = txt;
    for (const [oldPath, newPath] of repoint) {
      if (out.includes(oldPath)) out = out.split(oldPath).join(newPath);
    }
    if (out !== txt) {
      if (!DRY) writeFileSync(p, out, "utf8");
      rewrittenFiles.push(p);
    }
  }
}
if (repoint.size) for (const d of TEXT_DIRS) if (existsSync(join(ROOT, d))) rewriteTree(join(ROOT, d));
console.log(`repo files ${DRY ? "that would be " : ""}rewritten: ${rewrittenFiles.length}`);

loadEnvLocal();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ── 1b. push the repointed payloads, or the DB keeps the stale paths alive ──
const TOUR_JSON = /product-tour-static[/\\]([^/\\]+)[/\\]\1\.(en|ko|ja|es|zh|zh-TW)\.json$/;
let synced = 0;
if (!DRY) {
  const enSlugs = new Set();
  for (const p of rewrittenFiles) {
    const m = p.replace(/\\/g, "/").match(TOUR_JSON);
    if (!m) continue;
    const [, slug, locale] = m;
    const payload = JSON.parse(readFileSync(p, "utf8"));
    const hero = payload?.catalog_card?.heroImage || payload?.hero?.imageUrl || null;
    const { error } = await supabase
      .from("tour_product_pages")
      .update({
        detail_payload: payload,
        ...(hero ? { hero_image_url: hero, thumbnail_url: hero } : {}),
      })
      .eq("slug", slug)
      .eq("locale", locale);
    if (error) console.warn(`  tour_product_pages ${slug}/${locale}: ${error.message}`);
    else synced += 1;
    if (locale === "en") enSlugs.add({ slug, payload });
  }
  for (const { slug, payload } of enSlugs) {
    const hero = payload?.catalog_card?.heroImage || payload?.hero?.imageUrl || null;
    const gallery = (payload.galleryItems || [])
      .map((g) => g?.src)
      .filter((s) => typeof s === "string" && s.startsWith("/images/"));
    const patch = {};
    if (hero) patch.image_url = hero;
    if (gallery.length) patch.gallery_images = gallery;
    if (Object.keys(patch).length) await supabase.from("tours").update(patch).eq("slug", slug);
  }
  // match_pois holds bare paths, not payloads — repoint them directly.
  for (const [oldPath, newPath] of repoint) {
    await supabase.from("match_pois").update({ default_image_url: newPath }).eq("default_image_url", oldPath);
  }
  console.log(`db rows repointed: ${synced}`);
}

// ── 2. collect every surviving reference, repo + DB ─────────────────────────

const referenced = new Set();
const REF = /\/images\/tours\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.webp/g;

function scanTree(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      scanTree(p);
      continue;
    }
    if (!/\.(json|ts|tsx|js|jsx|mjs|md|sql|html)$/i.test(ent.name)) continue;
    if (statSync(p).size > 12 * 1024 * 1024) continue;
    let txt;
    try {
      txt = readFileSync(p, "utf8");
    } catch {
      continue;
    }
    for (const m of txt.matchAll(REF)) referenced.add(m[0]);
  }
}
for (const d of TEXT_DIRS) if (existsSync(join(ROOT, d))) scanTree(join(ROOT, d));
console.log(`references found in repo: ${referenced.size}`);

async function scanDb() {
  for (const [table, cols] of [
    ["tour_product_pages", "detail_payload, hero_image_url, thumbnail_url"],
    ["tours", "image_url, gallery_images"],
    ["match_pois", "default_image_url, images"],
  ]) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 199);
      if (error) {
        console.warn(`  db scan ${table}: ${error.message}`);
        break;
      }
      if (!data?.length) break;
      for (const row of data) {
        for (const m of JSON.stringify(row).matchAll(REF)) referenced.add(m[0]);
      }
      if (data.length < 200) break;
      from += 200;
    }
  }
}
await scanDb();
console.log(`references found, repo + db: ${referenced.size}`);

// ── 3. sweep ────────────────────────────────────────────────────────────────
let removed = 0;
let bytes = 0;
for (const c of candidates) {
  const pub = `/images/tours/${c.slug}/${c.file}`;
  if (referenced.has(pub)) continue;
  bytes += statSync(c.path).size;
  removed += 1;
  if (!DRY) unlinkSync(c.path);
}
console.log(
  `${DRY ? "[dry] would remove" : "removed"} ${removed} orphaned WebP (${(bytes / 1048576).toFixed(1)} MB)`
);
