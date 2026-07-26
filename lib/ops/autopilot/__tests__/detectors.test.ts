/**
 * 오토파일럿 탐지기 — 관제 W5.
 *
 * 이 스위트의 중심은 **거짓 경고를 만들지 않는 것**이다. 큐는 사람이 매일 보는
 * 화면이고, 근거 없는 경고가 섞이면 전체가 무시된다. 특히:
 *   · 정원 "미상"을 초과로 부르지 않는다.
 *   · 취소된 배정/예약을 살아 있는 것으로 세지 않는다.
 *   · 같은 문제는 몇 번 점검해도 같은 subject_key다(멱등의 축).
 */

import {
  detectSuggestions,
  urgencyFromLeadTime,
  actionHref,
  type DetectorInputs,
} from '../detectors';
import { previousPeriodOf } from '../runner';
import { periodDateBounds } from '@/lib/ops/tax/assignments';

const TODAY = '2026-08-10';

function inputs(over: Partial<DetectorInputs> = {}): DetectorInputs {
  return {
    today: TODAY,
    horizonDays: 14,
    tours: [],
    assignments: [],
    dispatches: [],
    rates: [],
    previousPeriod: null,
    ...over,
  };
}

const TOUR = {
  roomId: 'r1',
  bookingId: 'bk1',
  tourDate: '2026-08-12',
  tourTitle: '제주 동부 일일투어',
  guests: 4,
  tourType: 'private',
};

const kinds = (list: Array<{ kind: string }>) => list.map((s) => s.kind);

describe('urgencyFromLeadTime', () => {
  it('scales with how much time is left to act', () => {
    expect(urgencyFromLeadTime(TODAY, '2026-08-11')).toBe('high');
    expect(urgencyFromLeadTime(TODAY, '2026-08-12')).toBe('high');
    expect(urgencyFromLeadTime(TODAY, '2026-08-15')).toBe('medium');
    expect(urgencyFromLeadTime(TODAY, '2026-08-25')).toBe('low');
  });
});

describe('previousPeriodOf', () => {
  it('rolls back over a year boundary', () => {
    expect(previousPeriodOf('2026-08-10')).toBe('2026-07');
    expect(previousPeriodOf('2026-01-05')).toBe('2025-12');
  });

  /**
   * The scan used to bound the previous month as `${prevPeriod}-31`. In five
   * months of twelve that date does not exist, Postgres rejected the query,
   * supabase-js returned count: null, and `?? 0` turned "the query never ran"
   * into "no worked assignments" — so the settlement reminder went quiet
   * without anyone noticing. Every previous month must produce a real date.
   */
  it('every previous month has a last day that actually exists', () => {
    for (let month = 1; month <= 12; month += 1) {
      const today = `2026-${String(month).padStart(2, '0')}-15`;
      const { first, last } = periodDateBounds(previousPeriodOf(today));
      for (const bound of [first, last]) {
        expect(bound).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // `new Date` silently rolls 2026-06-31 forward to July 1st, so compare
        // the string back out rather than trusting the parse to fail.
        expect(new Date(`${bound}T00:00:00Z`).toISOString().slice(0, 10)).toBe(bound);
      }
    }
  });

  it('bounds February, including a leap year', () => {
    expect(periodDateBounds(previousPeriodOf('2026-03-01')).last).toBe('2026-02-28');
    expect(periodDateBounds(previousPeriodOf('2028-03-01')).last).toBe('2028-02-29');
    expect(periodDateBounds(previousPeriodOf('2026-07-01')).last).toBe('2026-06-30');
  });
});

describe('detectSuggestions — coverage gaps', () => {
  it('flags a tour with no guide and no vehicle', () => {
    const found = detectSuggestions(inputs({ tours: [TOUR] }));
    expect(kinds(found)).toEqual(expect.arrayContaining(['guide_unassigned', 'vehicle_unassigned']));
  });

  it('accepts an assignment linked by booking even when room_id is empty', () => {
    // 배정 원장은 room_id / booking_id 중 하나만 채워지는 경우가 흔하다.
    const found = detectSuggestions(
      inputs({
        tours: [TOUR],
        assignments: [
          {
            id: 'a1',
            guideId: 'g1',
            guideName: '김가이드',
            roomId: null,
            bookingId: 'bk1',
            tourDate: '2026-08-12',
            tourType: 'private',
            amountKrw: 150_000,
            status: 'planned',
          },
        ],
      }),
    );
    expect(kinds(found)).not.toContain('guide_unassigned');
  });

  it('treats a cancelled assignment as no assignment', () => {
    const found = detectSuggestions(
      inputs({
        tours: [TOUR],
        assignments: [
          {
            id: 'a1',
            guideId: 'g1',
            guideName: null,
            roomId: 'r1',
            bookingId: 'bk1',
            tourDate: '2026-08-12',
            tourType: 'private',
            amountKrw: null,
            status: 'cancelled',
          },
        ],
      }),
    );
    expect(kinds(found)).toContain('guide_unassigned');
  });

  it('ignores tours outside the horizon', () => {
    const found = detectSuggestions(
      inputs({ tours: [{ ...TOUR, tourDate: '2026-09-30' }, { ...TOUR, roomId: 'r0', tourDate: '2026-08-01' }] }),
    );
    expect(found).toHaveLength(0);
  });
});

