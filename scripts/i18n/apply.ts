/**
 * i18n 파이프라인 [6단] — 발행. 검증 통과분을 `tour_product_pages` 신규 로케일 행으로 INSERT.
 *
 * 플랜: docs/i18n-expansion-plan-v2-2026-07-25.md (v3.1) §6 불변 규칙
 *
 *   npm run i18n:apply -- --locale=de                            # 드라이런 (기본)
 *   npm run i18n:apply -- --locale=de --apply                    # 신규 행 INSERT
 *   npm run i18n:apply -- --locale=de --apply --overwrite        # 기존 행 갱신
 *   npm run i18n:apply -- --locale=de --apply --partial
 *
 * 🔴 이 스크립트가 지키는 불변식:
 *   1. **기본은 INSERT-only.** 대상 (slug, locale) 행이 이미 있으면 실패하고 건너뛴다.
 *      `--overwrite` 를 명시해야만 upsert 로 바뀐다 — 사장님 지시(2026-08-08)로
 *      추가됐다. 영어 원문이 바뀌었는데 번역 행이 옛 코스를 들고 있는 경우가 실제로
 *      있었고(제주 동부 de/fr/it 는 함덕이 첫 스톱, 부산 크루즈는 스톱 12→11),
 *      그때는 갱신이 정답이지 방치가 정답이 아니다.
 *   2. **커버리지 100% 게이트는 두 경로 모두에 걸린다.** `--partial` 없이는 반쪽
 *      번역이 기존 행을 덮을 수 없다.
 *   3. 번역이 없는 포인터는 영어 원문을 유지한다(영어 폴백).
 *   4. payload 는 **라이브 EN 행을 통째로 복사**한 뒤 번역 포인터만 덮어쓴다. 그래서
 *      재적용은 코스·이미지·구조를 자동으로 라이브 기준으로 되돌린다.
 *
 * ⚠ 2026-08-08 이전 헤더는 "오픈 게이트를 건드리지 않으니 고객에게 안 보인다"고 적어
 *   두었는데, 그 전제는 끝났다 — de/fr/it/ru 는 이제 실제로 서빙된다. 이 스크립트의
 *   쓰기는 곧바로 손님 화면에 반영된다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { restoreGlossaryTerms, type MaskedTerm } from '../../lib/ai/glossary';
import { getAtPointer, setAtPointer } from '../../lib/i18n/pipeline/segments';
import type { Manifest, Unit } from '../../lib/i18n/pipeline/manifest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = join(ROOT, 'i18n-work');
const SURFACE = 'tour_product_pages';
const PIPELINE_VERSION = '1';

const PUBLISHABLE = new Set(['auto_pass', 'flagged', 'human_pass']);

/**
 * `price_per` 라벨. `price`는 FORBIDDEN 등급이라 LLM이 근처에 가지 않는다 —
 * 닫힌 어휘이므로 하드코딩이 번역보다 안전하다.
 */
const PRICE_PER: Record<string, Record<string, string>> = {
  de: { person: 'Person', group: 'Gruppe', vehicle: 'Fahrzeug' },
  fr: { person: 'personne', group: 'groupe', vehicle: 'véhicule' },
  it: { person: 'persona', group: 'gruppo', vehicle: 'veicolo' },
  ru: { person: 'человек', group: 'группа', vehicle: 'автомобиль' },
};

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const LOCALE = flag('locale');
const DO_APPLY = argv.includes('--apply');
const ALLOW_PARTIAL = argv.includes('--partial');
/**
 * 🔴 기존 (slug, locale) 행을 덮어쓴다. 기본값은 여전히 INSERT-only다.
 *
 * 이 플래그가 필요한 이유는 하나뿐이다: **영어 원문이 바뀌었는데 번역 행이 옛 코스를
 * 그대로 들고 있는 경우.** payload 는 아래에서 라이브 EN 행을 통째로 복사한 뒤 번역
 * 포인터만 덮어쓰므로, 재적용하면 코스·이미지·구조가 전부 라이브 기준으로 재생성된다.
 *
 * 커버리지 게이트(100%)는 그대로 걸린다 — `--partial` 없이는 반쪽 번역으로 기존 행을
 * 망가뜨릴 수 없다.
 */
const OVERWRITE = argv.includes('--overwrite');
const ONLY_SLUGS = flag('slugs')?.split(',').map((s) => s.trim()).filter(Boolean);

if (!LOCALE || !['de', 'fr', 'it', 'ru'].includes(LOCALE)) {
  console.error('--locale 은 de|fr|it|ru 중 하나여야 한다.');
  process.exit(1);
}

