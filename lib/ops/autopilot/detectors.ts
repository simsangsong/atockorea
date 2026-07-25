/**
 * 오토파일럿 탐지기 — 관제 W5
 * (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §6).
 *
 * ⚠️ `lib/ops/parse/autopilot-trigger.ts`는 **OTA 파서용 동명이인**이다. 무관하다.
 *
 * 원칙: **실행하지 않고 제안한다.** 이 파일은 사실을 보고 "사람이 봐야 할 것"의
 * 목록을 만들 뿐이고, 배정·배차·발송을 하지 않는다. 자동 배정이 틀리면 손님에게
 * 직접 노출되고, 그 비용이 자동화의 이득보다 크다(설계안 §1-7).
 *
 * 전부 순수 함수다. 조회는 `runner.ts`가 한다.
 */

import { resolveRate, type GuideRateRow } from '@/lib/ops/guides/rates';

export const SUGGESTION_KINDS = [
  'guide_unassigned',
  'vehicle_unassigned',
  'capacity_over',
  'rate_missing',
  'settlement_pending',
] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export type Severity = 'high' | 'medium' | 'low';

export interface Suggestion {
  kind: SuggestionKind;
  severity: Severity;
  /** 멱등의 축. 같은 문제는 몇 번 점검해도 같은 키다. */
  subjectKey: string;
  tourDate: string | null;
  title: string;
  detail: string | null;
  /** 화면 이동·자동채움용 최소 사실. 🔴 손님 PII 금지. */
  payload: Record<string, unknown>;
}

export interface DetectorInputs {
  /** 점검 기준일 'YYYY-MM-DD' (KST). */
  today: string;
  /** 앞으로 며칠까지 볼 것인가. */
  horizonDays: number;
  /** 대상 기간의 투어(룸 단위). */
  tours: Array<{
    roomId: string;
    bookingId: string | null;
    tourDate: string;
    tourTitle: string | null;
    /** 예약 인원. null = 미상. */
    guests: number | null;
    tourType: string;
  }>;
  /** 배정 원장(취소 포함 — 여기서 거른다). */
  assignments: Array<{
    id: string;
    guideId: string;
    guideName: string | null;
    roomId: string | null;
    bookingId: string | null;
    tourDate: string;
    tourType: string;
    amountKrw: number | null;
    status: string;
  }>;
  /** 배차 인스턴스 + 해석된 정원(null = 미상). */
  dispatches: Array<{
    id: string;
    roomId: string | null;
    plate: string | null;
    capacity: number | null;
  }>;
  rates: GuideRateRow[];
  /** 직전 달의 정산 상태. */
  previousPeriod: {
    period: string;
    /** 그 달의 worked 배정 수. */
    workedCount: number;
    /** 그 달에 이미 만들어진 정산행 수. */
    settlementCount: number;
  } | null;
}

