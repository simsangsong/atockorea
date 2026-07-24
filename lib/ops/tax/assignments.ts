/**
 * 가이드 배정 원장 헬퍼 — AtoC 통합 플랜 §6.9.
 *
 * 이 원장이 왜 새로 필요했는지: `tour_rooms`에는 guide_id가 없고(booking_id /
 * tour_id / tour_date만), 가이드는 지금까지 `tour_room_invites`로 링크를 받는
 * 존재였다. 즉 "이 가이드가 이 달에 어떤 투어를 했는가"의 진짜 소스가 없어서
 * 월 정산 배치를 만들 수 없었다. ops_guide_assignments가 그 소스다.
 *
 * 순수 계층만 여기 둔다(쓰기 payload 조립 + 날짜 계산). 조회·쓰기는 라우트가
 * 하고, 집계는 settlement.ts가 한다 — 규칙은 네트워크 없이 테스트한다.
 */

export const ASSIGNMENT_ROLES = ['guide', 'driver', 'both'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export const ASSIGNMENT_STATUSES = ['planned', 'worked', 'cancelled'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** 정산 대상은 이것뿐이다 — 사람이 "실제로 일했다"고 확인한 배정(설계 결정 4). */
export const SETTLEABLE_STATUS: AssignmentStatus = 'worked';

/** API가 돌려주는 컬럼. 배정 원장에는 PII가 없다(가이드 이름은 조인으로 붙인다). */
export const ASSIGNMENT_SELECT_COLUMNS =
  'id, guide_id, booking_id, room_id, tour_date, tour_type, role, amount_krw, status, note, created_at, updated_at';

export interface AssignmentRow {
  id: string;
  guide_id: string;
  booking_id: string | null;
  room_id: string | null;
  tour_date: string;
  tour_type: string;
  role: string;
  amount_krw: number | null;
  status: string;
  note: string | null;
  created_at?: string;
  updated_at?: string;
}

export type AssignmentWriteError =
  | 'guide_required'
  | 'date_invalid'
  | 'tour_type_required'
  | 'role_invalid'
  | 'status_invalid'
  | 'amount_invalid'
  | 'empty_patch';

export type AssignmentWriteResult =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; code: AssignmentWriteError; message: string };

const MESSAGES: Record<AssignmentWriteError, string> = {
  guide_required: '가이드를 선택해 주세요.',
  date_invalid: '투어일은 YYYY-MM-DD 형식이어야 해요.',
  tour_type_required: '투어 유형을 입력해 주세요 (단가표의 유형과 같은 값).',
  role_invalid: '역할은 가이드·기사·겸업 중 하나여야 해요.',
  status_invalid: '상태는 예정·완료·취소 중 하나여야 해요.',
  amount_invalid: '금액은 0 이상의 정수(원)여야 해요.',
  empty_patch: '변경할 내용이 없어요.',
};

/** 'YYYY-MM-DD' 실재 날짜만 통과 (2026-02-30 같은 값은 거른다). */
export function isValidYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 'YYYY-MM' 형식만 통과. */
export function isValidPeriod(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

/** 'YYYY-MM' → 그 달의 첫날·마지막날('YYYY-MM-DD'). tour_date 범위 조회용. */
export function periodDateBounds(period: string): { first: string; last: string } {
  if (!isValidPeriod(period)) throw new Error(`Invalid period: ${period}`);
  const [y, m] = period.split('-').map(Number);
  // 다음 달 0일 = 이번 달 말일. UTC로 계산하고 문자열만 쓴다(타임존 무관).
  const lastDay = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0)).getUTCDate();
  return { first: `${period}-01`, last: `${period}-${String(lastDay).padStart(2, '0')}` };
}

