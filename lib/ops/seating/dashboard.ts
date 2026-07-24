/**
 * 가이드 명단·좌석 대시보드 순수 로직 — AtoC 통합 플랜 §5.4b / §11.B B1.
 *
 * DB·React 무의존 순수 함수만. 명단 대시보드(GuideSeatDashboard)·좌석 스트립
 * (GuideSeatStrip)·카운터바가 전부 이 모듈을 공유한다 — 단일 소스 원칙:
 * roster(bookings) + ops_seat_assignments 를 받아 행/칩/집계/게이트를 계산한다.
 */

import { maskGuestName } from './claim';
import { extractHighlights, groupBookingsByPickup, type ManifestBooking, type ManifestGroup } from '@/lib/ops/manifest/group';

/** ops_seat_assignments 행의 대시보드 관련 부분집합 (booking 단위). */
export interface DashboardAssignment {
  seat_number: number;
  booking_id: string;
  guest_label?: string | null;
  checked_in_at?: string | null;
  absent_at?: string | null;
  locked?: boolean | null;
}

/** 명단 행 상태 — 좌석/체크인/노쇼 관점 (§5.4b 그린/대기/노쇼). */
export type RosterRowStatus =
  | 'unseated' // claim만/좌석 미지정 (§5.4b "좌석 미지정" 뱃지)
  | 'seated' // 좌석 지정, 미체크인
  | 'partial' // party 일부만 체크인
  | 'checked_in' // 전원 체크인 (그린)
  | 'absent'; // 노쇼 (한 좌석이라도 absent면 행은 노쇼로 강조)

export interface RosterRow {
  bookingId: string;
  name: string;
  partySize: number;
  channel: string | null;
  seatNumbers: number[];
  status: RosterRowStatus;
  highlights: string[];
  specialRequests: string | null;
  contactPhone: string | null;
  whatsapp: string | null;
  pickupName: string | null;
  pickupTime: string | null;
  preferredLanguage: string | null;
}

function assignmentsForBooking(
  assignments: DashboardAssignment[],
  bookingId: string,
): DashboardAssignment[] {
  return assignments
    .filter((a) => a.booking_id === bookingId)
    .sort((a, b) => a.seat_number - b.seat_number);
}

/** 단일 booking의 좌석 상태 판정 (§5.4b 행 상태). */
export function rosterRowStatus(seatAssignments: DashboardAssignment[]): RosterRowStatus {
  if (seatAssignments.length === 0) return 'unseated';
  if (seatAssignments.some((a) => a.absent_at)) return 'absent';
  const checkedIn = seatAssignments.filter((a) => a.checked_in_at).length;
  if (checkedIn === 0) return 'seated';
  if (checkedIn === seatAssignments.length) return 'checked_in';
  return 'partial';
}

/** roster + assignments → 명단 행 (booking 단위, 좌석·상태·특이사항 결합). */
export function buildRosterRows(
  bookings: ManifestBooking[],
  assignments: DashboardAssignment[],
): RosterRow[] {
  return bookings.map((b) => {
    const mine = assignmentsForBooking(assignments, b.id);
    return {
      bookingId: b.id,
      name: b.contactName?.trim() || maskGuestName(b.contactName),
      partySize: Math.max(1, b.partySize || 1),
      channel: b.source ?? null,
      seatNumbers: mine.map((a) => a.seat_number),
      status: rosterRowStatus(mine),
      highlights: extractHighlights(b.specialRequests),
      specialRequests: b.specialRequests ?? null,
      contactPhone: b.contactPhone ?? null,
      whatsapp: b.whatsapp ?? null,
      pickupName: b.pickupName ?? null,
      pickupTime: b.pickupTime ?? null,
      preferredLanguage: b.preferredLanguage ?? null,
    };
  });
}

/** 픽업지 그룹 + 각 그룹의 행 (아코디언 렌더용). */
export interface RosterPickupGroup {
  group: ManifestGroup;
  rows: RosterRow[];
}

