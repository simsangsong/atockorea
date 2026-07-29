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
import { buildScene, buildWideScene, CANVAS, BAND, TYPE, WIDE, TYPE_WIDE } from './scene.mjs';
import { measuredTimeline, stopsOf, promiseLineOf, transitLabel, roleOf } from './lib/timeline.mjs';
import { BLUR_FILL } from './lib/grade.mjs';
import { sharp } from './lib/overlay.mjs';

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--'));
if (!specPath) { console.error('usage: vfull.mjs <spec.json> [--force]'); process.exit(1); }
const FORCE = argv.includes('--force');
// `--wide` dresses the same beats for 16:9. Both orientations share this loop,
// the cache, and every gate — only the canvas, the shell and the composition
// differ, so a fix to one can never quietly miss the other.
const WIDE_MODE = argv.includes('--wide');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const ROOT = process.cwd();
const MASTER = path.join(ROOT, 'out', 'video-guide', `${spec.slug}.mp4`);
if (!fs.existsSync(MASTER)) { console.error(`먼저 와이드 마스터를 렌더해야 한다: ${MASTER}`); process.exit(1); }
const WORK = path.join(ROOT, '.cache', 'video-guide', `${spec.slug}-${WIDE_MODE ? 'wfull' : 'vfull'}`);
const POLAROIDS = path.join(ROOT, '.cache', 'video-guide', spec.slug);
const OUT = path.join(ROOT, 'out', 'video-guide', `${spec.slug}-${WIDE_MODE ? 'wide' : 'vertical'}.mp4`);
fs.mkdirSync(WORK, { recursive: true });

const FRAME = WIDE_MODE ? WIDE : CANVAS;
const TYPESET = WIDE_MODE ? TYPE_WIDE : TYPE;
const sceneOf = WIDE_MODE ? buildWideScene : buildScene;
// the watermark row — the strip the shell-presence probe reads
const MARK = WIDE_MODE ? { y: 1026, h: 36 } : { y: 1846, h: 44 };

const FPS = 30;
const ENTRANCE = 2.0;            // entrance anims settle by ~1.8s (220+5·150+820ms)
const ANIMATED = new Set(['stop', 'title', 'promise', 'recap']);

/**
 * 🔴 ffmpeg gets its own pipes, never the parent's.
 *
 * With `stdio: 'inherit'` the child writes into whatever this process's stdout
 * is. Run under a harness that captures stdout to a pipe and drains it lazily,
 * that pipe fills, and the next write blocks — forever. It looks exactly like a
 * hung encode: the process is alive, memory climbs, CPU sits near zero, and a
 * two-second clip never finishes. Capturing the output here (and only printing
 * it on failure) means a full buffer can never stall the encode.
 */
const run = (args, label) => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`FAILED: ${label}\n${r.stderr ?? ''}`);
    process.exit(1);
  }
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
const page = await browser.newPage({ viewport: { width: FRAME.w, height: FRAME.h } });

