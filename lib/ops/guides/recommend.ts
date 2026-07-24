/**
 * 배정 추천 — AtoC 통합 플랜 §6.9 / §11.F.
 *
 * kursoflow(`src/lib/guides/recommend.ts`)의 "점수 + 사유 배열" 형태를 포팅했다.
 * 사유(reasons)를 함께 돌려주는 것이 핵심 설계다 — 관제 화면에서 "왜 이 사람이
 * 1순위인지"가 보이지 않으면 추천은 신뢰받지 못하고 결국 아무도 안 쓴다.
 *
 * 이 시스템에 맞춘 차이:
 *   · 정원(max_party_size)·코스 이력은 아직 원장이 없으므로 점수에서 뺐다.
 *     대신 관광통역안내사 자격(certified)과 유형(guide_type) 적합도를 쓴다.
 *   · 휴무는 배정을 차단하지 않는다(§11.F trust-based NOTICE). 휴무자는 목록에서
 *     지우는 게 아니라 맨 뒤로 밀고 `unavailable: true` + 사유를 단다 — 화면이
 *     경고를 띄우되 사람이 끝까지 고를 수 있어야 한다.
 *   · 같은 날 이미 배정된 가이드는 제외가 아니라 감점이다(하루 2탕은 실제로 있다).
 *
 * 순수 함수 계층(scoreGuides)과 조회 계층(recommendGuides)이 갈려 있다 — 점수
 * 규칙은 네트워크 없이 테스트한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidYmd } from './availability';

export interface RecommendableGuide {
  id: string;
  name: string;
  languages: string[] | null;
  guide_type: string | null;
  certified: boolean | null;
  active?: boolean | null;
}

export interface GuideRecommendation {
  guide: {
    id: string;
    name: string;
    languages: string[];
    guideType: string | null;
    certified: boolean;
  };
  score: number;
  reasons: string[];
  /** 그날 휴무로 등록되어 있는가 (배정을 막지는 않는다 — 경고용). */
  unavailable: boolean;
  /** 그날 이미 배정된 건수 (호출부가 알려준 만큼). */
  assignedCount: number;
}

export interface ScoreOptions {
  /** 손님 언어 (예: 'en', 'ja'). 없으면 언어 점수는 0. */
  language?: string | null;
  /** 필요한 유형: 'driver' | 'bus_guide'. 'both' 가이드는 둘 다 충족한다. */
  needType?: string | null;
  /** 그날 휴무인 가이드 id들. */
  unavailableGuideIds?: Iterable<string> | null;
  /** 그날 이미 배정된 건수 (guideId → 건수). */
  assignedCounts?: Map<string, number> | null;
  limit?: number;
}

/** 점수 배점 — 한 곳에 모아둬야 나중에 조정할 때 흩어지지 않는다. */
export const SCORE = {
  languageMatch: 40,
  certified: 15,
  typeMatch: 10,
  /** 하루 중복 배정 1건당 감점 (제외가 아니라 순위 하락). */
  alreadyAssigned: -25,
} as const;

