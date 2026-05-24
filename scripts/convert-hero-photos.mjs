/**
 * One-off: convert hero photo batch (D:/Atoc Photos/modified/hero-2026-05-24/*.png)
 * to WebP 1600w q90 under public/images/home/hero/.
 *
 *   node scripts/convert-hero-photos.mjs
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { extname, join } from "path";

const SRC = "D:/Atoc Photos/modified/hero-2026-05-24";
const OUT = "public/images/home/hero";
const TARGET_WIDTH = 1600;
const QUALITY = 90;

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort();

if (files.length === 0) {
  console.error(`[convert-hero-photos] no source files under ${SRC}`);
  process.exit(1);
}

for (const file of files) {
  const inputPath = join(SRC, file);
  const stem = file.replace(extname(file), "");
  const outputPath = join(OUT, `${stem}.webp`);

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
