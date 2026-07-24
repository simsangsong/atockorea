/**
 * 가이드 월 정산 배치 — AtoC 통합 플랜 §6.9.
 *
 *   worked 배정 수집 → 단가 해석 → 가이드별 gross 합산 → 3.3% 원천징수
 *   → ops_guide_settlements upsert(멱등) → ops_entity_ledger(kr) 비용 행 기입
 *
 * 계약 (코디네이터 확정 — 마이그레이션 주석과 한 쌍):
 *   · **status='worked' 배정만** 집계한다. planned/cancelled는 돈이 아니다.
 *   · 단가는 `amount_krw` 스냅샷이 있으면 그것이 이기고, 없으면
 *     `lib/ops/guides/rates.ts`의 resolveRate로 (가이드, 타입, 투어일)을 푼다.
 *     둘 다 없으면 **0원으로 때우지 않고** unresolved로 보고한다 — "단가 미설정"과
 *     "무보수"는 다른 사실이고, 조용히 0원을 지급하는 것이 최악이다.
 *   · **실비변상은 gross에 섞이지 않는다**(원천징수 대상 아님). 배치는
 *     reimbursement_krw를 계산하지 않고 기존 값을 보존만 한다 — 자세한 이유는
 *     아래 REIMBURSEMENT_SOURCE_NOTE.
 *   · 금액은 전부 정수 KRW. 반올림·평균 없음.
 *   · 멱등: UNIQUE(tenant_id, guide_id, period). 같은 달을 몇 번 돌려도 가이드당
 *     1행이고, 원장도 external_ref 부분 유니크로 1행이다.
 *   · status='paid'인 정산행은 금액을 다시 쓰지 않는다 — 이미 지급된 숫자가 소리
 *     없이 바뀌면 지급 증빙과 장부가 어긋난다. locked로 보고하고 사람이 판단한다.
 *   · 🔴 D10: 여기서 이체·제출·발송하는 것은 하나도 없다. 'paid'는 사후 기록이다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRate, type GuideRateRow } from '@/lib/ops/guides/rates';
import { computeWithholding } from './withholding';
import {
  SETTLEABLE_STATUS,
  isValidPeriod,
  periodDateBounds,
  type AssignmentRow,
} from './assignments';

export const TAX_TENANT_ID = 'atockorea';

/**
 * 실비변상의 소스가 왜 자동이 아닌가 — 실스키마를 직접 확인한 결과:
 *
 *   `tour_room_extras(room_id, booking_id, item, amount_krw, payer, kind, status)`
 *   에는 guide_id가 없고, payer는 'guide' | 'driver' 라는 **역할 문자열**이다.
 *   배정 원장(booking_id)으로 사람을 역추적하는 것 자체는 가능하지만, 그보다 먼저
 *   돈의 방향이 다르다: 이 테이블은 캡슐 문구("당일 가이드에게 현금 정산해요",
 *   "현금 수취 완료")가 말하듯 **손님이 가이드에게 당일 현금으로 갚는 rail**이다
 *   (플랜 P-D2: LEDGER는 기록·투명성 장치, Stripe 미개입).
 *
 *   그러므로 이 값을 회사→가이드 실비변상으로 옮겨 적으면 가이드가 같은 대납을
 *   두 번 받는다. 그래서 배치는 tour_room_extras를 읽지 않고, reimbursement_krw는
 *   사람이 정산 화면에서 입력하는 값으로 남긴다(회사가 실제로 갚아야 하는 실비 —
 *   손님에게 받지 못한 대납 등 — 는 사람만 판단할 수 있다).
 */
export const REIMBURSEMENT_SOURCE_NOTE =
  'tour_room_extras는 손님→가이드 현금 rail이라 회사 실비변상으로 자동 전용하지 않는다. reimbursement_krw는 사람이 입력한다.';

/** 원장 기입 어휘 — 기존 CHECK('revenue','commission','remit','fee','expense')를 재사용. */
export const GUIDE_PAYOUT_LEDGER_ENTITY = 'kr';
export const GUIDE_PAYOUT_LEDGER_TYPE = 'expense';
export const GUIDE_PAYOUT_LEDGER_SOURCE = 'guide_settlement';
/** KRW는 소수 단위가 없다 — minor unit = 원. currency로 그 사실을 명시한다. */
export const GUIDE_PAYOUT_LEDGER_CURRENCY = 'KRW';

