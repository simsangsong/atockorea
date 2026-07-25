/**
 * 추출기 테스트.
 *
 * 이 테스트가 지키는 것: **번역해서는 안 되는 필드가 추출되지 않는다.**
 * `matching_profile`이 번역되면 매칭 엔진이, `slug`/`product_id`가 번역되면
 * 라우팅이 깨진다 — 그 경로를 여기서 막는다.
 */
import {
  chunkLeaves,
  extractLeaves,
  getAtPointer,
  isTranslatableLeaf,
  setAtPointer,
  sourceHash,
  tierOfTopLevelKey,
} from '../segments';

describe('등급 분류', () => {
  it('금지 키를 FORBIDDEN으로 분류한다', () => {
    for (const key of ['slug', 'locale', 'product_id', 'matching_profile', 'matching_metadata', 'price', 'schema_version', 'document_kind']) {
      expect(tierOfTopLevelKey(key)).toBe('FORBIDDEN');
    }
  });

  it('A-1 감수 필수 키를 분류한다', () => {
    expect(tierOfTopLevelKey('hero')).toBe('A1');
    expect(tierOfTopLevelKey('seo')).toBe('A1');
    expect(tierOfTopLevelKey('catalog_card')).toBe('A1');
  });

  it('미등록 키는 조용히 번역되지 않고 HOLD로 떨어진다', () => {
    expect(tierOfTopLevelKey('someFutureSection')).toBe('HOLD');
  });

  it('실고객 리뷰는 보류 등급이다 (v3 Q8)', () => {
    expect(tierOfTopLevelKey('guestReviews')).toBe('HOLD');
    expect(tierOfTopLevelKey('reviewsSummary')).toBe('HOLD');
  });

  it('page_sections 는 죽은 데이터로 분류된다 — 렌더 경로가 읽지 않는다', () => {
    expect(tierOfTopLevelKey('page_sections')).toBe('DEAD');
  });

  it('가격 위젯·이미지·섹션 enum 은 금지 등급이다', () => {
    for (const key of ['pricingTiers', 'priceSource', 'liveStatusSection', 'ogImage', 'heroImage', 'thumbnail', 'imageUrl']) {
      expect(tierOfTopLevelKey(key)).toBe('FORBIDDEN');
    }
  });
});

describe('리프 번역 대상성 휴리스틱', () => {
  it('문구는 대상이다', () => {
    expect(isTranslatableLeaf('A full day around the eastern coast')).toBe(true);
  });

  it('URL·이미지·이메일은 제외', () => {
    expect(isTranslatableLeaf('https://atockorea.com/a')).toBe(false);
    expect(isTranslatableLeaf('/images/hero.webp')).toBe(false);
    expect(isTranslatableLeaf('help@atockorea.com')).toBe(false);
  });

  it('enum·식별자는 제외', () => {
    expect(isTranslatableLeaf('small_group')).toBe(false);
    expect(isTranslatableLeaf('zh-TW')).toBe(false);
    expect(isTranslatableLeaf('hero.title')).toBe(false);
  });

  it('숫자·색상·CSS 값은 제외', () => {
    expect(isTranslatableLeaf('70000')).toBe(false);
    expect(isTranslatableLeaf('#a3b2c1')).toBe(false);
    expect(isTranslatableLeaf('12px')).toBe(false);
  });

  it('ISO 날짜는 제외', () => {
    expect(isTranslatableLeaf('2026-08-17')).toBe(false);
  });

  it('키 이름이 식별자성이면 값이 문구여도 제외', () => {
    expect(isTranslatableLeaf('Sunrise Peak', 'title')).toBe(true);
    expect(isTranslatableLeaf('Sunrise Peak', 'icon')).toBe(false);
    expect(isTranslatableLeaf('Sunrise Peak', 'image_url')).toBe(false);
  });

  it('React 컴포넌트명과 CSS 값은 제외 — 번역되면 렌더가 깨진다', () => {
    expect(isTranslatableLeaf('TourHeroSection', 'component')).toBe(false);
    expect(isTranslatableLeaf('center 35%', 'imagePosition')).toBe(false);
  });
});

