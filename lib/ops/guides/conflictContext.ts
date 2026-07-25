/**
 * 충돌 판정에 필요한 사실을 한 번에 모으는 로더 — 관제 W2.
 *
 * `conflicts.ts`는 순수하게 두고 조회는 여기에 몰아넣는다. 라우트 두 곳(POST /
 * PATCH)이 각자 조회하면 "어떤 사실로 판정했는가"가 갈라지고, 갈라진 판정은
 * 한쪽 경로에서만 뚫리는 구멍이 된다.
 *
 * 예약 시각도 여기서 해석한다: 배정에 시각이 직접 주어지지 않았고 booking_id가
 * 있으면 `bookings.tour_time`을 읽어 스냅샷으로 붙인다. 트리거가 조인을 타지
 * 않는 이유(§ 마이그레이션 주석)와 짝이 되는 지점 — 예약 시각이 나중에 바뀌어도
 * 이미 저장된 배정의 판정 근거는 흔들리지 않는다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { GUIDES_TENANT_ID } from './registry';
import type { GuideRateRow } from './rates';
import type { CandidateAssignment, ConflictContext, ExistingAssignment } from './conflicts';

/** 시각을 모르는 투어의 기본 소요 시간. 종료 시각을 굳이 물어보지 않게 한다. */
export const DEFAULT_TOUR_DURATION_MINUTES = 8 * 60;

/** 'HH:MM[:SS]' → 'HH:MM'. 그 외에는 null. */
export function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * 시작 시각만 아는 경우의 종료 시각. **자정을 넘기지 않는다** — 23:00 시작이
 * 다음날 07:00이 되면 그날의 겹침 판정이 무의미해지고, 야간 투어는 아직 이
 * 저장소가 다루는 개념이 아니다(투어룸 트랙에도 같은 엣지가 기록돼 있다).
 */
export function inferEndTime(start: string | null, durationMinutes = DEFAULT_TOUR_DURATION_MINUTES): string | null {
  const normalized = normalizeTime(start);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  const end = Math.min(h * 60 + m + durationMinutes, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

export interface LoadedConflictContext {
  context: ConflictContext;
  /** 배정 행에 실제로 저장할 시각(예약에서 상속했을 수 있다). */
  resolvedTimes: { startTime: string | null; endTime: string | null };
}

/**
 * 판정 컨텍스트 로드. 조회가 하나라도 실패하면 그 사실만 조용히 빠진다 —
 * 예를 들어 휴무 조회가 실패하면 휴무 블록이 안 걸린다. 그래도 **DB 트리거가
 * 최종 방어선으로 남아 있으므로** 잘못된 저장은 여전히 거부된다. 여기서 throw하면
 * 조회 장애가 배정 자체를 못 하게 만들 뿐이다.
 */
export async function loadConflictContext(
  supabase: SupabaseClient,
  candidate: CandidateAssignment,
  opts: {
    tenantId?: string;
    /**
     * 배정에 못박힌 금액. 있으면(0 포함) 단가 미설정 경고를 내지 않는다 —
     * 단가표를 볼 이유가 없기 때문이다. 라우트가 쓰기 payload에서 넘긴다.
     */
    amountKrw?: number | null;
  } = {},
): Promise<LoadedConflictContext> {
  const tenantId = opts.tenantId ?? GUIDES_TENANT_ID;

  const [guideRes, sameDayRes, unavailableRes, ratesRes, bookingRes] = await Promise.all([
    supabase.from('ops_guides').select('id, active, languages').eq('id', candidate.guideId).maybeSingle(),
    supabase
      .from('ops_guide_assignments')
      .select('id, guide_id, tour_date, booking_id, start_time, end_time, status')
      .eq('tenant_id', tenantId)
      .eq('guide_id', candidate.guideId)
      .eq('tour_date', candidate.tourDate)
      .limit(50),
    supabase
      .from('ops_guide_unavailable_dates')
      .select('id')
      .eq('guide_id', candidate.guideId)
      .eq('date', candidate.tourDate)
      .limit(1),
    supabase
      .from('ops_guide_rates')
      .select('id, guide_id, tour_type, amount_krw, effective_from, note')
      .eq('tenant_id', tenantId)
      .eq('tour_type', candidate.tourType)
      .limit(500),
    candidate.bookingId
      ? supabase
          .from('bookings')
          .select('id, tour_time, preferred_language')
          .eq('id', candidate.bookingId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const guide = guideRes.data as { active: boolean; languages: string[] | null } | null;
  const booking = bookingRes.data as { tour_time: string | null; preferred_language: string | null } | null;

  // 시각 우선순위: 사람이 입력한 값 > 예약의 tour_time > 없음.
  const startTime = normalizeTime(candidate.startTime) ?? normalizeTime(booking?.tour_time);
  const endTime = normalizeTime(candidate.endTime) ?? (startTime ? inferEndTime(startTime) : null);

  return {
    resolvedTimes: { startTime, endTime },
    context: {
      sameDayAssignments: (sameDayRes.data ?? []) as unknown as ExistingAssignment[],
      guideActive: guide ? guide.active : null,
      guideUnavailable: (unavailableRes.data ?? []).length > 0,
      guideLanguages: guide?.languages ?? null,
      bookingLanguage: booking?.preferred_language ?? null,
      rates: (ratesRes.data ?? []) as unknown as GuideRateRow[],
      amountKrw: opts.amountKrw ?? null,
    },
  };
}
