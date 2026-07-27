/**
 * @jest-environment node
 *
 * P0 — 코스 선택지 판별기.
 *
 * 픽스처는 **라이브 데이터에서 그대로 뜬 형태**다(2026-07-27 조회). 오분류의
 * 대가가 양방향으로 크기 때문이다: 놓치면 리포트의 버그가 그대로 남고(코스 4개가
 * 관광지 4곳으로 들어앉는다), 과잉 적용하면 **정상 투어의 하루 일정이 통째로
 * "코스 고르기" 화면**으로 바뀐다.
 */
import {
  isCourseOptionItinerary,
  toCourseOptions,
} from '@/lib/tour-room/courseOptions';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';

/** jeju-island-private-car-charter-tour (라이브: 4 stops, time·duration 전무). */
const CHARTER: ItineraryStop[] = [
  {
    number: 1,
    name: 'East Route: UNESCO & K-Drama Coast',
    description: "The most landmark-dense route option…",
    highlights: ['Seongsan Ilchulbong', 'Seopjikoji'],
    _poi_meta: {
      constituent_pois: [
        'seongsan_ilchulbong',
        'seopjikoji',
        'gwangchigi_beach',
        'seongeup_folk_village',
        'jeju_folk_village',
        'udo_island',
      ],
    },
  },
  {
    number: 2,
    name: 'West Route: Beaches, Tea & Cafe Coast',
    highlights: ['Hyeopjae Beach'],
    _poi_meta: {
      constituent_pois: ['hyeopjae_beach', 'hallim_park', 'osulloc_tea_museum', 'geumneung_beach'],
    },
  },
  {
    number: 3,
    name: 'South Route: Waterfalls & Volcanic Coast',
    highlights: ['Cheonjiyeon Falls'],
    _poi_meta: {
      constituent_pois: [
        'cheonjiyeon_falls',
        'jusangjeolli_cliff',
        'oedolgae_rock',
        'cheonjeyeon_falls',
        'seogwipo_olle_market',
        'jeongbang_falls',
      ],
    },
  },
  {
    number: 4,
    name: 'Custom Route: Build Your Own Day',
    highlights: [],
    _poi_meta: {
      candidate_pois: [
        'sangumburi_crater',
        'manjanggul_cave',
        'hallasan_national_park',
        'jeju_stone_park',
        'aewol_cafe_street',
        'yongduam_rock',
      ],
    },
  },
] as unknown as ItineraryStop[];

/** 정상 투어(라이브: 모든 stop이 time+duration 보유). */
const NORMAL: ItineraryStop[] = [
  { number: 1, name: 'Pickup', time: '08:00', duration: '20 min' },
  { number: 2, name: 'Seongsan Ilchulbong', time: '09:30', duration: '90 min' },
  { number: 3, name: 'Seopjikoji', time: '11:30', duration: '60 min' },
] as unknown as ItineraryStop[];

describe('isCourseOptionItinerary', () => {
  it('🔴 전세 상품(라이브 형태)을 코스 선택지로 판별한다', () => {
    expect(isCourseOptionItinerary(CHARTER)).toBe(true);
  });

  it('🔴 정상 투어는 절대 코스 선택지가 아니다 — 오분류하면 일정이 통째로 사라진다', () => {
    expect(isCourseOptionItinerary(NORMAL)).toBe(false);
  });

  it('스톱 하나라도 time이 있으면 정류지 목록이다', () => {
    const mixed = [...CHARTER];
    mixed[0] = { ...mixed[0], time: '09:00' } as ItineraryStop;
    expect(isCourseOptionItinerary(mixed)).toBe(false);
  });

  it('duration만 있어도 정류지 목록이다', () => {
    const mixed = CHARTER.map((s) => ({ ...s, duration: '60 min' })) as ItineraryStop[];
    expect(isCourseOptionItinerary(mixed)).toBe(false);
  });

  it('2개 미만에는 적용하지 않는다 — 근거가 없다', () => {
    expect(isCourseOptionItinerary([CHARTER[0]])).toBe(false);
    expect(isCourseOptionItinerary([])).toBe(false);
  });

  it('빈 문자열 time/duration은 값이 없는 것으로 센다', () => {
    const blank = CHARTER.map((s) => ({ ...s, time: '', duration: '  ' })) as ItineraryStop[];
    expect(isCourseOptionItinerary(blank)).toBe(true);
  });
});

describe('toCourseOptions', () => {
  const options = toCourseOptions(CHARTER);

  it('코스별 구성 장소를 그대로 읽는다', () => {
    expect(options.map((o) => o.poiKeys.length)).toEqual([6, 4, 6, 0]);
    expect(options[0].poiKeys[0]).toBe('seongsan_ilchulbong');
  });

  it('커스텀 코스는 정류지를 만들지 않고 후보 풀을 제안한다 — 이름이 아니라 구조로 판별', () => {
    expect(options[3].isCustom).toBe(true);
    expect(options[3].candidatePoiKeys).toHaveLength(6);
    // 이름에 "Custom"이 없어도 구조가 같으면 커스텀이다.
    const renamed = toCourseOptions([
      CHARTER[0],
      { ...CHARTER[3], name: '나만의 하루' } as ItineraryStop,
    ]);
    expect(renamed[1].isCustom).toBe(true);
  });

  it('구성 장소가 있는 코스는 커스텀이 아니다', () => {
    expect(options.slice(0, 3).every((o) => !o.isCustom)).toBe(true);
  });
});

