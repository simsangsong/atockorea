/**
 * AI 커스터마이즈 조인 투어 상수
 * - 차량: 1~6인 밴, 7~13인 대형밴
 * - 호텔 위치: 제주 시내(추가요금 없음), 제주 시외(인당 +1만), 서귀포 시내/시외(인당 +1.5만)
 * - 일일 이동 거리 150km 초과 시 추가요금 안내
 */

/** 호텔(숙소) 위치 — 픽업 지역에 따라 요금 적용 */
export type HotelLocation = 'jeju_city' | 'jeju_outside' | 'seogwipo_city' | 'seogwipo_outside';

/** 제주 시외 선택 시 인당 추가 요금 (원) */
export const CUSTOM_JOIN_TOUR_JEJU_OUTSIDE_EXTRA_KRW = 10_000;
/** 서귀포(시내/시외) 선택 시 인당 추가 요금 (원) */
export const CUSTOM_JOIN_TOUR_SEOGWIPO_EXTRA_KRW = 15_000;

/** 제주시 내 해당 동만 추가요금 없음. 이 목록에 없으면 제주도 전역 +1만 원 */
export const JEJU_CITY_DONGS = [
  '연동', '노형동', '건입동', '도두동', '삼도1동', '삼도2동', '삼양동',
  '아라동', '오라동', '용담1동', '용담2동', '이도1동', '이도2동', '일도1동', '일도2동',
] as const;

/** 참가 가능 직선거리 제한 (km). 발의자 호텔과 참가자 호텔이 이 거리 초과면 참가 불가 */
export const CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM = 10;

/**
 * 주소 문자열로 호텔 위치(요금 구역) 판별.
 * - 서귀포시 포함 → seogwipo_city
 * - 제주시 + 위 동 목록 포함 → jeju_city (추가요금 없음)
 * - 제주 포함(위 제외) → jeju_outside (+1만)
 * - 그 외(부산/서울 등) → jeju_city 로 fallback (기본가)
 */
export function getHotelLocationFromAddress(address: string): HotelLocation {
  const a = (address || '').trim();
  if (!a) return 'jeju_city';
  if (/서귀포|Seogwipo|seogwipo/i.test(a)) return 'seogwipo_city';
  if (!/제주|Jeju|jeju/i.test(a)) return 'jeju_city';
  const hasCityDong = JEJU_CITY_DONGS.some((dong) => a.includes(dong));
  return hasCityDong ? 'jeju_city' : 'jeju_outside';
}

/** 두 좌표 간 직선 거리(km). Haversine */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const CUSTOM_JOIN_TOUR = {
  /** 일일 이동 거리 제한 (km). 초과 시 추가요금 안내 및 수정 유도 */
  DAILY_DISTANCE_KM_LIMIT: 150,

  /** 참가 인원 최소 */
  MIN_PARTICIPANTS: 1,
  /** 참가 인원 최대 */
  MAX_PARTICIPANTS: 13,

  /** 1~6인: 일반 밴. 제주 시내만 기본가, 제주 시외 +1만, 서귀포 +1.5만 */
  VAN: {
    MIN_PAX: 1,
    MAX_PAX: 6,
    LABEL_KO: '일반 밴',
    LABEL_EN: 'Van',
    /** 인당 요금 (원) — 제주 시내만 추가요금 없음 */
    PRICE_PER_PERSON_KRW: 100_000,
    /** 제주 시외 인당 요금 (원) */
    PRICE_PER_PERSON_JEJU_OUTSIDE_KRW: 110_000,
    /** 서귀포 시내/시외 인당 요금 (원) */
    PRICE_PER_PERSON_SEOGWIPO_KRW: 115_000,
    PRICE_TYPE: 'person' as const,
  },

  /** 7~13인: 대형 밴. 제주 시내만 기본가, 제주 시외 +1만, 서귀포 +1.5만 */
  LARGE_VAN: {
    MIN_PAX: 7,
    MAX_PAX: 13,
    LABEL_KO: '대형 밴',
    LABEL_EN: 'Large van',
    /** 인당 요금 (원) — 제주 시내만 추가요금 없음 */
    PRICE_PER_PERSON_KRW: 90_000,
    /** 제주 시외 인당 요금 (원) */
    PRICE_PER_PERSON_JEJU_OUTSIDE_KRW: 100_000,
    /** 서귀포 시내/시외 인당 요금 (원) */
    PRICE_PER_PERSON_SEOGWIPO_KRW: 105_000,
    PRICE_TYPE: 'person' as const,
  },

  /** 제주: 하루에 동쪽+서쪽 양쪽 방문 시 추가 요금 (원). 당일 가이드에게 현금 지불 */
  JEJU_CROSS_REGION_EXTRA_FEE_KRW: 70_000,

} as const;

