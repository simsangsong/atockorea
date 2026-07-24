/**
 * 가이드 단가 해석 — AtoC 통합 플랜 §6.9.
 *
 * 규칙 (마이그레이션 설계 결정 4와 한 쌍):
 *   1. 가이드별 오버라이드(guide_id = 그 가이드)가 테넌트 기본단가(guide_id NULL)를
 *      이긴다. 오버라이드가 하나라도 유효하면 기본단가는 보지 않는다.
 *   2. 같은 층위 안에서는 `effective_from <= onDate` 중 가장 최신이 이긴다.
 *      미래 시행 단가는 그날이 오기 전까지 무시된다.
 *   3. 유효한 행이 없으면 null — 0원이 아니다. "단가 미설정"과 "무보수"는 다른
 *      사실이고, 정산(다음 슬라이스)이 그 구분을 잃으면 조용히 0원을 지급한다.
 *
 * 순수 함수다. 조회는 라우트가 하고 여기서는 정렬·선택만 한다(테스트 가능성).
 */

export interface GuideRateRow {
  id?: string;
  /** null = 테넌트 기본단가. */
  guide_id: string | null;
  tour_type: string;
  amount_krw: number;
  /** 'YYYY-MM-DD'. */
  effective_from: string;
  note?: string | null;
}

export interface ResolvedRate {
  amountKrw: number;
  /** 'guide' = 가이드별 오버라이드, 'default' = 테넌트 기본단가. */
  scope: 'guide' | 'default';
  effectiveFrom: string;
  rowId: string | null;
  note: string | null;
}

/** 같은 층위 안에서 onDate 기준 최신 유효 행. 없으면 null. */
function latestEffective(rows: GuideRateRow[], onDate: string): GuideRateRow | null {
  let best: GuideRateRow | null = null;
  for (const row of rows) {
    if (!row.effective_from || row.effective_from > onDate) continue; // 미래 시행 단가
    if (!best || row.effective_from > best.effective_from) best = row;
  }
  return best;
}

/**
 * (가이드, 투어타입, 날짜)의 유효 단가. rows는 해당 tour_type으로 이미 좁혀져
 * 있어도 되고 전체여도 된다 — 여기서 한 번 더 거른다.
 */
export function resolveRate(
  rows: GuideRateRow[] | null | undefined,
  opts: { guideId: string; tourType: string; onDate: string },
): ResolvedRate | null {
  if (!rows || rows.length === 0) return null;
  const scoped = rows.filter((r) => r.tour_type === opts.tourType);
  if (scoped.length === 0) return null;

  const override = latestEffective(scoped.filter((r) => r.guide_id === opts.guideId), opts.onDate);
  const chosen = override ?? latestEffective(scoped.filter((r) => r.guide_id == null), opts.onDate);
  if (!chosen) return null;

  return {
    amountKrw: chosen.amount_krw,
    scope: override ? 'guide' : 'default',
    effectiveFrom: chosen.effective_from,
    rowId: chosen.id ?? null,
    note: chosen.note ?? null,
  };
}

/**
 * 한 가이드의 "현재 단가표" — 타입별로 지금 유효한 값 하나씩. 가이드 상세 화면의
 * 단가 탭이 이걸 그대로 렌더한다.
 */
export function currentRateTable(
  rows: GuideRateRow[] | null | undefined,
  opts: { guideId: string; onDate: string },
): Array<ResolvedRate & { tourType: string }> {
  if (!rows || rows.length === 0) return [];
  const types = [...new Set(rows.map((r) => r.tour_type))].sort();
  const out: Array<ResolvedRate & { tourType: string }> = [];
  for (const tourType of types) {
    const resolved = resolveRate(rows, { guideId: opts.guideId, tourType, onDate: opts.onDate });
    if (resolved) out.push({ ...resolved, tourType });
  }
  return out;
}
