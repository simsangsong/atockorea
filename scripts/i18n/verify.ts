/**
 * i18n 파이프라인 [3단] — 결정론적 검증 실행 + 매니페스트 갱신.
 *
 * 플랜: docs/i18n-expansion-plan-v2-2026-07-25.md (v3.1) §2 ②
 *
 *   npm run i18n:verify -- --locale=de
 *   npm run i18n:verify -- --locale=de --unit=tour_product_pages:jeju-...:de:A1
 *   npm run i18n:verify -- --locale=de --quiet
 *
 * DB를 건드리지 않는다. 파일만 읽고 매니페스트·리포트만 쓴다.
 * 통과분은 `auto_pass`/`flagged`, 실패분은 `verify_fail`(3회면 `blocked`).
 *
 * 종료코드: 실패 unit이 있으면 1 — CI에 걸 수 있다.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyUnit, type Finding, type TargetLocale } from '../../lib/i18n/pipeline/gates';
import { applyVerifyOutcome, type Manifest } from '../../lib/i18n/pipeline/manifest';
import { emptyTm, tmRecord, tmSize, type TranslationMemory } from '../../lib/i18n/pipeline/tm';

const PIPELINE_VERSION = '1';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = join(ROOT, 'i18n-work');

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const LOCALE = flag('locale');
const ONLY_UNIT = flag('unit');
const QUIET = argv.includes('--quiet');
const RUN_ID = flag('run') ?? `verify-${LOCALE ?? 'all'}`;

if (!LOCALE || !['de', 'fr', 'it', 'ru'].includes(LOCALE)) {
  console.error('--locale 은 de|fr|it|ru 중 하나여야 한다.');
  process.exit(1);
}

interface InUnit {
  unitId: string;
  surface: string;
  slug: string;
  locale: string;
  chunk: string;
  segments: Record<string, { source_en: string; glossary?: string[] }>;
}

interface OutUnit {
  unitId?: string;
  locale?: string;
  segments: Record<string, string>;
  notes?: Record<string, string>;
}

function loadBanned(locale: string): { banned: string[]; keepAsIs: string[] } {
  const brandsPath = join(WORK, 'glossary', '_brands.json');
  const brands = existsSync(brandsPath)
    ? (JSON.parse(readFileSync(brandsPath, 'utf8')) as {
        keepAsIs?: string[];
        bannedAllLocales?: string[];
      })
    : {};

  const localePath = join(WORK, 'glossary', `${locale}.json`);
  const localeGlossary = existsSync(localePath)
    ? (JSON.parse(readFileSync(localePath, 'utf8')) as {
        banned?: string[];
        names?: Record<string, string>;
      })
    : {};

  // 확정 POI 명칭도 keepAsIs다 — 원문과 같아도 G9 미번역 플래그가 뜨면 안 된다.
  const poiNames = Object.values(localeGlossary.names ?? {}).filter((v) => v.trim().length > 0);

  return {
    banned: [...(brands.bannedAllLocales ?? []), ...(localeGlossary.banned ?? [])],
    keepAsIs: [...(brands.keepAsIs ?? []), ...poiNames],
  };
}

interface UnitReport {
  unitId: string;
  status: string;
  segments: number;
  fails: number;
  flags: number;
  findings: Finding[];
}

function main(): void {
  const locale = LOCALE as TargetLocale;
  const { banned, keepAsIs } = loadBanned(locale);

  const manifestPath = join(WORK, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('매니페스트가 없다. 먼저 npm run i18n:extract 를 돌려라.');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

  const targets = manifest.units.filter(
    (u) => u.locale === locale && (!ONLY_UNIT || u.id === ONLY_UNIT),
  );
  if (targets.length === 0) {
    console.error(`검증할 unit이 없다 (locale=${locale}).`);
    process.exit(1);
  }

  console.log(`\n=== i18n verify · ${locale} · ${targets.length} unit ===`);
  console.log(`금지어 ${banned.length}개 · 원문유지 허용 ${keepAsIs.length}개\n`);

  const tmPath = join(WORK, 'tm', `${locale}.json`);
  const tm: TranslationMemory = existsSync(tmPath)
    ? (JSON.parse(readFileSync(tmPath, 'utf8')) as TranslationMemory)
    : emptyTm(locale, PIPELINE_VERSION);
  const tmBefore = tmSize(tm);

  const reports: UnitReport[] = [];
  let missing = 0;

  for (const unit of targets) {
    const inPath = join(WORK, 'in', unit.surface, `${safeFileName(unit.id)}.json`);
    const outPath = join(WORK, 'out', unit.surface, locale, `${safeFileName(unit.id)}.json`);

    if (!existsSync(inPath)) {
      console.log(`⚠ 입력 없음 — ${unit.id}`);
      continue;
    }
    if (!existsSync(outPath)) {
      missing += 1;
      continue; // 아직 번역되지 않은 unit. 상태를 건드리지 않는다.
    }

    const inUnit = JSON.parse(readFileSync(inPath, 'utf8')) as InUnit;

    let outUnit: OutUnit;
    try {
      outUnit = JSON.parse(readFileSync(outPath, 'utf8')) as OutUnit;
    } catch (err) {
      // 잘린 JSON — 컨텍스트 초과의 전형. 재큐 대상.
      const idx = manifest.units.findIndex((u) => u.id === unit.id);
      manifest.units[idx] = applyVerifyOutcome(unit, {
        failed: true,
        flagged: false,
        fails: 1,
        flags: 0,
        error: `JSON parse 실패: ${(err as Error).message}`,
      });
      reports.push({
        unitId: unit.id,
        status: manifest.units[idx].status,
        segments: unit.segments,
        fails: 1,
        flags: 0,
        findings: [
          { gate: 'G1', severity: 'fail', pointer: '', message: 'JSON parse 실패 (잘린 출력)' },
        ],
      });
      console.log(`✗ ${unit.id} — JSON parse 실패`);
      continue;
    }

    const sourceSegments: Record<string, string> = {};
    for (const [pointer, seg] of Object.entries(inUnit.segments)) {
      sourceSegments[pointer] = seg.source_en;
    }

    const result = verifyUnit(
      { segments: sourceSegments },
      { segments: outUnit.segments ?? {} },
      { locale, bannedTerms: banned, keepAsIs },
    );

    const idx = manifest.units.findIndex((u) => u.id === unit.id);
    manifest.units[idx] = applyVerifyOutcome(unit, {
      failed: result.failed,
      flagged: result.flagged,
      fails: result.stats.fails,
      flags: result.stats.flags,
      error: result.findings.find((f) => f.severity === 'fail')?.message,
    });

    reports.push({
      unitId: unit.id,
      status: manifest.units[idx].status,
      segments: result.stats.segments,
      fails: result.stats.fails,
      flags: result.stats.flags,
      findings: result.findings,
    });

    // 검증을 통과한 세그먼트만 TM에 넣는다 — 실패한 unit의 문구가 재사용되면 안 된다.
    if (!result.failed) {
      const failedPointers = new Set(
        result.findings.filter((f) => f.severity === 'fail').map((f) => f.pointer),
      );
      tmRecord(
        tm,
        PIPELINE_VERSION,
        unit.id,
        Object.entries(sourceSegments)
          .filter(([pointer]) => !failedPointers.has(pointer))
          .map(([pointer, source]) => ({ source, target: outUnit.segments?.[pointer] ?? '' })),
      );
    }

    const mark = result.failed ? '✗' : result.flagged ? '△' : '✓';
    console.log(
      `${mark} ${unit.id} — 세그먼트 ${result.stats.segments} · fail ${result.stats.fails} · flag ${result.stats.flags}`,
    );

    if (!QUIET && result.findings.length > 0) {
      for (const f of result.findings.slice(0, 8)) {
        console.log(`    [${f.gate}/${f.severity}] ${f.pointer} — ${f.message}`);
      }
      if (result.findings.length > 8) {
        console.log(`    … 그 외 ${result.findings.length - 8}건 (리포트 파일 참조)`);
      }
    }
  }

  manifest.updatedAt = new Date().toISOString();
  writeAtomic(manifestPath, JSON.stringify(manifest, null, 2));

  mkdirSync(join(WORK, 'tm'), { recursive: true });
  writeAtomic(tmPath, JSON.stringify(tm, null, 2));

  const reportDir = join(WORK, 'reports', RUN_ID);
  mkdirSync(reportDir, { recursive: true });
  writeAtomic(
    join(reportDir, 'verify.json'),
    JSON.stringify({ locale, generatedAt: manifest.updatedAt, reports }, null, 2),
  );

  const failed = reports.filter((r) => r.fails > 0).length;
  const flagged = reports.filter((r) => r.fails === 0 && r.flags > 0).length;
  const passed = reports.length - failed - flagged;

  console.log(`\n검증 ${reports.length} unit — 통과 ${passed} · 플래그 ${flagged} · 실패 ${failed}`);
  console.log(`TM ${tmBefore} → ${tmSize(tm)} (+${tmSize(tm) - tmBefore})`);
  if (missing > 0) console.log(`미번역 ${missing} unit (출력 파일 없음 — 상태 변경 없음)`);
  console.log(`리포트: i18n-work/reports/${RUN_ID}/verify.json`);

  process.exit(failed > 0 ? 1 : 0);
}

function safeFileName(id: string): string {
  return id.replace(/[^\w.-]+/g, '_');
}

function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

main();