describe('detectSuggestions — capacity', () => {
  const dispatch = (capacity: number | null) => ({ id: 'd1', roomId: 'r1', plate: '12가3456', capacity });

  it('flags a shortfall as high severity regardless of lead time', () => {
    const found = detectSuggestions(
      inputs({ tours: [{ ...TOUR, tourDate: '2026-08-23', guests: 30 }], dispatches: [dispatch(20)] }),
    );
    const over = found.find((s) => s.kind === 'capacity_over');
    expect(over?.severity).toBe('high');
  });

  it('does not call an unknown capacity an overflow', () => {
    // 차량 마스터를 채우는 동안 큐가 거짓 경고로 가득 차면 아무도 안 본다.
    const found = detectSuggestions(inputs({ tours: [TOUR], dispatches: [dispatch(null)] }));
    expect(kinds(found)).not.toContain('capacity_over');
  });

  it('sums seats across multiple vehicles before deciding', () => {
    const found = detectSuggestions(
      inputs({
        tours: [{ ...TOUR, guests: 30 }],
        dispatches: [dispatch(20), { id: 'd2', roomId: 'r1', plate: '34나5678', capacity: 16 }],
      }),
    );
    expect(kinds(found)).not.toContain('capacity_over');
  });

  it('says nothing about capacity when the guest count is unknown', () => {
    const found = detectSuggestions(
      inputs({ tours: [{ ...TOUR, guests: null }], dispatches: [dispatch(4)] }),
    );
    expect(kinds(found)).not.toContain('capacity_over');
  });
});

describe('detectSuggestions — the settlement link', () => {
  const worked = {
    id: 'a1',
    guideId: 'g1',
    guideName: '김가이드',
    roomId: 'r1',
    bookingId: 'bk1',
    tourDate: '2026-08-12',
    tourType: 'private',
    amountKrw: null,
    status: 'worked',
  };

  it('flags a worked assignment with no resolvable rate', () => {
    const found = detectSuggestions(inputs({ assignments: [worked] }));
    const item = found.find((s) => s.kind === 'rate_missing');
    expect(item?.severity).toBe('high');
    expect(item?.payload.assignmentId).toBe('a1');
  });

  it('stays quiet when the assignment pins its own amount', () => {
    const found = detectSuggestions(inputs({ assignments: [{ ...worked, amountKrw: 0 }] }));
    expect(kinds(found)).not.toContain('rate_missing');
  });

  it('stays quiet when a tenant default covers it', () => {
    const found = detectSuggestions(
      inputs({
        assignments: [worked],
        rates: [{ guide_id: null, tour_type: 'private', amount_krw: 150_000, effective_from: '2026-01-01' }],
      }),
    );
    expect(kinds(found)).not.toContain('rate_missing');
  });

  it('only looks at worked assignments — a planned one is not money yet', () => {
    const found = detectSuggestions(inputs({ assignments: [{ ...worked, status: 'planned' }] }));
    expect(kinds(found)).not.toContain('rate_missing');
  });

  it('flags an unsettled previous month', () => {
    const found = detectSuggestions(
      inputs({ previousPeriod: { period: '2026-07', workedCount: 12, settlementCount: 0 } }),
    );
    expect(kinds(found)).toContain('settlement_pending');
  });

  it('says nothing when the previous month is already settled', () => {
    const found = detectSuggestions(
      inputs({ previousPeriod: { period: '2026-07', workedCount: 12, settlementCount: 3 } }),
    );
    expect(kinds(found)).not.toContain('settlement_pending');
  });

  it('says nothing when the previous month had no work at all', () => {
    const found = detectSuggestions(
      inputs({ previousPeriod: { period: '2026-07', workedCount: 0, settlementCount: 0 } }),
    );
    expect(kinds(found)).not.toContain('settlement_pending');
  });
});

describe('detectSuggestions — idempotency and ordering', () => {
  it('gives the same problem the same subject key every run', () => {
    const first = detectSuggestions(inputs({ tours: [TOUR] }));
    const second = detectSuggestions(inputs({ tours: [TOUR] }));
    expect(first.map((s) => s.subjectKey)).toEqual(second.map((s) => s.subjectKey));
  });

  it('is deterministic in order so a new item is recognisable', () => {
    const tours = [
      { ...TOUR, roomId: 'r2', tourDate: '2026-08-14' },
      { ...TOUR, roomId: 'r1', tourDate: '2026-08-12' },
    ];
    const found = detectSuggestions(inputs({ tours }));
    const dates = found.filter((s) => s.tourDate).map((s) => s.tourDate!);
    expect([...dates]).toEqual([...dates].sort());
  });

  it('carries no guest PII in the payload — the queue is a shared operator screen', () => {
    const found = detectSuggestions(inputs({ tours: [TOUR] }));
    const text = JSON.stringify(found.map((s) => s.payload));
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/\d{3}-\d{4}/);
  });
});

describe('actionHref', () => {
  it('sends each kind to the screen that can actually fix it', () => {
    expect(actionHref({ kind: 'rate_missing', payload: { guideId: 'g1' } })).toContain('/admin/guides');
    expect(actionHref({ kind: 'rate_missing', payload: { guideId: 'g1' } })).toContain('tab=rates');
    expect(actionHref({ kind: 'settlement_pending', payload: { period: '2026-07' } })).toContain(
      '/admin/guide-settlements',
    );
    expect(actionHref({ kind: 'vehicle_unassigned', payload: {} })).toBe('/admin/tour-ops');
  });
});
