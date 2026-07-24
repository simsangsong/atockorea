/**
 * §K B2 — 스몰그룹 정원. 순수 함수만.
 *
 * 🔴 **B2-D1 — 이 파일은 판매 재고를 계산하지 않는다.** 정원은 운영 캡이고,
 * 초과는 "매진"이 아니라 "2호차가 필요하다"는 **운영자용 신호**다. 확정 결정이
 * 이미 있다: 온디맨드 = 무한, `product_inventory`가 비어 있는 것은 의도,
 * 희소성 UI 금지. 그래서 여기서 나온 값이 상품 페이지·체크아웃·챗봇 가용성
 * 답변에 절대 닿으면 안 된다(B2.5가 그걸 회귀로 증명한다).
 *
 * 🔴 **B2-D2 — 캡의 단위는 그룹이다.** `tour_rooms.booking_id`가 NOT NULL UNIQUE라
 * 룸은 예약당 1개다. "룸당 12"로 만들면 예약 1건당 12명이 되어 캡이 사라진다.
 */

/** price_type별 코드 기본값 — 상품이 값을 정하지 않았을 때의 최종 폴백. */
export const CAPACITY_DEFAULTS = {
  /**
   * 1인당 과금 = 조인 스몰그룹. 오너 지시값.
   * (라이브 활성 상품의 group_size가 전부 'Small group' 자유 텍스트라
   *  파싱으로는 이 숫자가 나오지 않는다 — B2.1 마이그레이션 주석 참조.)
   */
  person: 12,
  /**
   * 전세/프라이빗. 상품 캡이 **없다** — 실효 정원은 배정 차량의 좌석수다(B2-D4).
   * null은 "이 축에는 제한이 없다"이지 "0명"이 아니다.
   */
  vehicle: null,
} as const;

export type PriceType = keyof typeof CAPACITY_DEFAULTS;

export interface CapacityTour {
  /** B2.1 숫자 컬럼. NULL = 상품이 값을 정하지 않음 → price_type 기본값. */
  max_room_guests?: number | null;
  price_type?: string | null;
}

export interface CapacityGroup {
  /** B2-D3 그날 그 그룹만의 예외. 운영자가 명시적으로 넣었을 때만 존재한다. */
  capacity?: number | null;
}

export interface CapacityVehicle {
  /** 배정 차량의 좌석수. 여러 대면 합. */
  total_seats?: number | null;
}

function positiveOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

/**
 * B2.1b — **정원 해석 순서를 여기 한 곳에 고정한다.**
 *
 *   ① `ops_tour_groups.capacity`  그날 그 그룹만의 예외 (운영자가 명시)
 *   ② `tours.max_room_guests`     상품 기본
 *   ③ `price_type` 코드 기본값     최종 폴백
 *
 * 숫자가 두 테이블에 사는데 우선순위를 안 적으면 드리프트가 확정된다 —
 * 이 저장소의 반복 실패모드다(§H-4). 순서를 바꾸고 싶으면 이 함수만 고친다.
 *
 * null = "상품 축에는 제한이 없다"(전세 등). 0명이 아니다.
 */
export function productCapacity(tour: CapacityTour | null | undefined, group?: CapacityGroup | null): number | null {
  const groupOverride = positiveOrNull(group?.capacity);
  if (groupOverride !== null) return groupOverride;

  const productValue = positiveOrNull(tour?.max_room_guests);
  if (productValue !== null) return productValue;

  const priceType = (tour?.price_type ?? '') as PriceType;
  return CAPACITY_DEFAULTS[priceType] ?? null;
}

/**
 * B2-D4 — 실효 정원 = min(상품 정원, 배정 차량 좌석수 합).
 *
 * 13인승 쏠라티에 12인 캡을 걸어도 실제로 앉을 수 있는 것은 12명이고,
 * 반대로 상품 캡이 없는 전세라도 좌석은 유한하다. 둘 중 **작은 쪽**이 진실이다.
 * 차량 미배정이면 좌석 축이 아직 없으므로 상품 정원만 적용한다
 * (0으로 보면 배정 전 모든 그룹이 초과로 뜬다).
 */
