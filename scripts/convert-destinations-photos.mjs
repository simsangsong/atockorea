/**
 * One-off: convert destinations photo batch
 * (D:/Atoc Photos/modified/destinations-2026-05-25/*.{jpg,webp,png})
 * to WebP 1200w q90 under public/images/destinations/.
 *
 *   node scripts/convert-destinations-photos.mjs
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { extname, join } from "path";

const SRC = "D:/Atoc Photos/modified/destinations-2026-05-25";
const OUT = "public/images/destinations";
const TARGET_WIDTH = 1200;
const QUALITY = 90;

// Source filename → destination filename (matches DESTINATIONS imageSrc).
const RENAME = {
  "01-seoul-gyeongbokgung-arch": "seoul-card",
  "02-busan-gamcheon-little-prince": "busan-card",
  "03-jeju-seopjikoji-swing": "jeju-card",
};

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort();

if (files.length === 0) {
  console.error(`[convert-destinations-photos] no source files under ${SRC}`);
  process.exit(1);
}

for (const file of files) {
  const inputPath = join(SRC, file);
  const stem = file.replace(extname(file), "");
  const targetStem = RENAME[stem] ?? stem;
  const outputPath = join(OUT, `${targetStem}.webp`);

  const meta = await sharp(inputPath).metadata();
  const pipeline = sharp(inputPath);
  if (meta.width && meta.width > TARGET_WIDTH) {
    pipeline.resize({ width: TARGET_WIDTH, withoutEnlargement: true });
  }
  const buffer = await pipeline.webp({ quality: QUALITY }).toBuffer();
  await sharp(buffer).toFile(outputPath);

  const ratioStr = meta.width && meta.height ? `${meta.width}x${meta.height}` : "?";
  console.log(`[ok] ${file} (${ratioStr}) → ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

console.log(`[done] ${files.length} files → ${OUT}`);
