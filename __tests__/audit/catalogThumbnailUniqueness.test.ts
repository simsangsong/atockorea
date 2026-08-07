/**
 * 🔴 상설 게이트 — 카탈로그 카드가 **서로 다른 사진**인가.
 *
 * 2026-08-07 실측: 판매 중인 21개 상품이 **9장의 사진을 돌려쓰고** 있었다. 부산 4개가
 * 해동용궁사 일몰 한 장, 수원 3개가 장안문 야경 한 장, 설악 3개가 능선 한 장.
 * OTA 그리드에서 이건 "같은 상품이 네 번 올라온 것"으로 읽힌다.
 *
 * 원인은 카피 실수가 아니라 **파생 규칙**이다 — `tour-payload-thumb-sync.mjs` 가 카드
 * 이미지를 **첫 non-OPS 스톱**에서 뽑는데, 형제 상품은 첫 스톱이 같다. 그래서 상품을
 * 하나 더 만들 때마다 조용히 중복이 생긴다. 사람이 눈치채려면 카탈로그를 눈으로 훑어야 한다.
 *
 * 잡는 것 셋:
 *   1. 판매 가능한 상품끼리 **카드 이미지 중복 0**
 *   2. 오버라이드가 가리키는 파일이 **디스크에 실재**
 *   3. 오버라이드가 **그 상품 일정에 실제로 있는 스톱**의 사진 (관련성) —
 *      전세 상품처럼 의도적으로 일정 밖인 경우만 `offItinerary` 로 면제
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  isTourSlugHiddenFromPublicCatalog,
  isTourSlugBlockedFromConsumerSurfaces,
} from '@/lib/tour-consumer-visibility';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PRODUCT_THUMBNAILS } = require('../../scripts/photo-curation/product-thumbnails.mjs') as {
  PRODUCT_THUMBNAILS: Record<string, { image: string; why: string; offItinerary?: boolean }>;
};

const ROOT = process.cwd();
const STATIC_DIR = path.join(ROOT, 'components/product-tour-static');

type Stop = { image?: string; images?: string[]; _poi_meta?: { poi_key?: string } };
type Payload = {
  catalog_card?: { heroImage?: string; thumbnail?: string };
  itineraryStops?: Stop[];
};

function payloadOf(slug: string): Payload | null {
  const f = path.join(STATIC_DIR, slug, `${slug}.en.json`);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, 'utf8')) as Payload;
}

/** Every image reachable from this product's own itinerary, at any nesting depth. */
function itineraryImages(node: unknown, out = new Set<string>()): Set<string> {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => itineraryImages(n, out));
    return out;
  }
  const rec = node as Record<string, unknown>;
  if (Array.isArray(rec.itineraryStops)) {
    for (const s of rec.itineraryStops as Stop[]) {
      if (typeof s?.image === 'string') out.add(s.image);
      for (const u of s?.images ?? []) if (typeof u === 'string') out.add(u);
    }
  }
  for (const k of Object.keys(rec)) itineraryImages(rec[k], out);
  return out;
}

/**
 * 🔴 2026-08-08 — 이 목록을 `PRODUCT_THUMBNAILS` 에서 뽑고 있었다. 즉 게이트가
 * **내가 관리하는 21개만 재고 실제로 나가는 38개는 안 쟀다.** 오버라이드에 없던 17개는
 * 파생 규칙(첫 non-OPS 스톱)이 그대로 굴러서 남이섬 3개·통도사 2개·경복궁 2개·성산 2개·
 * 설악 2개가 라이브에서 겹쳤고, 게이트는 내내 초록이었다.
 * → 목록의 출처는 **카탈로그 자신**이어야 한다.
 */
const CATALOG_DIRS = readdirSync(STATIC_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(STATIC_DIR, d.name, `${d.name}.en.json`)))
  .map((d) => d.name);

const sellable = CATALOG_DIRS.filter(
  (slug) =>
    !isTourSlugHiddenFromPublicCatalog(slug) && !isTourSlugBlockedFromConsumerSurfaces(slug),
);

describe('catalogue card thumbnails', () => {
  it('🔴 판매 가능한 상품끼리 같은 사진을 쓰지 않는다', () => {
    const byImage = new Map<string, string[]>();
    for (const slug of sellable) {
      const hero = payloadOf(slug)?.catalog_card?.heroImage;
      if (!hero) continue;
      byImage.set(hero, [...(byImage.get(hero) ?? []), slug]);
    }
    const shared = [...byImage.entries()]
      .filter(([, slugs]) => slugs.length > 1)
      .map(([image, slugs]) => `${image} ← ${slugs.join(', ')}`);
    expect(shared).toEqual([]);
  });

  it('오버라이드가 가리키는 파일이 실재한다', () => {
    const missing = Object.entries(PRODUCT_THUMBNAILS)
      .filter(([, spec]) => !existsSync(path.join(ROOT, 'public', spec.image.replace(/^\//, ''))))
      .map(([slug, spec]) => `${slug} → ${spec.image}`);
    expect(missing).toEqual([]);
  });

  it('카드 사진이 그 상품 일정에 실제로 있는 스톱의 것이다 (관련성)', () => {
    const offRoute: string[] = [];
    for (const [slug, spec] of Object.entries(PRODUCT_THUMBNAILS)) {
      if (spec.offItinerary) continue;
      const payload = payloadOf(slug);
      if (!payload) continue;
      if (!itineraryImages(payload).has(spec.image)) offRoute.push(`${slug} → ${spec.image}`);
    }
    expect(offRoute).toEqual([]);
  });

  it('🔴 판매 가능한 상품은 전부 오버라이드를 갖는다 (파생에 맡기면 중복이 자란다)', () => {
    const unmanaged = sellable.filter((slug) => !PRODUCT_THUMBNAILS[slug]);
    expect(unmanaged).toEqual([]);
  });

  it('선택 이유가 모든 상품에 적혀 있다', () => {
    const undocumented = Object.entries(PRODUCT_THUMBNAILS)
      .filter(([, spec]) => !spec.why || spec.why.trim().length < 8)
      .map(([slug]) => slug);
    expect(undocumented).toEqual([]);
  });
});