function normalizeLang(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** 'zh-CN' → 'zh' 까지 봐준다(가이드는 보통 'zh'로 등록한다). */
function langMatches(guideLangs: Set<string>, want: string): boolean {
  if (!want) return false;
  if (guideLangs.has(want)) return true;
  const base = want.split('-')[0];
  return base !== want && guideLangs.has(base);
}

/** 순수 점수 계산 — 정렬된 추천 목록. 네트워크·DB 없음. */
export function scoreGuides(
  guides: RecommendableGuide[] | null | undefined,
  opts: ScoreOptions = {},
): GuideRecommendation[] {
  if (!guides || guides.length === 0) return [];
  const unavailable = new Set(opts.unavailableGuideIds ?? []);
  const assigned = opts.assignedCounts ?? new Map<string, number>();
  const want = normalizeLang(opts.language);
  const needType = (opts.needType ?? '').trim();

  const scored: GuideRecommendation[] = [];
  for (const g of guides) {
    if (g.active === false) continue;
    const langs = (g.languages ?? []).map(normalizeLang).filter(Boolean);
    const langSet = new Set(langs);
    const assignedCount = assigned.get(g.id) ?? 0;
    const isOff = unavailable.has(g.id);
    const reasons: string[] = [];
    let score = 0;

    if (want) {
      if (langMatches(langSet, want)) {
        score += SCORE.languageMatch;
        reasons.push(`${want.toUpperCase()} 가능`);
      } else {
        reasons.push(`⚠️ ${want.toUpperCase()} 미등록`);
      }
    }

    if (g.certified) {
      score += SCORE.certified;
      reasons.push('관광통역안내사 자격');
    }

    if (needType) {
      if (g.guide_type === needType || g.guide_type === 'both') {
        score += SCORE.typeMatch;
        reasons.push(needType === 'driver' ? '운전 가능' : '안내 가능');
      } else {
        reasons.push(`⚠️ 유형 불일치 (${g.guide_type ?? '미지정'})`);
      }
    }

    if (assignedCount > 0) {
      score += SCORE.alreadyAssigned * assignedCount;
      reasons.push(`⚠️ 이 날짜 이미 ${assignedCount}건 배정됨`);
    }

    // 휴무는 제외가 아니라 "맨 뒤 + 경고" (§11.F). 사람이 끝까지 고를 수 있다.
    if (isOff) reasons.unshift('⚠️ 이 날짜 휴무');

    scored.push({
      guide: {
        id: g.id,
        name: g.name,
        languages: langs,
        guideType: g.guide_type ?? null,
        certified: Boolean(g.certified),
      },
      score,
      reasons,
      unavailable: isOff,
      assignedCount,
    });
  }

  scored.sort((a, b) => {
    if (a.unavailable !== b.unavailable) return a.unavailable ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return a.guide.name.localeCompare(b.guide.name, 'ko');
  });

  const limit = opts.limit ?? scored.length;
  return scored.slice(0, Math.max(0, limit));
}

export interface RecommendOptions extends Omit<ScoreOptions, 'unavailableGuideIds'> {
  tenantId: string;
  /** 'YYYY-MM-DD' (KST 투어일). */
  date: string;
}

/**
 * 조회 + 점수.
 *
 * 배정 건수의 출처가 두 개다:
 *   1. **ops_guide_assignments** — 그 날짜에 실제로 등록된 배정(취소 제외).
 *      정산 슬라이스가 만든 원장이고, 이제 이게 1차 소스다.
 *   2. 호출부가 넘긴 assignedCounts — 화면에서 방금 고른, 아직 저장 안 된 사람.
 * 둘을 **합산**한다. 저장된 1건 + 화면에서 방금 고른 1건 = 2탕이라는 사실이
 * 점수에 반영돼야 하기 때문이다. 배정 테이블이 아직 없는 환경(마이그레이션 적용
 * 전)에서는 조회가 실패해도 추천이 죽지 않고 2번만으로 동작한다.
 */
export async function recommendGuides(
  supabase: SupabaseClient,
  opts: RecommendOptions,
): Promise<GuideRecommendation[]> {
  if (!isValidYmd(opts.date)) return [];

  const { data: guides, error } = await supabase
    .from('ops_guides')
    .select('id, name, languages, guide_type, certified, active')
    .eq('tenant_id', opts.tenantId)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error || !guides || guides.length === 0) return [];

  const { data: off } = await supabase
    .from('ops_guide_unavailable_dates')
    .select('guide_id')
    .eq('tenant_id', opts.tenantId)
    .eq('date', opts.date);

  const unavailableGuideIds = ((off ?? []) as Array<{ guide_id: string }>).map((r) => r.guide_id);

  const assignedCounts = new Map(opts.assignedCounts ?? []);
  try {
    const { data: assigned } = await supabase
      .from('ops_guide_assignments')
      .select('guide_id, status')
      .eq('tenant_id', opts.tenantId)
      .eq('tour_date', opts.date);
    for (const row of (assigned ?? []) as Array<{ guide_id: string; status: string }>) {
      if (row.status === 'cancelled') continue;
      assignedCounts.set(row.guide_id, (assignedCounts.get(row.guide_id) ?? 0) + 1);
    }
  } catch {
    // 배정 원장 미적용 환경 — 추천은 계속 동작해야 한다.
  }

  return scoreGuides(guides as RecommendableGuide[], {
    language: opts.language,
    needType: opts.needType,
    assignedCounts,
    unavailableGuideIds,
    limit: opts.limit,
  });
}
