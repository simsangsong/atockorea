/**
 * F4/F5 — the renderer. Scene spec in, MP4 + WebVTT out.
 *
 * Structurally the tour pipeline with the live footage removed: Playwright
 * paints frames, `tpad=stop_mode=clone` holds the settled frame for the rest of
 * the beat, ffmpeg concatenates. The traps that pipeline paid for are inherited
 * on purpose and are marked 🔴 where they bite.
 *
 * Gates run BEFORE the encode, because a gate that runs after is a report, not
 * a gate:
 *   G-1  one accent    — no saturated colour outside the declared accent
 *   G-2  two registers — more than two font families means a silent fallback
 *   G-3  subtitle zone — burnt-in English must not enter the locale strip
 *   G-4  reading time  — every beat ≥ max(2.8s, chars/12)
 *   G-5  CJK           — zero breaks between two CJK characters (P1-5)
 *   G-6  shot freshness— every referenced shot exists and matches the manifest
 *   G-7  shell present — the composited frame is not silently empty
 *
 * Usage:
 *   node scripts/scene-video/build.mjs specs/app-guide-join.mjs [--wide] [--out file]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from '../video-guide/lib/deps.mjs';
import { renderSceneHtml } from './scene.mjs';
import { CANVAS, WIDE, FPS, TYPE, readingMs, palette } from './design.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const SPEC_PATH = args.find((a) => !a.startsWith('--'));
const WIDE_MODE = args.includes('--wide');
const argOf = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

if (!SPEC_PATH) {
  console.error('usage: node scripts/scene-video/build.mjs <spec.mjs> [--wide] [--out file]');
  process.exit(2);
}

/** 🔴 ffmpeg gets its own pipes — inheriting the parent's deadlocks on Windows. */
function ff(argv, label) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...argv],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    console.error(`🔴 ffmpeg failed (${label})\n${r.stderr?.toString().slice(0, 1200)}`);
    process.exit(1);
  }
}

const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;

/** Saturation of an sRGB hex, 0..1. Greys are ~0; the accent is not. */
function saturation(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function fail(msg) {
  console.error(`🔴 ${msg}`);
  process.exit(1);
}

const spec = (await import(pathToFileURL(path.resolve(SPEC_PATH)).href)).default;
const scenes = spec.scenes ?? [];
if (scenes.length === 0) fail('spec has no scenes');

const size = WIDE_MODE ? WIDE : CANVAS;
const OUT = path.resolve(ROOT, argOf('out', `scripts/scene-video/.out/${spec.id}${WIDE_MODE ? '-wide' : ''}.mp4`));
const WORK = path.join(path.dirname(OUT), `.work-${spec.id}${WIDE_MODE ? '-wide' : ''}`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });

// ── G-6: every referenced shot must exist, and be the one the stage captured ──
const shotsManifestPath = path.resolve(ROOT, spec.shots ?? 'scripts/scene-video/.shots/shots.json');
if (!fs.existsSync(shotsManifestPath)) {
  fail(`스크린샷 매니페스트가 없다: ${path.relative(ROOT, shotsManifestPath)}\n`
    + '   먼저: node scripts/scene-video/shots.mjs');
}
const shotsManifest = JSON.parse(fs.readFileSync(shotsManifestPath, 'utf8'));
const shotFile = (key) => {
  const entry = shotsManifest.shots?.[key];
  if (!entry) fail(`G-6: 스펙이 참조한 shot "${key}" 가 매니페스트에 없다`);
  const abs = path.resolve(ROOT, entry.file);
  if (!fs.existsSync(abs)) fail(`G-6: shot "${key}" 파일이 없다: ${entry.file}`);
  if (fs.statSync(abs).size !== entry.bytes) {
    fail(`G-6: shot "${key}" 가 매니페스트와 다르다 — 낡은 화면이 영상에 남는 것을 막는다`);
  }
  // The renderer needs the real shape, not just the bytes (see scene.mjs).
  return { file: abs, ratio: entry.ratio ?? null };
};

/** Resolve `shot: 'home'` keys to absolute paths the scene renderer can inline. */
function resolveShots(scene) {
  const out = { ...scene };
  if (out.shot) out.shot = shotFile(out.shot);
  if (Array.isArray(out.cards)) out.cards = out.cards.map((c) => ({ ...c, shot: c.shot ? shotFile(c.shot) : null }));
  return out;
}

const accentHexes = new Set([palette('light').accent.toLowerCase(), palette('dark').accent.toLowerCase()]);

console.log(`\n  ${spec.id}${WIDE_MODE ? ' (16:9)' : ' (9:16)'} · ${scenes.length} scenes\n`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: size.w, height: size.h },
  deviceScaleFactor: 1,
});
const segments = [];
const cues = [];
let clock = 0;

