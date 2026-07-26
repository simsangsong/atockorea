#!/usr/bin/env node
/**
 * Deterministic HTML→MP4 renderer for pictogram how-to videos (howto track v1).
 *
 * The scene file exposes window.__total (ms) and window.__seek(t) over paused
 * WAAPI animations, so every frame is exact — no wall-clock capture drift.
 * Frames are screenshotted with Playwright Chromium at 1080x1920 and encoded
 * with the same local ffmpeg the POI pipeline uses (yuv420p + silent audio bed
 * for player compatibility, faststart for progressive playback).
 *
 * Usage:
 *   node scripts/render-howto-video.mjs --html=assets/howto/onboarding-en.html \
 *        --out=.tmp/howto/onboarding-en [--fps=30] [--preview]
 *
 *   --preview  six spot frames only (one per scene) — fast design QA, no MP4.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}
const HTML = arg('html');
const OUT = arg('out');
const FPS = Number(arg('fps', '30'));
const PREVIEW = process.argv.includes('--preview');
if (!HTML || !OUT) {
  console.error('Usage: node scripts/render-howto-video.mjs --html=<file> --out=<dir> [--fps=30] [--preview]');
  process.exit(1);
}

function ffmpegCmd() {
  for (const cmd of [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean)) {
    if (spawnSync(cmd, ['-version'], { stdio: 'ignore' }).status === 0) return cmd;
  }
  throw new Error('ffmpeg not found (set FFMPEG_PATH)');
}

async function main() {
  const htmlPath = path.resolve(HTML);
  if (!existsSync(htmlPath)) throw new Error(`Missing scene file: ${htmlPath}`);
  const outDir = path.resolve(OUT);
  const framesDir = path.join(outDir, 'frames');
  mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => typeof window.__seek === 'function' && window.__total > 0);
  const total = await page.evaluate(() => window.__total);

  if (PREVIEW) {
    // One frame per scene, mid-scene — where the composition should be settled.
    for (let s = 0; s < 6; s += 1) {
      const t = Math.min(total - 1, s * 5000 + 3600);
      await page.evaluate((ms) => window.__seek(ms), t);
      await page.screenshot({ path: path.join(outDir, `preview-scene${s + 1}.png`) });
    }
    await browser.close();
    console.log(`previews → ${outDir}`);
    return;
  }

  const frameCount = Math.ceil((total / 1000) * FPS);
  console.log(`rendering ${frameCount} frames @ ${FPS}fps (${(total / 1000).toFixed(1)}s) …`);
  for (let f = 0; f < frameCount; f += 1) {
    const t = Math.min(total - 1, Math.round((f / FPS) * 1000));
    await page.evaluate((ms) => window.__seek(ms), t);
    await page.screenshot({ path: path.join(framesDir, `f${String(f).padStart(5, '0')}.png`) });
    if (f % 120 === 0) console.log(`  frame ${f}/${frameCount}`);
  }
  await browser.close();

  const mp4 = path.join(outDir, `${path.basename(HTML, '.html')}.mp4`);
  const encode = spawnSync(ffmpegCmd(), [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(framesDir, 'f%05d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=mono:sample_rate=16000',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '48k',
    '-movflags', '+faststart',
    mp4,
  ], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
  if (encode.status !== 0) {
    console.error(encode.stderr?.toString('utf8').slice(-1500));
    throw new Error('ffmpeg encode failed');
  }
  // Poster = a settled frame from scene 1.
  spawnSync(ffmpegCmd(), ['-y', '-ss', '2.4', '-i', mp4, '-frames:v', '1', path.join(outDir, 'poster.png')], { stdio: 'ignore' });
  console.log(`done → ${mp4}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
