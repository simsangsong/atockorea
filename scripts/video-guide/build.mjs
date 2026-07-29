#!/usr/bin/env node
/**
 * One-take walkthrough -> guided route video.
 *
 *   node scripts/video-guide/build.mjs docs/video-specs/<slug>.json [options]
 *
 *   --only 05,13     rebuild just these beats (everything else comes from cache)
 *   --theme pearl    arrow palette (default: spec.theme, else pearl)
 *   --locale ko      burn this locale's caption for review; `none` ships the master
 *   --draft          half resolution, fast preset — for checking structure
 *
 * The spec is the only thing that changes per attraction. See
 * docs/onetake-tour-video-edit-master-plan-2026-07-29.md
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { renderArrowFrames, renderPolaroid, pathLuma, sharp } from './lib/overlay.mjs';

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--'));
if (!specPath) { console.error('usage: build.mjs <spec.json> [--only ids] [--theme t] [--draft]'); process.exit(1); }
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const has = (name) => argv.includes(`--${name}`);

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const DRAFT = has('draft');
const FPS = spec.output?.fps ?? 30;
const OUT_W = DRAFT ? 960 : (spec.output?.width ?? 1920);
const OUT_H = DRAFT ? 540 : (spec.output?.height ?? 1080);
const THEME = flag('theme', spec.theme ?? 'pearl');
const ONLY = flag('only', null)?.split(',').map((s) => s.trim());

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.cache', 'video-guide', spec.slug);
const OUTDIR = path.join(ROOT, 'out', 'video-guide');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUTDIR, { recursive: true });

const GRADE = (Array.isArray(spec.grade) ? spec.grade.join(',') : spec.grade) ?? [
  'eq=saturation=1.12:gamma=1.01',
  "curves=all='0/0 0.22/0.19 0.5/0.51 0.78/0.82 1/1'",
  'colorbalance=rh=0.020:bh=-0.018:rm=0.008:bm=-0.008',
  'unsharp=5:5:0.40:5:5:0.0',
  'vignette=a=PI/5.5',
].join(',');

const VSCALE = `scale=${OUT_W}:${OUT_H}:flags=lanczos,setsar=1,format=yuv420p`;
const VENC = DRAFT
  ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26']
  // crf 18 on this footage lands around 21 Mbps (dense foliage eats bitrate) — 800 MB for
  // five minutes, which is unusable for delivery. crf 20 + a cap is visually the same.
  : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '9M', '-bufsize', '18M'];
const AENC = ['-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k'];

function run(args, label) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (r.status !== 0) { console.error(`\nFAILED: ${label}\n  ffmpeg ${args.join(' ')}`); process.exit(1); }
}

const srcFile = (id) => path.join(spec.sourceDir, spec.sources[id]);
const hashOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o) + GRADE + OUT_W + THEME).digest('hex').slice(0, 12);

const manifestPath = path.join(CACHE, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

/** A moving segment, optionally time-compressed. */
function renderClip(beat, out) {
  const dur = +(beat.out - beat.in).toFixed(3);
  const speed = beat.speed ?? 1;
  const outDur = +(dur / speed).toFixed(3);
  const vf = `${GRADE},setpts=PTS/${speed},fps=${FPS},${VSCALE}`;
  const args = ['-ss', String(beat.in), '-t', String(dur), '-i', srcFile(beat.src)];
  const maps = [];
  if (speed <= 2.0 && !beat.mute) {
    maps.push('-map', '0:v', '-map', '0:a',
      '-af', `atempo=${speed},highpass=f=110,volume=${beat.gain ?? 0.8}`);
  } else {
    args.push('-f', 'lavfi', '-t', String(outDur), '-i', 'anullsrc=r=48000:cl=stereo');
    maps.push('-map', '0:v', '-map', '1:a');
  }
  run([...args, '-vf', vf, ...maps, '-t', String(outDur), ...VENC, ...AENC, out], `clip ${beat.id}`);
  return outDur;
}

/** Pull one graded still — the base for every held beat. */
function grabStill(beat, still) {
  run(['-ss', String(beat.at), '-i', srcFile(beat.src), '-frames:v', '1',
    '-vf', `${GRADE},${VSCALE}`, '-q:v', '2', still], `still ${beat.id}`);
}