describe('extractLeaves', () => {
  const payload = {
    slug: 'jeju-grand-highlights-loop',
    locale: 'en',
    product_id: 'abc-123',
    price: { amount: 144, per: 'person' },
    matching_profile: { vibe: 'A relaxed coastal loop for first timers' },
    matching_metadata: { note: 'internal only' },
    hero: { title: 'Grand Highlights Loop', subtitle: 'One day, the whole island' },
    itineraryStops: [
      { name: 'Seongsan Ilchulbong', blurb: 'A tuff cone with a crater rim walk', image: '/a.webp' },
      { name: 'Seopjikoji', blurb: 'Windswept cape with a lighthouse' },
    ],
    guestReviews: [{ body: 'Loved it!' }],
  };

  it('금지 키는 리프를 하나도 내주지 않는다', () => {
    const { leaves } = extractLeaves(payload);
    const pointers = leaves.map((l) => l.pointer);
    expect(pointers.some((p) => p.startsWith('/matching_profile'))).toBe(false);
    expect(pointers.some((p) => p.startsWith('/matching_metadata'))).toBe(false);
    expect(pointers.some((p) => p.startsWith('/price'))).toBe(false);
    expect(pointers).not.toContain('/slug');
    expect(pointers).not.toContain('/locale');
    expect(pointers).not.toContain('/product_id');
  });

  it('보류 등급(실고객 리뷰)도 추출하지 않는다', () => {
    const { leaves } = extractLeaves(payload);
    expect(leaves.some((l) => l.pointer.startsWith('/guestReviews'))).toBe(false);
  });

  it('배열 인덱스를 포인터에 담는다', () => {
    const { leaves } = extractLeaves(payload);
    expect(leaves.map((l) => l.pointer)).toContain('/itineraryStops/0/blurb');
    expect(leaves.map((l) => l.pointer)).toContain('/itineraryStops/1/name');
  });

  it('이미지 경로는 리프에서 빠진다', () => {
    const { leaves } = extractLeaves(payload);
    expect(leaves.map((l) => l.pointer)).not.toContain('/itineraryStops/0/image');
  });

  it('등급 필터가 작동한다', () => {
    const { leaves } = extractLeaves(payload, { tiers: ['A1'] });
    expect(leaves.every((l) => l.tier === 'A1')).toBe(true);
    expect(leaves.some((l) => l.pointer.startsWith('/hero'))).toBe(true);
    expect(leaves.some((l) => l.pointer.startsWith('/itineraryStops'))).toBe(false);
  });

  it('미등록 키를 리포트한다 — 스키마 성장 감지', () => {
    const { unknownKeys } = extractLeaves({ ...payload, brandNewSection: { t: 'x' } });
    expect(unknownKeys).toContain('brandNewSection');
  });

  it('언더스코어 서브트리는 화이트리스트 섹션 안에서도 버린다', () => {
    const { leaves } = extractLeaves({
      itinerary_variants: [
        {
          stops: [
            {
              name: 'Jeju Cruise Terminal Pickup',
              duration: '30 min',
              _poi_meta: { poi_key: 'jeju_cruise_port', sources: ['VisitKorea cruise terminal page'] },
            },
          ],
        },
      ],
    });
    const pointers = leaves.map((l) => l.pointer);
    expect(pointers).toContain('/itinerary_variants/0/stops/0/name');
    expect(pointers.some((p) => p.includes('_poi_meta'))).toBe(false);
  });

  it('출처 인용(sources)은 번역하지 않는다', () => {
    const { leaves } = extractLeaves({
      itineraryStops: [{ blurb: 'A crater rim walk', sources: ['VisitKorea', 'Jeju Tourism Org'] }],
    });
    expect(leaves.map((l) => l.pointer)).toEqual(['/itineraryStops/0/blurb']);
  });
});

describe('JSON Pointer 왕복', () => {
  it('읽고 쓴다', () => {
    const doc = { hero: { title: 'A' }, stops: [{ name: 'B' }] };
    expect(getAtPointer(doc, '/hero/title')).toBe('A');
    expect(getAtPointer(doc, '/stops/0/name')).toBe('B');
    expect(setAtPointer(doc, '/hero/title', 'Ü')).toBe(true);
    expect(doc.hero.title).toBe('Ü');
  });

  it('없는 경로에는 쓰지 않는다 — 새 키를 만들지 않는다', () => {
    const doc = { hero: { title: 'A' } };
    expect(setAtPointer(doc, '/hero/newKey', 'x')).toBe(false);
    expect(setAtPointer(doc, '/nope/deep', 'x')).toBe(false);
    expect(doc).toEqual({ hero: { title: 'A' } });
  });

  it('슬래시·틸드가 든 키를 이스케이프한다', () => {
    const doc = { 'a/b': { '~c': 'v' } };
    expect(getAtPointer(doc, '/a~1b/~0c')).toBe('v');
  });
});

describe('chunkLeaves', () => {
  it('등급 경계를 넘지 않는다 — 감수 범위가 등급 단위이므로', () => {
    const leaves = [
      { pointer: '/hero/a', text: 'x'.repeat(100), topLevelKey: 'hero', tier: 'A1' as const },
      { pointer: '/itineraryStops/0/a', text: 'y'.repeat(100), topLevelKey: 'itineraryStops', tier: 'B' as const },
    ];
    const chunks = chunkLeaves(leaves, 10_000);
    expect(chunks).toHaveLength(2);
    expect(chunks.every((c) => new Set(c.map((l) => l.tier)).size === 1)).toBe(true);
  });

  it('같은 등급의 작은 키들은 한 청크로 묶는다', () => {
    const leaves = [
      { pointer: '/hero/a', text: 'x'.repeat(50), topLevelKey: 'hero', tier: 'A1' as const },
      { pointer: '/seo/a', text: 'y'.repeat(50), topLevelKey: 'seo', tier: 'A1' as const },
      { pointer: '/subnavItems/0', text: 'z'.repeat(50), topLevelKey: 'subnavItems', tier: 'A1' as const },
    ];
    expect(chunkLeaves(leaves, 6000)).toHaveLength(1);
  });

  it('큰 섹션을 상한으로 쪼갠다', () => {
    const leaves = Array.from({ length: 10 }, (_, i) => ({
      pointer: `/itineraryStops/${i}/blurb`,
      text: 'z'.repeat(1000),
      topLevelKey: 'itineraryStops',
      tier: 'B' as const,
    }));
    const chunks = chunkLeaves(leaves, 3000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toHaveLength(10);
  });
});

describe('sourceHash', () => {
  it('같은 원문은 같은 해시 — TM 중복제거의 기준', () => {
    expect(sourceHash('A full day tour')).toBe(sourceHash('A full day tour'));
  });

  it('다른 원문은 다른 해시', () => {
    expect(sourceHash('40 minutes')).not.toBe(sourceHash('30 minutes'));
  });
});
