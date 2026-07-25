/**
 * i18n 파이프라인 [0단+1단] — 추출 · 마스킹 · 매니페스트 생성.
 *
 * 플랜: docs/i18n-expansion-plan-v2-2026-07-25.md (v3.1) §2 ①, §5
 *
 *   node --env-file=.env.local --import tsx scripts/i18n/extract.ts --locale=de
 *   npm run i18n:extract -- --locale=de --slugs=jeju-grand-highlights-loop
 *   npm run i18n:extract -- --locale=de --tier=A1 --limit=3
 *
 * 읽기 전용 스크립트다 — DB에 쓰지 않는다. 산출물은 i18n-work/in/ + manifest.json.
 *
 * 🔴 FORBIDDEN 등급 키(matching_profile·slug·price…)는 lib/i18n/pipeline/segments.ts
 * 가 순회 자체를 하지 않는다. 여기서 다시 필터링하지 않는 이유는 방어선을 한 곳에
 * 모으기 위해서다 — 두 곳에 두면 한 곳이 낡는다.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { maskGlossaryTerms, type GlossaryEntry } from '../../lib/ai/glossary';
import {
  chunkLeaves,
  extractLeaves,
  sourceHash,
  type Leaf,
  type Tier,
} from '../../lib/i18n/pipeline/segments';
import {
  emptyManifest,
  unitId,
  type Manifest,
  type Unit,
} from '../../lib/i18n/pipeline/manifest';
import { emptyTm, tmLookup, tmSize, type TranslationMemory } from '../../lib/i18n/pipeline/tm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = join(ROOT, 'i18n-work');
const SURFACE = 'tour_product_pages';
const PIPELINE_VERSION = '1';

// ── CLI ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function flag(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const LOCALE = flag('locale');
const ONLY_SLUGS = flag('slugs')?.split(',').map((s) => s.trim()).filter(Boolean);
const TIER_FILTER = flag('tier')?.split(',').map((s) => s.trim()) as Tier[] | undefined;
const LIMIT = Number(flag('limit') ?? '0') || 0;

const VALID_LOCALES = ['de', 'fr', 'it', 'ru'];
if (!LOCALE || !VALID_LOCALES.includes(LOCALE)) {
  console.error(`--locale 은 ${VALID_LOCALES.join('|')} 중 하나여야 한다.`);
  process.exit(1);
}

// ── 글로서리 로드 ─────────────────────────────────────────────────────────────

/**
 * L1 고유명사 엔트리. `i18n-work/glossary/<locale>.json` 이 있으면 대상 로케일
 * 명칭까지 실어서 마스킹·복원이 모두 작동한다. 없으면 en만으로 마스킹하고
 * 복원 시 en으로 폴백한다(플랜 §3.1 — 이 폴백이 곧 "글로서리 미완" 신호다).
 */
function loadGlossary(locale: string): { entries: GlossaryEntry[]; hasTargetNames: boolean } {
  const sourcePath = join(WORK, 'in', 'poi-names', 'source.json');
  if (!existsSync(sourcePath)) return { entries: [], hasTargetNames: false };

  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
    pois: Array<{ key: string; en: string | null; ko: string | null }>;
  };

  const targetPath = join(WORK, 'glossary', `${locale}.json`);
  let targetNames: Record<string, string> = {};
  if (existsSync(targetPath)) {
    const parsed = JSON.parse(readFileSync(targetPath, 'utf8')) as {
      names?: Record<string, string>;
    };
    targetNames = parsed.names ?? {};
  }

  const entries: GlossaryEntry[] = [];
  for (const poi of source.pois) {
    const names: Record<string, string> = {};
    if (poi.en) names.en = poi.en;
    if (poi.ko) names.ko = poi.ko;
    const target = targetNames[poi.key];
    if (target && target.trim().length > 0) names[locale] = target;
    if (Object.keys(names).length > 0) entries.push({ key: poi.key, names });
  }

  return { entries, hasTargetNames: Object.keys(targetNames).length > 0 };
}

// ── DB ────────────────────────────────────────────────────────────────────────

interface PageRow {
  slug: string;
  locale: string;
  detail_payload: Record<string, unknown>;
}

