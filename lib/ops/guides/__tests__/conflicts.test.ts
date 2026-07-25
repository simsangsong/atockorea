/**
 * 배정 충돌 판정 — 관제 W2.
 *
 * 이 스위트가 지키는 것은 두 가지다:
 *   1. **막아야 할 것을 막는다** — 휴무일·비활성·중복·시간겹침.
 *   2. **막지 말아야 할 것을 막지 않는다** — 시각을 모르는 배정이 그날 전체를
 *      잠그거나, 정당한 하루 두 탕이 거부되면 현장이 시스템을 우회하기 시작한다.
 *      2번이 깨지는 쪽이 실제로는 더 위험하다.
 */

import {
  detectAssignmentConflicts,
  blockCodeFromDbError,
  overlaps,
  speaksLanguage,
  timeToMinutes,
  type CandidateAssignment,
  type ConflictContext,
  type ExistingAssignment,
} from '../conflicts';
import type { GuideRateRow } from '../rates';

const GUIDE = '11111111-1111-1111-1111-111111111111';
const DATE = '2026-08-03';

function candidate(over: Partial<CandidateAssignment> = {}): CandidateAssignment {
  return { guideId: GUIDE, tourDate: DATE, tourType: 'private', ...over };
}

const RATES: GuideRateRow[] = [
  { guide_id: null, tour_type: 'private', amount_krw: 150_000, effective_from: '2026-01-01' },
];

function context(over: Partial<ConflictContext> = {}): ConflictContext {
  return { sameDayAssignments: [], guideActive: true, rates: RATES, ...over };
}

function existing(over: Partial<ExistingAssignment> = {}): ExistingAssignment {
  return {
    id: 'aaaa',
    guide_id: GUIDE,
    tour_date: DATE,
    booking_id: null,
    start_time: null,
    end_time: null,
    status: 'planned',
    ...over,
  };
}

const codes = (items: Array<{ code: string }>) => items.map((i) => i.code).sort();

describe('timeToMinutes', () => {
  it('accepts both HH:MM and the postgres HH:MM:SS shape', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('09:30:00')).toBe(570);
  });

  it('returns null for anything it cannot trust', () => {
    expect(timeToMinutes('25:00')).toBeNull();
    expect(timeToMinutes('9시')).toBeNull();
    expect(timeToMinutes(null)).toBeNull();
    expect(timeToMinutes(undefined)).toBeNull();
  });
});

describe('overlaps', () => {
  it('detects a real overlap', () => {
    expect(overlaps({ start: '08:00', end: '12:00' }, { start: '11:00', end: '15:00' })).toBe(true);
  });

  it('treats touching ends as not overlapping', () => {
    // 12:00 종료 투어와 12:00 시작 투어는 겹치지 않는다 — 반개구간.
    expect(overlaps({ start: '08:00', end: '12:00' }, { start: '12:00', end: '18:00' })).toBe(false);
  });

  it('refuses to guess when either side has no time', () => {
    // 시각 미상을 "종일"로 간주하면 배정 하나가 그날 전체를 잠근다.
    expect(overlaps({ start: null, end: null }, { start: '11:00', end: '15:00' })).toBe(false);
    expect(overlaps({ start: '08:00', end: null }, { start: '08:30', end: '15:00' })).toBe(false);
  });
});

describe('speaksLanguage', () => {
  it('matches on the base language, ignoring region', () => {
    expect(speaksLanguage(['en'], 'en-US')).toBe(true);
    expect(speaksLanguage(['ja'], 'ja')).toBe(true);
  });

  it('keeps the chinese variants distinct because they are different work', () => {
    expect(speaksLanguage(['zh-CN'], 'zh-TW')).toBe(false);
    expect(speaksLanguage(['zh-tw'], 'zh-TW')).toBe(true);
  });

  it('is false when the guide has no registered languages', () => {
    expect(speaksLanguage([], 'en')).toBe(false);
    expect(speaksLanguage(null, 'en')).toBe(false);
  });
});

