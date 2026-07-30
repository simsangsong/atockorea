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
import {
  CANVAS, WIDE, FPS, TYPE, THEMES, DEFAULT_THEME, CJK_LOCALES,
  MOTION, motionFloorMs, readingMs, palette,
} from './design.mjs';

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

/**
 * 🔴 A guard for a trap this pipeline fell into THREE times.
 *
 * `scene.mjs` returns one enormous template literal, so a backtick written
 * casually inside a CSS or JS comment nested in it terminates the string. The
 * failure surfaces as a module-load SyntaxError pointing at an innocent line,
 * which costs several minutes of hunting every time. Checking it here means the
 * build says what actually happened.
 */
function assertSceneModuleLoadable() {
  const scenePath = path.resolve(ROOT, 'scripts/scene-video/scene.mjs');
  const src = fs.readFileSync(scenePath, 'utf8');
  const inner = src.slice(src.indexOf('<!doctype html>'));
  const stray = inner
    .split('\n')
    .filter((line) => /^\s*(\/\/|\/\*|\*)/.test(line) && line.includes('`'));
  if (stray.length) {
    const lines = stray.map((l) => `   ${l.trim()}`).join('\n');
    fail(`scene.mjs: 템플릿 리터럴 안의 주석에 백틱이 있다 — 문자열이 거기서 끊긴다\n${lines}`);
  }
}
assertSceneModuleLoadable();

const spec = (await import(pathToFileURL(path.resolve(SPEC_PATH)).href)).default;
const scenes = spec.scenes ?? [];
if (scenes.length === 0) fail('spec has no scenes');

// v3 — the film is built PER LOCALE: English headline, that locale's gloss
// beneath it (owner brief §V3-A). English renders with no gloss line at all.
const LOCALE = argOf('locale', spec.defaultLocale ?? 'en');
const THEME = argOf('theme', spec.theme ?? DEFAULT_THEME);
if (!THEMES[THEME]) fail(`unknown theme "${THEME}" — ${Object.keys(THEMES).join(' | ')}`);

const size = WIDE_MODE ? WIDE : CANVAS;
const suffix = `${LOCALE === 'en' ? '' : `.${LOCALE}`}${WIDE_MODE ? '-wide' : ''}`;
const OUT = path.resolve(ROOT, argOf('out', `scripts/scene-video/.out/${spec.id}${suffix}.mp4`));
const WORK = path.join(path.dirname(OUT), `.work-${spec.id}${suffix}`);
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

// ── G-9: recorded clips referenced by `screen-demo` scenes ────────────────────
const clipsManifestPath = path.resolve(ROOT, spec.clips ?? 'scripts/scene-video/.clips/clips.json');
const clipsManifest = fs.existsSync(clipsManifestPath)
  ? JSON.parse(fs.readFileSync(clipsManifestPath, 'utf8'))
  : { clips: {} };
const clipFile = (key) => {
  const entry = clipsManifest.clips?.[key];
  if (!entry) {
    fail(`G-9: 스펙이 참조한 클립 "${key}" 가 없다 — 먼저 node scripts/scene-video/recordings.mjs`);
  }
  const abs = path.resolve(ROOT, entry.file);
  if (!fs.existsSync(abs)) fail(`G-9: 클립 "${key}" 파일이 없다: ${entry.file}`);
  return { file: abs, seconds: entry.seconds ?? 0, what: entry.what };
};

/**
 * Resolve asset keys and pick this locale's gloss.
 *
 * A spec writes `gloss: { ko: '…', ja: '…' }` and the builder takes the one for
 * the render locale. English gets none — the headline already IS English, and a
 * gloss repeating it would be the v2 mistake (the same sentence twice, so
 * neither gets read).
 */