/** A held frame: arrows, a polaroid, or a slow push. Always silent. */
async function renderHold(beat, out) {
  const dur = beat.hold;
  const still = path.join(CACHE, `still_${beat.id}.png`);
  grabStill(beat, still);

  const inputs = ['-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', still];
  let filter = '[0:v]';
  let next = 1;

  if (beat.kind === 'closeup') {
    const z = beat.zoom ?? 1.55, cx = beat.cx ?? 0.5, cy = beat.cy ?? 0.5;
    filter += `crop=w='iw/(1+${(z - 1).toFixed(3)}*min(t/${dur},1))':h='ih/(1+${(z - 1).toFixed(3)}*min(t/${dur},1))':`
      + `x='(iw-out_w)*${cx}':y='(ih-out_h)*${cy}',${VSCALE}[v];`;
  } else if (beat.kind === 'polaroid') {
    const card = path.join(CACHE, `polaroid_${beat.id}.png`);
    await renderPolaroid({ framePath: still, outFile: card, opts: beat.polaroid ?? {} });
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', card);
    // shutter: a fast white bloom, then the scene settles back a touch so the print pops
    filter += `eq=brightness='if(lt(t,0.14),(0.14-t)*5.5,-0.055)':saturation=0.92:eval=frame[bg];`
      + `[${next}:v]scale=${OUT_W}:${OUT_H},fade=t=in:st=0.14:d=0.40:alpha=1[card];`
      + `[bg][card]overlay=0:0:format=auto,${VSCALE}[v];`;
    next++;
  } else {
    const seqDir = path.join(CACHE, `ovl_${beat.id}`);
    const luma = await pathLuma(still, beat.arrows ?? []);
    await renderArrowFrames({ outDir: seqDir, beat, fps: FPS, duration: dur, themeName: THEME, luma });
    inputs.push('-framerate', String(FPS), '-i', path.join(seqDir, 'f_%04d.png'));
    filter += `null[bg];[${next}:v]scale=${OUT_W}:${OUT_H}[ovl];[bg][ovl]overlay=0:0:format=auto,${VSCALE}[v];`;
    next++;
  }

  inputs.push('-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=48000:cl=stereo');
  run([...inputs, '-filter_complex', filter.replace(/;$/, ''), '-map', '[v]', '-map', `${next}:a`,
    '-t', String(dur), '-r', String(FPS), ...VENC, ...AENC, out], `hold ${beat.id}`);
  return dur;
}

// ---- build ------------------------------------------------------------------
const parts = [];
let total = 0;
for (const beat of spec.beats) {
  const out = path.join(CACHE, `beat_${beat.id}.mp4`);
  const h = hashOf(beat);
  const stale = manifest[beat.id] !== h || !fs.existsSync(out);
  const selected = !ONLY || ONLY.includes(beat.id);

  if (stale && !selected) {
    console.warn(`  ! beat ${beat.id} is stale but not in --only; using old cache`);
  }
  if ((stale && selected) || (selected && ONLY)) {
    const dur = beat.kind === 'clip' ? renderClip(beat, out) : await renderHold(beat, out);
    manifest[beat.id] = h;
    console.log(`  ${beat.id}  ${beat.kind.padEnd(8)} ${String(dur).padStart(6)}s  ${beat.note ?? ''}`);
  } else if (!fs.existsSync(out)) {
    const dur = beat.kind === 'clip' ? renderClip(beat, out) : await renderHold(beat, out);
    manifest[beat.id] = h;
    console.log(`  ${beat.id}  ${beat.kind.padEnd(8)} ${String(dur).padStart(6)}s  ${beat.note ?? ''}`);
  } else {
    console.log(`  ${beat.id}  cached`);
  }
  parts.push(out);
  total += beat.kind === 'clip' ? (beat.out - beat.in) / (beat.speed ?? 1) : beat.hold;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const listFile = path.join(CACHE, 'concat.txt');
fs.writeFileSync(listFile, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

const silent = path.join(CACHE, 'joined.mp4');
run(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent], 'concat');

const finalOut = path.join(OUTDIR, `${spec.slug}${DRAFT ? '-draft' : ''}.mp4`);
const bed = spec.audio?.bed && fs.existsSync(spec.audio.bed) ? spec.audio.bed : null;
if (bed) {
  run(['-i', silent, '-stream_loop', '-1', '-i', bed,
    '-filter_complex',
    `[0:a]highpass=f=110,loudnorm=I=-22:TP=-2:LRA=11[amb];`
    + `[1:a]volume=${spec.audio.bedGain ?? 0.5},afade=t=in:st=0:d=2[bed];`
    + `[bed][amb]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', ...AENC, '-shortest',
    '-movflags', '+faststart', finalOut], 'mix bed');
} else {
  run(['-i', silent, '-af', 'highpass=f=110,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:v', 'copy', ...AENC, '-movflags', '+faststart', finalOut], 'master audio');
}

console.log(`\n=> ${finalOut}`);
console.log(`   beats ${spec.beats.length} · planned ${Math.round(total)}s (${(total / 60).toFixed(1)}min)`
  + (bed ? '' : '   [no music bed — set spec.audio.bed]'));