export function effectiveCapacity(
  tour: CapacityTour | null | undefined,
  vehicles: CapacityVehicle[] | null | undefined,
  group?: CapacityGroup | null,
): number | null {
  const product = productCapacity(tour, group);

  const seatTotal = (vehicles ?? []).reduce<number>((sum, v) => {
    const seats = positiveOrNull(v?.total_seats);
    return seats === null ? sum : sum + seats;
  }, 0);
  const seats = seatTotal > 0 ? seatTotal : null;

  if (product === null) return seats;
  if (seats === null) return product;
  return Math.min(product, seats);
}

export interface CapacityBooking {
  number_of_guests?: number | null;
  status?: string | null;
}

/** 취소·환불은 자리를 차지하지 않는다 (명단·집계 공통 규칙, A-7d soft cancel). */
function occupiesSeat(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s !== 'cancelled' && s !== 'canceled' && s !== 'refunded';
}

/**
 * 그룹 인원 = 그 그룹 예약들의 게스트 수 합.
 *
 * ⚠ 호출부는 **시뮬 예약을 먼저 떨어뜨린 배열**을 준다(A0.1 `dropSimBookings`).
 * 시뮬이 섞이면 실제로는 비어 있는 투어가 정원 초과로 뜬다.
 */
export function groupHeadcount(bookings: CapacityBooking[] | null | undefined): number {
  return (bookings ?? []).reduce<number>((sum, b) => {
    if (!occupiesSeat(b?.status)) return sum;
    const n = positiveOrNull(b?.number_of_guests);
    return sum + (n ?? 0);
  }, 0);
}

export interface CapacityVerdict {
  headcount: number;
  /** null = 이 그룹에는 적용할 정원이 없다(전세·차량 미배정 등). */
  capacity: number | null;
  over: boolean;
  /** 초과 인원. 초과가 아니면 0. */
  overBy: number;
  /** 남은 자리. 정원이 없으면 null. **손님에게 보여주지 말 것**(B2-D1 희소성 금지). */
  remaining: number | null;
}

/**
 * 초과 판정. 결과는 **운영자 화면 전용**이다.
 *
 * 🔴 `remaining`을 손님 표면에 쓰지 말 것. "3자리 남음"은 희소성 UI이고,
 * 온디맨드 무한 판매 결정을 조용히 뒤집는다(B2-D1·B2.5).
 */
export function capacityVerdict(
  bookings: CapacityBooking[] | null | undefined,
  tour: CapacityTour | null | undefined,
  vehicles?: CapacityVehicle[] | null,
  group?: CapacityGroup | null,
): CapacityVerdict {
  const headcount = groupHeadcount(bookings);
  const capacity = effectiveCapacity(tour, vehicles, group);
  if (capacity === null) {
    return { headcount, capacity: null, over: false, overBy: 0, remaining: null };
  }
  const overBy = Math.max(0, headcount - capacity);
  return {
    headcount,
    capacity,
    over: overBy > 0,
    overBy,
    remaining: Math.max(0, capacity - headcount),
  };
}

/**
 * B2-D5 — 운영자용 경고 문구. "막혔다"가 아니라 "2호차가 필요하다"로 쓴다.
 * 오버부킹은 이미 발생한 사실이고, 시스템이 막을 수 있는 시점이 아니다.
 */
export function overCapacityNotice(verdict: CapacityVerdict, tourTitle?: string | null): string | null {
  if (!verdict.over || verdict.capacity === null) return null;
  const title = (tourTitle ?? '').trim();
  const subject = title ? `${title} ` : '';
  return `${subject}${verdict.headcount}명 — 정원 ${verdict.capacity} 초과(${verdict.overBy}명). 2호차 배정이 필요합니다.`;
}
