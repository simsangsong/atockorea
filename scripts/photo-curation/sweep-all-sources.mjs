/**
 * Full sweep of every photo source on this machine, deduplicated, with each file
 * attributed to a POI folder where the directory name gives one away.
 *
 * Sources deliberately include `D:/VIDEO2` — the video folders hold 500+ stills alongside
 * the clips, and an earlier sweep that only walked `D:/한국여행사진_통합` reported seven
 * attractions as "no photography exists" when the photos were sitting right there.
 *
 * Dedup fingerprint is `size + sha1(first 96KB)`. Byte-identical copies are what actually
 * litter these folders (the same shot in `Atoc Photos`, `한국여행사진_통합` and a KakaoTalk
 * export), and a full hash of ~4k large files costs minutes for no extra recall.
 *
 *   node scripts/photo-curation/sweep-all-sources.mjs --out sweep.json
 */

import { createHash } from "crypto";
import { existsSync, openSync, readSync, closeSync, readdirSync, statSync, writeFileSync } from "fs";
import { extname, join } from "path";

const args = process.argv.slice(2);
const argOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const OUT = argOf("--out", "sweep.json");
const MIN_BYTES = Number(argOf("--min-bytes", String(300 * 1024)));

const ROOTS = [
  ["통합", "D:/한국여행사진_통합"],
  ["VIDEO2", "D:/VIDEO2"],
  ["AtocPhotos", "D:/Atoc Photos"],
  ["jeju", "D:/jeju photos"],
  ["해녀쇼", "D:/해녀쇼"],
  ["kakao", "D:/kakao"],
  ["live", "D:/live"],
  ["C:atoc-photos", "C:/Users/sangsong/atoc-photos"],
  ["C:Desktop", "C:/Users/sangsong/Desktop"],
  ["C:Downloads", "C:/Users/sangsong/Downloads"],
  ["C:Documents", "C:/Users/sangsong/Documents"],
  ["C:Pictures", "C:/Users/sangsong/Pictures"],
];

const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif", ".heic"]);
/** Directories that hold no product photography — app caches, other people's brands, PII. */
const SKIP_DIR =
  /^(node_modules|\.git|\.next|\.venv|__pycache__|venv|Screenshots|Tencent Files|ComfyUI|Roblox|면접자료\d*|_video-merge.*|_tools|_klook|_음악베드)$/i;

const seen = new Map(); // fingerprint -> first path
const rows = [];
let skippedDup = 0;

function fingerprint(path, size) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(Math.min(96 * 1024, size));
    readSync(fd, buf, 0, buf.length, 0);
    return `${size}:${createHash("sha1").update(buf).digest("hex")}`;
  } finally {
    closeSync(fd);
  }
}

function walk(source, dir, depth, trail) {
  let ents = [];
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.test(e.name) || depth >= 5) continue;
      walk(source, p, depth + 1, [...trail, e.name]);
      continue;
    }
    if (!IMG.has(extname(e.name).toLowerCase())) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.size < MIN_BYTES) continue;
    let fp;
    try { fp = fingerprint(p, st.size); } catch { continue; }
    if (seen.has(fp)) { skippedDup += 1; continue; }
    seen.set(fp, p);
    rows.push({
      source,
      // Deepest directory that is not a season / bucket folder — that is the POI name.
      poiDir: [...trail].reverse().find((t) => !/^_|^(봄|여름|가을|겨울)$/.test(t)) || "",
      trail: trail.join("/"),
      path: p.split("\\").join("/"),
      size: st.size,
    });
  }
}

for (const [source, root] of ROOTS) if (existsSync(root)) walk(source, root, 0, []);

writeFileSync(OUT, JSON.stringify(rows, null, 1));
const bySource = {};
for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + 1;
console.log(`unique images ≥${(MIN_BYTES / 1024).toFixed(0)}KB: ${rows.length}   (byte-identical duplicates skipped: ${skippedDup})`);
for (const [s, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${s}`);