export const SETTLEMENT_STATUSES = ['draft', 'confirmed', 'paid'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const SETTLEMENT_SELECT_COLUMNS =
  'id, tenant_id, guide_id, period, gross_krw, income_tax_krw, local_tax_krw, withheld_krw, net_krw, reimbursement_krw, payout_krw, assignment_count, status, paid_at, paid_note, created_at, updated_at';

export interface GuideSettlementRow {
  id: string;
  tenant_id: string;
  guide_id: string;
  period: string;
  gross_krw: number;
  income_tax_krw: number;
  local_tax_krw: number;
  withheld_krw: number;
  net_krw: number;
  reimbursement_krw: number;
  payout_krw: number;
  assignment_count: number;
  status: string;
  paid_at: string | null;
  paid_note: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// 순수 집계
// ---------------------------------------------------------------------------

export interface UnresolvedAssignment {
  assignmentId: string;
  guideId: string;
  tourDate: string;
  tourType: string;
}

export interface GuideAggregate {
  guideId: string;
  /** 용역대가 합계(실비 제외). */
  grossKrw: number;
  assignmentCount: number;
  /** 단가를 못 찾아 0원으로 들어간 배정들. 화면이 경고로 띄운다. */
  unresolved: UnresolvedAssignment[];
}

/**
 * worked 배정 → 가이드별 합계. 순수 함수(네트워크 없음).
 *
 * 단가 우선순위: 배정의 amount_krw 스냅샷 > ops_guide_rates 해석 > 미해석(0 + 보고).
 * 정렬은 guideId 사전순 — 같은 입력이면 같은 순서로 나와야 문서가 결정론적이다.
 */
export function aggregateWorkedAssignments(
  assignments: AssignmentRow[] | null | undefined,
  rates: GuideRateRow[] | null | undefined,
): GuideAggregate[] {
  const byGuide = new Map<string, GuideAggregate>();

  for (const a of assignments ?? []) {
    if (a.status !== SETTLEABLE_STATUS) continue;

    const bucket = byGuide.get(a.guide_id) ?? {
      guideId: a.guide_id,
      grossKrw: 0,
      assignmentCount: 0,
      unresolved: [],
    };

    // 0은 유효한 스냅샷이다(무보수 배정). null/undefined만 "단가표에서 풀어라".
    let amount: number | null = null;
    if (typeof a.amount_krw === 'number' && Number.isFinite(a.amount_krw)) {
      amount = Math.max(0, Math.floor(a.amount_krw));
    } else {
      const resolved = resolveRate(rates, {
        guideId: a.guide_id,
        tourType: a.tour_type,
        onDate: a.tour_date,
      });
      amount = resolved ? Math.max(0, Math.floor(resolved.amountKrw)) : null;
    }

    if (amount === null) {
      bucket.unresolved.push({
        assignmentId: a.id,
        guideId: a.guide_id,
        tourDate: a.tour_date,
        tourType: a.tour_type,
      });
    } else {
      bucket.grossKrw += amount;
    }
    bucket.assignmentCount += 1;
    byGuide.set(a.guide_id, bucket);
  }

  return [...byGuide.values()].sort((a, b) => (a.guideId < b.guideId ? -1 : a.guideId > b.guideId ? 1 : 0));
}

export interface SettlementAmounts {
  grossKrw: number;
  incomeTaxKrw: number;
  localTaxKrw: number;
  withheldKrw: number;
  netKrw: number;
  reimbursementKrw: number;
  payoutKrw: number;
}

/**
 * gross + 실비 → 정산 금액 일습. 실비는 원천징수 대상이 아니므로 세액 계산 뒤에
 * 더해진다(payout = net + 실비). DB의 CHECK 3개와 정확히 같은 항등식이다.
 */
export function computeSettlementAmounts(grossKrw: number, reimbursementKrw = 0): SettlementAmounts {
  const w = computeWithholding(grossKrw);
  const reimbursement = Number.isFinite(reimbursementKrw) ? Math.max(0, Math.floor(reimbursementKrw)) : 0;
  return {
    grossKrw: w.gross,
    incomeTaxKrw: w.incomeTax,
    localTaxKrw: w.localIncomeTax,
    withheldKrw: w.totalWithheld,
    netKrw: w.net,
    reimbursementKrw: reimbursement,
    payoutKrw: w.net + reimbursement,
  };
}

/** 정산 행 payload (upsert에 그대로 실린다). */
export function settlementPayload(
  guideId: string,
  period: string,
  amounts: SettlementAmounts,
  assignmentCount: number,
  opts: { tenantId?: string; nowIso?: string; status?: SettlementStatus } = {},
): Record<string, unknown> {
  return {
    tenant_id: opts.tenantId ?? TAX_TENANT_ID,
    guide_id: guideId,
    period,
    gross_krw: amounts.grossKrw,
    income_tax_krw: amounts.incomeTaxKrw,
    local_tax_krw: amounts.localTaxKrw,
    withheld_krw: amounts.withheldKrw,
    net_krw: amounts.netKrw,
    reimbursement_krw: amounts.reimbursementKrw,
    payout_krw: amounts.payoutKrw,
    assignment_count: assignmentCount,
    ...(opts.status ? { status: opts.status } : {}),
    updated_at: opts.nowIso ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// IO — 조회
// ---------------------------------------------------------------------------

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeSettlementRow(raw: Record<string, unknown>): GuideSettlementRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id ?? TAX_TENANT_ID),
    guide_id: String(raw.guide_id),
    period: String(raw.period),
    gross_krw: num(raw.gross_krw),
    income_tax_krw: num(raw.income_tax_krw),
    local_tax_krw: num(raw.local_tax_krw),
    withheld_krw: num(raw.withheld_krw),
    net_krw: num(raw.net_krw),
    reimbursement_krw: num(raw.reimbursement_krw),
    payout_krw: num(raw.payout_krw),
    assignment_count: num(raw.assignment_count),
    status: String(raw.status ?? 'draft'),
    paid_at: (raw.paid_at as string) ?? null,
    paid_note: (raw.paid_note as string) ?? null,
    created_at: (raw.created_at as string) ?? undefined,
    updated_at: (raw.updated_at as string) ?? undefined,
  };
}

/**
 * 한 번에 읽는 배정 행 상한. 상한에 닿으면 잘라내지 않고 던진다 — 정산은 금액이라
 * 일부만 집계한 그럴듯한 숫자보다 명시적 실패가 낫다(finance 슬라이스와 같은 방침).
 */
export const ASSIGNMENT_FETCH_LIMIT = 5000;

export async function fetchWorkedAssignments(
  supabase: SupabaseClient,
  period: string,
  tenantId = TAX_TENANT_ID,
): Promise<AssignmentRow[]> {
  const { first, last } = periodDateBounds(period);
  const { data, error } = await supabase
    .from('ops_guide_assignments')
    .select('id, guide_id, booking_id, room_id, tour_date, tour_type, role, amount_krw, status, note')
    .eq('tenant_id', tenantId)
    .eq('status', SETTLEABLE_STATUS)
    .gte('tour_date', first)
    .lte('tour_date', last)
    .limit(ASSIGNMENT_FETCH_LIMIT);
  if (error) throw new Error(error.message ?? 'assignment lookup failed');
  const rows = (data ?? []) as AssignmentRow[];
  if (rows.length >= ASSIGNMENT_FETCH_LIMIT) {
    throw new Error(
      `ops_guide_assignments page limit reached for ${period} (${rows.length} rows) — a truncated read would silently under-pay a guide; add pagination before settling this period`,
    );
  }
  return rows;
}

export async function fetchRates(
  supabase: SupabaseClient,
  tenantId = TAX_TENANT_ID,
): Promise<GuideRateRow[]> {
  const { data, error } = await supabase
    .from('ops_guide_rates')
    .select('id, guide_id, tour_type, amount_krw, effective_from, note')
    .eq('tenant_id', tenantId)
    .limit(2000);
  if (error) throw new Error(error.message ?? 'rate lookup failed');
  return (data ?? []) as GuideRateRow[];
}

export async function listSettlements(
  supabase: SupabaseClient,
  period: string,
  tenantId = TAX_TENANT_ID,
): Promise<GuideSettlementRow[]> {
  const { data, error } = await supabase
    .from('ops_guide_settlements')
    .select(SETTLEMENT_SELECT_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message ?? 'settlement list failed');
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeSettlementRow);
}

