#!/usr/bin/env node
/**
 * The 90-second vertical cut.
 *
 * Built from the finished wide master rather than re-rendering from source: the
 * grade, the pacing and the speed ramps are already correct there, so the vertical
 * only has to choose the highlights and dress them. Picking segments off the
 * master also means the two cuts can never drift apart.
 *
 * Layout follows assets/howto/poi-overlay-yonggungsa-p5.html — 1080x1920, the
 * 16:9 band at y656, caption block above, protection line below — with the
 * margins filled by a blurred copy of the same frame rather than left dead.
 *
 *   node scripts/video-guide/vertical.mjs docs/video-specs/<slug>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { buildScene, CANVAS, BAND } from './scene.mjs';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: vertical.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const ROOT = process.cwd();
const MASTER = path.join(ROOT, 'out', 'video-guide', `${spec.slug}.mp4`);
if (!fs.existsSync(MASTER)) { console.error(`먼저 가로 마스터를 렌더해야 한다: ${MASTER}`); process.exit(1); }
const WORK = path.join(ROOT, '.cache', 'video-guide', `${spec.slug}-vertical`);
const OUT = path.join(ROOT, 'out', 'video-guide', `${spec.slug}-vertical.mp4`);
fs.mkdirSync(WORK, { recursive: true });

const FPS = 30;
const run = (args, label) => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) { console.error(`FAILED: ${label}`); process.exit(1); }
};

// Where each beat lands in the master, so highlights can be lifted by beat id.
const offsets = {};
let t = 0;
for (const b of spec.beats) {
  offsets[b.id] = t;
  t += b.kind === 'clip' ? (b.out - b.in) / (b.speed ?? 1) : b.hold;
}

// The shorts cut is the stops plus the two views worth standing still for.
const PICKS = (spec.verticalPicks ?? spec.beats
  .filter((b) => b.kind !== 'clip' || (b.speed ?? 1) <= 1.05)
  .map((b) => b.id));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: CANVAS.w, height: CANVAS.h } });
const held = spec.beats.filter((b) => b.kind !== 'clip');
const parts = [];
let used = 0;
const BUDGET = spec.verticalSeconds ?? 90;

for (const id of PICKS) {
  if (used >= BUDGET) break;
  const beat = spec.beats.find((b) => b.id === id);
  if (!beat) continue;
  const full = beat.kind === 'clip' ? (beat.out - beat.in) / (beat.speed ?? 1) : beat.hold;
  const take = Math.min(full, beat.kind === 'clip' ? 6 : full, BUDGET - used);
  if (take < 1.2) continue;

  // overlay: title block, caption, watermark — arrows stay out of the shorts cut
  const html = buildScene({
    poi: { kicker: (spec.title?.en ?? '').toUpperCase(), title: beat.title ?? '', sub: beat.sub ?? '' },
    point: beat.kind !== 'clip' ? { n: held.indexOf(beat) + 1, of: held.length } : null,
    caption: beat.caption ?? '',
    arrows: [],
    durationMs: take * 1000,
  });
  const htmlFile = path.join(WORK, `s_${id}.html`);
  fs.writeFileSync(htmlFile, html);
  await page.goto('file://' + htmlFile.replace(/\\/g, '/'));
  await page.waitForFunction(() => typeof window.__seek === 'function');

  const frames = path.join(WORK, `f_${id}`);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const n = Math.round(take * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((ms) => window.__seek(ms), Math.round((i / FPS) * 1000));
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`), omitBackground: true });
  }

  const seg = path.join(WORK, `v_${id}.mp4`);
  run(['-ss', String(offsets[id] + 0.05), '-t', String(take), '-i', MASTER,
    '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'),
    '-filter_complex',
    `[0:v]scale=-2:${CANVAS.h},crop=${CANVAS.w}:${CANVAS.h},gblur=sigma=44,eq=brightness=-0.22:saturation=0.6[bg];`
    + `[0:v]scale=${BAND.w}:${BAND.h}[band];[bg][band]overlay=0:${BAND.y}[base];`
    + `[base][1:v]overlay=0:0,fps=${FPS},format=yuv420p[v]`,
    '-map', '[v]', '-map', '0:a', '-t', String(take),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', seg], `vertical ${id}`);

  parts.push(seg);
  used += take;
  console.log(`  ${id}  ${take.toFixed(1)}s  ${beat.title ?? ''}`);
}
await browser.close();

const list = path.join(WORK, 'concat.txt');
fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], 'concat');
console.log(`\n=> ${OUT}  (${used.toFixed(0)}s, ${parts.length} segments)`);
