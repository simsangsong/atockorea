#!/usr/bin/env node
/**
 * Release QC — judge the ENCODED artifact set, not the spec and not the
 * renderer's exit code. validate.mjs gates the edit before rendering; this
 * gates the files after, because every defect it checks for has shipped past
 * a green build at least once (silent master, drifted wide cut, cues longer
 * than the shortened video, missing deliverables).
 *
 *   node scripts/video-guide/release.mjs <slug> [--version=N] [--dir=<path>]
 *        [--spec=<path>] [--fast] [--strict]
 *
 *   --fast    skip sha256, loudness/silence and black-frame decodes (probe only)
 *   --strict  promote report-only measurements (start black, LUFS) to failures
 *
 * Writes <slug>.release-manifest.json next to the artifacts. The manifest's
 * terminal state is always `awaiting_publish_approval` — passing QC is not
 * publication permission, and a human watches every file at 1x regardless.
 *
 * Numbers that belong to the edit (2x ceiling, run length, pacing share) are
 * NOT re-checked here — validate.mjs owns them. This file owns only what can
 * be measured on the encoded output.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const FAST = argv.includes('--fast');
const STRICT = argv.includes('--strict');
const slug = argv.find((a) => !a.startsWith('--'));
if (!slug) {
  console.error('사용법: node scripts/video-guide/release.mjs <slug> [--version=N] [--dir=…] [--fast] [--strict]');
  process.exit(1);
}
const OUTDIR = path.resolve(ROOT, opt('dir', path.join('out', 'video-guide')));
const specPath = path.resolve(ROOT, opt('spec', path.join('docs', 'video-specs', `${slug}.json`)));
const VERSION = Number(opt('version', '1'));

if (!fs.existsSync(specPath)) { console.error(`스펙이 없다: ${specPath}`); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const probeBin = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
if (probeBin.error || probeBin.status !== 0) {
  console.error('ffprobe 가 없다 — 판정 불가 (exit 2)');
  process.exit(2);
}

// ---- the deliverable set (§0 of the skill / actual writer scripts) ----------
const CLEAN_W = spec.output?.width ?? 1920;
const CLEAN_H = spec.output?.height ?? 1080;
const SET = [
  { name: `${slug}.mp4`, kind: 'video', w: CLEAN_W, h: CLEAN_H, label: '클린 와이드 마스터' },
  { name: `${slug}-vertical.mp4`, kind: 'video', w: 1080, h: 1920, label: '주 산출물(세로 풀가이드)' },
  { name: `${slug}-wide.mp4`, kind: 'video', w: 1920, h: 1080, label: '드레스드 와이드' },
  { name: `${slug}-teaser.mp4`, kind: 'video', w: 1080, h: 1920, label: '티저' },
  { name: `${slug}-poster.jpg`, kind: 'image', label: '9:16 포스터' },
  { name: `${slug}-poster-wide.jpg`, kind: 'image', label: '16:9 포스터' },
  { name: `${slug}.chapters.txt`, kind: 'text', label: '챕터' },
  { name: `${slug}.cues.json`, kind: 'text', label: '큐 트랙' },
];

const fails = [];
const warns = [];
const gate = (ok, msg) => { if (!ok) fails.push(msg); return ok; };
const report = (ok, msg) => { if (!ok) (STRICT ? fails : warns).push(msg); return ok; };

const missing = SET.filter((f) => !fs.existsSync(path.join(OUTDIR, f.name)));
for (const m of missing) fails.push(`누락: ${m.name} (${m.label})`);

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const j = JSON.parse(r.stdout);
  const v = j.streams?.find((s) => s.codec_type === 'video');
  const a = j.streams?.find((s) => s.codec_type === 'audio');
  return {
    dur: Number(j.format?.duration ?? 0),
    bytes: Number(j.format?.size ?? 0),
    w: v?.width, h: v?.height, video: Boolean(v), audio: Boolean(a),
  };
}

/** One decode pass for silence + loudness (first 60s is plenty to catch a dead bed). */
function audioScan(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-t', '60', '-i', file, '-map', 'a:0', '-af', 'volumedetect,ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const err = r.stderr ?? '';
  const mean = err.match(/mean_volume:\s*(-?[\d.]+) dB/);
  const lufs = err.match(/I:\s*(-?[\d.]+) LUFS/);
  return { mean: mean ? Number(mean[1]) : null, lufs: lufs ? Number(lufs[1]) : null };
}