function resolveScene(scene) {
  const out = { ...scene };
  if (out.shot) out.shot = shotFile(out.shot);
  if (out.clip) out.clipInfo = clipFile(out.clip);
  if (Array.isArray(out.cards)) {
    out.cards = out.cards.map((c) => ({
      ...c,
      shot: c.shot ? shotFile(c.shot) : null,
      gloss: LOCALE === 'en' ? null : c.gloss?.[LOCALE] ?? null,
    }));
  }
  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((st) => {
      if (!Array.isArray(st)) return st;
      const [en, glossMap] = st;
      return LOCALE === 'en' ? [en, null] : [en, glossMap?.[LOCALE] ?? null];
    });
  }
  // v5 primitives — every drawn element resolves its gloss the same way, so a
  // new scene type cannot quietly ship a Korean line into the German film.
  const glossOf = (map) => (LOCALE === 'en' ? null : map?.[LOCALE] ?? null);
  if (Array.isArray(out.items)) {
    out.items = out.items.map((it) => ({ ...it, gloss: glossOf(it.glossMap ?? it.gloss) }));
  }
  if (Array.isArray(out.nodes)) {
    out.nodes = out.nodes.map((n) => ({ ...n, gloss: glossOf(n.gloss) }));
  }
  if (out.note) {
    out.note = { ...out.note, gloss: glossOf(out.note.gloss) };
  }
  out.gloss = LOCALE === 'en' ? null : scene.gloss?.[LOCALE] ?? null;
  return out;
}


/**
 * G-10 (§V4-C) — the English is read by people whose first language is not
 * English, so it is held to plain-language rules rather than to whether it
 * sounds good to a native ear.
 *
 * v3 shipped "a nudge before time", "emergency lives in one place" and "every
 * stop introduces itself". Each is fine English and each is an idiom or a
 * personification — the two things a non-native reader stumbles on hardest.
 * The list below is the ones already caught; add to it rather than trusting
 * anyone (including a later model) to remember the rule.
 */
const IDIOMS = [
  'nudge', 'lives in', 'introduces itself', 'explains itself', 'at a glance',
  'on the go', 'hand it to', 'a breeze', 'sorted', 'good to go', 'heads up',
  'reach out', 'drop us a line', 'in no time', 'hassle', 'kick off', 'wrap up',
];
const MAX_WORDS_PER_SENTENCE = 8;

function checkPlainEnglish(scene) {
  const strings = [
    ['headline', scene.headline],
    ...(scene.cards ?? []).map((c, i) => [`card ${i + 1}`, c.title]),
    ...(scene.steps ?? []).map((st, i) => [`step ${i + 1}`, Array.isArray(st) ? st[0] : st]),
    ...(scene.items ?? []).map((it, i) => [`item ${i + 1}`, it.title]),
    ...(scene.nodes ?? []).map((n, i) => [`node ${i + 1}`, n.title]),
    ...(scene.note ? [['note', scene.note.title], ['note-under', scene.note.under]] : []),
    // Bubbles: only the English ones — a Korean bubble IS the point of the scene.
    ...(scene.bubbles ?? []).filter((b) => !b.cjk).map((b, i) => [`bubble ${i + 1}`, b.text]),
  ].filter(([, v]) => typeof v === 'string' && v.trim());

  for (const [where, text] of strings) {
    const flat = text.split('\n').join(' ');
    const low = flat.toLowerCase();
    for (const idiom of IDIOMS) {
      if (low.includes(idiom)) {
        fail(`G-10 (${scene.id}/${where}): 관용구 "${idiom}" — 비원어민이 읽는 영어다\n   "${flat}"`);
      }
    }
    for (const sentence of flat.split(/[.?!]/).map((x) => x.trim()).filter(Boolean)) {
      const words = sentence.split(/\s+/).length;
      if (words > MAX_WORDS_PER_SENTENCE) {
        fail(`G-10 (${scene.id}/${where}): 한 문장 ${words}단어 > ${MAX_WORDS_PER_SENTENCE}\n   "${sentence}"`);
      }
    }
  }
}

