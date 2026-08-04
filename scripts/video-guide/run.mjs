#!/usr/bin/env node
/**
 * One command for the whole guide-video pipeline.
 *
 *   node scripts/video-guide/run.mjs                 # every spec in docs/video-specs
 *   node scripts/video-guide/run.mjs manjanggul-lava-tube
 *   node scripts/video-guide/run.mjs --full          # master + typographic shell, not a draft
 *   node scripts/video-guide/run.mjs --check         # measure and gate only, render nothing
 *
 * The stage order is the one the standard grammar fixes
 * (docs/video-guide-standard-grammar-2026-08-04.md §5): measure turns, snap
 * cuts to motion, gate the structure, then render. Each stage is skipped when
 * the one before it failed, because a spec that does not pass validate.mjs is
 * not worth twenty minutes of ffmpeg.
 *
 * 🔴 It refuses rather than guesses. Missing footage, absent sharp/playwright
 * and an unset music bed are all reported as preconditions with the exact fix,
 * because a pipeline that silently renders half a video is worse than one that
 * stops — the pilot shipped a cut with no shell text that way.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SPEC_DIR = path.join(ROOT, 'docs', 'video-specs');
const HERE = path.join(ROOT, 'scripts', 'video-guide');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const FULL = has('full');
const CHECK = has('check');
const slugs = argv.filter((a) => !a.startsWith('--'));

if (has('help')) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*| \* ?/gm, ''));
  process.exit(0);
}

/** The dependency host every stage needs; deps.mjs looks here before its Windows defaults. */
const env = { ...process.env };
if (!env.VIDEO_GUIDE_DEP_HOST) env.VIDEO_GUIDE_DEP_HOST = path.join(ROOT, 'package.json');

const specs = (slugs.length ? slugs : fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))
  .map((s) => ({ slug: s, file: path.join(SPEC_DIR, `${s}.json`) }));

const missing = specs.filter((s) => !fs.existsSync(s.file));
if (missing.length) {
  console.error(`스펙이 없다: ${missing.map((m) => m.slug).join(', ')}\n  ${SPEC_DIR} 안의 이름을 확인하라`);
  process.exit(1);
}

function run(script, args, label) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: 'inherit', env });
  if (r.status !== 0) console.error(`  ✗ ${label} — exit ${r.status}`);
  return r.status === 0;
}

/**
 * Preconditions that produce a silent bad render rather than a crash. Sources
 * missing is the common one when a spec is opened on a machine that is not the
 * capture machine; the music bed is gitignored, so a fresh checkout always
 * lacks it and the master would ship with ambience only.
 */
function preflight(spec) {
  const problems = [];
  const dir = spec.sourceDir;
  if (dir && !fs.existsSync(dir)) {
    problems.push(`소스 폴더가 없다: ${dir}\n      → 촬영본을 그 경로에 두거나 스펙의 sourceDir 을 고쳐라`);
  } else if (dir) {
    const absent = Object.entries(spec.sources ?? {})
      .filter(([, f]) => !fs.existsSync(path.join(dir, f))).map(([k, f]) => `${k}=${f}`);
    if (absent.length) problems.push(`소스 파일 ${absent.length}개 없음: ${absent.slice(0, 4).join(', ')}${absent.length > 4 ? ' …' : ''}`);
  }
  const bed = spec.audio?.bed;
  if (bed && !fs.existsSync(path.join(ROOT, bed))) {
    problems.push(`음악 베드가 없다: ${bed}\n      → assets/audio/video-guide/ 는 gitignore 다. mp3 를 그 경로에 복사하라(표준 §5-8)`);
  }
  try {
    spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0 || problems.push('ffmpeg 이 PATH 에 없다');
  } catch { problems.push('ffmpeg 이 PATH 에 없다'); }
  return problems;
}

const report = [];
for (const { slug, file } of specs) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\n━━ ${slug} ━━`);

  const blockers = preflight(spec);
  if (blockers.length) {
    blockers.forEach((b) => console.error(`  ✗ ${b}`));
    report.push({ slug, stage: 'preflight', ok: false });
    continue;
  }

  let stage = 'turns';
  let ok = run('turns.mjs', [file], 'turns');
  // turns.mjs only reports; the authored windows stay the editor's call. Its
  // exit status is advisory, so a non-zero here must not stop the run.
  ok = true;

  stage = 'motioncut';
  if (ok) ok = run('motioncut.mjs', [file], 'motioncut');
  stage = 'validate';
  if (ok) ok = run('validate.mjs', [file], 'validate');

  if (!ok) { report.push({ slug, stage, ok: false }); continue; }
  if (CHECK) { report.push({ slug, stage: 'check', ok: true }); continue; }

  stage = 'build';
  ok = run('build.mjs', FULL ? [file] : [file, '--draft'], 'build');
  if (ok && FULL) { stage = 'vfull'; ok = run('vfull.mjs', [file, '--wide'], 'vfull --wide'); }
  report.push({ slug, stage: ok ? 'done' : stage, ok });
}

console.log('\n════ 요약 ════');
for (const r of report) console.log(`  ${r.ok ? '✓' : '✗'} ${r.slug.padEnd(34)} ${r.stage}`);
const failed = report.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length}/${report.length} 실패 — 위 로그의 첫 ✗ 부터 고쳐라.`);
  process.exit(1);
}
console.log(`\n${report.length}/${report.length} 통과.` + (CHECK ? '' : `  출력: out/video-guide/`));
