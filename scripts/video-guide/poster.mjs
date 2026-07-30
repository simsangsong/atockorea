#!/usr/bin/env node
/**
 * Poster frames — one rigid template, every attraction (V6-D6).
 *
 * The measured lesson behind the rigidity: the reference channel's thumbnail
 * is identical every upload, recognisable at feed size. So the template is
 * code, not per-attraction taste: money frame, the claim in serif, the navy
 * chip. Two outputs: 1080×1920 (primary, matches the vertical product) and
 * 1280×720 (YouTube wide).
 *
 * The frame is re-extracted at full resolution from the spec's `poster`
 * timestamp (a contact-sheet time is a candidate, not a fact — K-2) and runs
 * through the same grade chain as the video, or the poster would advertise a
 * different look than the product.
 *
 * The claim on the poster IS the claim of the film: the first title-role
 * beat's title/sub. There is no separate poster copy to drift.
 *
 *   node scripts/video-guide/poster.mjs docs/video-specs/<slug>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from './lib/deps.mjs';
import { buildScene, CANVAS, BAND } from './scene.mjs';
import { promiseLineOf } from './lib/timeline.mjs';
import { gradeChain, BLUR_FILL } from './lib/grade.mjs';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: poster.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
if (!spec.poster) { console.error('spec.poster {src, at} 가 없다'); process.exit(1); }

const titleBeat = spec.beats.find((b) => b.role === 'title');
if (!titleBeat) { console.error('클레임(role:title) 비트가 없다 — 포스터 문안의 원천이다'); process.exit(1); }

const ROOT = process.cwd();
const WORK = path.join(ROOT, '.cache', 'video-guide', `${spec.slug}-poster`);
const OUTDIR = path.join(ROOT, 'out', 'video-guide');
fs.mkdirSync(WORK, { recursive: true });

const run = (args, label) => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24, encoding: 'utf8' });
  if (r.status !== 0) { console.error(`FAILED: ${label}`); process.exit(1); }
};
const fileUri = (p) => 'file:///' + p.replace(/\\/g, '/');

// full-res re-extract + the video's own grade
const frame = path.join(WORK, 'frame.png');
run(['-ss', String(spec.poster.at), '-i', path.join(spec.sourceDir, spec.sources[spec.poster.src]),
  '-frames:v', '1', '-vf', `${gradeChain(spec)},scale=1920:1080:flags=lanczos`, frame], 'frame');

const browser = await chromium.launch();

// ---- 9:16 — the vertical shell, settled, over the same bg/band composition --
const bg = path.join(WORK, 'bg.png');
run(['-i', frame, '-filter_complex',
  `[0:v]${BLUR_FILL(CANVAS.w, CANVAS.h)}[bg];`
  + `[0:v]scale=${BAND.w}:${BAND.h}[band];[bg][band]overlay=0:${BAND.y}`, bg], 'bg 9:16');

const page = await browser.newPage({ viewport: { width: CANVAS.w, height: CANVAS.h } });
const shellHtml = buildScene({
  role: 'title', title: titleBeat.title, sub: titleBeat.sub,
  chip: promiseLineOf(spec), kicker: (spec.title?.en ?? '').toUpperCase(),
  durationMs: 4000,
});
const shellFile = path.join(WORK, 'shell.html');
fs.writeFileSync(shellFile, shellHtml);
await page.goto(fileUri(shellFile));
await page.waitForFunction(() => typeof window.__seek === 'function');
await page.evaluate(() => window.__seek(5000));
// Same fit gate as the video shells — a poster with a wrapped-to-three title
// shipped on the very first run of this script.
const m = await page.evaluate(() => window.__measure());
if (m.topOverflow > 0 || m.titleLines > 2) {
  console.error(`FAIL poster: 타이틀 ${m.titleLines}줄 / 상단 넘침 ${m.topOverflow}px — 클레임을 줄여라`);
  process.exit(1);
}
const shell = path.join(WORK, 'shell.png');
await page.screenshot({ path: shell, omitBackground: true });

const poster916 = path.join(OUTDIR, `${spec.slug}-poster.jpg`);
run(['-i', bg, '-i', shell, '-filter_complex', '[0:v][1:v]overlay=0:0', '-frames:v', '1',
  '-q:v', '2', poster916], 'poster 9:16');

// ---- 16:9 — full-bleed frame, claim lower-left over a lifted gradient -------
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const wideHtml = `<!doctype html><html><head><meta charset="utf-8"/><style>
* { margin:0; box-sizing:border-box; }
html,body { width:1920px; height:1080px; background:transparent; overflow:hidden; }
.grad { position:absolute; inset:0;
  background:linear-gradient(to top, rgba(6,14,26,.82) 0%, rgba(6,14,26,.28) 34%, transparent 58%); }
.block { position:absolute; left:96px; right:96px; bottom:84px; color:#fff;
  font-family:'Segoe UI',sans-serif; }
.chip { display:inline-block; padding:10px 30px; border-radius:999px;
  background:rgba(13,95,116,.92); font-size:34px; font-weight:700; letter-spacing:.1em;
  margin-bottom:26px; }
h1 { font-family:Georgia,serif; font-size:104px; line-height:1.1; font-weight:700;
  letter-spacing:-.01em; text-shadow:0 4px 24px rgba(0,0,0,.5); max-width:1500px; }
p { margin-top:18px; font-size:46px; opacity:.94; text-shadow:0 2px 14px rgba(0,0,0,.5); }
</style></head><body>
<div class="grad"></div>
<div class="block"><span class="chip">${esc(promiseLineOf(spec))}</span>
<h1>${esc(titleBeat.title)}</h1><p>${esc(titleBeat.sub)}</p></div>
</body></html>`;
const widePage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const wideFile = path.join(WORK, 'wide.html');
fs.writeFileSync(wideFile, wideHtml);
await widePage.goto(fileUri(wideFile));
const wideShell = path.join(WORK, 'wide.png');
await widePage.screenshot({ path: wideShell, omitBackground: true });
await browser.close();

const posterWide = path.join(OUTDIR, `${spec.slug}-poster-wide.jpg`);
run(['-i', frame, '-i', wideShell, '-filter_complex',
  '[0:v][1:v]overlay=0:0,scale=1280:720:flags=lanczos', '-frames:v', '1', '-q:v', '2', posterWide],
  'poster 16:9');

console.log(`=> ${poster916}\n=> ${posterWide}`);
