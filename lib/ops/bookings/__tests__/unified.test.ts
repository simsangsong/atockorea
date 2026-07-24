/**
 * §K B1.1 — 통합 리졸버.
 *
 * 이 스위트가 지키는 계약:
 *   1. 🔴 세 티어가 하나의 숫자로 합쳐지지 않는다 (B1-D1).
 *   2. 🔴 "룸 누락"이 세 개의 다른 실패로 남는다 (B1-D2) — 합치면 조치를 못 한다.
 *   3. 🔴 "실패 0"과 "인박스 미연결"이 구분된다 (B1-D6).
 *   4. 같은 입력 → 같은 출력(정렬 포함).
 */

import {
  buildUnifiedRecords,
  groupByDate,
  inboxState,
  recordDate,
  roomGapFor,
  summarize,
  tierEmptyLabel,
  type BookingInput,
} from '../unified';

const booking = (over: Partial<BookingInput> = {}): BookingInput => ({
  id: 'b1',
  tour_id: 't1',
  tour_date: '2026-08-17',
  created_at: '2026-08-01T02:00:00Z',
  contact_name: 'Massimo',
  number_of_guests: 2,
  status: 'confirmed',
  source: 'gyg',
  ...over,
});

describe('B1-D1 — 티어를 섞지 않는다', () => {
  const records = buildUnifiedRecords({
    bookings: [booking(), booking({ id: 'b2', source: 'tour_product' })],
    parseLogs: [
      { id: 'l1', channel: 'klook', commit_result: 'review_queued', created_at: '2026-08-02T00:00:00Z' },
      { id: 'l2', channel: 'viator', commit_result: 'failed', created_at: '2026-08-03T00:00:00Z', error: '날짜 파싱 실패' },
      { id: 'l3', channel: 'gyg', commit_result: 'auto_committed', created_at: '2026-08-04T00:00:00Z' },
    ],
    parseFailures: [{ id: 'f1', source_platform: 'kkday', reason: '본문 없음', created_at: '2026-08-05T00:00:00Z' }],
  });

  it('평면별로 센다', () => {
    const s = summarize(records);
    expect(s.counts).toEqual({ confirmed: 2, pending_review: 1, unparsed: 2 });
  });

  it('🔴 총합 필드가 존재하지 않는다 — 셋을 더한 숫자는 거짓말이다', () => {
    const s = summarize(records);
    expect(Object.keys(s.counts).sort()).toEqual(['confirmed', 'pending_review', 'unparsed']);
    expect((s as unknown as Record<string, unknown>).total).toBeUndefined();
    expect((s.counts as unknown as Record<string, unknown>).total).toBeUndefined();
  });

  it('이미 자동 커밋된 로그는 어느 티어에도 들어가지 않는다 — 예약으로 이미 세었다', () => {
    expect(records.find((r) => r.id === 'l3')).toBeUndefined();
  });

  it('확정 인원만 더한다 — 확인 대기 건은 인원을 주장하지 않는다', () => {
    expect(summarize(records).confirmedGuests).toBe(4);
    expect(records.find((r) => r.id === 'l1')?.partySize).toBe(0);
  });

  it('취소 예약은 어느 평면에도 없다', () => {
    const cancelled = buildUnifiedRecords({ bookings: [booking({ status: 'cancelled' })] });
    expect(cancelled).toHaveLength(0);
  });
});

describe('B1-D2 — 룸 누락은 세 개의 다른 실패다', () => {
  const ctx = (over: Partial<Parameters<typeof roomGapFor>[1]> = {}) => ({
    roomByBooking: new Map<string, string>(),
    participantsByRoom: new Map<string, number>(),
    seatedBookings: new Set<string>(),
    joinBookings: new Set<string>(),
    ...over,
  });

  it('ⓐ 룸 자체가 없음', () => {
    expect(roomGapFor(booking(), ctx())).toBe('no_room');
  });

  it('ⓑ 룸은 있으나 아무도 입장하지 않음', () => {
    expect(roomGapFor(booking(), ctx({ roomByBooking: new Map([['b1', 'r1']]) }))).toBe('no_participant');
  });

  it('ⓒ 조인투어인데 좌석 미배정', () => {
    expect(
      roomGapFor(
        booking(),
        ctx({
          roomByBooking: new Map([['b1', 'r1']]),
          participantsByRoom: new Map([['r1', 1]]),
          joinBookings: new Set(['b1']),
        }),
      ),
    ).toBe('no_seat');
  });

  it('🔴 프라이빗은 좌석 미배정이 실패가 아니다 — 아니면 요주의가 전부 프라이빗으로 찬다', () => {
    expect(
      roomGapFor(
        booking(),
        ctx({ roomByBooking: new Map([['b1', 'r1']]), participantsByRoom: new Map([['r1', 1]]) }),
      ),
    ).toBeNull();
  });

  it('전부 갖춰지면 누락이 아니다', () => {
    expect(
      roomGapFor(
        booking(),
        ctx({
          roomByBooking: new Map([['b1', 'r1']]),
          participantsByRoom: new Map([['r1', 2]]),
          joinBookings: new Set(['b1']),
          seatedBookings: new Set(['b1']),
        }),
      ),
    ).toBeNull();
  });

  it('집계에서도 세 실패가 따로 남는다 — 합치면 무엇을 할지가 사라진다', () => {
    const records = buildUnifiedRecords({
      bookings: [booking({ id: 'b1' }), booking({ id: 'b2' }), booking({ id: 'b3' })],
      rooms: [
        { booking_id: 'b2', id: 'r2' },
        { booking_id: 'b3', id: 'r3' },
      ],
      participants: [{ room_id: 'r3' }],
      joinBookingIds: ['b3'],
    });
    expect(summarize(records).roomGaps).toEqual({ no_room: 1, no_participant: 1, no_seat: 1 });
  });

  it('누락마다 무엇을 해야 하는지 한 줄이 붙는다', () => {
    const [record] = buildUnifiedRecords({ bookings: [booking()] });
    expect(record.roomGap).toBe('no_room');
    expect(record.reason).toContain('링크 발급');
  });
});

