#!/usr/bin/env node
/**
 * One-shot in-place compressor for the largest tour/hero images.
 *
 * Why in-place: image paths are stored in Supabase (`tour_products.image_url`,
 * `gallery_images`) and hard-coded in seed scripts, so renaming to `.webp` would
 * require a DB migration. Re-encoding inside the same filename keeps DB rows valid
 * — even when the new bytes are JPEG behind a `.png` extension, browsers and
 * `next/image` detect the format from magic bytes, not from the path.
 *
 * Safety: the new buffer is only written if it is strictly smaller than the
 * original. Run from repo root.
 */
import sharp from "sharp";
import { stat, readFile, writeFile } from "node:fs/promises";

const MAX_WIDTH = 1920;

/** @type {Array<{ path: string; enc: "jpeg" | "png" }>} */
const targets = [
  { path: "public/images/tours/jeju-eastern-unesco-seongsan.png", enc: "jpeg" },
  { path: "public/images/tours/jeju-southern-unesco-snow-road.png", enc: "jpeg" },
  { path: "public/images/tours/jeju-eastern-unesco-cover.png", enc: "jpeg" },
  { path: "public/images/tours/jeju-eastern-unesco-beach.png", enc: "jpeg" },
  { path: "public/images/tours/jeju-private-car-tour-cover.png", enc: "png" },
  { path: "public/images/tours/jeju-private-tour-waterfall.png", enc: "png" },
  { path: "public/images/tours/jeju-west-south-cliff-waves.png", enc: "png" },
  { path: "public/images/tours/jeju-west-south-hiking-trail.png", enc: "png" },
  { path: "public/images/tours/jeju-cruise-tour-coast.png", enc: "png" },
  { path: "public/images/hero/seoul-hero.jpg", enc: "jpeg" },
  { path: "public/images/hero/jeju-hero.jpg", enc: "jpeg" },
  { path: "public/images/hero/busan-hero.jpg", enc: "jpeg" },
];

let totalBefore = 0;
let totalAfter = 0;
let touched = 0;

for (const { path: p, enc } of targets) {
  const origBuf = await readFile(p);
  const orig = origBuf.byteLength;
  totalBefore += orig;

  let pipeline = sharp(origBuf);
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  let out;
  if (enc === "jpeg") {
    out = await pipeline.jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
  } else {
    // Try PNG first (lossless-ish); if it doesn't beat JPEG@80 by enough, fall back.
    const png = await pipeline
      .clone()
      .png({ quality: 80, compressionLevel: 9, effort: 10, palette: true })
      .toBuffer();
    const jpg = await pipeline
      .clone()
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toBuffer();
    // Choose whichever is smaller; sharp + magic-byte detection makes JPEG-in-.png safe.
    out = png.byteLength <= jpg.byteLength ? png : jpg;
  }

  if (out.byteLength < orig) {
    await writeFile(p, out);
    totalAfter += out.byteLength;
    touched += 1;
    const pct = ((1 - out.byteLength / orig) * 100).toFixed(0);
    console.log(
      `✅ ${p}: ${(orig / 1024).toFixed(0)} KB → ${(out.byteLength / 1024).toFixed(0)} KB (-${pct}%)`,
    );
  } else {
    totalAfter += orig;
    console.log(`⊘  ${p}: ${(orig / 1024).toFixed(0)} KB (no improvement, kept original)`);
  }
}

console.log("");
console.log(
  `Touched ${touched}/${targets.length} files. Total: ${(totalBefore / 1024).toFixed(0)} KB → ${(totalAfter / 1024).toFixed(0)} KB (-${((1 - totalAfter / totalBefore) * 100).toFixed(0)}%).`,
);
