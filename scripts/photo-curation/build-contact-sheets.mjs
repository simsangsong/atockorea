/**
 * Renders numbered contact sheets so the photo library can actually be *looked at*
 * before anything is wired into the site.
 *
 * Each sheet tiles up to `--per-sheet` candidates for one POI, with an index label,
 * the season/`_보정본` bucket and the pixel size under every frame. The index is the
 * stable handle used by `pick-list.json` → `apply-picks.mjs`.
 *
 *   node scripts/photo-curation/build-contact-sheets.mjs --out <dir> [--only <poi,poi>]
 *
 * Candidate pre-filter (big folders hold 80–130 near-duplicate burst frames):
 *   • drop anything under 1000px wide — too small to survive a 1920px hero crop
 *   • group by capture burst (KakaoTalk filename timestamp) and take the largest few
 *   • keep every `_보정본` frame in the running — the owner asked for retouched/AI
 *     frames to be used, not filtered out
 *   • landscape frames rank first (cards and heroes are 16:9), portraits still shown
 */

import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { POI_FOLDER_MAP, SKIP_FOLDERS } from "./library-map.mjs";

const args = process.argv.slice(2);
const argOf = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const MANIFEST = argOf("--manifest", "photo-manifest.json");
const OUT_DIR = argOf("--out", "contact-sheets");
const ONLY = argOf("--only", "");
const PER_SHEET = Number(argOf("--per-sheet", "16"));
const MAX_SHEETS = Number(argOf("--max-sheets", "2"));
const COLS = Number(argOf("--cols", "4"));
const TILE_W = Number(argOf("--tile", "300"));
const TILE_H = Math.round((TILE_W * 2) / 3);
const LABEL_H = 20;

mkdirSync(OUT_DIR, { recursive: true });

/** @type {{region:string,poi:string,bucket:string,path:string,size:number,w:number,h:number,ar:number}[]} */
const rows = JSON.parse(readFileSync(MANIFEST, "utf8"));

/** Burst key: KakaoTalk_20260510_230009595_21.jpg → 20260510_230009595 */
function burstKey(path) {
  const b = basename(path);
  const m = b.match(/(\d{8}[_-]\d{6,9})/);
  return m ? m[1] : b.replace(/[_-]?\d+(\.\w+)$/, "$1");
}

