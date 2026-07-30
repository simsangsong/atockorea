import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSvg, THEMES, adapt, W, H } from './svg.mjs';

// This worktree has no node_modules. Resolve sharp from a checkout that does.
// NEVER junction node_modules in — a recursive delete would follow the link out.
const SHARP_HOST = process.env.VIDEO_GUIDE_SHARP_HOST
  ?? 'C:/Users/sangsong/atockorea-ops-next/package.json';
const sharp = createRequire(SHARP_HOST)('sharp');

export { sharp };

/**
 * Mean luminance (0..255) of the region the arrow will sit on.
 * Waypoints are authored against 1920x1080; the still may be smaller in draft mode,
 * so scale the sample box to whatever the frame actually is.
 */
export async function pathLuma(framePath, arrows) {
  const pts = arrows.flatMap((a) => a.points ?? [a.from, a.target].filter(Boolean));
  if (!pts.length) return null;
  const meta = await sharp(framePath).metadata();
  const k = meta.width / W;
  const xs = pts.map((p) => p.x * k), ys = pts.map((p) => p.y * k);
  const pad = 60 * k;
  const left = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const top = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const width = Math.min(meta.width - left, Math.ceil(Math.max(...xs) - Math.min(...xs) + pad * 2));
  const height = Math.min(meta.height - top, Math.ceil(Math.max(...ys) - Math.min(...ys) + pad * 2));
  if (width < 4 || height < 4) return null;
  const { channels } = await sharp(framePath).extract({ left, top, width, height }).stats();
  const [r, g, b] = channels;
  return 0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean;
}

/**
 * Render a transparent PNG sequence for one overlay beat.
 * timing: { hold, draw, tail } in seconds — a stillness, a slow unfurl, a read pause.
 */
export async function renderArrowFrames({ outDir, beat, fps, duration, themeName, luma }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const theme = adapt(THEMES[themeName] ?? THEMES.pearl, luma);
  const hold = beat.timing?.hold ?? 0.35;
  const draw = beat.timing?.draw ?? 2.2;
  const frames = Math.round(duration * fps);
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const p = t <= hold ? 0 : Math.min(1, (t - hold) / draw);
    const svg = Buffer.from(buildSvg(beat, p, theme));
    await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: svg, top: 0, left: 0 }])
      .png({ compressionLevel: 6 })
      .toFile(path.join(outDir, `f_${String(f).padStart(4, '0')}.png`));
  }
  return frames;
}

/**
 * Polaroid card: the frozen frame, shrunk into a white print with a soft shadow and
 * a slight tilt. Returned as a full-canvas transparent PNG so ffmpeg can just overlay it.
 */
export async function renderPolaroid({ framePath, outFile, opts = {} }) {
  const cardW = opts.width ?? 820;
  const border = opts.border ?? 26;
  const chin = opts.chin ?? 92;          // the fat bottom edge of a real polaroid
  const tilt = opts.tilt ?? -2.2;
  const photoW = cardW - border * 2;
  const photoH = Math.round(photoW * 9 / 16);
  const cardH = photoH + border + chin;

  const photo = await sharp(framePath).resize(photoW, photoH, { fit: 'cover' }).toBuffer();
  const card = await sharp({ create: { width: cardW, height: cardH, channels: 4, background: { r: 253, g: 252, b: 249, alpha: 1 } } })
    .composite([{ input: photo, top: border, left: border }])
    .png().toBuffer();

  const rotated = await sharp(card)
    .rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const meta = await sharp(rotated).metadata();

  const cx = opts.centerX ?? Math.round(W / 2);
  const cy = opts.centerY ?? Math.round(H / 2);
  const left = Math.round(cx - meta.width / 2);
  const top = Math.round(cy - meta.height / 2);

  // soft drop shadow: a blurred dark copy of the card silhouette
  const shadow = await sharp(rotated)
    .ensureAlpha()
    .composite([{ input: { create: { width: meta.width, height: meta.height, channels: 4, background: { r: 12, g: 18, b: 30, alpha: 1 } } }, blend: 'in' }])
    .blur(22).png().toBuffer();

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: shadow, top: top + 16, left: left + 4, opacity: 0.45 },
      { input: rotated, top, left },
    ])
    .png().toFile(outFile);
  return outFile;
}