/** 'YYYY-MM-DD' → 'YYYY-MM'. */
export function periodOf(tourDate: string): string {
  return tourDate.slice(0, 7);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * 배정 쓰기 필드 조립.
 *
 * `amount_krw`는 "안 건드림"(undefined) / "단가표에서 해석"(null) / "이 금액으로
 * 못박음"(정수)의 세 상태를 구분한다. 0은 유효한 스냅샷이다 — "무보수 배정"과
 * "단가 미설정"은 다른 사실이고, 그 구분을 잃으면 정산이 조용히 0원을 지급한다.
 */
export function buildAssignmentWrite(
  input: Record<string, unknown>,
  mode: 'create' | 'update',
): AssignmentWriteResult {
  const fields: Record<string, unknown> = {};

  if (mode === 'create') {
    const guideId = text(input.guideId ?? input.guide_id);
    if (!guideId) return { ok: false, code: 'guide_required', message: MESSAGES.guide_required };
    fields.guide_id = guideId;

    const tourDate = input.tourDate ?? input.tour_date;
    if (!isValidYmd(tourDate)) return { ok: false, code: 'date_invalid', message: MESSAGES.date_invalid };
    fields.tour_date = tourDate;

    const tourType = text(input.tourType ?? input.tour_type);
    if (!tourType) return { ok: false, code: 'tour_type_required', message: MESSAGES.tour_type_required };
    fields.tour_type = tourType;
  } else {
    const tourDate = input.tourDate ?? input.tour_date;
    if (tourDate !== undefined) {
      if (!isValidYmd(tourDate)) return { ok: false, code: 'date_invalid', message: MESSAGES.date_invalid };
      fields.tour_date = tourDate;
    }
    const tourType = input.tourType ?? input.tour_type;
    if (tourType !== undefined) {
      const value = text(tourType);
      if (!value) return { ok: false, code: 'tour_type_required', message: MESSAGES.tour_type_required };
      fields.tour_type = value;
    }
  }

  const bookingId = nullableText(input.bookingId ?? input.booking_id);
  if (bookingId !== undefined) fields.booking_id = bookingId;
  const roomId = nullableText(input.roomId ?? input.room_id);
  if (roomId !== undefined) fields.room_id = roomId;
  const note = nullableText(input.note);
  if (note !== undefined) fields.note = note;

  const role = input.role;
  if (role !== undefined) {
    const value = text(role);
    if (!value || !(ASSIGNMENT_ROLES as readonly string[]).includes(value)) {
      return { ok: false, code: 'role_invalid', message: MESSAGES.role_invalid };
    }
    fields.role = value;
  }

  const status = input.status;
  if (status !== undefined) {
    const value = text(status);
    if (!value || !(ASSIGNMENT_STATUSES as readonly string[]).includes(value)) {
      return { ok: false, code: 'status_invalid', message: MESSAGES.status_invalid };
    }
    fields.status = value;
  }

  const rawAmount = input.amountKrw ?? input.amount_krw;
  if (rawAmount !== undefined) {
    if (rawAmount === null || rawAmount === '') {
      fields.amount_krw = null; // 단가표에서 해석하라는 뜻.
    } else {
      const n = typeof rawAmount === 'string' ? Number(rawAmount.replace(/[, ]/g, '')) : Number(rawAmount);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return { ok: false, code: 'amount_invalid', message: MESSAGES.amount_invalid };
      }
      fields.amount_krw = n;
    }
  }

  if (mode === 'update') {
    if (Object.keys(fields).length === 0) {
      return { ok: false, code: 'empty_patch', message: MESSAGES.empty_patch };
    }
    fields.updated_at = new Date().toISOString();
  }

  return { ok: true, fields };
}

/**
 * 배정 행들 → (guideId → 그 날짜 배정 건수). 배정 추천의 감점 신호.
 * 취소된 배정은 세지 않는다 — 취소는 그 사람이 비어 있다는 뜻이다.
 */
export function assignedCountsFor(
  rows: Array<Pick<AssignmentRow, 'guide_id' | 'status'>> | null | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    if (row.status === 'cancelled') continue;
    counts.set(row.guide_id, (counts.get(row.guide_id) ?? 0) + 1);
  }
  return counts;
}
