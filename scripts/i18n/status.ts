/**
 * i18n 진척 현황 — 세션 인수인계의 첫 명령.
 *
 *   npm run i18n:status
 *
 * 매니페스트만 읽는다. 다음 세션은 이 출력만 보고 이어받을 수 있어야 한다
 * (플랜 v2.2 §4 세션 절차).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { claimableUnits, summarize, type Manifest } from '../../lib/i18n/pipeline/manifest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = join(ROOT, 'i18n-work');

const manifestPath = join(WORK, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.log('매니페스트 없음 — 아직 추출하지 않았다. `npm run i18n:extract -- --locale=de`');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const s = summarize(manifest);

console.log(`\n=== i18n 진척 · pipeline v${manifest.pipelineVersion} · ${manifest.updatedAt} ===\n`);
console.log(`전체 ${s.total} unit · 발행가능 ${(s.publishableRatio * 100).toFixed(1)}%\n`);

const order = ['pending', 'running', 'verify_fail', 'flagged', 'auto_pass', 'human_pass', 'blocked'] as const;
console.log('상태별');
for (const k of order) {
  if (s.byStatus[k] > 0) console.log(`  ${k.padEnd(12)} ${s.byStatus[k]}`);
}

console.log('\n로케일별');
for (const [locale, buckets] of Object.entries(s.byLocale)) {
  const parts = order.filter((k) => buckets[k]).map((k) => `${k} ${buckets[k]}`);
  console.log(`  ${locale.padEnd(4)} ${parts.join(' · ')}`);
}

// 글로서리 상태 — S3 번역의 선결 조건(플랜 v3.1 §3).
console.log('\n글로서리 L1');
for (const locale of ['de', 'fr', 'it', 'ru']) {
  const p = join(WORK, 'glossary', `${locale}.json`);
  if (!existsSync(p)) {
    console.log(`  ${locale.padEnd(4)} 없음 — en 폴백으로 동작`);
    continue;
  }
  const g = JSON.parse(readFileSync(p, 'utf8')) as {
    names?: Record<string, string>;
    verification?: { filled?: number; empty?: number; warnings?: string[] };
  };
  const filled = Object.values(g.names ?? {}).filter((v) => v.trim().length > 0).length;
  const warnings = g.verification?.warnings?.length ?? 0;
  console.log(`  ${locale.padEnd(4)} 채움 ${filled} · 경고 ${warnings}`);
}

const next = claimableUnits(manifest, 12);
if (next.length > 0) {
  console.log(`\n다음에 집을 unit ${next.length}개 (상위 12)`);
  for (const u of next) {
    console.log(`  [${u.status}/${u.attempts}회] ${u.tier.padEnd(3)} ${u.sourceChars.toString().padStart(5)}자  ${u.id}`);
  }
} else {
  console.log('\n집을 unit 없음 — 전부 처리됐거나 blocked.');
}

const blocked = manifest.units.filter((u) => u.status === 'blocked');
if (blocked.length > 0) {
  console.log(`\n⚠ blocked ${blocked.length}개 — 3회 실패로 미발행(영어 폴백). 사람 확인 필요`);
  for (const u of blocked.slice(0, 8)) console.log(`  ${u.id} — ${u.lastError ?? ''}`);
}

console.log('');
