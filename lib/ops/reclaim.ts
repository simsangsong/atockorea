/**
 * 재claim 승인 큐 순수 계층 — AtoC 통합 플랜 §5.2 C-5.
 *
 * 플랜 원문: "이미 claim된 이름을 다른 사람이 탭한 경우 → 재claim 요청은
 * 운영자 승인 큐로 (탈취 방지). 기존 디바이스 토큰은 승인 시 폐기."
 *
 * 서버는 이미 절반을 한다: claim 라우트가 409를 주고 `reclaim_requested`
 * 이벤트 + ops 푸시를 남긴다. 없는 건 **사람이 판정하는 큐**와 **승인 시
 * 기존 토큰 폐기**다. 이 파일은 그 큐의 순수 부분 — 이벤트 로그
 * (tour_room_events)를 요청↔결정 쌍으로 접는다. 별도 테이블을 만들지
 * 않는 이유: 결정도 감사 대상이고, 감사 로그는 이미 여기다.
 *
 * 멱등 키 계약은 claim 라우트가 쓰는 것과 **글자 그대로 같아야 한다**:
 *   subject_key = `reclaim:{bookingId}:{deviceKey}`
 * (app/api/ops/rooms/[roomId]/claim/route.ts 참조. 여기서 다른 모양을 쓰면
 *  요청과 결정이 영원히 짝을 못 찾는다.)
 *
 * DB·React 무의존 순수 함수만 — admin 라우트와 큐 화면이 공유한다.
 */

export const RECLAIM_REQUESTED = 'reclaim_requested';
export const RECLAIM_APPROVED = 'reclaim_approved';
export const RECLAIM_REJECTED = 'reclaim_rejected';

export const RECLAIM_EVENT_TYPES = [RECLAIM_REQUESTED, RECLAIM_APPROVED, RECLAIM_REJECTED] as const;

export type ReclaimDecision = 'approve' | 'reject';
export type ReclaimStatus = 'pending' | 'approved' | 'rejected';

/** claim 라우트와 동일한 subject_key. 변경 금지 (짝짓기 키). */
export function reclaimSubjectKey(bookingId: string, deviceKey: string): string {
  return `reclaim:${bookingId}:${deviceKey}`;
}

export function parseReclaimSubjectKey(
  subjectKey: string | null | undefined,
): { bookingId: string; deviceKey: string } | null {
  if (!subjectKey) return null;
  const parts = subjectKey.split(':');
  if (parts.length !== 3 || parts[0] !== 'reclaim') return null;
  if (!parts[1] || !parts[2]) return null;
  return { bookingId: parts[1], deviceKey: parts[2] };
}

/** 디바이스 키는 전체를 화면에 뿌리지 않는다 — 식별에 필요한 만큼만. */
export function maskDeviceKey(deviceKey: string | null | undefined): string {
  if (!deviceKey) return '—';
  if (deviceKey.length <= 12) return deviceKey;
  return `${deviceKey.slice(0, 8)}…${deviceKey.slice(-4)}`;
}

export interface ReclaimEventLike {
  id: string;
  room_id: string;
  booking_id: string | null;
  type: string;
  actor_role?: string | null;
  subject_key: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface ReclaimRequestRow {
  subjectKey: string;
  requestEventId: string;
  roomId: string;
  bookingId: string;
  deviceKey: string;
  requestedAt: string;
  status: ReclaimStatus;
  decidedAt: string | null;
  decisionEventId: string | null;
  /** 결정 이벤트 payload (승인자·폐기된 토큰 수 등 감사 정보). */
  decisionPayload: Record<string, unknown> | null;
}

/**
 * 이벤트 로그 → 큐. 같은 subject_key의 요청 하나에 결정 최대 하나가 붙는다
 * (claim 라우트가 subject_key로 멱등 INSERT하므로 요청은 디바이스당 1행).
 *
 * 정렬: 미결(pending) 먼저, 각 그룹 안에서는 최신 요청 먼저 — 운영자가
 * 화면을 열었을 때 "지금 처리해야 할 것"이 항상 맨 위다.
 */
export function buildReclaimQueue(events: ReclaimEventLike[]): ReclaimRequestRow[] {
  const requests = new Map<string, ReclaimEventLike>();
  const decisions = new Map<string, ReclaimEventLike>();

  for (const event of events) {
    const key = event.subject_key;
    if (!key || !parseReclaimSubjectKey(key)) continue;
    if (event.type === RECLAIM_REQUESTED) {
      const existing = requests.get(key);
      // 같은 키의 요청이 여러 개면 가장 이른 것 = 최초 요청 시각.
      if (!existing || event.created_at < existing.created_at) requests.set(key, event);
    } else if (event.type === RECLAIM_APPROVED || event.type === RECLAIM_REJECTED) {
      const existing = decisions.get(key);
      // 결정은 마지막 것이 유효 (정상 경로에서는 1건).
      if (!existing || event.created_at > existing.created_at) decisions.set(key, event);
    }
  }

  const rows: ReclaimRequestRow[] = [];
  for (const [key, request] of requests) {
    const parsed = parseReclaimSubjectKey(key)!;
    const decision = decisions.get(key) ?? null;
    rows.push({
      subjectKey: key,
      requestEventId: request.id,
      roomId: request.room_id,
      bookingId: request.booking_id ?? parsed.bookingId,
      deviceKey: parsed.deviceKey,
      requestedAt: request.created_at,
      status: decision ? (decision.type === RECLAIM_APPROVED ? 'approved' : 'rejected') : 'pending',
      decidedAt: decision?.created_at ?? null,
      decisionEventId: decision?.id ?? null,
      decisionPayload: decision?.payload ?? null,
    });
  }

  return rows.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return a.requestedAt < b.requestedAt ? 1 : a.requestedAt > b.requestedAt ? -1 : 0;
  });
}

export function pendingReclaims(rows: ReclaimRequestRow[]): ReclaimRequestRow[] {
  return rows.filter((row) => row.status === 'pending');
}

/**
 * 결정 가능 여부 — 기본은 항상 "불가"다 (자동 승인 없음).
 * ① 그 디바이스의 요청이 실제로 큐에 있어야 하고,
 * ② 아직 결정되지 않았어야 하며,
 * ③ 운영자가 confirm을 명시해야 한다 (2단계 액션).
 */
export type ReclaimGateResult =
  | { ok: true; row: ReclaimRequestRow }
  | { ok: false; status: number; error: string; message: string };

export function gateReclaimDecision(
  rows: ReclaimRequestRow[],
  input: { bookingId: string; deviceKey: string; confirm: unknown },
): ReclaimGateResult {
  const key = reclaimSubjectKey(input.bookingId, input.deviceKey);
  const row = rows.find((candidate) => candidate.subjectKey === key);
  if (!row) {
    return {
      ok: false,
      status: 404,
      error: 'reclaim_not_found',
      message: '이 디바이스의 재등록 요청을 찾을 수 없어요.',
    };
  }
  if (row.status !== 'pending') {
    return {
      ok: false,
      status: 409,
      error: 'already_decided',
      message: `이미 ${row.status === 'approved' ? '승인' : '거절'}된 요청이에요.`,
    };
  }
  if (input.confirm !== true) {
    return {
      ok: false,
      status: 400,
      error: 'confirm_required',
      message: '승인/거절은 확인 단계를 거쳐야 해요.',
    };
  }
  return { ok: true, row };
}