async function fetchEnglishPages(): Promise<PageRow[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local.',
    );
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  let query = sb.from(SURFACE).select('slug, locale, detail_payload').eq('locale', 'en');
  if (ONLY_SLUGS?.length) query = query.in('slug', ONLY_SLUGS);

  const { data, error } = await query.order('slug');
  if (error) throw new Error(`${SURFACE} fetch failed: ${error.message}`);
  return (data ?? []) as PageRow[];
}

// ── 실행 ──────────────────────────────────────────────────────────────────────

interface UnitFile {
  unitId: string;
  surface: string;
  slug: string;
  locale: string;
  chunk: string;
  tier: string;
  /** pointer → 번역가에게 주는 3원 소스 (플랜 §2). `tm`이 있으면 그대로 쓴다. */
  segments: Record<string, { source_en: string; glossary?: string[]; tm?: string }>;
  /**
   * 마스킹 복원용 — **pointer → (토큰 → 확정 명칭)**.
   *
   * 🔴 반드시 pointer별로 분리해야 한다. `maskGlossaryTerms`는 호출마다 `⟦G0⟧`부터
   * 번호를 새로 매기므로 **같은 토큰이 세그먼트마다 다른 고유명사를 가리킨다.**
   * 유닛 하나로 합치면 마지막 값이 앞을 덮어써서, 복원 때 엉뚱한 지명이 박힌다
   * (2026-07-26 실측: `⟦G0⟧`가 스톱1에서 Jusangjeolli, 스톱3에서 Seongsan Ilchulbong).
   */
  glossaryTokens: Record<string, Record<string, string>>;
  /** TM으로 이미 확정된 세그먼트 수 — 서브에이전트가 새로 번역할 양을 가늠하게 한다. */
  tmHits: number;
}

