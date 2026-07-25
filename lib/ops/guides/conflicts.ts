/**
 * 가이드 배정 충돌 판정 — 관제 W2
 * (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §3).
 *
 * DB 트리거가 최종 방어선이고, 이 파일은 **사람에게 보여줄 판정**을 만든다.
 * 두 계층이 필요한 이유는 서로 다른 일을 하기 때문이다:
 *
 *   · 트리거는 "절대 저장되면 안 되는 것"만 막는다. 동시 편집·직접 SQL·다른
 *     라우트에서도 뚫리지 않아야 하므로 DB에 있다. 대신 경고를 만들 수 없다 —
 *     경고는 저장을 막지 않으니까.
 *   · 이 모듈은 저장 **전에** 블록과 경고를 함께 계산한다. `?dryRun=1`이 이것만
 *     돌려서, 화면이 [저장]을 누르기 전에 "휴무일입니다 / 단가가 없습니다"를
 *     보여줄 수 있다.
 *
 * 경고 7(단가 미설정)이 이 트랙의 핵심 연결고리다. 지금까지 단가 누락은 배정
 * 시점에 아무 신호가 없다가 월말 정산 배치에서 `unresolved`로 나타났다 — 즉
 * "0원으로 때울 뻔한 상태"를 사람이 한 달 뒤에 알았다. 배정할 때 말해 주면
 * 그 자리에서 단가를 넣는다.
 *
 * 전부 순수 함수다. 조회는 라우트가 하고 여기엔 네트워크가 없다.
 */

import { resolveRate, type GuideRateRow } from './rates';

/** 하드 블록 — 저장이 거부된다(오버라이드 가능 여부는 항목마다 다르다). */
export const BLOCK_CODES = [
  'guide_inactive',
  'guide_unavailable',
  'time_overlap',
  'duplicate_slot',
] as const;
export type BlockCode = (typeof BLOCK_CODES)[number];

/** 경고 — 저장은 되지만 사람이 봐야 하는 사실. */
export const WARNING_CODES = ['multiple_same_day', 'language_mismatch', 'rate_missing'] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export interface ConflictItem {
  code: BlockCode | WarningCode;
  message: string;
  /** 사유를 적으면 통과시킬 수 있는 항목인가. 경고는 항상 false(막지 않으므로). */
  overridable: boolean;
  /** 부딪힌 상대 배정 id — 화면이 그 행을 가리킬 수 있게. */
  conflictsWith?: string;
}

export interface ConflictResult {
  blocked: ConflictItem[];
  warnings: ConflictItem[];
}

/** 판정에 필요한 기존 배정의 최소 형태. */
export interface ExistingAssignment {
  id: string;
  guide_id: string;
  tour_date: string;
  booking_id: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
}

/** 판정 대상(저장하려는 배정). */
export interface CandidateAssignment {
  /** 수정 중이면 자기 자신의 id — 자기와 충돌한다고 하면 안 된다. */
  id?: string | null;
  guideId: string;
  tourDate: string;
  tourType: string;
  bookingId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
  conflictOverride?: boolean;
}

export interface ConflictContext {
  /** 같은 가이드의 같은 날짜 기존 배정들(취소 포함 — 여기서 걸러낸다). */
  sameDayAssignments: ExistingAssignment[];
  /** 가이드가 활성인가. null = 모름(판정 생략). */
  guideActive?: boolean | null;
  /** 그날이 휴무로 등록돼 있는가. */
  guideUnavailable?: boolean;
  /** 가이드가 구사하는 언어 코드. */
  guideLanguages?: string[] | null;
  /** 예약이 요청한 언어 코드. */
  bookingLanguage?: string | null;
  /** 단가 이력 전체(resolveRate가 해석한다). */
  rates?: GuideRateRow[] | null;
  /** 배정에 금액이 못박혀 있으면 단가표를 볼 필요가 없다. */
  amountKrw?: number | null;
}