/** 'YYYY-MM-DD' 에 n일 더하기 (UTC date-only; KST는 DST가 없어 오프셋 프리). */
function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** D-day 가 가까울수록 심각하다. 사람이 손쓸 시간이 남았는가가 유일한 기준이다. */
export function urgencyFromLeadTime(today: string, tourDate: string): Severity {
  const days = Math.round(
    (new Date(`${tourDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000,
  );
  if (days <= 2) return 'high';
  if (days <= 7) return 'medium';
  return 'low';
}

/**
 * 규칙 5종. 반환 순서는 결정론적이다(같은 입력 → 같은 순서) — 큐가 매번 뒤섞이면
 * 사람이 "새 항목"을 알아볼 수 없다.
 */
export function detectSuggestions(input: DetectorInputs): Suggestion[] {
  const out: Suggestion[] = [];
  const horizonEnd = addDays(input.today, input.horizonDays);

  const upcoming = input.tours
    .filter((t) => t.tourDate >= input.today && t.tourDate <= horizonEnd)
    .sort((a, b) => (a.tourDate === b.tourDate ? a.roomId.localeCompare(b.roomId) : a.tourDate < b.tourDate ? -1 : 1));

  const liveAssignments = input.assignments.filter((a) => a.status !== 'cancelled');
  const assignedRoomIds = new Set(liveAssignments.map((a) => a.roomId).filter(Boolean));
  const assignedBookingIds = new Set(liveAssignments.map((a) => a.bookingId).filter(Boolean));

  const dispatchesByRoom = new Map<string, DetectorInputs['dispatches']>();
  for (const d of input.dispatches) {
    if (!d.roomId) continue;
    const list = dispatchesByRoom.get(d.roomId) ?? [];
    list.push(d);
    dispatchesByRoom.set(d.roomId, list);
  }

  for (const tour of upcoming) {
    // ① 가이드 미배정. 룸으로도 예약으로도 걸린 배정이 없어야 미배정이다 —
    //    배정 원장은 둘 중 하나만 채워지는 경우가 흔하다.
    const hasGuide =
      assignedRoomIds.has(tour.roomId) || (tour.bookingId != null && assignedBookingIds.has(tour.bookingId));
    if (!hasGuide) {
      out.push({
        kind: 'guide_unassigned',
        severity: urgencyFromLeadTime(input.today, tour.tourDate),
        subjectKey: `guide_unassigned:${tour.roomId}`,
        tourDate: tour.tourDate,
        title: `가이드 미배정 — ${tour.tourDate}`,
        detail: tour.tourTitle ? `${tour.tourTitle}${tour.guests ? ` · ${tour.guests}명` : ''}` : null,
        payload: { roomId: tour.roomId, bookingId: tour.bookingId, tourType: tour.tourType },
      });
    }

    // ② 차량 미배차.
    const dispatches = dispatchesByRoom.get(tour.roomId) ?? [];
    if (dispatches.length === 0) {
      out.push({
        kind: 'vehicle_unassigned',
        severity: urgencyFromLeadTime(input.today, tour.tourDate),
        subjectKey: `vehicle_unassigned:${tour.roomId}`,
        tourDate: tour.tourDate,
        title: `차량 미배차 — ${tour.tourDate}`,
        detail: tour.tourTitle ? `${tour.tourTitle}${tour.guests ? ` · ${tour.guests}명` : ''}` : null,
        payload: { roomId: tour.roomId, bookingId: tour.bookingId },
      });
    } else if (tour.guests != null) {
      // ③ 정원 초과. **정원 미상(null)은 초과로 치지 않는다** — 모르는 것을
      //    문제라고 부르면 차량 마스터를 안 채운 동안 큐가 거짓 경고로 가득 찬다.
      const known = dispatches.filter((d) => d.capacity != null);
      if (known.length > 0) {
        const seats = known.reduce((sum, d) => sum + (d.capacity ?? 0), 0);
        if (seats < tour.guests) {
          out.push({
            kind: 'capacity_over',
            severity: 'high', // 안전 문제 — 리드타임과 무관하게 높다.
            subjectKey: `capacity_over:${tour.roomId}`,
            tourDate: tour.tourDate,
            title: `정원 부족 — ${tour.tourDate}`,
            detail: `좌석 ${seats}석 · 예약 ${tour.guests}명 (${known.map((d) => d.plate ?? '차량').join(', ')})`,
            payload: { roomId: tour.roomId, seats, guests: tour.guests },
          });
        }
      }
    }
  }

  // ④ 단가 미설정. worked 인데 금액도 단가표도 없으면 정산이 0원을 지급한다.
  const rateMissing = liveAssignments
    .filter((a) => a.status === 'worked' && a.amountKrw == null)
    .filter((a) => !resolveRate(input.rates, { guideId: a.guideId, tourType: a.tourType, onDate: a.tourDate }))
    .sort((a, b) => (a.tourDate === b.tourDate ? a.id.localeCompare(b.id) : a.tourDate < b.tourDate ? -1 : 1));
  for (const a of rateMissing) {
    out.push({
      kind: 'rate_missing',
      severity: 'high', // 돈이 틀리는 문제다.
      subjectKey: `rate_missing:${a.id}`,
      tourDate: a.tourDate,
      title: `단가 미설정 — ${a.guideName ?? '가이드'} · ${a.tourDate}`,
      detail: `${a.tourType} 배정에 단가가 없어 월 정산에서 0원으로 잡힙니다.`,
      payload: { assignmentId: a.id, guideId: a.guideId, tourType: a.tourType, tourDate: a.tourDate },
    });
  }

  // ⑤ 전월 미정산.
  const prev = input.previousPeriod;
  if (prev && prev.workedCount > 0 && prev.settlementCount === 0) {
    out.push({
      kind: 'settlement_pending',
      severity: 'medium',
      subjectKey: `settlement_pending:${prev.period}`,
      tourDate: null,
      title: `${prev.period} 정산 미실행`,
      detail: `일했음 배정 ${prev.workedCount}건이 아직 정산되지 않았습니다.`,
      payload: { period: prev.period, workedCount: prev.workedCount },
    });
  }

  return out;
}

export const KIND_LABEL: Record<SuggestionKind, string> = {
  guide_unassigned: '가이드 미배정',
  vehicle_unassigned: '차량 미배차',
  capacity_over: '정원 부족',
  rate_missing: '단가 미설정',
  settlement_pending: '정산 미실행',
};

/** 제안 → 화면이 보낼 곳. 실행이 아니라 **이동**이다(§1-7). */
export function actionHref(s: { kind: SuggestionKind; payload: Record<string, unknown> }): string {
  switch (s.kind) {
    case 'rate_missing':
      return `/admin/guides?guideId=${String(s.payload.guideId ?? '')}&tab=rates`;
    case 'settlement_pending':
      return `/admin/guide-settlements?period=${String(s.payload.period ?? '')}`;
    case 'guide_unassigned':
      return '/admin/guides?tab=assignments';
    default:
      return '/admin/tour-ops';
  }
}

export const ACTION_LABEL: Record<SuggestionKind, string> = {
  guide_unassigned: '배정 화면으로',
  vehicle_unassigned: '관제센터로',
  capacity_over: '관제센터로',
  rate_missing: '단가 설정으로',
  settlement_pending: '정산 화면으로',
};
