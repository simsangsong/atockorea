#!/usr/bin/env node
/**
 * Generate PWA icons from the AtoC circle emblem (public/atoc-emblem-circle-1024.png).
 *
 * The emblem is a dark-navy circle that touches the canvas edges, so:
 *  - "any" icons: the emblem resized as-is (transparent corners are fine).
 *  - "maskable" icons: emblem scaled to 80% and centered on a solid navy
 *    square so any platform mask (circle, squircle, rounded rect) crops
 *    cleanly — content stays inside the 40%-radius safe zone.
 *  - apple-touch-icon: 180×180 on solid navy (iOS disallows transparency
 *    and applies its own rounding).
 *
 * Output: public/pwa/ — shared by the tour-mode and tour-ops manifests.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('public/atoc-emblem-circle-1024.png');
const OUT_DIR = path.resolve('public/pwa');
// Sampled from the emblem's outer rim so the maskable bleed is seamless.
const BG = '#101a2e';

async function anyIcon(size) {
  await sharp(SRC)
    .resize(size, size)
    .png()
    .toFile(path.join(OUT_DIR, `icon-${size}.png`));
}

async function maskableIcon(size) {
  const inner = Math.round(size * 0.8);
  const emblem = await sharp(SRC).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: emblem, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT_DIR, `maskable-${size}.png`));
}

async function appleTouchIcon() {
  const size = 180;
  const inner = Math.round(size * 0.86);
  const emblem = await sharp(SRC).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: emblem, gravity: 'center' }])
    .flatten({ background: BG })
    .png()
    .toFile(path.join(OUT_DIR, 'apple-touch-icon.png'));
}

await mkdir(OUT_DIR, { recursive: true });
await Promise.all([
  anyIcon(192),
  anyIcon(512),
  maskableIcon(192),
  maskableIcon(512),
  appleTouchIcon(),
]);
console.log('PWA icons written to public/pwa/');