const accentHexes = new Set(Object.values(THEMES).map((t) => t.accent.toLowerCase()));

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
  const scene = resolveScene(raw);
  checkPlainEnglish(scene);
  const html = renderSceneHtml(scene, { wide: WIDE_MODE, theme: THEME, locale: LOCALE });

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

  // ── G-2 v3: two ROLES, not two raw families. The CJK gloss is the display
  // role in a script the Latin face cannot draw, so it is excluded by the
  // measure; a decorative third face still lands here.
  if (m.displayFamilies.length > 1) {
    fail(`G-2 (${scene.id}): 디스플레이 서체 ${m.displayFamilies.length}종 — ${m.displayFamilies.join(', ')}`);
  }
  if (m.roles.length > 2) fail(`G-2 (${scene.id}): 타입 역할 ${m.roles.length} — ${m.roles.join(', ')}`);
  // ── G-3 v3: nothing is burnt at the bottom any more, so the band must be
  // empty rather than merely uncrowded.
  if (m.subtitleZoneIntruder) fail(`G-3 (${scene.id}): 하단 자막 존 침범 — "${m.subtitleZoneIntruder}"`);
  if (m.cjkBroken.length) fail(`G-5 (${scene.id}): CJK 글자단위 줄바꿈 ${m.cjkBroken.length}건 — ${m.cjkBroken.join(' · ')}`);
  if (m.stageOverflow > 0) fail(`G-2 (${scene.id}): 스테이지 ${m.stageOverflow}px 넘침`);
  // 🔴 These budgets existed in design.mjs from the first commit and NOTHING
  // read them, so the first cut shipped three-line captions under a two-line
  // rule. A budget nobody checks is a comment.
  if (m.headlineLines > TYPE.headlineMaxLines) {
    fail(`G-2 (${scene.id}): 헤드라인 ${m.headlineLines}줄 > ${TYPE.headlineMaxLines}`);
  }
  if (m.glossLines > TYPE.glossMaxLines) {
    fail(`G-3 (${scene.id}): 해석 줄 ${m.glossLines}줄 > ${TYPE.glossMaxLines} — 문장을 줄여라`);
  }
  // ── G-8 v3: no italic (owner brief).
  if (m.italics.length) fail(`G-8 (${scene.id}): italic ${m.italics.length}건 — ${m.italics.join(' · ')}`);
  // ── G-9: a demo scene must have a clip, and the clip must cover the beat.
  if (scene.scene === 'screen-demo') {
    if (!scene.clipInfo) fail(`G-9 (${scene.id}): screen-demo 인데 clip 이 없다`);
    if (!m.clipBox) fail(`G-9 (${scene.id}): 클립이 들어갈 구멍을 못 찾았다`);
  }

  // ── G-4: a beat must outlast its own text.
  const longest = [scene.headline, scene.gloss, scene.sub,
    ...(scene.cards ?? []).map((c) => `${c.title ?? ''} ${c.gloss ?? ''}`),
    ...(scene.steps ?? []).map((st) => (Array.isArray(st) ? st.filter(Boolean).join(' ') : st)),
  ].filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? '';
  const need = readingMs(longest) / 1000;
  // A demo beat must also outlast its own recording, or the clip is cut off
  // mid-gesture and the transition it exists to show never completes.
  const clipNeed = scene.clipInfo ? scene.clipInfo.seconds : 0;
  // …and it must outlast its own MOTION. A beat shorter than arrive+hold+leave
  // gets one of those truncated, which is exactly the abruptness the grammar
  // exists to remove.
  const motionNeed = motionFloorMs() / 1000;
  const dur = Math.max(scene.dur ?? 0, need, clipNeed, motionNeed);
  if ((scene.dur ?? 0) > 0 && scene.dur + 0.05 < need) {
    console.log(`  · ${scene.id}: ${scene.dur}s → ${dur.toFixed(1)}s (G-4 가독 시간)`);
  }

  // ── frames: the entrance, then a few settled copies for tpad to clone.
  // 🔴 It must be SEVERAL frames. A single-frame %04d pattern composites
  // nothing at all — silently, no error, no dropped frames.
  const inDir = path.join(WORK, `in_${scene.id}`);
  const outDir = path.join(WORK, `out_${scene.id}`);
  fs.mkdirSync(inDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  // A demo scene's shell is an OVERLAY with a hole in it, so it is captured
  // with a transparent background; a still scene paints its own ground.
  const isDemo = scene.scene === 'screen-demo';
  const shot = (file) => page.screenshot({ path: file, omitBackground: isDemo });
  if (isDemo) await page.evaluate(() => { document.body.style.background = 'transparent'; });

  const frameName = (i) => `f_${String(i).padStart(4, '0')}.png`;

  // Arrive.
  const inMs = MOTION.entrance + MOTION.entranceTail;
  const nIn = Math.round((inMs / 1000) * FPS);
  for (let i = 0; i < nIn; i += 1) {
    await page.evaluate((ms) => window.__seek(ms), Math.round((i / FPS) * 1000));
    await shot(path.join(inDir, frameName(i)));
  }
  // Settle — one frame, held by tpad for the middle of the beat.
  await page.evaluate(() => window.__seek(60_000));
  const settled = path.join(WORK, `settled_${scene.id}.png`);
  await shot(settled);
  // 🔴 tpad needs SEVERAL frames to clone from. A one-file %04d pattern
  // composites nothing at all — silently, no error, no dropped frames.
  for (let i = nIn; i < nIn + 4; i += 1) fs.copyFileSync(settled, path.join(inDir, frameName(i)));

  // Leave. Without this the beat ended at full opacity and butt-joined the
  // next one, which is the tick at every boundary the owner called out.
  const nOut = Math.round((MOTION.exit / 1000) * FPS) + Math.ceil((MOTION.exitStagger * 6) / 1000 * FPS);
  for (let i = 0; i < nOut; i += 1) {
    await page.evaluate((ms) => window.__seekOut(ms), Math.round((i / FPS) * 1000));
    await shot(path.join(outDir, frameName(i)));
  }
  const outSeconds = nOut / FPS;

  // ── G-7: the settled frame must not be blank. A composite that silently
  // produces an empty shell is this pipeline's classic failure (T-35).
  const stat = fs.statSync(settled);
  if (stat.size < 8000) fail(`G-7 (${scene.id}): 렌더된 셸이 사실상 비어 있다 (${stat.size}B)`);

  const seg = path.join(WORK, `seg_${scene.id}.mp4`);
  const holdSeconds = Math.max(0.1, dur - inMs / 1000 - outSeconds);
  /**
   * The shell for the WHOLE beat: arrive → hold → leave.
   *
   * `tpad` clones the settled frame across the hold (`eof_action=repeat` does
   * NOT — measured on the tour pipeline, the overlay vanishes the instant the
   * sequence runs out), then the exit sequence is concatenated on the end.
   * Same graph for both scene kinds, so the motion cannot drift apart.
   */
  const shellChain = `[0:v]tpad=stop_mode=clone:stop_duration=${holdSeconds.toFixed(3)},fps=${FPS}[a];`
    + `[1:v]fps=${FPS}[b];[a][b]concat=n=2:v=1:a=0[shell];`;

  if (isDemo) {
    const box = m.clipBox;
    const clip = scene.clipInfo;
    // The clip fades with the frame at both ends, so the recording never snaps
    // on or cuts off — it arrives and leaves with everything else.
    const clipFadeOut = Math.max(0.2, dur - outSeconds).toFixed(3);
    const filter = `color=c=${palette(THEME).canvas}:s=${size.w}x${size.h}:d=${dur.toFixed(3)}:r=${FPS}[bg];`
      + `[0:v]scale=${box.w}:${box.h}:force_original_aspect_ratio=increase,`
      + `crop=${box.w}:${box.h},fps=${FPS},`
      + `fade=t=in:st=0:d=${(MOTION.entrance / 1000).toFixed(2)},`
      + `fade=t=out:st=${clipFadeOut}:d=${outSeconds.toFixed(3)}[clip];`
      + `[bg][clip]overlay=${box.x}:${box.y}:shortest=0[base];`
      + shellChain.replace('[0:v]', '[1:v]').replace('[1:v]fps', '[2:v]fps')
      + `[base][shell]overlay=0:0:format=auto,fps=${FPS},format=yuv420p[v]`;
    ff(['-i', clip.file,
      '-framerate', String(FPS), '-i', path.join(inDir, 'f_%04d.png'),
      '-framerate', String(FPS), '-i', path.join(outDir, 'f_%04d.png'),
      '-filter_complex', filter, '-map', '[v]', '-t', dur.toFixed(3),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', seg], `demo ${scene.id}`);
  } else {
    ff(['-framerate', String(FPS), '-i', path.join(inDir, 'f_%04d.png'),
      '-framerate', String(FPS), '-i', path.join(outDir, 'f_%04d.png'),
      '-filter_complex', `${shellChain}[shell]fps=${FPS},format=yuv420p[v]`,
      '-map', '[v]', '-t', dur.toFixed(3),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', seg], `seg ${scene.id}`);
  }
  segments.push(seg);

  // The VTT carries the English line — the same sentence the frame shows, so a
  // player with subtitles on never contradicts the picture.
  if (scene.headline) {
    cues.push({ start: clock, end: clock + dur, text: String(scene.headline).split('\n').join(' ') });
  }
  clock += dur;
  console.log(`  ${String(scene.id).padEnd(18)} ${scene.scene.padEnd(13)} ${dur.toFixed(1)}s${scene.clipInfo ? `  🎬 ${scene.clip}` : ''}`);
}
await browser.close();

const listFile = path.join(WORK, 'segments.txt');
fs.writeFileSync(listFile, segments.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', OUT], 'concat');

// ── F5: English is in the frame as the headline; the track mirrors it.
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