function isSeogwipo(loc: HotelLocation | undefined): boolean {
  return loc === 'seogwipo_city' || loc === 'seogwipo_outside';
}

function isJejuOutside(loc: HotelLocation | undefined): boolean {
  return loc === 'jeju_outside';
}

/** 결제용 투어 ID (bookings.tour_id). DB에 "Custom Join Tour" 상품이 있어야 함. 없으면 결제 없이 발의만 가능 */
export function getCustomJoinTourBookingTourId(): number | null {
  const id = process.env.NEXT_PUBLIC_CUSTOM_JOIN_TOUR_TOUR_ID;
  if (!id) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export type VehicleType = 'van' | 'large_van';

export interface CustomJoinTourPricing {
  vehicleType: VehicleType;
  vehicleLabelKo: string;
  vehicleLabelEn: string;
  priceType: 'person';
  /** 1인 단가 (원) */
  unitPriceKrw: number;
  participants: number;
  /** 총 결제 금액 = unitPriceKrw × participants */
  totalPriceKrw: number;
}

/**
 * 참가 인원 및 호텔 위치에 따른 차량·요금 계산 (모두 인당 요금)
 * - 제주 시내: 추가요금 없음 (밴 ₩100,000 / 대형밴 ₩90,000)
 * - 제주 시외: 인당 +1만 (밴 ₩110,000 / 대형밴 ₩100,000)
 * - 서귀포 시내/시외: 인당 +1.5만 (밴 ₩115,000 / 대형밴 ₩105,000)
 */
export function getCustomJoinTourPricing(
  participants: number,
  hotelLocation?: HotelLocation
): CustomJoinTourPricing | null {
  if (participants < CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS || participants > CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS) {
    return null;
  }
  const getVanUnit = (): number => {
    if (isSeogwipo(hotelLocation)) return CUSTOM_JOIN_TOUR.VAN.PRICE_PER_PERSON_SEOGWIPO_KRW;
    if (isJejuOutside(hotelLocation)) return CUSTOM_JOIN_TOUR.VAN.PRICE_PER_PERSON_JEJU_OUTSIDE_KRW;
    return CUSTOM_JOIN_TOUR.VAN.PRICE_PER_PERSON_KRW;
  };
  const getLargeVanUnit = (): number => {
    if (isSeogwipo(hotelLocation)) return CUSTOM_JOIN_TOUR.LARGE_VAN.PRICE_PER_PERSON_SEOGWIPO_KRW;
    if (isJejuOutside(hotelLocation)) return CUSTOM_JOIN_TOUR.LARGE_VAN.PRICE_PER_PERSON_JEJU_OUTSIDE_KRW;
    return CUSTOM_JOIN_TOUR.LARGE_VAN.PRICE_PER_PERSON_KRW;
  };
  if (participants <= CUSTOM_JOIN_TOUR.VAN.MAX_PAX) {
    const unitPriceKrw = getVanUnit();
    return {
      vehicleType: 'van',
      vehicleLabelKo: CUSTOM_JOIN_TOUR.VAN.LABEL_KO,
      vehicleLabelEn: CUSTOM_JOIN_TOUR.VAN.LABEL_EN,
      priceType: 'person',
      unitPriceKrw,
      participants,
      totalPriceKrw: participants * unitPriceKrw,
    };
  }
  const unitPriceKrw = getLargeVanUnit();
  return {
    vehicleType: 'large_van',
    vehicleLabelKo: CUSTOM_JOIN_TOUR.LARGE_VAN.LABEL_KO,
    vehicleLabelEn: CUSTOM_JOIN_TOUR.LARGE_VAN.LABEL_EN,
    priceType: 'person',
    unitPriceKrw,
    participants,
    totalPriceKrw: participants * unitPriceKrw,
  };
}
