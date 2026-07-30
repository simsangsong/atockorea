#!/usr/bin/env node
/**
 * Vertical-shell preview: measure the route, author the arrow, render the overlay
 * and composite it over the real frame — one still per beat, at full arrow extent.
 *
 *   node scripts/video-guide/preview.mjs docs/video-specs/<slug>.json 02,21,28
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from './lib/deps.mjs';
import { routeAfter } from './heading.mjs';
import { authorArrow } from './authorArrows.mjs';
import { buildScene, CANVAS, BAND } from './scene.mjs';

const specPath = process.argv[2];
const only = (process.argv[3] ?? '').split(',').filter(Boolean);
const progress = Number(process.argv[4] ?? 1);
if (!specPath) { console.error('usage: preview.mjs <spec.json> [beatIds] [progress]'); process.exit(1); }

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const src = (id) => path.join(spec.sourceDir, spec.sources[id]);
const OUT = path.join(process.cwd(), 'out', 'video-guide', 'preview');
fs.mkdirSync(OUT, { recursive: true });

const held = spec.beats.filter((b) => b.kind !== 'clip');
const targets = held.filter((b) => !only.length || only.includes(b.id));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: CANVAS.w, height: CANVAS.h } });

for (const beat of targets) {
  const route = routeAfter(src(beat.src), beat.at);
  const wantsArrow = beat.kind === 'arrow';
  const arrow = wantsArrow
    // the 16:9 band is only 608px tall inside a 1920px canvas, so source-space
    // widths have to be pushed up hard or the arrow reads as a hairline
    ? authorArrow(route, { steps: beat.arrows?.[0]?.mode === 'steps', thickness: 2.3,
                           stepCount: beat.arrows?.[0]?.steps })
    : null;

  const durationMs = (beat.hold ?? 5) * 1000;
  const html = buildScene({
    poi: { kicker: (spec.title?.en ?? '').toUpperCase(), title: beat.title ?? '', sub: beat.sub ?? '' },
    point: { n: held.indexOf(beat) + 1, of: held.length },
    caption: beat.caption ?? '',
    arrows: arrow ? [arrow] : [],
    durationMs,
    timing: beat.timing,
  });

  const htmlFile = path.join(OUT, `scene_${beat.id}.html`);
  fs.writeFileSync(htmlFile, html);
  await page.goto('file://' + htmlFile.replace(/\\/g, '/'));
  await page.waitForFunction(() => typeof window.__seek === 'function');
  await page.evaluate((ms) => window.__seek(ms), Math.round(durationMs * progress));
  const overlay = path.join(OUT, `ovl_${beat.id}.png`);
  await page.screenshot({ path: overlay, omitBackground: true });

  // graded still -> blurred full-bleed backdrop + sharp 16:9 band + overlay
  const still = path.join(OUT, `still_${beat.id}.jpg`);
  run(['-ss', String(beat.at), '-i', src(beat.src), '-frames:v', '1',
    '-vf', 'eq=saturation=1.12:gamma=1.01,unsharp=5:5:0.35:5:5:0', '-q:v', '2', still]);

  const out = path.join(OUT, `beat_${beat.id}.jpg`);
  run(['-i', still, '-i', overlay, '-filter_complex',
    `[0:v]scale=-2:${CANVAS.h},crop=${CANVAS.w}:${CANVAS.h},gblur=sigma=42,eq=brightness=-0.20:saturation=0.65[bg];`
    + `[0:v]scale=${BAND.w}:${BAND.h}[band];[bg][band]overlay=0:${BAND.y}[base];`
    + `[base][1:v]overlay=0:0[v]`,
    '-map', '[v]', '-frames:v', '1', '-q:v', '3', out]);

  console.log(`${beat.id}  route=${route.kind}${route.drift !== undefined ? ` drift=${route.drift}` : ''}` +
    `  arrow=${arrow ? arrow.mode + (arrow.corner ? ` corner@${(arrow.corner * 100).toFixed(0)}%` : '') : '없음'}  -> ${path.basename(out)}`);
}
await browser.close();

function run(args) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) { console.error('ffmpeg failed:', args.join(' ')); process.exit(1); }
}
