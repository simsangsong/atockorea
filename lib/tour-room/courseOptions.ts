/**
 * P0 (사용자 리포트 2026-07-27) — 전세 상품의 "코스 택1"을 정류지로 오해하지 않기.
 *
 * 차량 대절 상품의 `detail_payload.itineraryStops`는 순차 정류지가 아니다.
 * 상품 페이지에서는 "동/서/남/커스텀 중 하나를 고르세요"로 읽히는 **선택지**인데,
 * D-1 플래너는 배열을 그대로 하루 일정으로 가져왔다. 그래서 제주 프라이빗 일정을
 * 고르면 코스 네 개가 **관광지 네 곳**으로 들어앉았다.
 *
 * 판별은 이름이 아니라 **구조**로 한다. 라이브 전 상품을 훑은 결과가 깨끗했다:
 *
 *   jeju-island-private-car-charter-tour      4 stops · time 0 · duration 0
 *   seoul-suburbs-private-chartered-car-10hr  4 stops · time 0 · duration 0
 *   그 외 전 상품                              6~11 stops · time·duration 전부 보유
 *
 * 즉 "모든 stop에 `time`도 `duration`도 없다"가 정확히 이 두 상품만 집는다.
 * 슬러그 하드코딩은 다음에 추가될 전세 상품을 놓치고, 이름 매칭("Route N")은
 * 로케일마다 깨진다.
 *
 * 코스별 실제 장소는 이미 데이터에 있다 — `_poi_meta.constituent_pois`가
 * `poi_key` 배열이고, 커스텀 코스만 `candidate_pois`(고를 후보 풀)를 갖는다.
 * 그래서 이 수정에 새 데이터 수집은 없다.
 */

import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';

/** `_poi_meta`의 미타입 확장 필드(작성 배치가 넣는다). */
interface CoursePoiMeta {
  poi_key?: string;
  /** 이 코스를 구성하는 장소들. 코스를 고르면 이게 정류지가 된다. */
  constituent_pois?: unknown;
  /** 커스텀 코스가 제안하는 후보 풀. 정류지가 아니라 피커의 시작점이다. */
  candidate_pois?: unknown;
}

export interface CourseOption {
  /** 원본 배열에서의 위치(1-based) — 안정적인 키. */
  index: number;
  name: string;
  description?: string;
  highlights: readonly string[];
  /** 고르면 정류지가 될 poi_key들. 커스텀 코스는 비어 있다. */
  poiKeys: string[];
  /** 커스텀 코스가 제안하는 후보 poi_key들. */
  candidatePoiKeys: string[];
  /**
   * 정류지를 만들지 않고 피커를 여는 코스("직접 만들기").
   * constituent 없이 candidate만 있는 것으로 판별한다 — 이름을 보지 않는다.
   */
  isCustom: boolean;
}

function stringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 이 itinerary가 정류지 목록이 아니라 코스 선택지인가?
 *
 * 스톱이 2개 미만이면 **적용하지 않는다** — 한 개짜리 배열은 코스 선택지로 볼
 * 근거가 없고, 오분류하면 정상 투어의 일정이 통째로 "코스 고르기"가 되어버린다.
 */
export function isCourseOptionItinerary(stops: readonly ItineraryStop[]): boolean {
  if (!Array.isArray(stops) || stops.length < 2) return false;
  return stops.every((stop) => !hasText(stop?.time) && !hasText(stop?.duration));
}

/** 선택지로 판별된 itinerary를 코스 카드 목록으로 바꾼다. */
export function toCourseOptions(stops: readonly ItineraryStop[]): CourseOption[] {
  return stops.map((stop, i) => {
    const meta = (stop?._poi_meta ?? {}) as CoursePoiMeta;
    const poiKeys = stringArray(meta.constituent_pois);
    const candidatePoiKeys = stringArray(meta.candidate_pois);
    return {
      index: i + 1,
      name: typeof stop?.name === 'string' ? stop.name : '',
      description: typeof stop?.description === 'string' ? stop.description : undefined,
      highlights: Array.isArray(stop?.highlights) ? stop.highlights : [],
      poiKeys,
      candidatePoiKeys,
      isCustom: poiKeys.length === 0 && candidatePoiKeys.length > 0,
    };
  });
}

/**
 * 코스 하나 → 플래너 정류지 초안.
 *
 * `poi_key`만 넣는다: 이름·좌표는 `match_pois`가 서버에서 채우므로 여기서 이름을
 * 복사하면 로케일이 굳어버린다(플래너는 10로케일이다).
 */
export function courseToStopSeeds(course: CourseOption): Array<{ poi_key: string }> {
  return course.poiKeys.map((poi_key) => ({ poi_key }));
}