/** 연간 서식(지급명세서)용 — 해당 연도 전체 정산행. */
export async function listSettlementsForYear(
  supabase: SupabaseClient,
  year: string,
  tenantId = TAX_TENANT_ID,
): Promise<GuideSettlementRow[]> {
  const { data, error } = await supabase
    .from('ops_guide_settlements')
    .select(SETTLEMENT_SELECT_COLUMNS)
    .eq('tenant_id', tenantId)
    .gte('period', `${year}-01`)
    .lte('period', `${year}-12`)
    .order('period', { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message ?? 'settlement year list failed');
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeSettlementRow);
}

// ---------------------------------------------------------------------------
// IO — 원장 기입 (kr 사이드 비용)
// ---------------------------------------------------------------------------

/**
 * 가이드 지급의 한국법인 비용 행. 멱등 키는 external_ref = 정산행 id이고,
 * 마이그레이션의 부분 유니크 인덱스가 그것을 DB 레벨에서 강제한다.
 *
 * 금액은 회사가 실제로 부담하는 총액 = gross + 실비다(원천징수분은 가이드 대신
 * 세무서에 내는 돈이므로 여전히 회사의 비용 유출이다). 부호는 원장 규약대로
 * 유출 = 음수. 내역은 meta에 남긴다 — 세액 대사 시 원장만 보고도 재구성 가능해야
 * 한다.
 *
 * 절대 throw하지 않는다: 정산 자체는 성공했는데 원장 기입 실패로 전체가 롤백되면
 * 사람이 같은 달을 다시 돌려야 한다(멱등이라 안전하지만 무의미한 실패다).
 */
