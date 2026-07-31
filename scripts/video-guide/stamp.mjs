#!/usr/bin/env node
/**
 * Ownership stamping and verification.
 *
 *   node scripts/video-guide/stamp.mjs docs/video-specs/<slug>.json
 *   node scripts/video-guide/stamp.mjs docs/video-specs/<slug>.json --verify <suspect.mp4>
 *
 * Three layers, because any one of them alone is weak:
 *
 * 1. **Container metadata** — copyright / artist / comment fields written into
 *    every deliverable. Trivially stripped, but it is what an honest platform
 *    reads and what an honest re-poster sees first.
 * 2. **Invisible mark** — the key-derived low-frequency pattern from
 *    `lib/forensic.mjs`, added during the master render so every derived cut
 *    inherits it. Survives re-encode and rescale (see that file for the limits).
 * 3. **Evidence manifest** — `<slug>.evidence.json`: SHA-256 of every artifact,
 *    the mark key fingerprint, per-frame perceptual hashes at fixed timestamps,
 *    and a UTC issue time. **Committed to git**, which is what actually
 *    establishes priority: the commit is a third-party-witnessed timestamp
 *    showing we held this file before their upload existed.
 *
 * In a dispute the pair does the work: the manifest proves what we published and
 * when, and `--verify` on their copy proves it descends from ours.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { detectBest, keyFor, fingerprint, GRID, AMPLITUDE, HALF_PERIOD } from './lib/forensic.mjs';

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--') && a.endsWith('.json'));
if (!specPath) { console.error('usage: stamp.mjs <spec.json> [--verify <file.mp4>]'); process.exit(1); }
const vi = argv.indexOf('--verify');
const VERIFY = vi >= 0 ? argv[vi + 1] : null;

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const ROOT = process.cwd();
const OUTDIR = path.join(ROOT, 'out', 'video-guide');
const KEY = keyFor(spec);

const OWNER = 'AtoC Korea';
const NOTICE_EN = 'Property of AtoC Korea. Unauthorised use will be pursued to the full extent of the law.';
const NOTICE_KO = '본 영상은 AtoC Korea 의 자산입니다. 무단 도용·복제·재배포 시 법적 책임을 반드시 추궁합니다.';

const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** Perceptual hash of one frame — survives re-encode, so it matches a stolen copy. */
function frameHash(file, at) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(at), '-i', file, '-frames:v', '1',
    '-vf', 'format=gray,scale=16:16:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 22, encoding: 'buffer' });
  if (!r.stdout || r.stdout.length < 256) return null;
  const px = Array.from(r.stdout.slice(0, 256), Number);
  const mean = px.reduce((a, b) => a + b, 0) / px.length;
  let bits = '';
  for (const v of px) bits += v >= mean ? '1' : '0';
  return BigInt(`0b${bits}`).toString(16).padStart(64, '0');
}

if (VERIFY) {
  if (!fs.existsSync(VERIFY)) { console.error(`없는 파일: ${VERIFY}`); process.exit(1); }
  const evPath = path.join(OUTDIR, `${spec.slug}.evidence.json`);
  const ev = fs.existsSync(evPath) ? JSON.parse(fs.readFileSync(evPath, 'utf8')) : null;

  console.log(`검증 대상: ${VERIFY}`);
  console.log(`기준 저작물: ${spec.slug}  (키 지문 ${fingerprint(KEY)})\n`);

  const best = await detectBest(VERIFY, KEY, { frames: 900 });
  const verdict = best.verdict === 'match'
      ? '일치 — 우리 마스터에서 파생된 사본으로 판정'
    : best.verdict === 'weak'
      ? '약한 일치 — 재인코딩·크롭으로 손상됐을 수 있다. 다른 증거와 함께 판단'
      : '불일치 — 이 마스터의 마크가 검출되지 않음';
  console.log(`  불가시 마크  상관 ${best.score} · 이 파일의 잡음 바닥 ${best.floor}`
    + ` · 마진 ${best.margin}σ  (${best.frames}프레임, ${best.windows ?? '?'}구간)`);
  if (best.flip || best.crop < 1) {
    console.log(`  적용된 역변환: ${[best.flip ? '좌우반전' : null,
      best.crop < 1 ? `중앙크롭 ${Math.round(best.crop * 100)}%` : null].filter(Boolean).join(' + ')}`);
  }
  console.log(`  → ${verdict}`);
  console.log('     (마진은 같은 파일에 미끼 키 6개를 돌려 잰 바닥 대비 표준편차. 4σ 이상이 일치 판정.)');

  if (ev) {
    const suspect = ev.frameHashes.map((h) => ({ at: h.at, now: frameHash(VERIFY, h.at), was: h.hash }));
    const dist = (a, b) => {
      if (!a || !b) return null;
      let d = 0; const x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
      for (const c of x.toString(2)) if (c === '1') d++;
      return d;
    };
    const ds = suspect.map((s) => dist(s.now, s.was)).filter((d) => d != null);
    if (ds.length) {
      const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
      console.log(`  프레임 지각해시 평균거리 ${avg.toFixed(1)}/256`
        + `  → ${avg <= 24 ? '동일 장면' : avg <= 56 ? '유사 — 재편집 가능성' : '다른 영상'}`);
    }
    console.log(`  발행 시각(UTC) ${ev.issuedAt} · 매니페스트 커밋으로 선행성 입증`);
  } else {
    console.log('  ⚠ evidence.json 이 없다 — 먼저 stamp 를 돌려 매니페스트를 만들어라');
  }
  process.exit(0);
}

