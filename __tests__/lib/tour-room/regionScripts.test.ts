/**
 * 지역 해설(제주 알아보기)의 순수 함수들.
 *
 * 이 모듈은 파일 머리 주석에 계약을 세 개 적어 두었는데 그중 둘은 **틀리면
 * 화면에서 조용히 잘못된 숫자로 보이는** 종류다:
 *
 *   - 좌표가 없으면 `null`이지 `0`이 아니다. 0으로 접으면 그 식당이 "바로 옆"이
 *     된다 — 오늘 경로에서 40km 떨어진 곳에 손님을 보낸다.
 *   - 거리 표기는 1km 미만도 "0km"로 보이면 안 된다.
 *
 * 계약을 주석에만 두면 다음 사람이 지운다. 여기서 잡는다.
 */
import {
  countEmphasis,
  formatKm,
  googleMapsUrl,
  haversineKm,
  nearestStopKm,
  parseEmphasis,
  placeTagLabel,
  regionKeyForTour,
  stripEmphasis,
  type RegionScriptPlace,
} from '@/lib/tour-room/regionScripts';

const place = (over: Partial<RegionScriptPlace> = {}): RegionScriptPlace => ({
  tag: 'black_pork',
  ko: '숙성도',
  en: 'Suksungdo',
  ...over,
});

describe('regionKeyForTour', () => {
  it('실제 라이브 슬러그를 지역으로 접는다', () => {
    expect(regionKeyForTour('jeju-grand-highlights-loop')).toBe('jeju');
    expect(regionKeyForTour('jeju-island-private-car-charter-tour')).toBe('jeju');
    expect(regionKeyForTour('busan-private-car-charter-cruise-shore')).toBe('busan');
  });

  it('지역이 없는 상품은 null — 섹션이 안 뜨는 것이 정상이다', () => {
    // 포천·서울·인천 상품에는 지역 해설이 없다. 이 null이 "밴드가 고장났다"가
    // 아니라 "이 상품에는 해설이 없다"라는 뜻이고, 그 구분이 무너지면
    // 스크린샷 하니스가 정상 화면을 결함으로 읽는다(2026-08-02에 실제로 그랬다).
    expect(regionKeyForTour('pocheon-sanjeong-lake-herb-island-art-valley')).toBeNull();
    expect(regionKeyForTour('seoul-private-nami-morning-calm-petite-france')).toBeNull();
    expect(regionKeyForTour(null)).toBeNull();
    expect(regionKeyForTour(undefined)).toBeNull();
    expect(regionKeyForTour('')).toBeNull();
  });

  it('대소문자를 가리지 않는다', () => {
    expect(regionKeyForTour('JEJU-Grand-Highlights-Loop')).toBe('jeju');
  });
});