/** 'HH:MM' / 'HH:MM:SS' → 분. 파싱 실패는 null(= 시각 미상). */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 두 구간이 겹치는가. **양쪽 다 시작·끝이 있을 때만** 판정한다.
 *
 * 시각을 모르는 배정을 "종일"로 간주해 겹쳤다고 하면, 시각이 아직 안 들어온
 * 초기 배정 하나가 그날 전체를 잠근다. 모르는 것은 모른다고 두고 경고(규칙 5)로
 * 넘기는 것이 맞다.
 */
export function overlaps(
  a: { start: string | null | undefined; end: string | null | undefined },
  b: { start: string | null | undefined; end: string | null | undefined },
): boolean {
  const aStart = timeToMinutes(a.start);
  const aEnd = timeToMinutes(a.end);
  const bStart = timeToMinutes(b.start);
  const bEnd = timeToMinutes(b.end);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** 언어 코드 정규화 — 'ko-KR' → 'ko', 'zh-CN' → 'zh-cn'(지역 구분이 의미 있는 경우만 유지). */
function normalizeLang(code: string): string {
  const lower = code.trim().toLowerCase();
  if (lower.startsWith('zh')) return lower.replace('_', '-');
  return lower.split(/[-_]/)[0];
}

/**
 * 가이드가 그 언어를 하는가. 중국어만 지역(zh-cn / zh-tw)을 구분한다 — 간체·번체
 * 안내는 실제로 다른 일이고, 나머지 언어는 지역 변종이 안내에 영향을 주지 않는다.
 */
export function speaksLanguage(guideLanguages: string[] | null | undefined, wanted: string): boolean {
  if (!guideLanguages || guideLanguages.length === 0) return false;
  const target = normalizeLang(wanted);
  return guideLanguages.some((l) => normalizeLang(l) === target);
}

const MESSAGES = {
  guide_inactive: '이 가이드는 비활성 상태예요. 먼저 가이드 관리에서 활성으로 바꿔 주세요.',
  guide_unavailable: '이 날짜는 가이드의 휴무일로 등록돼 있어요.',
  time_overlap: '같은 가이드의 시간이 겹치는 배정이 이미 있어요.',
  duplicate_slot: '같은 가이드·같은 날짜·같은 예약의 배정이 이미 있어요.',
  multiple_same_day: '이 가이드는 같은 날 이미 다른 배정이 있어요. 시각을 입력하면 겹침을 정확히 확인할 수 있어요.',
  rate_missing:
    '이 가이드·투어유형·날짜에 해당하는 단가가 없어요. 지금 넣지 않으면 월말 정산에서 0원으로 잡힙니다.',
} as const;

/**
 * 규칙 1~7 판정.
 *
 * `conflictOverride`가 켜져 있으면 오버라이드 가능한 블록(휴무일·시간겹침)은
 * 결과에서 빠진다 — 화면이 "사유를 적으면 통과합니다"를 보여준 뒤 다시 부를 때
 * 같은 경고가 반복되지 않게.
 */
export function detectAssignmentConflicts(
  candidate: CandidateAssignment,
  context: ConflictContext,
): ConflictResult {
  const blocked: ConflictItem[] = [];
  const warnings: ConflictItem[] = [];

  // 취소 배정은 아무 자리도 차지하지 않는다(트리거와 같은 규칙).
  if (candidate.status === 'cancelled') return { blocked, warnings };

  const override = candidate.conflictOverride === true;

  // 규칙 4 — 비활성 가이드. 오버라이드 불가.
  if (context.guideActive === false) {
    blocked.push({ code: 'guide_inactive', message: MESSAGES.guide_inactive, overridable: false });
  }

  // 규칙 3 — 휴무일. 오버라이드 가능.
  if (context.guideUnavailable && !override) {
    blocked.push({ code: 'guide_unavailable', message: MESSAGES.guide_unavailable, overridable: true });
  }

  const others = (context.sameDayAssignments ?? []).filter(
    (row) => row.status !== 'cancelled' && row.id !== candidate.id,
  );

  // 규칙 2 — 완전 중복. 오버라이드 불가.
  //   booking_id 가 둘 다 NULL이고 시각도 같으면 서로 구별할 수 없는 같은 행이다.
  const candidateBooking = candidate.bookingId ?? null;
  const candidateStart = candidate.startTime ?? null;
  const duplicate = others.find((row) => {
    if (candidateBooking !== null || row.booking_id !== null) {
      return row.booking_id === candidateBooking && candidateBooking !== null;
    }
    return timeToMinutes(row.start_time) === timeToMinutes(candidateStart);
  });
  if (duplicate) {
    blocked.push({
      code: 'duplicate_slot',
      message: MESSAGES.duplicate_slot,
      overridable: false,
      conflictsWith: duplicate.id,
    });
  }

  // 규칙 1 — 시간 겹침. 오버라이드 가능.
  if (!override) {
    const clash = others.find((row) =>
      overlaps(
        { start: row.start_time, end: row.end_time },
        { start: candidate.startTime, end: candidate.endTime },
      ),
    );
    if (clash) {
      blocked.push({
        code: 'time_overlap',
        message: MESSAGES.time_overlap,
        overridable: true,
        conflictsWith: clash.id,
      });
    }
  }

  // 규칙 5 — 같은 날 2건 이상(시각 미상). 겹침을 이미 잡았으면 중복 안내하지 않는다.
  const hasTimeBlock = blocked.some((b) => b.code === 'time_overlap' || b.code === 'duplicate_slot');
  if (others.length > 0 && !hasTimeBlock) {
    warnings.push({ code: 'multiple_same_day', message: MESSAGES.multiple_same_day, overridable: false });
  }

  // 규칙 6 — 언어 불일치. 통역 동반 등 예외가 실제로 있어 경고까지만.
  const wanted = context.bookingLanguage?.trim();
  if (wanted && !speaksLanguage(context.guideLanguages, wanted)) {
    warnings.push({
      code: 'language_mismatch',
      message: `예약 언어(${wanted})를 이 가이드의 등록 언어에서 찾지 못했어요.`,
      overridable: false,
    });
  }

  // 규칙 7 — 단가 미설정. 이 트랙이 이으려는 바로 그 구멍.
  //   금액이 못박혀 있으면(0 포함) 단가표를 볼 이유가 없다.
  const pinned = typeof context.amountKrw === 'number' && Number.isFinite(context.amountKrw);
  if (!pinned) {
    const resolved = resolveRate(context.rates ?? [], {
      guideId: candidate.guideId,
      tourType: candidate.tourType,
      onDate: candidate.tourDate,
    });
    if (!resolved) {
      warnings.push({ code: 'rate_missing', message: MESSAGES.rate_missing, overridable: false });
    }
  }

  return { blocked, warnings };
}

/**
 * DB 트리거·제약이 던진 에러 → 이 모듈의 코드. 라우트가 500 대신 409를 낼 수
 * 있게 하는 번역기다. 매칭에 실패하면 null — 모르는 에러를 충돌인 척하지 않는다.
 */
export function blockCodeFromDbError(message: string | null | undefined): BlockCode | null {
  const text = message ?? '';
  if (text.includes('assignment_guide_inactive')) return 'guide_inactive';
  if (text.includes('assignment_guide_unavailable')) return 'guide_unavailable';
  if (text.includes('assignment_time_overlap')) return 'time_overlap';
  if (text.includes('ops_guide_assignments_dateslot_uniq')) return 'duplicate_slot';
  if (text.includes('ops_guide_assignments_uniq')) return 'duplicate_slot';
  return null;
}

/** 코드 → 사람이 읽는 한국어 한 줄. */
export function blockMessage(code: BlockCode): string {
  return MESSAGES[code];
}