const segs = [];
for (const row of tl.rows) {
  const beat = row.beat;
  const props = shellOf(beat);
  const seg = path.join(WORK, `v_${beat.id}.mp4`);
  // `v` covers everything the cache key cannot see — bump it whenever the
  // composition filter changes, or half the guide keeps the old look.
  // `scene` is bumped per orientation so a CSS change re-renders only that cut.
  const h = hashOf({ props, start: row.start, dur: row.dur, TYPESET,
    scene: WIDE_MODE ? 'w2' : 'v1', v: 6 });
  segs.push(seg);
  if (!FORCE && manifest[beat.id] === h && fs.existsSync(seg)) { console.log(`  ${beat.id}  cached`); continue; }

  const html = sceneOf({ ...props, durationMs: row.dur * 1000 });
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
  if (m.titleLines > TYPESET.titleMaxLines) bust.push(`타이틀 ${m.titleLines}줄`);
  if (m.captionLines > TYPESET.captionMaxLines) bust.push(`캡션 ${m.captionLines}줄`);
  if (bust.length) { console.error(`FAIL ${beat.id} (${props.role}): ${bust.join(' · ')}`); process.exit(1); }

  // The shell is ONE image sequence: the entrance frames where a role has an
  // entrance, then a few copies of the settled frame. `tpad` clones the last
  // one for the rest of the beat, so the sequence never has to be as long as
  // the beat — a seventeen-second stop would otherwise cost 525 PNGs.
  //
  // 🔴 It must be a sequence of SEVERAL frames. A single frame — whether fed
  // as `-i shell.png` or as a one-file `%04d` pattern — composites nothing at
  // all, silently, with no error and no dropped frames. Four is enough.
  const animated = ANIMATED.has(props.role) && row.dur > 0.8;
  const nAnim = animated ? Math.round(Math.min(ENTRANCE, row.dur) * FPS) : 0;
  const framesDir = path.join(WORK, `f_${beat.id}`);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const framePath = (i) => path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`);
  for (let i = 0; i < nAnim; i++) {
    await page.evaluate((ms) => window.__seek(ms), Math.round((i / FPS) * 1000));
    await page.screenshot({ path: framePath(i), omitBackground: true });
  }
  await page.evaluate(() => window.__seek(5000));
  const settled = path.join(WORK, `settled_${beat.id}.png`);
  await page.screenshot({ path: settled, omitBackground: true });
  for (let i = nAnim; i < nAnim + 4; i++) fs.copyFileSync(settled, framePath(i));

  // One overlay, one shell input. `tpad` holds the sequence's last frame for
  // the whole beat — `eof_action=repeat` does NOT (measured: the text vanishes
  // the instant the sequence runs out), and `-loop 1` on the input deadlocks.
  const inputs = ['-ss', String(row.start), '-t', String(row.dur), '-i', MASTER,
    '-framerate', String(FPS), '-i', path.join(framesDir, 'f_%04d.png')];
  // Vertical builds a room for the footage; wide IS the footage, full bleed.
  const base = WIDE_MODE
    ? `[0:v]scale=${WIDE.w}:${WIDE.h}[base];`
    : `[0:v]${BLUR_FILL(CANVAS.w, CANVAS.h)}[bg];`
      + `[0:v]scale=${BAND.w}:${BAND.h}[band];[bg][band]overlay=0:${BAND.y}[base];`;
  const filter = base
    + `[1:v]tpad=stop_mode=clone:stop_duration=${row.dur}[shell];`
    + `[base][shell]overlay=0:0:format=auto,fps=${FPS},format=yuv420p[v]`;

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

/**
 * Did the shell actually composite?
 *
 * One overlay form encoded cleanly — right duration, right beat count, exit 0 —
 * and produced a guide with no text on it at all. Nothing downstream noticed.
 * So the render is not finished until a pixel says the shell is there: the
 * watermark line sits at a fixed y in every shell over the darkest, smoothest
 * part of the frame, so its row band has high luma spread when text is present
 * and almost none when the overlay silently did nothing.
 */
// 🔴 Probe LATE in the beat, not early. The first version of this gate sampled
// one second in — inside the entrance animation — and passed a guide whose text
// disappeared the moment the entrance ended. The failure lives in the tail.
{
  const probeAt = tl.rows
    .filter((r) => roleOf(r.beat) === 'stop' && r.dur > 2)
    .map((r) => r.start + r.dur * 0.85);
  const bad = [];
  for (const at of [probeAt[0], probeAt[Math.floor(probeAt.length / 2)], probeAt[probeAt.length - 1]]) {
    if (at === undefined || at > outDur - 0.3) continue;
    const probe = path.join(WORK, 'shellcheck.png');
    run(['-ss', String(at), '-i', OUT, '-frames:v', '1',
      '-vf', `crop=${FRAME.w}:${MARK.h}:0:${MARK.y}`, probe], 'shell probe');
    const { data } = await sharp(probe).greyscale().raw().toBuffer({ resolveWithObject: true });
    let sum = 0, sum2 = 0;
    for (const v of data) { sum += v; sum2 += v * v; }
    const mean = sum / data.length;
    const sd = Math.sqrt(sum2 / data.length - mean * mean);
    console.log(`  셸 합성 σ=${sd.toFixed(1)} @${at.toFixed(1)}s`);
    if (sd < 6) bad.push(at.toFixed(1));
  }
  if (bad.length) {
    console.error(`셸이 합성되지 않았다 — 워터마크 줄 대비 부족 @${bad.join(', ')}s. 오버레이 필터를 확인하라`);
    process.exit(1);
  }
}
console.log(`\n=> ${OUT}  (${outDur.toFixed(1)}s, 마스터 ${masterDur.toFixed(1)}s, 비트 ${tl.rows.length})`);