describe('haversineKm', () => {
  it('같은 점은 0', () => {
    const a = { lat: 33.4586, lng: 126.9425 };
    expect(haversineKm(a, a)).toBeCloseTo(0, 6);
  });

  it('제주 규모의 실거리를 낸다 — 제주공항→성산일출봉 약 43km', () => {
    const airport = { lat: 33.5070, lng: 126.4930 };
    const seongsan = { lat: 33.4586, lng: 126.9425 };
    // 카카오 내비 실측 43.1km(도로). 대권거리는 그보다 짧다 — 40~43 사이면 맞다.
    const km = haversineKm(airport, seongsan);
    expect(km).toBeGreaterThan(40);
    expect(km).toBeLessThan(43.5);
  });

  it('대칭이다', () => {
    const a = { lat: 33.24, lng: 126.52 };
    const b = { lat: 33.5, lng: 126.53 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});

describe('nearestStopKm', () => {
  const stops = [
    { lat: 33.4586, lng: 126.9425 }, // 성산일출봉
    { lat: 33.2447, lng: 126.5602 }, // 정방폭포
  ];

  it('가장 가까운 스톱까지의 거리를 고른다', () => {
    const near = place({ lat: 33.2450, lng: 126.5610 });
    const km = nearestStopKm(near, stops);
    expect(km).not.toBeNull();
    expect(km as number).toBeLessThan(1);
  });

  it('🔴 좌표가 없으면 null이지 0이 아니다', () => {
    // 0을 돌려주면 화면에 "오늘 경로에서 0.0km"로 찍힌다 — 좌표를 모른다는 사실이
    // "바로 옆"이라는 거짓말로 바뀐다.
    expect(nearestStopKm(place(), stops)).toBeNull();
    expect(nearestStopKm(place({ lat: 33.2 }), stops)).toBeNull();
    expect(nearestStopKm(place({ lng: 126.5 }), stops)).toBeNull();
  });

  it('🔴 스톱이 없거나 좌표가 깨졌으면 null이다', () => {
    const p = place({ lat: 33.245, lng: 126.561 });
    expect(nearestStopKm(p, [])).toBeNull();
    expect(nearestStopKm(p, [{ lat: NaN, lng: 126.5 }])).toBeNull();
  });

  it('좌표 없는 스톱이 섞여 있어도 나머지로 계산한다', () => {
    const p = place({ lat: 33.245, lng: 126.561 });
    const km = nearestStopKm(p, [{ lat: NaN, lng: NaN }, stops[1]]);
    expect(km).not.toBeNull();
    expect(km as number).toBeLessThan(1);
  });
});

describe('formatKm', () => {
  it('🔴 1km 미만도 "0km"로 보이지 않는다', () => {
    expect(formatKm(0.4)).toBe('0.4km');
    expect(formatKm(0.04)).toBe('0.0km'); // 반올림 결과지 절삭이 아니다
  });

  it('10km 미만은 소수 한 자리, 그 이상은 정수', () => {
    expect(formatKm(9.94)).toBe('9.9km');
    expect(formatKm(10)).toBe('10km');
    expect(formatKm(18.4)).toBe('18km');
    expect(formatKm(20.6)).toBe('21km');
  });
});

describe('googleMapsUrl', () => {
  it('좌표가 있으면 좌표 링크', () => {
    expect(googleMapsUrl(place({ lat: 33.4586, lng: 126.9425 }))).toBe(
      'https://www.google.com/maps/search/?api=1&query=33.4586,126.9425',
    );
  });

  it('좌표가 없으면 null — 지도 칩 자체가 안 뜬다', () => {
    expect(googleMapsUrl(place())).toBeNull();
    expect(googleMapsUrl(place({ lat: 33.4 }))).toBeNull();
  });
});

describe('placeTagLabel', () => {
  it('분류만 번역하고 상호는 번역하지 않는다', () => {
    expect(placeTagLabel('black_pork', 'ko')).toBe('흑돼지');
    expect(placeTagLabel('black_pork', 'ja')).toBe('黒豚');
    expect(placeTagLabel('black_pork', 'de')).toBe('Schwarzes Schwein');
  });

  it('모르는 태그는 태그 자체를 돌려준다 — 빈칸으로 사라지지 않는다', () => {
    expect(placeTagLabel('nonexistent_tag', 'ko')).toBe('nonexistent_tag');
  });

  it('모든 태그가 10로케일을 다 갖는다 — 목록형', () => {
    // Record<string, Record<RoomLocale, string>>는 tsc가 못 잡는 사각지대다
    // (2026-07 로케일 확장에서 기록됨). 런타임에서 센다.
    const locales = ['en', 'ko', 'ja', 'es', 'zh', 'zh-TW', 'fr', 'de', 'ru', 'it'] as const;
    const tags = ['pick', 'cafe', 'black_pork', 'pork_noodles', 'horse', 'hairtail',
      'haejangguk', 'bomal', 'seongge', 'momguk'];
    const missing: string[] = [];
    for (const tag of tags) {
      for (const locale of locales) {
        const label = placeTagLabel(tag, locale);
        if (!label || label === tag) missing.push(`${tag}/${locale}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('parseEmphasis', () => {
  it('강조가 없으면 스팬 하나', () => {
    expect(parseEmphasis('제주는 화산섬입니다.')).toEqual([
      { text: '제주는 화산섬입니다.', strong: false },
    ]);
  });

  it('가운데 강조를 셋으로 쪼갠다', () => {
    expect(parseEmphasis('해녀는 **2,371명** 남았습니다.')).toEqual([
      { text: '해녀는 ', strong: false },
      { text: '2,371명', strong: true },
      { text: ' 남았습니다.', strong: false },
    ]);
  });

  it('문장 맨 앞·맨 뒤 강조도 잡는다', () => {
    expect(parseEmphasis('**바람**과 돌과 여자')).toEqual([
      { text: '바람', strong: true },
      { text: '과 돌과 여자', strong: false },
    ]);
    expect(parseEmphasis('그래서 남은 것은 **물질**')).toEqual([
      { text: '그래서 남은 것은 ', strong: false },
      { text: '물질', strong: true },
    ]);
  });

  it('한 문단에 여러 개', () => {
    const spans = parseEmphasis('**A** 사이 **B** 끝');
    expect(spans.filter((s) => s.strong).map((s) => s.text)).toEqual(['A', 'B']);
  });

  it('🔴 짝이 안 맞는 별표는 글자 그대로 남긴다', () => {
    // 삼키면 원고 오타가 화면에서는 멀쩡해 보이고 아무도 모른다.
    // 별표가 보이면 누군가 고친다.
    expect(parseEmphasis('열었는데 **안 닫음')).toEqual([
      { text: '열었는데 **안 닫음', strong: false },
    ]);
    expect(stripEmphasis('열었는데 **안 닫음')).toBe('열었는데 **안 닫음');
  });

  it('🔴 빈 강조는 강조가 아니다', () => {
    // 굵은 빈칸은 렌더링 사고로만 생긴다.
    expect(parseEmphasis('앞****뒤')).toEqual([{ text: '앞****뒤', strong: false }]);
    expect(countEmphasis('앞****뒤')).toBe(0);
  });

  it('영어 본문에서도 같게 동작한다', () => {
    const spans = parseEmphasis('By the end of 2025 there were **2,371**.');
    expect(spans.filter((s) => s.strong).map((s) => s.text)).toEqual(['2,371']);
  });

  it('빈 문자열', () => {
    expect(parseEmphasis('')).toEqual([]);
    expect(countEmphasis('')).toBe(0);
    expect(stripEmphasis('')).toBe('');
  });
});

describe('stripEmphasis / countEmphasis', () => {
  it('strip은 마크업만 걷고 글자는 그대로 둔다', () => {
    expect(stripEmphasis('해녀는 **2,371명** 남았습니다.')).toBe('해녀는 2,371명 남았습니다.');
  });

  it('🔴 세는 쪽과 그리는 쪽이 같은 규칙을 쓴다', () => {
    // 다른 규칙을 쓰면 게이트는 초록인데 화면에는 별표가 남는다.
    const samples = [
      '**A** 와 **B**',
      '짝 없는 ** 하나',
      '앞****뒤',
      '평범한 문장',
      '**끝에서 열림',
    ];
    for (const s of samples) {
      expect(countEmphasis(s)).toBe(parseEmphasis(s).filter((x) => x.strong).length);
    }
  });
});