export function buildRosterGroups(
  bookings: ManifestBooking[],
  assignments: DashboardAssignment[],
): RosterPickupGroup[] {
  const rowByBooking = new Map(buildRosterRows(bookings, assignments).map((r) => [r.bookingId, r]));
  return groupBookingsByPickup(bookings).map((group) => ({
    group,
    rows: group.bookings.map((b) => rowByBooking.get(b.id)!).filter(Boolean),
  }));
}

/** 상단 카운터바 집계 (pax 기준 — 플랜 "총 14명·6팀 | 체크인 11 | 대기 2 | 노쇼 1"). */
export interface DashboardCounts {
  teams: number;
  totalPax: number;
  checkedInPax: number;
  absentPax: number;
  waitingPax: number;
}

export function dashboardCounts(
  bookings: ManifestBooking[],
  assignments: DashboardAssignment[],
): DashboardCounts {
  const teams = bookings.length;
  const totalPax = bookings.reduce((s, b) => s + Math.max(1, b.partySize || 1), 0);
  let checkedInPax = 0;
  let absentPax = 0;
  for (const a of assignments) {
    if (a.absent_at) absentPax += 1;
    else if (a.checked_in_at) checkedInPax += 1;
  }
  // 대기 = 총원 − 체크인 − 노쇼 (좌석 미지정 게스트도 대기에 포함).
  const waitingPax = Math.max(0, totalPax - checkedInPax - absentPax);
  return { teams, totalPax, checkedInPax, absentPax, waitingPax };
}

/**
 * 시작 게이트 상태 (§5.4 C-15/C-16). 배정된 전 좌석이 {checked_in | absent}
 * 이면 활성 — 미충족 시 미체크인 인원 안내. 배정 0건이면 비활성(빈 룸 방지).
 */
export interface GateStatus {
  enabled: boolean;
  /** 배정 중 미해결(미체크인·비노쇼) 좌석 수 — "N명 미체크인" 안내용. */
  pendingCount: number;
  hasAssignments: boolean;
}

export function gateStatus(assignments: DashboardAssignment[]): GateStatus {
  const hasAssignments = assignments.length > 0;
  const pendingCount = assignments.filter((a) => !a.checked_in_at && !a.absent_at).length;
  return {
    enabled: hasAssignments && pendingCount === 0,
    pendingCount,
    hasAssignments,
  };
}

/** 좌석 스트립 칩 (§11.B B1 / §12 Q6). */
export interface SeatChip {
  key: string;
  bookingId: string;
  /** 지정 좌석번호 — 미지정(Q6 회색 칩)은 null. */
  seatNumber: number | null;
  label: string;
  checkedIn: boolean;
  absent: boolean;
  /** true = 좌석 미지정 게스트 (회색 "－ 이름" 칩, Q6). */
  unseated: boolean;
}

/**
 * 채팅 헤더 좌석 스트립 빌드 (§11.B B1): 지정 좌석 칩(좌석번호순, 체크인 그린)
 * + 좌석 미지정 게스트 회색 칩(Q6 — §5.4b 미지정 뱃지와 동일 소스).
 */
export function buildSeatStrip(
  bookings: ManifestBooking[],
  assignments: DashboardAssignment[],
): SeatChip[] {
  const nameByBooking = new Map(bookings.map((b) => [b.id, b.contactName?.trim() || maskGuestName(b.contactName)]));

  const seated: SeatChip[] = [...assignments]
    .sort((a, b) => a.seat_number - b.seat_number)
    .map((a) => ({
      key: `seat-${a.seat_number}`,
      bookingId: a.booking_id,
      seatNumber: a.seat_number,
      label: (a.guest_label && a.guest_label.trim()) || nameByBooking.get(a.booking_id) || 'Guest',
      checkedIn: Boolean(a.checked_in_at) && !a.absent_at,
      absent: Boolean(a.absent_at),
      unseated: false,
    }));

  const seatedBookingIds = new Set(assignments.map((a) => a.booking_id));
  const unseated: SeatChip[] = bookings
    .filter((b) => !seatedBookingIds.has(b.id))
    .map((b) => ({
      key: `unseated-${b.id}`,
      bookingId: b.id,
      seatNumber: null,
      label: nameByBooking.get(b.id) || 'Guest',
      checkedIn: false,
      absent: false,
      unseated: true,
    }));

  return [...seated, ...unseated];
}
