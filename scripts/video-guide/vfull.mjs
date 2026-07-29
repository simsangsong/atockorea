#!/usr/bin/env node
/**
 * The full-length vertical guide — the primary deliverable (V6-D1).
 *
 * Every beat of the finished wide master is lifted into the 1080×1920 shell:
 * blurred margins, the 16:9 band at y656, English wayfinding above, one
 * meaning line below (scene.mjs owns the zone contract and the presbyopia
 * floor). Lifting from the master — never re-rendering from source — keeps
 * grade and pacing identical across cuts by construction.
 *
 * Beat → master-time mapping goes through lib/timeline.mjs, which deducts the
 * dissolve overlaps; the naive cumulative sum drifted six seconds by the end
 * of the pilot timeline.
 *
 * Shell overlays are rendered as an entrance sequence (~2s) plus one settled
 * frame that loops for the rest of the beat — NOT one screenshot per output
 * frame, which would be ~6,400 Playwright shots for a four-minute guide
 * (trap T-17). Roles that only carry static chrome (transit, clean) skip the
 * entrance entirely so the kicker does not re-animate on every cut.
 *
 * The render fails on any measured text overflow (__measure): more than two
 * lines, or a zone bust — which is also what catches a silent font fallback.
 *
 *   node scripts/video-guide/vfull.mjs docs/video-specs/<slug>.json [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { buildScene, CANVAS, BAND, TYPE } from './scene.mjs';
import { measuredTimeline, stopsOf, promiseLineOf, transitLabel, roleOf } from './lib/timeline.mjs';

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--'));
if (!specPath) { console.error('usage: vfull.mjs <spec.json> [--force]'); process.exit(1); }
const FORCE = argv.includes('--force');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const ROOT = process.cwd();
const MASTER = path.join(ROOT, 'out', 'video-guide', `${spec.slug}.mp4`);
if (!fs.existsSync(MASTER)) { console.error(`먼저 와이드 마스터를 렌더해야 한다: ${MASTER}`); process.exit(1); }
const WORK = path.join(ROOT, '.cache', 'video-guide', `${spec.slug}-vfull`);
const POLAROIDS = path.join(ROOT, '.cache', 'video-guide', spec.slug);
const OUT = path.join(ROOT, 'out', 'video-guide', `${spec.slug}-vertical.mp4`);
fs.mkdirSync(WORK, { recursive: true });

const FPS = 30;
const ENTRANCE = 2.0;            // entrance anims settle by ~1.8s (220+5·150+820ms)
const ANIMATED = new Set(['stop', 'title', 'promise', 'recap']);

const run = (args, label) => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) { console.error(`FAILED: ${label}`); process.exit(1); }
};
const probeDur = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', f]);
  return Number(String(r.stdout).trim()) || 0;
};

// ---- timeline sanity: the map must be MEASURED off this exact encode --------
const tl = measuredTimeline(spec, path.join(ROOT, 'out', 'video-guide'));
if (!tl) {
  console.error('실측 타임라인이 없다/스펙과 안 맞는다 — build.mjs 를 다시 돌려 timeline.json 을 뽑아라');
  process.exit(1);
}
const masterDur = probeDur(MASTER);
if (Math.abs(masterDur - tl.total) > 0.8) {
  console.error(`타임라인 불일치: 마스터 ${masterDur.toFixed(2)}s vs 실측 기록 ${tl.total.toFixed(2)}s — ` +
    `마스터가 이 timeline.json 과 같은 빌드인지부터 확인하라`);
  process.exit(1);
}

const stops = stopsOf(spec);
const kicker = (spec.title?.en ?? '').toUpperCase();
const fileUri = (p) => 'file:///' + p.replace(/\\/g, '/');

/** Shell props for one beat — everything scene.mjs needs, nothing else. */
function shellOf(beat) {
  const role = roleOf(beat);
  if (role === 'title') return { role, title: beat.title, sub: beat.sub };
  if (role === 'promise') return { role, kicker, chip: promiseLineOf(spec), caption: 'Ends where it starts.' };
  if (role === 'recap') {
    const prints = ['14', '16', '19p', '26']
      .map((id) => path.join(POLAROIDS, `polaroid_${id}.png`))
      .filter((p) => fs.existsSync(p)).map(fileUri);
    return { role, title: beat.title, sub: beat.sub, prints,
      caption: `${stops.length} stops · full circle` };
  }
  if (role === 'stop') {
    const n = stops.indexOf(beat) + 1;
    return { role, kicker, point: { n, of: stops.length },
      title: beat.stopLabel?.title ?? beat.title, sub: beat.stopLabel?.sub ?? beat.sub,
      caption: beat.caption };
  }
  if (role === 'transit') return { role, kicker, chip: transitLabel(beat.out - beat.in) };
  return { role, kicker };                                   // clean
}