function blackScan(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-t', '5', '-i', file, '-vf', 'blackdetect=d=0.3:pix_th=0.10', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (r.stderr ?? '').match(/black_start:0(?:\.0+)?\s.*?black_duration:([\d.]+)/);
  return m ? Number(m[1]) : 0;
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ---- per-file physical checks ----------------------------------------------
const artifacts = [];
const probes = {};
for (const f of SET) {
  const file = path.join(OUTDIR, f.name);
  if (!fs.existsSync(file)) continue;
  const entry = { name: f.name, bytes: fs.statSync(file).size };
  if (f.kind === 'video') {
    const p = probe(file);
    probes[f.name] = p;
    if (gate(p && p.video, `${f.name}: 열리지 않거나 비디오 스트림 없음`) && p) {
      gate(p.w === f.w && p.h === f.h, `${f.name}: 해상도 ${p.w}x${p.h} ≠ ${f.w}x${f.h}`);
      gate(p.audio, `${f.name}: 오디오 스트림 없음`);
      entry.probe = { dur: +p.dur.toFixed(2), w: p.w, h: p.h, audio: p.audio };
      if (!FAST && p.audio) {
        const a = audioScan(file);
        // T-54: a silent master reads about -91 dB; a real bed reads -18 or so.
        gate(a.mean === null || a.mean > -60, `${f.name}: 무음 (mean ${a.mean} dB — 음악 베드가 안 실렸다)`);
        entry.audio = a;
      }
      if (!FAST) {
        const black = blackScan(file);
        report(black < 1.0, `${f.name}: 시작 블랙 ${black.toFixed(1)}s (페이드인이면 정상 — 눈으로 확인)`);
        entry.startBlack = black;
      }
    }
  }
  if (!FAST) entry.sha256 = sha256(file);
  artifacts.push(entry);
}

// ---- cross-file checks ------------------------------------------------------
const vert = probes[`${slug}-vertical.mp4`];
const wide = probes[`${slug}-wide.mp4`];
const teaser = probes[`${slug}-teaser.mp4`];

// Both dressed cuts lift from one measured timeline; a real gap means one was
// rendered against a stale spec (the drift that shipped in the first batch).
// Same-encode jitter is ~1 frame, so 0.5s is generous and still catches it.
if (vert && wide) gate(Math.abs(vert.dur - wide.dur) <= 0.5, `세로/와이드 길이 어긋남: ${vert.dur.toFixed(2)}s vs ${wide.dur.toFixed(2)}s`);

// Same math as the in-builder gate in vertical.mjs (≥80% of budget, never over).
const BUDGET = spec.verticalSeconds ?? 90;
if (teaser) gate(teaser.dur >= BUDGET * 0.8 - 0.5 && teaser.dur <= BUDGET + 1, `티저 ${teaser.dur.toFixed(1)}s — 예산 ${BUDGET}s 의 80~100% 밖`);

if (vert) {
  const chFile = path.join(OUTDIR, `${slug}.chapters.txt`);
  if (fs.existsSync(chFile)) {
    for (const line of fs.readFileSync(chFile, 'utf8').split('\n').filter(Boolean)) {
      const m = line.match(/^(\d+):(\d\d)\s/);
      if (!m) { fails.push(`chapters: 형식 이상 — "${line}"`); continue; }
      const t = Number(m[1]) * 60 + Number(m[2]);
      gate(t <= vert.dur, `chapters: "${line.trim()}" — 영상(${vert.dur.toFixed(1)}s) 밖`);
    }
  }
  const cuesFile = path.join(OUTDIR, `${slug}.cues.json`);
  if (fs.existsSync(cuesFile)) {
    const cues = JSON.parse(fs.readFileSync(cuesFile, 'utf8'));
    gate(Math.abs((cues.duration ?? 0) - vert.dur) <= 0.5, `cues.duration ${cues.duration}s ≠ 실제 세로 ${vert.dur.toFixed(2)}s — 재단 후 exportmeta 재실행 누락`);
    const over = (cues.cues ?? []).filter((c) => c.t1 > vert.dur + 0.05);
    gate(over.length === 0, `cues: ${over.length}개가 영상 밖 (첫 위반 beat=${over[0]?.beat} t1=${over[0]?.t1})`);
  }
}

// stamp.mjs already wrote sha256 evidence? Then the two must agree.
const evPath = path.join(OUTDIR, `${slug}.evidence.json`);
if (fs.existsSync(evPath) && !FAST) {
  const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
  for (const e of ev.artifacts ?? []) {
    const here = artifacts.find((a) => a.name === e.name);
    if (here && here.sha256 && here.sha256 !== e.sha256) fails.push(`evidence 불일치: ${e.name} — stamp 이후 파일이 바뀌었다. stamp 를 다시 돌려라`);
  }
}

// Source fingerprints, same binding turns.mjs uses: a QC verdict is only
// meaningful against the sources the cut was made from.
let sourceFingerprints = null;
if (spec.sourceDir && spec.sources) {
  sourceFingerprints = {};
  for (const [k, rel] of Object.entries(spec.sources)) {
    const p = path.join(spec.sourceDir, rel);
    sourceFingerprints[k] = fs.existsSync(p)
      ? { bytes: fs.statSync(p).size, mtimeMs: Math.round(fs.statSync(p).mtimeMs) }
      : null;
  }
  if (Object.values(sourceFingerprints).some((v) => v === null)) warns.push('소스 일부가 이 머신에 없다 — 지문 불완전 (QC 는 유효, 소스 대조만 불가)');
}

// ---- verdict + manifest -----------------------------------------------------
const verdict = fails.length ? 'FAIL' : 'PASS';
const manifest = {
  slug, version: VERSION, verdict,
  state: 'awaiting_publish_approval',
  generatedAt: new Date().toISOString(),
  mode: FAST ? 'fast' : 'full',
  specHash: crypto.createHash('sha1').update(JSON.stringify(spec)).digest('hex').slice(0, 12),
  budgetSeconds: BUDGET,
  fails, warns, artifacts, sourceFingerprints,
};
fs.mkdirSync(OUTDIR, { recursive: true });
const manifestPath = path.join(OUTDIR, `${slug}.release-manifest.json`);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

for (const w of warns) console.log(`  ⚠ ${w}`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(`\n${verdict} — ${artifacts.length}/${SET.length} artifacts, v${VERSION}`);
console.log(`=> ${manifestPath}`);
if (verdict === 'PASS') console.log('   통과 = 발행 아님. 사람이 전 파일을 1x 로 보고, 발행은 별도 승인.');
process.exit(fails.length ? 1 : 0);
