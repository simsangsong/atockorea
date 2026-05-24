/**
 * One-off: convert the two cruise private-pickup thumbnails extracted from
 * the current session (.tmp-session-images/img-10/img-11) to WebP 1600w q90
 * under public/images/tours/{incheon-cruise,jeju-cruise-terminal}/.
 *
 *   node scripts/convert-cruise-thumbnails.mjs
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const TARGET_WIDTH = 1600;
const QUALITY = 90;

const TARGETS = [
  {
    src: ".tmp-session-images/img-10-2026-05-24T15-50-05-844Z.webp",
    out: "public/images/tours/incheon-cruise/incheon-port-private-pickup.webp",
    label: "Incheon Port — Costa Serena + Carnival private pickup",
  },
  {
    src: ".tmp-session-images/img-11-2026-05-24T15-50-05-844Z.webp",
    out: "public/images/tours/jeju-cruise-terminal/jeju-cruise-terminal-private-pickup.webp",
    label: "Jeju Gangjeong terminal — Carnival pickup arriving guests (REPLACES existing)",
  },
];

for (const t of TARGETS) {
  const outDir = t.out.slice(0, t.out.lastIndexOf("/"));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const meta = await sharp(t.src).metadata();
  const pipeline = sharp(t.src);
  if (meta.width && meta.width > TARGET_WIDTH) {
    pipeline.resize({ width: TARGET_WIDTH, withoutEnlargement: true });
  }
  const buffer = await pipeline.webp({ quality: QUALITY }).toBuffer();
  await sharp(buffer).toFile(t.out);
  const ratioStr = meta.width && meta.height ? `${meta.width}x${meta.height}` : "?";
  console.log(`[ok] ${t.label}`);
  console.log(`       ${t.src} (${ratioStr}) → ${t.out} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

console.log(`[done] ${TARGETS.length} files`);