function pickCandidates(list) {
  const retouched = list.filter((r) => r.bucket.includes("_보정본"));
  const plain = list.filter((r) => !r.bucket.includes("_보정본"));

  const usable = plain.filter((r) => r.w >= 1000);
  const pool = usable.length >= 6 ? usable : plain;

  // Thin out bursts: keep the 2 largest frames of each burst, then widen if needed.
  const bursts = new Map();
  for (const r of pool) {
    const k = burstKey(r.path);
    if (!bursts.has(k)) bursts.set(k, []);
    bursts.get(k).push(r);
  }
  const thinned = [];
  for (const frames of bursts.values()) {
    frames.sort((a, b) => b.w * b.h - a.w * a.h);
    thinned.push(...frames.slice(0, 2));
  }
  const budget = PER_SHEET * MAX_SHEETS;
  let chosen = thinned;
  if (chosen.length > budget) {
    // Landscape first, then by pixel area — but keep a couple of portraits for galleries.
    const land = chosen.filter((r) => r.ar >= 1.15).sort((a, b) => b.w * b.h - a.w * a.h);
    const port = chosen.filter((r) => r.ar < 1.15).sort((a, b) => b.w * b.h - a.w * a.h);
    const portQuota = Math.min(port.length, Math.max(2, Math.round(budget * 0.25)));
    chosen = [...land.slice(0, budget - portQuota - retouched.length), ...port.slice(0, portQuota)];
  }
  // Retouched frames always ride along, at the front (owner direction 2026-08-07).
  const seen = new Set(retouched.map((r) => r.path));
  return [...retouched, ...chosen.filter((r) => !seen.has(r.path))].slice(0, budget);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Group by wiring target (assetSlug), not by folder: 경주 한옥마을 + 경주교촌마을 are one
// place, and 해녀박물관 + 성산 해녀 물질시연 + 해녀쇼 all feed the same stop.
const byTarget = new Map();
for (const r of rows) {
  if (SKIP_FOLDERS.has(r.poi)) continue;
  const spec = POI_FOLDER_MAP[r.poi];
  if (!spec) continue;
  if (!byTarget.has(spec.assetSlug)) byTarget.set(spec.assetSlug, { spec, folders: new Set(), list: [] });
  const g = byTarget.get(spec.assetSlug);
  g.folders.add(r.poi);
  g.list.push(r);
}

const onlySet = ONLY ? new Set(ONLY.split(",").map((s) => s.trim())) : null;
const index = {};

for (const [assetSlug, group] of [...byTarget.entries()].sort()) {
  if (onlySet && !onlySet.has(assetSlug)) continue;
  const { spec, list } = group;
  const poi = [...group.folders].join(" + ");
  const cands = pickCandidates(list);
  index[assetSlug] = {
    folders: [...group.folders],
    poiKeys: spec.poiKeys,
    total: list.length,
    shown: cands.length,
    frames: cands.map((c, i) => ({ n: i + 1, path: c.path, w: c.w, h: c.h, bucket: c.bucket })),
  };

  for (let s = 0; s * PER_SHEET < cands.length; s += 1) {
    const slice = cands.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const rowsN = Math.ceil(slice.length / COLS);
    const W = COLS * TILE_W;
    const H = rowsN * (TILE_H + LABEL_H) + 26;

    const composites = [];
    for (let i = 0; i < slice.length; i += 1) {
      const c = slice[i];
      const cx = (i % COLS) * TILE_W;
      const cy = Math.floor(i / COLS) * (TILE_H + LABEL_H) + 26;
      let buf;
      try {
        buf = await sharp(c.path)
          .rotate()
          .resize(TILE_W - 6, TILE_H - 6, { fit: "contain", background: "#111" })
          .jpeg({ quality: 78 })
          .toBuffer();
      } catch {
        continue;
      }
      composites.push({ input: buf, left: cx + 3, top: cy + 3 });
      const tag = c.bucket.includes("_보정본") ? "RT" : c.bucket.replace("_계절미상", "?");
      composites.push({
        input: Buffer.from(
          `<svg width="${TILE_W}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#000"/>` +
            `<text x="4" y="15" font-family="monospace" font-size="14" fill="#ffd166">${
              s * PER_SHEET + i + 1
            }</text>` +
            `<text x="30" y="15" font-family="monospace" font-size="12" fill="#9fe">${esc(tag)}</text>` +
            `<text x="${TILE_W - 4}" y="15" text-anchor="end" font-family="monospace" font-size="11" fill="#bbb">${
              c.w
            }x${c.h}</text></svg>`
        ),
        left: cx,
        top: cy + TILE_H,
      });
    }
    composites.push({
      input: Buffer.from(
        `<svg width="${W}" height="26"><rect width="100%" height="100%" fill="#000"/>` +
          `<text x="6" y="18" font-family="sans-serif" font-size="15" fill="#fff">${esc(poi)}  ` +
          `[${esc(assetSlug)}]  sheet ${s + 1}  ·  ${cands.length} shown of ${list.length}</text></svg>`
      ),
      left: 0,
      top: 0,
    });

    const outName = `${assetSlug}${s ? `-${s + 1}` : ""}.jpg`;
    await sharp({ create: { width: W, height: H, channels: 3, background: "#111" } })
      .composite(composites)
      .jpeg({ quality: 80 })
      .toFile(join(OUT_DIR, outName));
    console.log(`${outName}\t${poi}\t${slice.length} frames`);
  }
}

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 1));
console.log(`\nPOIs sheeted: ${Object.keys(index).length}`);
