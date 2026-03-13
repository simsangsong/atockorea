/**
 * AI 커스터마이즈 조인 투어 상수
 * - 차량: 1~6인 밴, 7~13인 대형밴
 * - 일일 이동 거리 150km 초과 시 추가요금 안내
 */

export const CUSTOM_JOIN_TOUR = {
  /** 일일 이동 거리 제한 (km). 초과 시 추가요금 안내 및 수정 유도 */
  DAILY_DISTANCE_KM_LIMIT: 150,

  /** 참가 인원 최소 */
  MIN_PARTICIPANTS: 1,
  /** 참가 인원 최대 */
  MAX_PARTICIPANTS: 13,

  /** 1~6인: 일반 밴 (고정 요금) */
  VAN: {
    MIN_PAX: 1,
    MAX_PAX: 6,
    LABEL_KO: '일반 밴',
    LABEL_EN: 'Van',
    /** 고정 요금 (원) */
    PRICE_KRW: 100_000,
    PRICE_TYPE: 'group' as const,
  },

  /** 7~13인: 대형 밴 (인당 요금) */
  LARGE_VAN: {
    MIN_PAX: 7,
    MAX_PAX: 13,
    LABEL_KO: '대형 밴',
    LABEL_EN: 'Large van',
    /** 인당 요금 (원) */
    PRICE_PER_PERSON_KRW: 90_000,
    PRICE_TYPE: 'person' as const,
  },

  /** 제주: 하루에 동쪽+서쪽 양쪽 방문 시 추가 요금 (원). 당일 가이드에게 현금 지불 */
  JEJU_CROSS_REGION_EXTRA_FEE_KRW: 70_000,

} as const;

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
  priceType: 'group' | 'person';
  /** 그룹일 때 총액, 인당일 때 1인 단가 */
  unitPriceKrw: number;
  participants: number;
  /** 총 결제 금액 (원) */
  totalPriceKrw: number;
}

/**
 * 참가 인원에 따른 차량 및 요금 계산
 */
export function getCustomJoinTourPricing(participants: number): CustomJoinTourPricing | null {
  if (participants < CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS || participants > CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS) {
    return null;
  }
  if (participants <= CUSTOM_JOIN_TOUR.VAN.MAX_PAX) {
    return {
      vehicleType: 'van',
      vehicleLabelKo: CUSTOM_JOIN_TOUR.VAN.LABEL_KO,
      vehicleLabelEn: CUSTOM_JOIN_TOUR.VAN.LABEL_EN,
      priceType: 'group',
      unitPriceKrw: CUSTOM_JOIN_TOUR.VAN.PRICE_KRW,
      participants,
      totalPriceKrw: CUSTOM_JOIN_TOUR.VAN.PRICE_KRW,
    };
  }
  const total = participants * CUSTOM_JOIN_TOUR.LARGE_VAN.PRICE_PER_PERSON_KRW;
  return {
    vehicleType: 'large_van',
    vehicleLabelKo: CUSTOM_JOIN_TOUR.LARGE_VAN.LABEL_KO,
    vehicleLabelEn: CUSTOM_JOIN_TOUR.LARGE_VAN.LABEL_EN,
    priceType: 'person',
    unitPriceKrw: CUSTOM_JOIN_TOUR.LARGE_VAN.PRICE_PER_PERSON_KRW,
    participants,
    totalPriceKrw: total,
  };
}