interface InUnit {
  segments: Record<string, { source_en: string }>;
  /** pointer → (토큰 → 확정 명칭). 유닛 단위로 합치면 안 된다 — extract.ts 주석 참조. */
  glossaryTokens: Record<string, Record<string, string>>;
}
interface OutUnit {
  segments: Record<string, string>;
}

function sb(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeFileName(id: string): string {
  return id.replace(/[^\w.-]+/g, '_');
}

/** 마스킹 토큰을 확정 명칭으로 되꽂는다. `glossaryTokens`는 추출 시 기록해 둔 것. */
function restore(text: string, tokens: Record<string, string>, locale: string): string {
  const terms: MaskedTerm[] = Object.entries(tokens).map(([token, name]) => ({
    token,
    matched: name,
    entry: { key: token, names: { [locale]: name, en: name } },
  }));
  return restoreGlossaryTerms(text, terms, locale);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

async function main(): Promise<void> {
  const locale = LOCALE as string;
  const manifestPath = join(WORK, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('매니페스트가 없다.');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

  const units = manifest.units.filter(
    (u) => u.locale === locale && u.surface === SURFACE && (!ONLY_SLUGS || ONLY_SLUGS.includes(u.slug)),
  );
  if (units.length === 0) {
    console.error(`대상 unit이 없다 (locale=${locale}).`);
    process.exit(1);
  }

  const bySlug = new Map<string, Unit[]>();
  for (const u of units) {
    const list = bySlug.get(u.slug);
    if (list) list.push(u);
    else bySlug.set(u.slug, [u]);
  }

  console.log(`\n=== i18n apply · ${SURFACE} · ${locale} ${DO_APPLY ? '(APPLY)' : '(dry-run)'} ===`);
  console.log(`슬러그 ${bySlug.size}개 · unit ${units.length}개\n`);

  const client = sb();

  // 기존 대상 로케일 행 — 있으면 건드리지 않는다(불변식 1).
  const { data: existingRows, error: exErr } = await client
    .from(SURFACE)
    .select('slug')
    .eq('locale', locale);
  if (exErr) throw new Error(`existing fetch failed: ${exErr.message}`);
  const existing = new Set((existingRows ?? []).map((r) => (r as { slug: string }).slug));

  let inserted = 0;
  let skipped = 0;

  for (const [slug, slugUnits] of bySlug) {
    const publishable = slugUnits.filter((u) => PUBLISHABLE.has(u.status));
    const coverage = publishable.length / slugUnits.length;

    if (publishable.length === 0) {
      console.log(`- ${slug} — 발행 가능 unit 0개. 건너뜀`);
      skipped += 1;
      continue;
    }
    if (coverage < 1 && !ALLOW_PARTIAL) {
      console.log(
        `- ${slug} — unit ${publishable.length}/${slugUnits.length} 만 통과. 건너뜀 (--partial 로 부분 발행 가능)`,
      );
      skipped += 1;
      continue;
    }
    if (existing.has(slug) && !OVERWRITE) {
      console.log(
        `- ${slug} — ${locale} 행이 이미 존재. 건너뜀 (덮어쓰려면 --overwrite)`,
      );
      skipped += 1;
      continue;
    }

    // 영어 원문 로드 — 번역이 없는 포인터는 이 값이 그대로 남는다.
    const { data: enRows, error: enErr } = await client
      .from(SURFACE)
      .select('slug, product_id, tour_id, sort_order, stops_count, rating_avg, review_count, hero_image_url, thumbnail_url, price_amount_label, price_currency, detail_payload')
      .eq('locale', 'en')
      .eq('slug', slug)
      .limit(1);
    if (enErr) throw new Error(`en fetch failed (${slug}): ${enErr.message}`);
    const en = enRows?.[0] as
      | (Record<string, unknown> & { detail_payload: Record<string, unknown> })
      | undefined;
    if (!en) {
      console.log(`- ${slug} — 영어 원문 없음. 건너뜀`);
      skipped += 1;
      continue;
    }

    const payload = JSON.parse(JSON.stringify(en.detail_payload)) as Record<string, unknown>;
    let applied = 0;
    let missed = 0;

    for (const unit of publishable) {
      const inPath = join(WORK, 'in', SURFACE, `${safeFileName(unit.id)}.json`);
      const outPath = join(WORK, 'out', SURFACE, locale, `${safeFileName(unit.id)}.json`);
      if (!existsSync(inPath) || !existsSync(outPath)) continue;

      const inUnit = JSON.parse(readFileSync(inPath, 'utf8')) as InUnit;
      const outUnit = JSON.parse(readFileSync(outPath, 'utf8')) as OutUnit;

      for (const [pointer, translated] of Object.entries(outUnit.segments ?? {})) {
        if (typeof translated !== 'string' || translated.trim().length === 0) continue; // 규칙 6 → 영어 유지
        const restored = restore(translated, inUnit.glossaryTokens?.[pointer] ?? {}, locale);
        if (setAtPointer(payload, pointer, restored)) applied += 1;
        else missed += 1;
      }
    }

    // 로케일 표기 + 발행 추적(플랜 §3-[6]). 언더스코어 키라 추출기가 다시 집지 않는다.
    payload.locale = locale;
    payload._i18n = {
      pipelineVersion: PIPELINE_VERSION,
      sourceLocale: 'en',
      appliedSegments: applied,
      coverage: Number(coverage.toFixed(3)),
      qaStatus: publishable.every((u) => u.status === 'human_pass') ? 'human_pass' : 'auto_pass',
      note: 'Gated by TOUR_PRODUCT_FALLBACK_URL_LOCALES — not customer-visible until that array changes.',
    };

    const cc = (payload.catalog_card ?? {}) as Record<string, unknown>;
    const seo = (payload.seo ?? {}) as Record<string, unknown>;
    const priceObj = (payload.price ?? {}) as Record<string, unknown>;
    const perRaw = str(priceObj.per, 'person').toLowerCase();
    const perLabel = PRICE_PER[locale]?.[perRaw] ?? str(priceObj.per, 'person');
    if (!PRICE_PER[locale]?.[perRaw]) {
      console.log(`    ⚠ price.per="${perRaw}" 에 대한 ${locale} 라벨이 없어 원문 유지`);
    }

    const badges = Array.isArray(cc.badges) ? (cc.badges as unknown[]).map((b) => str(b)) : [];

    const row = {
      slug,
      locale,
      product_id: en.product_id,
      is_published: true,
      sort_order: en.sort_order ?? 0,
      tour_id: en.tour_id ?? null,
      title: str(cc.title) || str(getAtPointer(payload, '/hero/title')),
      subtitle: str(cc.subtitle) || null,
      region_label: str(cc.region) || null,
      duration_label: str(cc.duration) || null,
      stops_count: en.stops_count ?? null,
      rating_avg: en.rating_avg ?? null,
      review_count: en.review_count ?? null,
      badges,
      hero_image_url: en.hero_image_url ?? null,
      thumbnail_url: en.thumbnail_url ?? null,
      card_short_description: str(cc.shortCardDescription) || null,
      seo_title: str(seo.pageTitle) || null,
      meta_description: str(seo.metaDescription) || null,
      headline_line_1: str(payload.headlineLine1) || null,
      headline_line_2: str(payload.headlineLine2) || null,
      price_amount_label: en.price_amount_label ?? null,
      price_currency: en.price_currency ?? 'KRW',
      price_per: perLabel,
      detail_payload: payload,
    };

    if (!row.title) {
      console.log(`- ${slug} — title 이 비어 NOT NULL 위반. 건너뜀`);
      skipped += 1;
      continue;
    }

    console.log(
      `${DO_APPLY ? '+' : '·'} ${slug} — 세그먼트 적용 ${applied}${missed > 0 ? ` (포인터 불일치 ${missed})` : ''} · 커버리지 ${(coverage * 100).toFixed(0)}%`,
    );
    console.log(`    title: ${row.title.slice(0, 70)}`);

    if (!DO_APPLY) continue;

    const { error: insErr } = OVERWRITE
      ? await client.from(SURFACE).upsert(row, { onConflict: 'slug,locale' })
      : await client.from(SURFACE).insert(row);
    if (insErr) {
      console.log(`    ✗ ${OVERWRITE ? 'UPSERT' : 'INSERT'} 실패: ${insErr.message}`);
      skipped += 1;
      continue;
    }
    inserted += 1;
  }

  console.log(
    `\n${DO_APPLY ? '발행' : '드라이런'} — ${OVERWRITE ? 'UPSERT' : 'INSERT'} ${inserted} · 건너뜀 ${skipped}`,
  );
  if (!DO_APPLY) console.log('실제 쓰기: --apply 를 붙여라.');
  console.log(
    `\n🔴 ${locale} 는 2026-08-08 부터 실제로 서빙된다 — 이 쓰기는 곧바로 손님 화면에 반영된다.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
