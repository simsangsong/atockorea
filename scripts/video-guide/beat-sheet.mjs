#!/usr/bin/env node
/**
 * Contact sheet for one beat's source range — the thing §6 requires before a cut.
 *
 *   node scripts/video-guide/beat-sheet.mjs <slug> <beatId> [--cols 4] [--n 12]
 *
 * §6 records that a mechanical equal-interval slicing pass was run once and
 * REVERTED on the owner's instruction: slice positions have to be chosen while
 * looking at the footage. This makes that possible — it lays the beat's source
 * span out as frames so the dull stretch can be found by eye.
 *
 * Each frame is labelled with its source timestamp in the printed legend (not
 * burned in — `drawtext` needs fontconfig and segfaults on this box), and any
 * frame that falls inside a measured turn window from `<slug>.turns.json` is
 * marked `TURN`. **A cut must never land inside a turn** — that is the exact
 * mistake the Jusangjeolli v2 rejection listed four times.
 *
 * Output: <scratch>/beats/<slug>-<beatId>.jpg + a legend on stdout.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const [slug, beatId] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!slug || !beatId) {
  console.error('usage: beat-sheet.mjs <slug> <beatId> [--cols N] [--n N]');
  process.exit(2);
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const COLS = arg('cols', 4);
const N = arg('n', 12);

const OUT_ROOT = process.env.BEAT_SHEET_DIR ?? path.join(process.cwd(), '.beat-sheets');
const spec = JSON.parse(readFileSync(path.join('docs/video-specs', `${slug}.json`), 'utf8'));
const beat = (spec.beats ?? []).find((b) => String(b.id) === String(beatId));
if (!beat) {
  console.error(`no beat ${beatId} in ${slug}`);
  process.exit(2);
}

const turnsPath = path.join('docs/video-specs', `${slug}.turns.json`);
const turns = existsSync(turnsPath) ? JSON.parse(readFileSync(turnsPath, 'utf8')).turns ?? {} : {};
// turns.mjs writes `{ at, peak, in, out }` per window — already padded.
const windows = (turns[beat.src] ?? []).map((w) => (Array.isArray(w) ? w : [w.in, w.out]));
const inTurn = (t) => windows.some(([s, e]) => t >= s && t <= e);

const srcFile = spec.sources?.[beat.src];
if (!srcFile) {
  console.error(`beat ${beatId} has no source for '${beat.src}'`);
  process.exit(2);
}
const srcPath = path.join(spec.sourceDir, srcFile);
if (!existsSync(srcPath)) {
  console.error(`source missing on disk: ${srcPath}`);
  process.exit(2);
}

const tmp = path.join(OUT_ROOT, `_frames-${slug}-${beatId}`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(OUT_ROOT, { recursive: true });

const step = (beat.out - beat.in) / (N - 1);
const stamps = Array.from({ length: N }, (_, i) => +(beat.in + i * step).toFixed(2));

stamps.forEach((t, i) => {
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-ss', String(t), '-i', srcPath, '-frames:v', '1', '-vf', 'scale=420:-1',
     path.join(tmp, `${String(i).padStart(2, '0')}.jpg`)],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
});

const sheet = path.join(OUT_ROOT, `${slug}-${beatId}.jpg`);
const files = readdirSync(tmp).sort();
const rows = Math.ceil(files.length / COLS);
const CW = 420;
const CH = 300;

// Plain specifier — the script runs from the repo root, so resolution finds
// node_modules on its own. An absolute Windows path is not a valid ESM URL.
const sharp = (await import('sharp')).default;
const tiles = await Promise.all(
  files.map(async (f, i) => ({
    input: await sharp(path.join(tmp, f)).resize(CW, CH, { fit: 'contain', background: '#fff' }).jpeg({ quality: 80 }).toBuffer(),
    left: (i % COLS) * CW,
    top: Math.floor(i / COLS) * CH,
  })),
);
await sharp({ create: { width: COLS * CW, height: rows * CH, channels: 3, background: '#ffffff' } })
  .composite(tiles)
  .jpeg({ quality: 80 })
  .toFile(sheet);
rmSync(tmp, { recursive: true, force: true });

const span = beat.out - beat.in;
const screen = span / Number(beat.speed);
console.log(`${slug} beat ${beatId} — src ${beat.src} ${srcFile}`);
console.log(`  span ${beat.in}–${beat.out} (${span.toFixed(1)}s) @${beat.speed}x  screen ${screen.toFixed(2)}s`);
console.log(`  at 2x you may keep ${(screen * 2).toFixed(2)}s of ${span.toFixed(1)}s — drop ${(span - screen * 2).toFixed(2)}s`);
console.log(`  measured turns on ${beat.src}: ${windows.length ? windows.map(([s, e]) => `${s}–${e}`).join(' · ') : 'none'}`);
console.log(`  sheet ${sheet}`);
stamps.forEach((t, i) => {
  console.log(`   r${Math.floor(i / COLS) + 1}c${(i % COLS) + 1}  ${t.toFixed(2)}s${inTurn(t) ? '   🔴 TURN' : ''}`);
});