export async function recordGuidePayoutLedger(
  supabase: SupabaseClient,
  row: GuideSettlementRow,
): Promise<{ ok: boolean; action: 'inserted' | 'updated' | 'skipped'; error?: string }> {
  try {
    const amountMinor = -(row.gross_krw + row.reimbursement_krw);
    const payload = {
      tenant_id: row.tenant_id,
      entity: GUIDE_PAYOUT_LEDGER_ENTITY,
      booking_id: null,
      period: row.period,
      type: GUIDE_PAYOUT_LEDGER_TYPE,
      amount_minor: amountMinor,
      currency: GUIDE_PAYOUT_LEDGER_CURRENCY,
      source: GUIDE_PAYOUT_LEDGER_SOURCE,
      external_ref: row.id,
      note: `가이드 월 정산 ${row.period}`,
      meta: {
        guide_id: row.guide_id,
        gross_krw: row.gross_krw,
        withheld_krw: row.withheld_krw,
        net_krw: row.net_krw,
        reimbursement_krw: row.reimbursement_krw,
        payout_krw: row.payout_krw,
        assignment_count: row.assignment_count,
      },
    };

    const { data: existing, error: readError } = await supabase
      .from('ops_entity_ledger')
      .select('id, amount_minor')
      .eq('source', GUIDE_PAYOUT_LEDGER_SOURCE)
      .eq('external_ref', row.id)
      .maybeSingle();
    if (readError) return { ok: false, action: 'skipped', error: readError.message };

    if (existing) {
      const current = (existing as { id: string; amount_minor: number }).amount_minor;
      if (Number(current) === amountMinor) return { ok: true, action: 'skipped' };
      const { error } = await supabase
        .from('ops_entity_ledger')
        .update({ amount_minor: amountMinor, meta: payload.meta, note: payload.note })
        .eq('id', (existing as { id: string }).id);
      if (error) return { ok: false, action: 'skipped', error: error.message };
      return { ok: true, action: 'updated' };
    }

    const { error } = await supabase.from('ops_entity_ledger').insert(payload);
    // 동시 실행 레이스 — 부분 유니크 인덱스가 튕겨냈다면 이미 기입된 것이다.
    if (error) return { ok: false, action: 'skipped', error: error.message };
    return { ok: true, action: 'inserted' };
  } catch (e) {
    return { ok: false, action: 'skipped', error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// IO — 월 배치
// ---------------------------------------------------------------------------

export interface RunSettlementResult {
  period: string;
  rows: GuideSettlementRow[];
  created: number;
  updated: number;
  /** status='paid'라 금액을 다시 쓰지 않은 정산행들. */
  locked: GuideSettlementRow[];
  /** 단가를 못 찾은 배정 — 0원으로 들어갔으니 사람이 봐야 한다. */
  unresolved: UnresolvedAssignment[];
  /** 원장 기입 실패(정산 자체는 성공). */
  ledgerErrors: string[];
  assignmentCount: number;
}

/**
 * 월 정산 배치. 같은 달을 몇 번 돌려도 결과가 같다(멱등).
 *
 * 재실행이 하는 일:
 *   · 새 worked 배정이 생겼으면 금액을 갱신한다(늦게 확정되는 게 정상이다).
 *   · 배정이 전부 취소돼 0건이 된 가이드의 기존 draft/confirmed 행은 0으로
 *     되돌린다 — 지우지 않는 이유는 "정산했더니 0원이었다"와 "정산한 적 없다"가
 *     다른 사실이기 때문이고, 남겨두면 원장 행도 0으로 맞출 수 있다.
 *   · paid 행은 건드리지 않는다(locked로 보고).
 */
export async function runGuideSettlement(
  supabase: SupabaseClient,
  period: string,
  opts: { tenantId?: string; nowIso?: string } = {},
): Promise<RunSettlementResult> {
  if (!isValidPeriod(period)) throw new Error(`Invalid period: ${period}`);
  const tenantId = opts.tenantId ?? TAX_TENANT_ID;
  const nowIso = opts.nowIso ?? new Date().toISOString();

  const [assignments, rates, existingRows] = await Promise.all([
    fetchWorkedAssignments(supabase, period, tenantId),
    fetchRates(supabase, tenantId),
    listSettlements(supabase, period, tenantId),
  ]);

  const aggregates = aggregateWorkedAssignments(assignments, rates);
  const existingByGuide = new Map(existingRows.map((r) => [r.guide_id, r]));

  // 배정이 사라진 가이드도 0원으로 다시 계산 대상에 넣는다(위 주석).
  const targets = new Map<string, GuideAggregate>();
  for (const agg of aggregates) targets.set(agg.guideId, agg);
  for (const row of existingRows) {
    if (!targets.has(row.guide_id)) {
      targets.set(row.guide_id, { guideId: row.guide_id, grossKrw: 0, assignmentCount: 0, unresolved: [] });
    }
  }

  const locked: GuideSettlementRow[] = [];
  const payloads: Record<string, unknown>[] = [];
  let created = 0;
  let updated = 0;

  for (const agg of [...targets.values()].sort((a, b) => (a.guideId < b.guideId ? -1 : 1))) {
    const existing = existingByGuide.get(agg.guideId);
    if (existing && existing.status === 'paid') {
      locked.push(existing);
      continue;
    }
    // 실비는 사람이 넣은 값을 보존한다 — 배치는 절대 만들지 않는다.
    const amounts = computeSettlementAmounts(agg.grossKrw, existing?.reimbursement_krw ?? 0);
    payloads.push(settlementPayload(agg.guideId, period, amounts, agg.assignmentCount, { tenantId, nowIso }));
    if (existing) updated += 1;
    else created += 1;
  }

  let rows: GuideSettlementRow[] = [];
  if (payloads.length > 0) {
    const { data, error } = await supabase
      .from('ops_guide_settlements')
      .upsert(payloads, { onConflict: 'tenant_id,guide_id,period' })
      .select(SETTLEMENT_SELECT_COLUMNS);
    if (error) throw new Error(error.message ?? 'settlement upsert failed');
    rows = ((data ?? []) as Record<string, unknown>[]).map(normalizeSettlementRow);
  }

  // upsert가 행을 돌려주지 않는 환경(select 미지원 스텁 등)에서도 원장을 맞출 수
  // 있도록 재조회로 수렴한다. 조회가 비면 그냥 원장 기입을 건너뛴다.
  if (rows.length === 0 && payloads.length > 0) {
    rows = await listSettlements(supabase, period, tenantId);
  }

  const ledgerErrors: string[] = [];
  for (const row of rows) {
    if (row.status === 'paid') continue;
    const result = await recordGuidePayoutLedger(supabase, row);
    if (!result.ok && result.error) ledgerErrors.push(`${row.guide_id}: ${result.error}`);
  }

  return {
    period,
    rows: [...rows, ...locked],
    created,
    updated,
    locked,
    unresolved: aggregates.flatMap((a) => a.unresolved),
    ledgerErrors,
    assignmentCount: assignments.length,
  };
}
