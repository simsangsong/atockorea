/**
 * 좌석 순수 로직 — AtoC 통합 플랜 §5.3/§5.4.
 *
 * DB·React 무의존 순수 함수만 담는다. ops_seat_assignments 행(부분집합)을
 * 입력으로 받아 좌석 상태·시작 게이트·추천을 계산한다. 다음 슬라이스의
 * claim/체크인 API와 SeatMap 소비 화면(게스트 선택·가이드 콘솔·admin)이
 * 전부 이 모듈을 공유한다 (§5.4b 단일 소스 원칙).
 */

import type { VehicleLayoutJson } from './layouts';

/** SeatMap 렌더 상태 (§5.3b 상태 색 규약). */
export type SeatState =
  | 'available' // 빈좌석 (테두리만)
  | 'mine' // 내 선택 (호박색 계열 → 앱 토큰)
  | 'taken' // 타인 선택 (연회색·비활성)
  | 'checked_in' // 체크인 그린
  | 'absent' // 노쇼 (진회색·취소선)
  | 'locked'; // 잠금 (투어 시작 후 / C-11 체크인 시작 후)

/** ops_seat_assignments 행의 로직 관련 부분집합. */
export interface SeatAssignmentLike {
  seat_number: number;
  booking_id: string;
  guest_label?: string | null;
  checked_in_at?: string | null;
  absent_at?: string | null;
  locked?: boolean | null;
}

/**
 * 단일 좌석 상태 판정. 우선순위: absent > checked_in > locked > mine/taken.
 * (absent/checked_in은 종결 상태라 잠금 여부와 무관하게 그대로 보인다.)
 *
 * @param viewerBookingId 게스트 화면에서 "내 좌석" 판정용. 가이드/admin
 *   화면은 생략 → 배정 좌석은 전부 taken 계열로 표시.
 */
export function seatStatus(
  assignment: SeatAssignmentLike | null | undefined,
  viewerBookingId?: string | null,
): SeatState {
  if (!assignment) return 'available';
  if (assignment.absent_at) return 'absent';
  if (assignment.checked_in_at) return 'checked_in';
  if (assignment.locked) return 'locked';
  if (viewerBookingId && assignment.booking_id === viewerBookingId) return 'mine';
  return 'taken';
}

/**
 * layout + 배정 목록 → SeatMap `seatStates` prop.
 * 배정 없는 좌석은 available이므로 맵에서 생략한다.
 */
export function buildSeatStateMap(
  layout: VehicleLayoutJson,
  assignments: SeatAssignmentLike[],
  viewerBookingId?: string | null,
): Record<number, SeatState> {
  const valid = new Set(layout.seats.map((s) => s.n));
  const map: Record<number, SeatState> = {};
  for (const a of assignments) {
    if (!valid.has(a.seat_number)) continue; // 배치도 밖 좌석은 렌더 대상 아님
    map[a.seat_number] = seatStatus(a, viewerBookingId);
  }
  return map;
}

/**
 * 시작 게이트 (§5.4 C-15): 배정된 전 좌석이 {checked_in | absent} 이면 true.
 *
 * 배정이 0건이면 false — 아무도 좌석을 잡지 않은 룸에서 게이트가 열리면
 * 안 된다 (노쇼 absent 처리로만 게이트에서 제외 가능, C-15 ⚠).
 */
export function allSeatsResolved(assignments: SeatAssignmentLike[]): boolean {
  if (assignments.length === 0) return false;
  return assignments.every((a) => Boolean(a.checked_in_at) || Boolean(a.absent_at));
}

/** 게이트 대시보드용 집계 (카운터 바 — §5.4b). */
export function seatCounts(assignments: SeatAssignmentLike[]): {
  total: number;
  checkedIn: number;
  absent: number;
  waiting: number;
} {
  let checkedIn = 0;
  let absent = 0;
  for (const a of assignments) {
    if (a.absent_at) absent += 1;
    else if (a.checked_in_at) checkedIn += 1;
  }
  return {
    total: assignments.length,
    checkedIn,
    absent,
    waiting: assignments.length - checkedIn - absent,
  };
}

/**
 * party 연속좌석 추천 (§5.3 C-9 보조 — lead가 party 전원 좌석 일괄 지정 시
 * 기본 제안값).
 *
 * 전략(앞→뒤):
 *  1. 같은 행에서 물리적으로 붙어 있는(열 간격 1, 통로 미개재) 연속 빈좌석 run
 *  2. 같은 행 내 빈좌석 조합 (통로 건너 포함)
 *  3. 앞에서부터 아무 빈좌석 (분산 배치 폴백)
 * 충분한 빈좌석이 없으면 null.
 */
export function suggestPartySeats(
  layout: VehicleLayoutJson,
  takenSeatNumbers: Iterable<number>,
  partySize: number,
): number[] | null {
  if (partySize <= 0) return null;
  const taken = new Set(takenSeatNumbers);
  const free = layout.seats.filter((s) => !taken.has(s.n));
  if (free.length < partySize) return null;

  // 행별 그룹 (행 오름차순 = 앞→뒤, 행 내 열 오름차순 = 좌→우)
  const rows = new Map<number, typeof free>();
  for (const s of free) {
    const row = rows.get(s.r) ?? [];
    row.push(s);
    rows.set(s.r, row);
  }
  const sortedRows = [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, seats]) => [...seats].sort((a, b) => a.c - b.c));

  // 1. 붙어 있는 연속 run (c 간격 1 — 통로 c=2 결번이 run을 끊는다)
  for (const row of sortedRows) {
    let run: number[] = [];
    let prevC: number | null = null;
    for (const s of row) {
      if (prevC !== null && s.c === prevC + 1) run.push(s.n);
      else run = [s.n];
      prevC = s.c;
      if (run.length >= partySize) return run.slice(0, partySize);
    }
  }

  // 2. 같은 행 (통로 건너 포함)
  for (const row of sortedRows) {
    if (row.length >= partySize) return row.slice(0, partySize).map((s) => s.n);
  }

  // 3. 앞에서부터 채우기
  const ordered = [...free].sort((a, b) => a.r - b.r || a.c - b.c);
  return ordered.slice(0, partySize).map((s) => s.n);
}