describe('detectAssignmentConflicts — hard blocks', () => {
  it('blocks an inactive guide and refuses to let it be overridden', () => {
    const result = detectAssignmentConflicts(
      candidate({ conflictOverride: true }),
      context({ guideActive: false }),
    );
    expect(codes(result.blocked)).toContain('guide_inactive');
    expect(result.blocked.find((b) => b.code === 'guide_inactive')?.overridable).toBe(false);
  });

  it('blocks a rest-day assignment but marks it overridable', () => {
    const result = detectAssignmentConflicts(candidate(), context({ guideUnavailable: true }));
    const block = result.blocked.find((b) => b.code === 'guide_unavailable');
    expect(block).toBeDefined();
    expect(block?.overridable).toBe(true);
  });

  it('lets a rest-day assignment through once override is set', () => {
    const result = detectAssignmentConflicts(
      candidate({ conflictOverride: true }),
      context({ guideUnavailable: true }),
    );
    expect(codes(result.blocked)).not.toContain('guide_unavailable');
  });

  it('blocks overlapping times and points at the row it collides with', () => {
    const result = detectAssignmentConflicts(
      candidate({ startTime: '11:00', endTime: '15:00' }),
      context({
        sameDayAssignments: [existing({ id: 'other', start_time: '08:00', end_time: '12:00' })],
      }),
    );
    const block = result.blocked.find((b) => b.code === 'time_overlap');
    expect(block?.conflictsWith).toBe('other');
    expect(block?.overridable).toBe(true);
  });

  it('blocks two booking-less, time-less assignments as an indistinguishable duplicate', () => {
    const result = detectAssignmentConflicts(
      candidate(),
      context({ sameDayAssignments: [existing()] }),
    );
    const block = result.blocked.find((b) => b.code === 'duplicate_slot');
    expect(block).toBeDefined();
    expect(block?.overridable).toBe(false);
  });

  it('blocks a second assignment onto the same booking', () => {
    const result = detectAssignmentConflicts(
      candidate({ bookingId: 'bk-1' }),
      context({ sameDayAssignments: [existing({ id: 'other', booking_id: 'bk-1' })] }),
    );
    expect(codes(result.blocked)).toContain('duplicate_slot');
  });

  it('never blocks against a cancelled assignment', () => {
    const result = detectAssignmentConflicts(
      candidate({ startTime: '11:00', endTime: '15:00' }),
      context({
        sameDayAssignments: [
          existing({ id: 'dead', start_time: '08:00', end_time: '18:00', status: 'cancelled' }),
        ],
      }),
    );
    expect(result.blocked).toHaveLength(0);
  });

  it('never blocks against itself when editing', () => {
    const result = detectAssignmentConflicts(
      candidate({ id: 'self', startTime: '08:00', endTime: '12:00' }),
      context({
        sameDayAssignments: [existing({ id: 'self', start_time: '08:00', end_time: '12:00' })],
      }),
    );
    expect(result.blocked).toHaveLength(0);
  });

  it('produces nothing at all for a cancelled candidate', () => {
    const result = detectAssignmentConflicts(
      candidate({ status: 'cancelled' }),
      context({ guideActive: false, guideUnavailable: true, sameDayAssignments: [existing()] }),
    );
    expect(result.blocked).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('detectAssignmentConflicts — the two-tours-a-day case', () => {
  it('allows a genuine second tour when the times do not overlap', () => {
    const result = detectAssignmentConflicts(
      candidate({ startTime: '14:00', endTime: '18:00' }),
      context({
        sameDayAssignments: [existing({ id: 'morning', start_time: '08:00', end_time: '12:00' })],
      }),
    );
    expect(result.blocked).toHaveLength(0);
    expect(codes(result.warnings)).toContain('multiple_same_day');
  });

  it('warns rather than blocks when the existing row has no times to compare', () => {
    const result = detectAssignmentConflicts(
      candidate({ bookingId: 'bk-2', startTime: '14:00', endTime: '18:00' }),
      context({ sameDayAssignments: [existing({ id: 'unknown', booking_id: 'bk-1' })] }),
    );
    expect(result.blocked).toHaveLength(0);
    expect(codes(result.warnings)).toContain('multiple_same_day');
  });

  it('does not pile a same-day warning on top of an overlap block', () => {
    const result = detectAssignmentConflicts(
      candidate({ startTime: '11:00', endTime: '15:00' }),
      context({
        sameDayAssignments: [existing({ id: 'other', start_time: '08:00', end_time: '12:00' })],
      }),
    );
    expect(codes(result.warnings)).not.toContain('multiple_same_day');
  });
});

describe('detectAssignmentConflicts — the settlement link (rule 7)', () => {
  it('warns when no rate resolves, because settlement would otherwise pay 0원 a month later', () => {
    const result = detectAssignmentConflicts(candidate({ tourType: 'cruise' }), context());
    expect(codes(result.warnings)).toContain('rate_missing');
  });

  it('stays quiet when a tenant default covers the tour type', () => {
    const result = detectAssignmentConflicts(candidate(), context());
    expect(codes(result.warnings)).not.toContain('rate_missing');
  });

  it('stays quiet when the assignment pins its own amount — including 0 (unpaid)', () => {
    const unpaid = detectAssignmentConflicts(
      candidate({ tourType: 'cruise' }),
      context({ amountKrw: 0 }),
    );
    expect(codes(unpaid.warnings)).not.toContain('rate_missing');
  });

  it('warns when the only rate takes effect after the tour date', () => {
    const result = detectAssignmentConflicts(
      candidate({ tourDate: '2025-12-31' }),
      context({ rates: RATES }),
    );
    expect(codes(result.warnings)).toContain('rate_missing');
  });
});

describe('detectAssignmentConflicts — language (rule 6)', () => {
  it('warns but never blocks, because interpreters exist', () => {
    const result = detectAssignmentConflicts(
      candidate(),
      context({ guideLanguages: ['ko', 'en'], bookingLanguage: 'ja' }),
    );
    expect(result.blocked).toHaveLength(0);
    expect(codes(result.warnings)).toContain('language_mismatch');
  });

  it('stays quiet when the guide covers the requested language', () => {
    const result = detectAssignmentConflicts(
      candidate(),
      context({ guideLanguages: ['ko', 'en'], bookingLanguage: 'en-GB' }),
    );
    expect(codes(result.warnings)).not.toContain('language_mismatch');
  });
});

describe('blockCodeFromDbError', () => {
  it('translates each trigger and constraint into its code', () => {
    expect(blockCodeFromDbError('assignment_guide_inactive')).toBe('guide_inactive');
    expect(blockCodeFromDbError('assignment_guide_unavailable')).toBe('guide_unavailable');
    expect(blockCodeFromDbError('assignment_time_overlap')).toBe('time_overlap');
    expect(
      blockCodeFromDbError('duplicate key value violates unique constraint "ops_guide_assignments_dateslot_uniq"'),
    ).toBe('duplicate_slot');
    expect(
      blockCodeFromDbError('duplicate key value violates unique constraint "ops_guide_assignments_uniq"'),
    ).toBe('duplicate_slot');
  });

  it('returns null for an unrelated error instead of calling it a conflict', () => {
    // 모르는 에러를 409로 포장하면 진짜 장애가 "충돌입니다"로 위장된다.
    expect(blockCodeFromDbError('connection terminated unexpectedly')).toBeNull();
    expect(blockCodeFromDbError(null)).toBeNull();
  });
});