describe('B1-D6 — "실패 0"과 "인박스 미연결"을 구분한다', () => {
  it('로그가 한 번도 없으면 미연결이다', () => {
    expect(inboxState({ anyParseLogEver: false })).toBe('never_ran');
    expect(tierEmptyLabel('unparsed', 'never_ran')).toContain('미연결');
    expect(tierEmptyLabel('pending_review', 'never_ran')).toContain('미연결');
  });

  it('돌고 있으면 0은 안심 신호다', () => {
    expect(inboxState({ anyParseLogEver: true })).toBe('active');
    expect(tierEmptyLabel('unparsed', 'active')).toBe('파싱 실패 없음');
    expect(tierEmptyLabel('pending_review', 'active')).toBe('확인 대기 없음');
  });

  it('🔴 두 문구가 절대 같지 않다 — 같으면 오너가 OTA 메일을 놓친다', () => {
    expect(tierEmptyLabel('unparsed', 'never_ran')).not.toBe(tierEmptyLabel('unparsed', 'active'));
  });
});

describe('B1-D4 — 투어일 축과 유입일 축은 다른 질문이다', () => {
  const records = buildUnifiedRecords({
    bookings: [booking({ tour_date: '2026-08-17', created_at: '2026-08-01T02:00:00Z' })],
  });

  it('투어일 축', () => {
    expect(recordDate(records[0], 'tour_date')).toBe('2026-08-17');
  });

  it('유입일 축', () => {
    expect(recordDate(records[0], 'created_at')).toBe('2026-08-01');
  });

  it('투어일이 없는 레코드(파싱 실패)는 투어일 축 그룹에서 빠진다', () => {
    const withFailure = buildUnifiedRecords({
      bookings: [],
      parseFailures: [{ id: 'f1', created_at: '2026-08-05T00:00:00Z', reason: 'x' }],
    });
    expect(groupByDate(withFailure, 'tour_date').size).toBe(0);
    expect(groupByDate(withFailure, 'created_at').get('2026-08-05')).toHaveLength(1);
  });
});

describe('결정론', () => {
  it('같은 입력이면 같은 순서로 나온다', () => {
    const args = {
      bookings: [booking({ id: 'b2' }), booking({ id: 'b1' })],
      parseFailures: [{ id: 'f1', created_at: '2026-08-01T02:00:00Z', reason: 'x' }],
    };
    expect(buildUnifiedRecords(args).map((r) => r.id)).toEqual(buildUnifiedRecords(args).map((r) => r.id));
  });

  it('최신 유입이 먼저 온다', () => {
    const records = buildUnifiedRecords({
      bookings: [
        booking({ id: 'old', created_at: '2026-08-01T00:00:00Z' }),
        booking({ id: 'new', created_at: '2026-08-09T00:00:00Z' }),
      ],
    });
    expect(records[0].id).toBe('new');
  });

  it('채널이 비어 있어도 그룹이 사라지지 않는다', () => {
    const records = buildUnifiedRecords({ bookings: [booking({ source: null })] });
    expect(records[0].channel).toBe('unknown');
    expect(summarize(records).byChannel[0]).toMatchObject({ channel: 'unknown', tier: 'confirmed' });
  });

  it('빈 입력에서 터지지 않는다', () => {
    expect(buildUnifiedRecords({ bookings: [] })).toEqual([]);
    expect(summarize([])).toEqual({
      counts: { confirmed: 0, pending_review: 0, unparsed: 0 },
      roomGaps: { no_room: 0, no_participant: 0, no_seat: 0 },
      confirmedGuests: 0,
      byChannel: [],
    });
  });
});