for (const raw of scenes) {
  const scene = resolveShots(raw);
  const html = renderSceneHtml(scene, { wide: WIDE_MODE, theme: spec.theme });

  // ── G-1: one accent. Checked on the source, where a second brand colour
  // would be introduced — not on pixels, where a screenshot's own colours
  // (which are legitimately the app's) would drown the signal.
  const scenePart = html.slice(html.indexOf('<body'));
  for (const hex of scenePart.match(HEX) ?? []) {
    const h = hex.toLowerCase();
    if (saturation(h) > 0.35 && !accentHexes.has(h)) {
      fail(`G-1 (${scene.id}): 액센트 외 채도색 ${h}`);
    }
  }

  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => window.__seek(5000));
  const m = await page.evaluate(() => window.__measure());

  if (m.fontFamilies.length > 2) fail(`G-2 (${scene.id}): 서체 ${m.fontFamilies.length}종 — ${m.fontFamilies.join(', ')}`);
  if (m.subtitleZoneIntruder) fail(`G-3 (${scene.id}): 하단 로케일 존 침범 — "${m.subtitleZoneIntruder}"`);
  if (m.cjkBroken.length) fail(`G-5 (${scene.id}): CJK 글자단위 줄바꿈 ${m.cjkBroken.length}건 — ${m.cjkBroken.join(' · ')}`);
  if (m.stageOverflow > 0) fail(`G-2 (${scene.id}): 스테이지 ${m.stageOverflow}px 넘침`);
  // 🔴 These budgets existed in design.mjs from the first commit and NOTHING
  // read them, so the first cut shipped three-line captions under a two-line
  // rule. A budget nobody checks is a comment.
  if (m.headlineLines > TYPE.headlineMaxLines) {
    fail(`G-2 (${scene.id}): 헤드라인 ${m.headlineLines}줄 > ${TYPE.headlineMaxLines}`);
  }
  if (m.captionLines > TYPE.captionMaxLines) {
    fail(`G-3 (${scene.id}): 자막 ${m.captionLines}줄 > ${TYPE.captionMaxLines} — 문장을 줄여라`);
  }

  // ── G-4: a beat must outlast its own text.
  const longest = [scene.headline, scene.sub, scene.caption, scene.note,
    ...(scene.cards ?? []).map((c) => `${c.title ?? ''} ${c.sub ?? ''}`),
    ...(scene.steps ?? [])].filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? '';
  const need = readingMs(longest) / 1000;
  const dur = Math.max(scene.dur ?? 0, need);
  if ((scene.dur ?? 0) > 0 && scene.dur + 0.05 < need) {
    console.log(`  · ${scene.id}: ${scene.dur}s → ${dur.toFixed(1)}s (G-4 가독 시간)`);
  }

  // ── frames: the entrance, then a few settled copies for tpad to clone.
  // 🔴 It must be SEVERAL frames. A single-frame %04d pattern composites
  // nothing at all — silently, no error, no dropped frames.
  const framesDir = path.join(WORK, `f_${scene.id}`);
  fs.mkdirSync(framesDir, { recursive: true });
  const nAnim = Math.round(Math.min(1.2, dur) * FPS);
  for (let i = 0; i < nAnim; i += 1) {
    await page.evaluate((ms) => window.__seek(ms), Math.round((i / FPS) * 1000));
    await page.screenshot({ path: path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`) });
  }
  await page.evaluate(() => window.__seek(5000));
  const settled = path.join(WORK, `settled_${scene.id}.png`);
  await page.screenshot({ path: settled });
  for (let i = nAnim; i < nAnim + 4; i += 1) {
    fs.copyFileSync(settled, path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`));
  }

  // ── G-7: the settled frame must not be blank. A composite that silently
  // produces an empty shell is this pipeline's classic failure (T-35).
  const stat = fs.statSync(settled);
  if (stat.size < 8000) fail(`G-7 (${scene.id}): 렌더된 셸이 사실상 비어 있다 (${stat.size}B)`);

  const seg = path.join(WORK, `seg_${scene.id}.mp4`);
  ff(['-framerate', String(FPS), '-i', path.join(framesDir, 'f_%04d.png'),
    '-filter_complex',
    `[0:v]tpad=stop_mode=clone:stop_duration=${dur.toFixed(3)},fps=${FPS},format=yuv420p[v]`,
    '-map', '[v]', '-t', dur.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', seg], `seg ${scene.id}`);
  segments.push(seg);

  if (scene.caption) cues.push({ start: clock, end: clock + dur, text: scene.caption });
  clock += dur;
  console.log(`  ${String(scene.id).padEnd(18)} ${scene.scene.padEnd(13)} ${dur.toFixed(1)}s`);
}
await browser.close();

const listFile = path.join(WORK, 'segments.txt');
fs.writeFileSync(listFile, segments.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', OUT], 'concat');

// ── F5: burnt-in English is already in the frame; the locale tracks are files.
const vttPath = OUT.replace(/\.mp4$/, '.en.vtt');
const ts = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = (s % 60).toFixed(3).padStart(6, '0');
  return `${h}:${m}:${sec}`;
};
fs.writeFileSync(vttPath, ['WEBVTT', '', ...cues.flatMap((c, i) =>
  [String(i + 1), `${ts(c.start)} --> ${ts(c.end)}`, c.text, ''])].join('\n'));

// A still from the middle, so a reviewer sees the thing without a player.
const poster = OUT.replace(/\.mp4$/, '.poster.png');
ff(['-ss', (clock / 2).toFixed(2), '-i', OUT, '-frames:v', '1', poster], 'poster');

const bytes = fs.statSync(OUT).size;
console.log(`\n  ✅ ${path.relative(ROOT, OUT)}  ${clock.toFixed(1)}s  ${(bytes / 1024 / 1024).toFixed(1)}MB`);
console.log(`     ${path.relative(ROOT, vttPath)} · ${path.relative(ROOT, poster)}`);
