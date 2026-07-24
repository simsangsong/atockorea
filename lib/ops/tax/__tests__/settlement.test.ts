/**
 * @jest-environment node
 *
 * 가이드 월 정산 배치 (§6.9).
 *
 * 이 스위트가 지키는 계약 4가지:
 *   1. status='worked' 배정만 돈이 된다 (planned·cancelled는 0원).
 *   2. 실비변상은 gross에 절대 섞이지 않는다 — 원천징수 과세표준이 오염되면
 *      가이드가 내지 않아도 될 세금을 낸다.
 *   3. 배정의 amount_krw 스냅샷이 단가표를 이긴다.
 *   4. 같은 달을 두 번 돌려도 행이 2배가 되지 않는다(멱등).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aggregateWorkedAssignments,
  computeSettlementAmounts,
  recordGuidePayoutLedger,
  runGuideSettlement,
  settlementPayload,
  GUIDE_PAYOUT_LEDGER_SOURCE,
  type GuideSettlementRow,
} from '../settlement';
import { periodDateBounds, assignedCountsFor, type AssignmentRow } from '../assignments';
import { makeFakeDb, queriesFor, type FakeQuery } from '@/test-utils/opsSeatingFakes';
import type { GuideRateRow } from '@/lib/ops/guides/rates';

function assignment(over: Partial<AssignmentRow> = {}): AssignmentRow {
  return {
    id: over.id ?? 'a-1',
    guide_id: over.guide_id ?? 'g-1',
    booking_id: over.booking_id ?? null,
    room_id: over.room_id ?? null,
    tour_date: over.tour_date ?? '2026-08-03',
    tour_type: over.tour_type ?? 'private',
    role: over.role ?? 'guide',
    amount_krw: over.amount_krw === undefined ? null : over.amount_krw,
    status: over.status ?? 'worked',
    note: over.note ?? null,
  };
}

const RATES: GuideRateRow[] = [
  { id: 'r-default', guide_id: null, tour_type: 'private', amount_krw: 150_000, effective_from: '2026-01-01' },
  { id: 'r-g1', guide_id: 'g-1', tour_type: 'private', amount_krw: 200_000, effective_from: '2026-06-01' },
  { id: 'r-bus', guide_id: null, tour_type: 'bus', amount_krw: 120_000, effective_from: '2026-01-01' },
];

describe('periodDateBounds', () => {
  it('covers the whole month, leap February included', () => {
    expect(periodDateBounds('2026-08')).toEqual({ first: '2026-08-01', last: '2026-08-31' });
    expect(periodDateBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(periodDateBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(periodDateBounds('2026-12')).toEqual({ first: '2026-12-01', last: '2026-12-31' });
  });

  it('rejects a malformed period rather than guessing', () => {
    expect(() => periodDateBounds('2026-8')).toThrow();
  });
});

describe('aggregateWorkedAssignments', () => {
  it('counts only worked assignments', () => {
    const out = aggregateWorkedAssignments(
      [
        assignment({ id: 'a-1', status: 'worked' }),
        assignment({ id: 'a-2', status: 'planned' }),
        assignment({ id: 'a-3', status: 'cancelled' }),
      ],
      RATES,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ guideId: 'g-1', grossKrw: 200_000, assignmentCount: 1 });
  });

  it('prefers the assignment amount snapshot over the rate table', () => {
    const out = aggregateWorkedAssignments([assignment({ amount_krw: 180_000 })], RATES);
    expect(out[0].grossKrw).toBe(180_000);
  });

  it('treats a 0 snapshot as a real "unpaid" agreement, not as "no rate"', () => {
    const out = aggregateWorkedAssignments([assignment({ amount_krw: 0 })], RATES);
    expect(out[0].grossKrw).toBe(0);
    expect(out[0].unresolved).toHaveLength(0);
  });

  it('resolves the guide override, then the tenant default, by effective_from', () => {
    const out = aggregateWorkedAssignments(
      [
        assignment({ id: 'a-1', guide_id: 'g-1', tour_type: 'private' }), // 오버라이드 200,000
        assignment({ id: 'a-2', guide_id: 'g-2', tour_type: 'private' }), // 기본단가 150,000
        assignment({ id: 'a-3', guide_id: 'g-2', tour_type: 'bus' }), // 기본단가 120,000
      ],
      RATES,
    );
    expect(out.find((o) => o.guideId === 'g-1')?.grossKrw).toBe(200_000);
    expect(out.find((o) => o.guideId === 'g-2')?.grossKrw).toBe(270_000);
  });

  it('ignores a rate that has not taken effect on the tour date', () => {
    // g-1 오버라이드는 2026-06-01 시행 — 5월 투어는 기본단가로 떨어진다.
    const out = aggregateWorkedAssignments([assignment({ tour_date: '2026-05-10' })], RATES);
    expect(out[0].grossKrw).toBe(150_000);
  });

  it('reports an unresolved rate instead of silently paying 0', () => {
    const out = aggregateWorkedAssignments([assignment({ tour_type: 'cruise' })], RATES);
    expect(out[0].grossKrw).toBe(0);
    expect(out[0].unresolved).toEqual([
      { assignmentId: 'a-1', guideId: 'g-1', tourDate: '2026-08-03', tourType: 'cruise' },
    ]);
  });

  it('is deterministic in guide order', () => {
    const rows = [assignment({ id: 'a-1', guide_id: 'g-9' }), assignment({ id: 'a-2', guide_id: 'g-2' })];
    expect(aggregateWorkedAssignments(rows, RATES).map((o) => o.guideId)).toEqual(['g-2', 'g-9']);
    expect(aggregateWorkedAssignments([...rows].reverse(), RATES).map((o) => o.guideId)).toEqual(['g-2', 'g-9']);
  });
});

describe('computeSettlementAmounts — 실비는 과세표준에 섞이지 않는다', () => {
  it('withholds on 용역대가 only and adds 실비 afterwards', () => {
    const a = computeSettlementAmounts(1_000_000, 47_000);
    expect(a.grossKrw).toBe(1_000_000); // 실비가 gross에 합산되지 않았다
    expect(a.incomeTaxKrw).toBe(30_000);
    expect(a.localTaxKrw).toBe(3_000);
    expect(a.withheldKrw).toBe(33_000);
    expect(a.netKrw).toBe(967_000);
    expect(a.reimbursementKrw).toBe(47_000);
    expect(a.payoutKrw).toBe(1_014_000); // net + 실비
  });

  it('would over-withhold if 실비 were folded into gross (the bug this guards)', () => {
    const correct = computeSettlementAmounts(1_000_000, 47_000);
    const wrong = computeSettlementAmounts(1_047_000, 0);
    expect(wrong.withheldKrw).toBeGreaterThan(correct.withheldKrw);
    expect(correct.withheldKrw).toBe(33_000);
  });

  it('satisfies the three DB CHECK identities', () => {
    for (const [gross, extra] of [[0, 0], [1, 0], [333_333, 12_345], [9_999_999, 1]] as const) {
      const a = computeSettlementAmounts(gross, extra);
      expect(a.incomeTaxKrw + a.localTaxKrw).toBe(a.withheldKrw);
      expect(a.grossKrw - a.withheldKrw).toBe(a.netKrw);
      expect(a.netKrw + a.reimbursementKrw).toBe(a.payoutKrw);
    }
  });

  it('normalizes a negative or fractional 실비 to an integer won', () => {
    expect(computeSettlementAmounts(1000, -5).reimbursementKrw).toBe(0);
    expect(computeSettlementAmounts(1000, 12.9).reimbursementKrw).toBe(12);
  });
});

describe('settlementPayload', () => {
  it('carries every amount column the CHECK constraints need', () => {
    const payload = settlementPayload('g-1', '2026-08', computeSettlementAmounts(200_000), 1, {
      nowIso: '2026-09-01T00:00:00Z',
    });
    expect(payload).toMatchObject({
      tenant_id: 'atockorea',
      guide_id: 'g-1',
      period: '2026-08',
      gross_krw: 200_000,
      income_tax_krw: 6_000,
      local_tax_krw: 600,
      withheld_krw: 6_600,
      net_krw: 193_400,
      reimbursement_krw: 0,
      payout_krw: 193_400,
      assignment_count: 1,
    });
    // 배치는 status를 지정하지 않는다 — 기존 confirmed를 draft로 되돌리면 안 된다.
    expect(payload).not.toHaveProperty('status');
  });
});

describe('assignedCountsFor', () => {
  it('counts non-cancelled assignments per guide', () => {
    const counts = assignedCountsFor([
      { guide_id: 'g-1', status: 'worked' },
      { guide_id: 'g-1', status: 'planned' },
      { guide_id: 'g-1', status: 'cancelled' },
      { guide_id: 'g-2', status: 'planned' },
    ]);
    expect(counts.get('g-1')).toBe(2);
    expect(counts.get('g-2')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// IO 계층 — fake Supabase
// ---------------------------------------------------------------------------

interface FakeState {
  assignments: AssignmentRow[];
  rates: GuideRateRow[];
  settlements: GuideSettlementRow[];
  ledger: Array<{ id: string; external_ref: string; amount_minor: number }>;
}

function fakeDb(state: FakeState) {
  const log: FakeQuery[] = [];
  let seq = 0;
  const client = makeFakeDb((q) => {
    if (q.table === 'ops_guide_assignments') return { data: state.assignments };
    if (q.table === 'ops_guide_rates') return { data: state.rates };
    if (q.table === 'ops_guide_settlements') {
      if (q.op === 'upsert') {
        const payloads = (Array.isArray(q.payload) ? q.payload : [q.payload]) as Record<string, unknown>[];
        const out: GuideSettlementRow[] = [];
        for (const p of payloads) {
          const existing = state.settlements.find(
            (s) => s.guide_id === p.guide_id && s.period === p.period,
          );
          const row = {
            ...(existing ?? { id: `s-${(seq += 1)}`, status: 'draft', paid_at: null, paid_note: null }),
            ...p,
          } as GuideSettlementRow;
          if (existing) Object.assign(existing, row);
          else state.settlements.push(row);
          out.push(row);
        }
        return { data: out };
      }
      return { data: state.settlements };
    }
    if (q.table === 'ops_entity_ledger') {
      if (q.op === 'insert') {
        const p = q.payload as Record<string, unknown>;
        state.ledger.push({
          id: `l-${(seq += 1)}`,
          external_ref: String(p.external_ref),
          amount_minor: Number(p.amount_minor),
        });
        return { data: null };
      }
      if (q.op === 'update') return { data: null };
      const ref = q.filters.find((f) => f.method === 'eq' && f.args[0] === 'external_ref')?.args[1];
      return { data: state.ledger.find((l) => l.external_ref === ref) ?? null };
    }
    return { data: [] };
  }, log);
  return { client: client as unknown as SupabaseClient, log, state };
}

describe('runGuideSettlement — 멱등 + 원장 기입', () => {
  function freshState(): FakeState {
    return {
      assignments: [
        assignment({ id: 'a-1', guide_id: 'g-1', tour_date: '2026-08-03' }),
        assignment({ id: 'a-2', guide_id: 'g-1', tour_date: '2026-08-10' }),
        assignment({ id: 'a-3', guide_id: 'g-2', tour_date: '2026-08-11', tour_type: 'bus' }),
      ],
      rates: RATES,
      settlements: [],
      ledger: [],
    };
  }

  it('produces one row per guide with the withheld breakdown', async () => {
    const { client, state } = fakeDb(freshState());
    const result = await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });

    expect(result.created).toBe(2);
    expect(state.settlements).toHaveLength(2);
    const g1 = state.settlements.find((s) => s.guide_id === 'g-1')!;
    expect(g1.gross_krw).toBe(400_000); // 200,000 × 2 (가이드별 오버라이드)
    expect(g1.withheld_krw).toBe(13_200);
    expect(g1.net_krw).toBe(386_800);
    expect(g1.payout_krw).toBe(386_800);
    expect(g1.assignment_count).toBe(2);
  });

  it('is idempotent — running the same month twice does not double anything', async () => {
    const { client, state } = fakeDb(freshState());
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });
    const first = state.settlements.map((s) => ({ ...s }));
    const second = await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-02T00:00:00Z' });

    expect(state.settlements).toHaveLength(2);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(2);
    expect(state.settlements.map((s) => s.gross_krw)).toEqual(first.map((s) => s.gross_krw));
    // 원장도 가이드당 1행이다 — external_ref 부분 유니크가 지키는 불변식.
    expect(state.ledger).toHaveLength(2);
  });

  it('writes the kr-side expense ledger row as a negative outflow with a breakdown', async () => {
    const { client, state, log } = fakeDb(freshState());
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });

    const inserts = queriesFor(log, 'ops_entity_ledger', 'insert');
    expect(inserts).toHaveLength(2);
    const payload = inserts[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      entity: 'kr',
      type: 'expense',
      source: GUIDE_PAYOUT_LEDGER_SOURCE,
      currency: 'KRW',
      period: '2026-08',
      booking_id: null,
    });
    expect(Number(payload.amount_minor)).toBeLessThan(0);
    expect(state.ledger.every((l) => l.amount_minor < 0)).toBe(true);
  });

  it('preserves a human-entered 실비 across re-runs and never invents one', async () => {
    const { client, state } = fakeDb(freshState());
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });
    const g1 = state.settlements.find((s) => s.guide_id === 'g-1')!;
    expect(g1.reimbursement_krw).toBe(0); // 배치는 실비를 만들지 않는다

    // 사람이 실비를 넣은 뒤 재정산해도 값이 유지되고 payout에만 반영된다.
    g1.reimbursement_krw = 47_000;
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-03T00:00:00Z' });
    const after = state.settlements.find((s) => s.guide_id === 'g-1')!;
    expect(after.reimbursement_krw).toBe(47_000);
    expect(after.gross_krw).toBe(400_000); // 과세표준은 그대로
    expect(after.payout_krw).toBe(after.net_krw + 47_000);
  });

  it('never rewrites a paid settlement — it reports it as locked', async () => {
    const { client, state } = fakeDb(freshState());
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });
    const g1 = state.settlements.find((s) => s.guide_id === 'g-1')!;
    g1.status = 'paid';
    g1.gross_krw = 400_000;

    // 배정이 하나 늘어도 지급된 행의 금액은 그대로여야 한다.
    state.assignments.push(assignment({ id: 'a-4', guide_id: 'g-1', tour_date: '2026-08-20' }));
    const result = await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-05T00:00:00Z' });

    expect(result.locked.map((r) => r.guide_id)).toEqual(['g-1']);
    expect(state.settlements.find((s) => s.guide_id === 'g-1')!.gross_krw).toBe(400_000);
  });

  it('zeroes a settlement whose assignments were all cancelled (no stale amount)', async () => {
    const { client, state } = fakeDb(freshState());
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });
    state.assignments = state.assignments.map((a) =>
      a.guide_id === 'g-1' ? { ...a, status: 'cancelled' } : a,
    );
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-04T00:00:00Z' });

    const g1 = state.settlements.find((s) => s.guide_id === 'g-1')!;
    expect(g1.gross_krw).toBe(0);
    expect(g1.assignment_count).toBe(0);
    expect(state.settlements).toHaveLength(2); // 지우지 않는다 — "0원이었다"도 사실이다
  });

  it('surfaces unresolved rates instead of paying 0 quietly', async () => {
    const state = freshState();
    state.assignments = [assignment({ id: 'a-9', guide_id: 'g-3', tour_type: 'cruise' })];
    const { client } = fakeDb(state);
    const result = await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]).toMatchObject({ guideId: 'g-3', tourType: 'cruise' });
  });

  it('rejects a malformed period', async () => {
    const { client } = fakeDb(freshState());
    await expect(runGuideSettlement(client, '2026-8')).rejects.toThrow(/Invalid period/);
  });

  it('scopes the assignment query to the month and to worked only', async () => {
    const { client, log } = fakeDb(freshState());
    await runGuideSettlement(client, '2026-08', { nowIso: '2026-09-01T00:00:00Z' });
    const q = queriesFor(log, 'ops_guide_assignments')[0];
    const eqArgs = q.filters.filter((f) => f.method === 'eq').map((f) => f.args);
    expect(eqArgs).toContainEqual(['status', 'worked']);
    expect(q.filters.find((f) => f.method === 'gte')?.args).toEqual(['tour_date', '2026-08-01']);
    expect(q.filters.find((f) => f.method === 'lte')?.args).toEqual(['tour_date', '2026-08-31']);
  });
});

describe('recordGuidePayoutLedger', () => {
  const row: GuideSettlementRow = {
    id: 's-1',
    tenant_id: 'atockorea',
    guide_id: 'g-1',
    period: '2026-08',
    gross_krw: 400_000,
    income_tax_krw: 12_000,
    local_tax_krw: 1_200,
    withheld_krw: 13_200,
    net_krw: 386_800,
    reimbursement_krw: 20_000,
    payout_krw: 406_800,
    assignment_count: 2,
    status: 'draft',
    paid_at: null,
    paid_note: null,
  };

  it('books the full company cost (용역대가 + 실비), not just the net paid out', async () => {
    const state: FakeState = { assignments: [], rates: [], settlements: [], ledger: [] };
    const { client, log } = fakeDb(state);
    const result = await recordGuidePayoutLedger(client, row);
    expect(result).toMatchObject({ ok: true, action: 'inserted' });
    const payload = queriesFor(log, 'ops_entity_ledger', 'insert')[0].payload as Record<string, unknown>;
    // 원천징수분도 회사가 세무서에 내는 유출이므로 비용에 포함된다.
    expect(payload.amount_minor).toBe(-(400_000 + 20_000));
    expect(payload.external_ref).toBe('s-1');
    expect(payload.meta).toMatchObject({ withheld_krw: 13_200, payout_krw: 406_800 });
  });

  it('skips when the ledger row already matches (idempotent)', async () => {
    const state: FakeState = {
      assignments: [],
      rates: [],
      settlements: [],
      ledger: [{ id: 'l-1', external_ref: 's-1', amount_minor: -420_000 }],
    };
    const { client, log } = fakeDb(state);
    const result = await recordGuidePayoutLedger(client, row);
    expect(result).toMatchObject({ ok: true, action: 'skipped' });
    expect(queriesFor(log, 'ops_entity_ledger', 'insert')).toHaveLength(0);
  });

  it('updates the amount when the settlement was recalculated', async () => {
    const state: FakeState = {
      assignments: [],
      rates: [],
      settlements: [],
      ledger: [{ id: 'l-1', external_ref: 's-1', amount_minor: -100 }],
    };
    const { client, log } = fakeDb(state);
    const result = await recordGuidePayoutLedger(client, row);
    expect(result).toMatchObject({ ok: true, action: 'updated' });
    expect(queriesFor(log, 'ops_entity_ledger', 'update')).toHaveLength(1);
  });
});