// ---- render shells ----------------------------------------------------------
const manifestPath = path.join(WORK, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const hashOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: CANVAS.w, height: CANVAS.h } });

const segs = [];
for (const row of tl.rows) {
  const beat = row.beat;
  const props = shellOf(beat);
  const seg = path.join(WORK, `v_${beat.id}.mp4`);
  const h = hashOf({ props, start: row.start, dur: row.dur, TYPE, v: 3 });
  segs.push(seg);
  if (!FORCE && manifest[beat.id] === h && fs.existsSync(seg)) { console.log(`  ${beat.id}  cached`); continue; }

  const html = buildScene({ ...props, durationMs: row.dur * 1000 });
  const htmlFile = path.join(WORK, `s_${beat.id}.html`);
  fs.writeFileSync(htmlFile, html);
  await page.goto(fileUri(htmlFile));
  await page.waitForFunction(() => typeof window.__seek === 'function');

  // Text must fit its zone — measured, not eyeballed. Catches overlong copy
  // AND a silently substituted font (both change the box).
  await page.evaluate(() => window.__seek(5000));
  const m = await page.evaluate(() => window.__measure());
  const bust = [];
  if (m.topOverflow > 0) bust.push(`상단 존 넘침 ${m.topOverflow}px`);
  if (m.bottomOverflow > 0) bust.push(`하단 존 넘침 ${m.bottomOverflow}px`);
  if (m.titleLines > TYPE.titleMaxLines) bust.push(`타이틀 ${m.titleLines}줄`);
  if (m.captionLines > TYPE.captionMaxLines) bust.push(`캡션 ${m.captionLines}줄`);
  if (bust.length) { console.error(`FAIL ${beat.id} (${props.role}): ${bust.join(' · ')}`); process.exit(1); }

  const animated = ANIMATED.has(props.role) && row.dur > 0.8;
  const animSec = animated ? Math.min(ENTRANCE, row.dur) : 0;
  const nAnim = Math.round(animSec * FPS);
  const framesDir = path.join(WORK, `f_${beat.id}`);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  for (let i = 0; i < nAnim; i++) {
    await page.evaluate((ms) => window.__seek(ms), Math.round((i / FPS) * 1000));
    await page.screenshot({ path: path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`), omitBackground: true });
  }
  await page.evaluate(() => window.__seek(5000));
  const settled = path.join(WORK, `settled_${beat.id}.png`);
  await page.screenshot({ path: settled, omitBackground: true });

  const inputs = ['-ss', String(row.start), '-t', String(row.dur), '-i', MASTER];
  let filter =
    `[0:v]scale=-2:${CANVAS.h},crop=${CANVAS.w}:${CANVAS.h},gblur=sigma=44,` +
    `eq=brightness=-0.22:saturation=0.6[bg];` +
    `[0:v]scale=${BAND.w}:${BAND.h}[band];[bg][band]overlay=0:${BAND.y}[base];`;
  let next = 1;
  if (nAnim > 0) {
    inputs.push('-framerate', String(FPS), '-i', path.join(framesDir, 'f_%04d.png'));
    filter += `[base][${next}:v]overlay=0:0:eof_action=pass[wa];`;
    next++;
  } else {
    filter += `[base]null[wa];`;
  }
  inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(row.dur), '-i', settled);
  filter += `[wa][${next}:v]overlay=0:0:enable='gte(t,${animSec.toFixed(2)})',fps=${FPS},format=yuv420p[v]`;

  run([...inputs, '-filter_complex', filter, '-map', '[v]', '-map', '0:a?',
    '-t', String(row.dur), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', seg], `vfull ${beat.id}`);

  manifest[beat.id] = h;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  ${beat.id}  ${props.role.padEnd(7)} ${String(row.dur.toFixed(1)).padStart(6)}s  @${row.start.toFixed(1)}`);
}
await browser.close();

const list = path.join(WORK, 'concat.txt');
fs.writeFileSync(list, segs.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], 'concat');

const outDur = probeDur(OUT);
if (Math.abs(outDur - masterDur) > 1.2) {
  console.error(`길이 불일치: 세로 ${outDur.toFixed(2)}s vs 마스터 ${masterDur.toFixed(2)}s`);
  process.exit(1);
}
console.log(`\n=> ${OUT}  (${outDur.toFixed(1)}s, 마스터 ${masterDur.toFixed(1)}s, 비트 ${tl.rows.length})`);