async function main(): Promise<void> {
  const locale = LOCALE as string;
  const { entries, hasTargetNames } = loadGlossary(locale);

  console.log(`\n=== i18n extract · ${SURFACE} · ${locale} ===`);
  console.log(`글로서리 L1 ${entries.length}건${hasTargetNames ? '' : ' (⚠ 대상 로케일 명칭 없음 — en 폴백)'}`);

  const tmPath = join(WORK, 'tm', `${locale}.json`);
  const tm: TranslationMemory = existsSync(tmPath)
    ? (JSON.parse(readFileSync(tmPath, 'utf8')) as TranslationMemory)
    : emptyTm(locale, PIPELINE_VERSION);
  console.log(`TM ${tmSize(tm)}건`);

  const pages = await fetchEnglishPages();
  const slugs = LIMIT > 0 ? pages.slice(0, LIMIT) : pages;
  console.log(`영어 원문 ${pages.length}슬러그 → 대상 ${slugs.length}슬러그\n`);

  const manifestPath = join(WORK, 'manifest.json');
  const manifest: Manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest)
    : emptyManifest(PIPELINE_VERSION, new Date().toISOString());

  const byId = new Map(manifest.units.map((u) => [u.id, u]));
  const unknownKeysSeen = new Set<string>();
  let unitsWritten = 0;
  let segmentsTotal = 0;
  let tmHitsTotal = 0;

  for (const page of slugs) {
    const report = extractLeaves(page.detail_payload, { tiers: TIER_FILTER });
    report.unknownKeys.forEach((k) => unknownKeysSeen.add(k));

    const chunks = chunkLeaves(report.leaves);
    const chunkLabel = chunkLabeller();
    for (const chunk of chunks) {
      const chunkName = chunkLabel(chunk);
      const id = unitId(SURFACE, page.slug, locale, chunkName);

      const segments: UnitFile['segments'] = {};
      const glossaryTokens: Record<string, Record<string, string>> = {};
      let tmHits = 0;

      for (const leaf of chunk) {
        const masked = maskGlossaryTerms(leaf.text, entries);
        segments[leaf.pointer] = { source_en: masked.text };

        // TM 적중 — 이미 확정된 번역이 있으면 실어 보낸다(일관성 + 비용).
        const hit = tmLookup(tm, masked.text, PIPELINE_VERSION);
        if (hit) {
          segments[leaf.pointer].tm = hit;
          tmHits += 1;
        }

        if (masked.terms.length > 0) {
          segments[leaf.pointer].glossary = masked.terms.map(
            (t) => `${t.token} = ${t.entry.names[locale] ?? t.entry.names.en ?? t.matched}`,
          );
          const perPointer: Record<string, string> = {};
          for (const term of masked.terms) {
            perPointer[term.token] =
              term.entry.names[locale] ?? term.entry.names.en ?? term.matched;
          }
          glossaryTokens[leaf.pointer] = perPointer;
        }
      }

      const unitFile: UnitFile = {
        unitId: id,
        surface: SURFACE,
        slug: page.slug,
        locale,
        chunk: chunkName,
        tier: chunk[0].tier,
        segments,
        glossaryTokens,
        tmHits,
      };

      const outDir = join(WORK, 'in', SURFACE);
      mkdirSync(outDir, { recursive: true });
      writeAtomic(join(outDir, `${safeFileName(id)}.json`), JSON.stringify(unitFile, null, 2));

      const sourceChars = chunk.reduce((n, l) => n + l.text.length, 0);
      const existing = byId.get(id);
      const unit: Unit = {
        id,
        surface: SURFACE,
        slug: page.slug,
        locale,
        chunk: chunkName,
        tier: chunk[0].tier,
        // 이미 통과한 unit을 pending으로 되돌리지 않는다 — 재추출이 진척을 지우면 안 된다.
        status: existing?.status ?? 'pending',
        attempts: existing?.attempts ?? 0,
        segments: Object.keys(segments).length,
        sourceChars,
      };
      byId.set(id, unit);
      unitsWritten += 1;
      segmentsTotal += unit.segments;
      tmHitsTotal += tmHits;
    }
  }

  manifest.units = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  manifest.updatedAt = new Date().toISOString();
  manifest.pipelineVersion = PIPELINE_VERSION;
  writeAtomic(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`unit ${unitsWritten}개 · 세그먼트 ${segmentsTotal}개 → i18n-work/in/${SURFACE}/`);
  console.log(
    `TM 적중 ${tmHitsTotal}/${segmentsTotal} — 새로 번역할 세그먼트 ${segmentsTotal - tmHitsTotal}개`,
  );
  console.log(`매니페스트: ${manifest.units.length} unit (전 로케일 누적)`);

  if (unknownKeysSeen.size > 0) {
    console.log(
      `\n⚠ 등급 미부여 top-level 키 ${unknownKeysSeen.size}개 — 번역하지 않고 건너뜀:\n   ${[...unknownKeysSeen].join(', ')}`,
    );
    console.log('   → lib/i18n/pipeline/segments.ts TOP_LEVEL_TIERS 에 등급을 부여하라.');
  }

  // TM 중복 현황 — P7 진입 전에 절감 폭을 실측하기 위한 지표(플랜 §10).
  const hashes = new Map<string, number>();
  for (const page of slugs) {
    for (const leaf of extractLeaves(page.detail_payload, { tiers: TIER_FILTER }).leaves) {
      const h = sourceHash(leaf.text);
      hashes.set(h, (hashes.get(h) ?? 0) + 1);
    }
  }
  const uniqueSegments = hashes.size;
  const totalSegments = [...hashes.values()].reduce((a, b) => a + b, 0);
  if (totalSegments > 0) {
    const saving = ((1 - uniqueSegments / totalSegments) * 100).toFixed(1);
    console.log(`\nTM 중복제거: 고유 ${uniqueSegments} / 전체 ${totalSegments} → ${saving}% 절감 가능`);
  }
}

/**
 * 청크 라벨. 단일 키 청크는 키 이름, 여러 키가 묶인 청크는 등급 이름을 쓴다.
 * 같은 라벨이 반복되면 순번을 붙인다(`itineraryStops-2`).
 *
 * 카운터는 **슬러그마다 새로 만든다** — 전역이면 두 번째 슬러그의 `hero`가
 * `hero-2`가 되어 unit id가 슬러그별로 어긋난다.
 */
function chunkLabeller(): (chunk: Leaf[]) => string {
  const counters = new Map<string, number>();
  return (chunk: Leaf[]) => {
    const keys = new Set(chunk.map((l) => l.topLevelKey));
    const base = keys.size === 1 ? chunk[0].topLevelKey : chunk[0].tier;
    const n = (counters.get(base) ?? 0) + 1;
    counters.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

function safeFileName(id: string): string {
  return id.replace(/[^\w.-]+/g, '_');
}

/** 원자적 쓰기 — 잘린 JSON이 남지 않게 한다(플랜 §3-[2] 컨텍스트 초과 대비). */
function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
