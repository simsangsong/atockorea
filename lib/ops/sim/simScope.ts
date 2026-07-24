/**
 * A0.1 — 시뮬 예약 격리의 단일 판정 지점.
 *
 * 시뮬 예약은 라이브 DB에 산다. 숨기지 않는다 — 룸·좌석·체크인·명단에서
 * 정상적으로 보여야 시뮬이 시뮬 노릇을 한다. 배제되는 곳은 **집계와 돈**뿐이다:
 *
 *   ① 집계 — §11.E 일일보고서 · §K B1 통합통계 · §K B2 정원 카운트
 *   ② 돈   — Stripe 캡처 크론 · ops_entity_ledger 법인 원장 · 정산
 *
 * 🔴 30개 가까운 `from('bookings')` 호출부에 필터를 전부 다는 설계는
 * 드리프트를 보장한다(§H-4가 이 저장소의 반복 실패모드로 지목한 것). 해가
 * 되는 표면만 고르고, 그 목록을 여기 주석에 적어 둔다. 새 집계 화면을 만들 때
 * 이 파일을 읽게 하는 것이 목적이다.
 *
 * 적용된 표면 (2026-07-24 기준):
 *   - lib/ops/report/daily.ts        오늘 투어 · 신규 예약 · 내일 예정 · 연락 현황
 *   - app/api/cron/capture-tour-day-payments/route.ts  캡처 대상 선별
 *   - lib/ops/finance/periodDetail.ts 정산 기간 상세
 *   (B1 통합통계·B2 정원은 착수 시점에 처음부터 이걸 쓴다)
 */

/** 시더가 채우는 값. 다른 값도 "시뮬"로 취급되지만 시더는 이 하나만 쓴다. */
export const SIM_TAG = 'sim';

/**
 * 컬럼이 생기기 전 시더가 쓰던 고정 주소. 소급 태깅 마이그레이션이 처리했지만,
 * 판정에서도 계속 인정한다 — 백필이 놓친 행 하나가 법인 원장에 시뮬 매출을
 * 남기는 것보다, 실 예약이 이 주소를 쓸 일이 없다는 쪽에 거는 것이 낫다.
 */
export const SIM_CONTACT_EMAILS = [
  'sim-tour-mode@atockorea.test',
  'sim-tour-ops-admin@atockorea.test',
] as const;

export interface SimTaggable {
  sim_tag?: string | null;
  contact_email?: string | null;
}

/** 이 예약이 시뮬인가. 태그가 우선이고, 레거시 주소가 폴백이다. */
export function isSimBooking(row: SimTaggable | null | undefined): boolean {
  if (!row) return false;
  if (typeof row.sim_tag === 'string' && row.sim_tag.trim().length > 0) return true;
  const email = typeof row.contact_email === 'string' ? row.contact_email.trim().toLowerCase() : '';
  return email.length > 0 && (SIM_CONTACT_EMAILS as readonly string[]).includes(email);
}

/**
 * 집계에 들어가기 전 시뮬 행을 떨어뜨린다.
 *
 * 쿼리 필터(`.is('sim_tag', null)`)가 아니라 결과 필터인 이유: 집계 대부분이
 * `tour_rooms`에서 출발해 `.in('id', bookingIds)`로 예약을 되짚기 때문에,
 * 예약 쪽에만 필터를 걸면 **룸은 남고 예약만 사라져** "예약 없는 룸"이라는
 * 존재하지 않는 상태가 집계에 생긴다. 행을 받아 놓고 떨어뜨려야 그 룸까지
 * 같이 뺄 수 있다.
 */
export function dropSimBookings<T extends SimTaggable>(rows: T[]): T[] {
  return rows.filter((row) => !isSimBooking(row));
}

/** 위와 같은 판정을 id 집합으로. 룸·좌석 등 파생 행을 함께 떨어뜨릴 때 쓴다. */
export function simBookingIds<T extends SimTaggable & { id: string }>(rows: T[]): Set<string> {
  return new Set(rows.filter(isSimBooking).map((row) => row.id));
}

/**
 * 쿼리 레벨 배제. 예약에서 **직접** 출발하는 집계(신규 예약 목록, 캡처 대상
 * 선별)에서만 쓴다 — 위 dropSimBookings 주석의 "룸만 남는" 문제가 없는 경우다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function excludeSim<Q extends { is(column: string, value: null): any }>(query: Q): Q {
  return query.is('sim_tag', null) as Q;
}