// ---- stamp ------------------------------------------------------------------
const artifacts = fs.readdirSync(OUTDIR)
  .filter((f) => f.startsWith(spec.slug) && /\.(mp4|jpg)$/.test(f))
  .filter((f) => !f.includes('-review'));
if (!artifacts.length) { console.error('산출물이 없다 — 먼저 렌더해라'); process.exit(1); }

const issuedAt = new Date().toISOString();
const year = issuedAt.slice(0, 4);

for (const name of artifacts.filter((f) => f.endsWith('.mp4'))) {
  const f = path.join(OUTDIR, name);
  const tmp = path.join(OUTDIR, `.stamp_${name}`);
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', f, '-c', 'copy', '-movflags', '+faststart',
    '-metadata', `copyright=© ${year} ${OWNER}. All rights reserved. ${NOTICE_EN}`,
    '-metadata', `artist=${OWNER}`,
    '-metadata', `author=${OWNER}`,
    '-metadata', `publisher=${OWNER}`,
    '-metadata', `comment=${NOTICE_KO} | ${NOTICE_EN} | mark=${fingerprint(KEY)} | issued=${issuedAt}`,
    '-metadata', `title=${spec.title?.en ?? spec.slug} — ${OWNER}`,
    tmp], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`메타데이터 실패: ${name}`); process.exit(1); }
  fs.renameSync(tmp, f);
  console.log(`  meta  ${name}`);
}

const master = path.join(OUTDIR, `${spec.slug}.mp4`);
const dur = Number(String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1', master]).stdout).trim()) || 0;
const stamps = [0.12, 0.3, 0.5, 0.7, 0.88].map((p) => +(dur * p).toFixed(2));

const evidence = {
  work: spec.title?.en ?? spec.slug,
  slug: spec.slug,
  owner: OWNER,
  notice: { en: NOTICE_EN, ko: NOTICE_KO },
  issuedAt,
  invisibleMark: {
    algorithm: 'low-frequency key-derived luma grid',
    grid: `${GRID.w}x${GRID.h}`,
    amplitude: `${AMPLITUDE}/255`,
    phaseFrames: HALF_PERIOD,
    measured: {
      unmarked: '-2.4σ (오탐 없음)',
      marked: '11.0σ',
      reencoded720pCrf30: '6.3σ',
      cropped12pct: '-0.8σ — 크롭에는 약하다. 해시·매니페스트로 보완할 것',
    },
    keyFingerprint: fingerprint(KEY),
    verify: `node scripts/video-guide/stamp.mjs ${specPath} --verify <suspect.mp4>`,
    note: 'The key itself is derived from slug+poiKey and is not stored here; regenerate it from the spec.',
  },
  artifacts: artifacts.map((name) => {
    const f = path.join(OUTDIR, name);
    return { name, bytes: fs.statSync(f).size, sha256: sha256(f) };
  }),
  frameHashes: stamps.map((at) => ({ at, hash: frameHash(master, at) })).filter((x) => x.hash),
  howToUseThis: [
    '1. 이 파일을 git 에 커밋한다 — 커밋 시각이 제3자 증인이 되는 선행성 증거다.',
    '2. 도용 의심 파일이 나오면 --verify 로 불가시 마크 상관도와 프레임 해시 거리를 측정한다.',
    '3. sha256 은 무손실 복제 판정용, 프레임 해시와 마크는 재인코딩된 사본 판정용이다.',
  ],
};

const evPath = path.join(OUTDIR, `${spec.slug}.evidence.json`);
fs.writeFileSync(evPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`\n=> ${evPath}`);
console.log(`   artifacts ${evidence.artifacts.length} · frame hashes ${evidence.frameHashes.length}`
  + ` · mark ${fingerprint(KEY)} · issued ${issuedAt}`);
console.log('   🔴 이 파일을 커밋해야 타임스탬프 증거가 성립한다.');
