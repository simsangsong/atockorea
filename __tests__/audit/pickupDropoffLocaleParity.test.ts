/**
 * 상설 게이트 — EN 번들에 `pickup_dropoff` 가 있으면 **모든 로케일 번들에도** 있어야 한다.
 *
 * 🔴 왜 있는가: 2026-08-05 에 사장님이 한국어 상품 페이지에서 **픽업/드롭오프 카드
 * 자리가 통째로 비어 있는 것**을 발견했다. 상세 페이지는 `pickup_dropoff` 가 뷰모델에
 * 있을 때만 「Pickup & Map」 섹션 전체를 그린다
 * (`TourProductDetailClient.tsx` 의 `vm.pickup_dropoff ?` 게이트 +
 * `loadTourProductPage.ts` 가 null 아닐 때만 키를 넘김).
 * 블록이 없으면 지도도, 픽업 목록도, 하차 목록도 **아예 안 나오고** 타임라인이
 * 마지막 스톱에서 곧장 「포함 사항」으로 넘어간다.
 *
 * 실측(프로덕션 서버 HTML 에서 `id="pickup-dropoff"` 개수):
 *   busan-top-attractions-day-tour              en 1 · ko/ja/zh-TW/es **0**
 *   jeju-grand-highlights-loop                  en 1 · ko/ja/zh-TW/es **0**
 *   busan-small-group-sightseeing-…-passengers  en 1 · ko **0**
 *   incheon-seoul-private-car-shore-excursion…  en 1 · ko **0**
 * ⚠ `/zh/` 는 클라이언트 렌더라 서버 HTML 이 ~32KB 셸이다. 거기서 나온 0 은
 *   결함의 증거가 아니다 — 이 함정에 한 번 빠졌다.
 *
 * 원인은 코드가 아니라 **소스의 반쪽짜리 상태**였다: 블록이 EN 번들에만 있었고,
 * `scripts/gen_pickup_sql.js` 가 번역본을 DB 에만 한 번 써 넣고 레포에는 안 돌려놨다.
 * 그래서 나중에 어떤 SQL 이든 그 로케일의 detail_payload 를 번들에서 다시 만들면
 * 섹션이 조용히 사라졌다. **tsc 도 jest 도 전부 초록이었다.**
 *
 * 이 게이트는 레포 쪽 반쪽을 강제한다. DB 쪽은
 * `supabase/pending-db-apply/2026-08-05-15-missing-pickup-dropoff.sql` 이 맡는다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BUNDLE_ROOT = path.join(ROOT, 'components', 'product-tour-static');

type Bundle = { slug: string; locale: string; file: string; hasBlock: boolean };

/**
 * ⚠ 일부 상품은 `notes` 를 배열이 아니라 **문자열 하나**로 들고 있다.
 * `_shared/pickup-dropoff/PickupDropoffCards.tsx` 의 `inferReturnBand` 도
 * 같은 이유로 방어 코드를 들고 있다 ("a latent crash that only surfaced once
 * the page actually SSR'd"). 여기서도 정규화해서 읽는다.
 */
function asNotes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function readBundles(): Bundle[] {
  const out: Bundle[] = [];
  if (!fs.existsSync(BUNDLE_ROOT)) return out;
  for (const dir of fs.readdirSync(BUNDLE_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_') || dir.name === 'catalog') continue;
    const dirPath = path.join(BUNDLE_ROOT, dir.name);
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.json') || !file.startsWith(`${dir.name}.`)) continue;
      const locale = file.slice(dir.name.length + 1, -'.json'.length);
      let doc: Record<string, unknown>;
      try {
        doc = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
      } catch {
        continue;
      }
      const pd = doc.pickup_dropoff as { departure?: unknown[] } | undefined;
      out.push({
        slug: dir.name,
        locale,
        file: `${dir.name}/${file}`,
        hasBlock: Array.isArray(pd?.departure) && pd.departure.length > 0,
      });
    }
  }
  return out;
}

describe('pickup_dropoff 로케일 패리티', () => {
  const bundles = readBundles();

  it('번들을 실제로 읽고 있다 (0건이면 게이트가 조용히 죽은 것)', () => {
    expect(bundles.length).toBeGreaterThan(100);
    expect(bundles.filter((b) => b.hasBlock).length).toBeGreaterThan(50);
  });

  it('EN 에 픽업 블록이 있는 상품은 모든 로케일에 있어야 한다', () => {
    const bySlug = new Map<string, Bundle[]>();
    for (const b of bundles) {
      const list = bySlug.get(b.slug) ?? [];
      list.push(b);
      bySlug.set(b.slug, list);
    }

    const holes: string[] = [];
    for (const [slug, list] of bySlug) {
      const en = list.find((b) => b.locale === 'en');
      // 픽업 블록 자체가 없는 상품(전세 차량 등)은 이 게이트의 대상이 아니다 —
      // 섹션이 안 보이는 게 의도인 상품이 실제로 있다.
      if (!en?.hasBlock) continue;
      for (const b of list) {
        if (!b.hasBlock) holes.push(`${slug} — ${b.locale} 에 pickup_dropoff 없음 (${b.file})`);
      }
    }

    expect(holes).toEqual([]);
  });

  it('픽업 지점 이름이 로케일마다 실제로 번역돼 있다 (EN 문자열 복사 금지)', () => {
    // EN 이름을 그대로 복사해 넣으면 게이트는 통과하지만 한국어 페이지에 영어가 뜬다.
    // 라틴 문자를 쓰는 es 와, 고유명사가 원문인 경우가 정상인 필드는 제외한다.
    const CJK_LOCALES = new Set(['ko', 'ja', 'zh', 'zh-TW']);
    const bySlug = new Map<string, Bundle[]>();
    for (const b of bundles) {
      const list = bySlug.get(b.slug) ?? [];
      list.push(b);
      bySlug.set(b.slug, list);
    }

    const untranslated: string[] = [];
    for (const [slug, list] of bySlug) {
      const en = list.find((b) => b.locale === 'en');
      if (!en?.hasBlock) continue;
      const enDoc = JSON.parse(fs.readFileSync(path.join(BUNDLE_ROOT, slug, `${slug}.en.json`), 'utf8'));
      const enNotes = asNotes(enDoc.pickup_dropoff?.notes);
      if (enNotes.length === 0) continue;

      for (const b of list) {
        if (!CJK_LOCALES.has(b.locale)) continue;
        const doc = JSON.parse(fs.readFileSync(path.join(BUNDLE_ROOT, slug, `${slug}.${b.locale}.json`), 'utf8'));
        const notes = asNotes(doc.pickup_dropoff?.notes);
        for (const [i, note] of notes.entries()) {
          if (enNotes[i] !== undefined && note === enNotes[i]) {
            untranslated.push(`${slug} ${b.locale} — notes[${i}] 가 EN 원문 그대로`);
          }
        }
      }
    }

    expect(untranslated).toEqual([]);
  });
});
