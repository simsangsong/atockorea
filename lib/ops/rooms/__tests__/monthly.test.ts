/**
 * 투어룸 월간 집계 — 관제 W3.
 *
 * 이 스위트의 중심은 `health` 판정이다. 월간 화면이 실제로 답해야 하는 질문은
 * "방이 몇 개 열렸나"가 아니라 **"열어놓고 아무도 안 들어온 방이 어느 것인가"**이고,
 * 그 판정이 틀리면 화면은 있으나 마나다.
 */

import { buildRoomMonth, roomMonthToAoa, MONTHLY_ROOM_SCAN_LIMIT, type RoomMonthInputs } from '../monthly';

const NOW = '2026-08-10T00:00:00.000Z';

function inputs(over: Partial<RoomMonthInputs> = {}): RoomMonthInputs {
  return {
    period: '2026-08',
    rooms: [],
    bookings: [],
    tours: [],
    participants: [],
    messages: [],
    invites: [],
    now: NOW,
    ...over,
  };
}

function room(id: string, over: Partial<RoomMonthInputs['rooms'][number]> = {}) {
  return {
    id,
    booking_id: `bk-${id}`,
    tour_id: 'tour-1',
    tour_date: '2026-08-03',
    status: 'active',
    created_at: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('buildRoomMonth — health', () => {
  it('calls a room with invites but no guest participant "dead"', () => {
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        invites: [{ booking_id: 'bk-r1', revoked_at: null, expires_at: null }],
      }),
    );
    expect(result.rows[0].health).toBe('dead');
    expect(result.summary.deadCount).toBe(1);
  });

  it('calls a room with a guest but no guest message "quiet"', () => {
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        participants: [{ room_id: 'r1', role: 'customer', last_seen_at: '2026-08-02T09:00:00.000Z' }],
        // 운영자가 보낸 공지는 "대화가 있었다"의 근거가 되지 못한다.
        messages: [{ room_id: 'r1', sender_role: 'ops', created_at: '2026-08-02T10:00:00.000Z' }],
      }),
    );
    expect(result.rows[0].health).toBe('quiet');
    expect(result.rows[0].messageCount).toBe(1);
    expect(result.rows[0].guestMessageCount).toBe(0);
  });

  it('calls a room with a guest message "active"', () => {
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        participants: [{ room_id: 'r1', role: 'customer', last_seen_at: null }],
        messages: [{ room_id: 'r1', sender_role: 'customer', created_at: '2026-08-02T10:00:00.000Z' }],
      }),
    );
    expect(result.rows[0].health).toBe('active');
  });

  it('calls any non-active room "closed" regardless of traffic', () => {
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1', { status: 'ended' })],
        participants: [{ room_id: 'r1', role: 'customer', last_seen_at: null }],
        messages: [{ room_id: 'r1', sender_role: 'customer', created_at: NOW }],
      }),
    );
    expect(result.rows[0].health).toBe('closed');
  });

  it('does not count staff as guests', () => {
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        participants: [
          { room_id: 'r1', role: 'guide', last_seen_at: null },
          { room_id: 'r1', role: 'driver', last_seen_at: null },
        ],
      }),
    );
    expect(result.rows[0].participantCount).toBe(2);
    expect(result.rows[0].guestCount).toBe(0);
    expect(result.rows[0].health).toBe('dead');
  });

  it('treats an unknown role as a guest rather than dropping it', () => {
    // 역할 어휘가 늘었을 때 손님이 조용히 0명이 되는 것을 막는다.
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        participants: [{ room_id: 'r1', role: 'companion', last_seen_at: null }],
      }),
    );
    expect(result.rows[0].guestCount).toBe(1);
  });
});

describe('buildRoomMonth — invites are keyed by booking, not room', () => {
  it('attaches invites through the room booking_id', () => {
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        invites: [
          { booking_id: 'bk-r1', revoked_at: null, expires_at: '2026-09-01T00:00:00.000Z' },
          { booking_id: 'bk-r1', revoked_at: '2026-08-05T00:00:00.000Z', expires_at: null },
          { booking_id: 'bk-r1', revoked_at: null, expires_at: '2026-08-01T00:00:00.000Z' },
          { booking_id: 'bk-other', revoked_at: null, expires_at: null },
        ],
      }),
    );
    expect(result.rows[0].inviteCount).toBe(3);
    // 회수된 것과 만료된 것은 살아 있지 않다.
    expect(result.rows[0].liveInviteCount).toBe(1);
  });
});

describe('buildRoomMonth — activity and summary', () => {
  it('takes the latest of last_seen and last message as the activity time', () => {
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        participants: [{ room_id: 'r1', role: 'customer', last_seen_at: '2026-08-02T09:00:00.000Z' }],
        messages: [{ room_id: 'r1', sender_role: 'customer', created_at: '2026-08-02T11:00:00.000Z' }],
      }),
    );
    expect(result.rows[0].lastActivityAt).toBe('2026-08-02T11:00:00.000Z');
  });

  it('sums guests from the booking, not from participant rows', () => {
    // 방에 한 명만 들어와도 예약 인원은 4명이다 — 정원·배차는 후자를 봐야 한다.
    const result = buildRoomMonth(
      inputs({
        rooms: [room('r1')],
        bookings: [
          {
            id: 'bk-r1',
            contact_name: '김손님',
            number_of_guests: 4,
            preferred_language: 'en',
            status: 'confirmed',
            booking_reference: 'AT-1',
            source: 'viator',
          },
        ],
        participants: [{ room_id: 'r1', role: 'customer', last_seen_at: null }],
      }),
    );
    expect(result.summary.guestTotal).toBe(4);
    expect(result.rows[0].guestCount).toBe(1);
  });

  it('reports truncation instead of quietly under-counting', () => {
    const messages = Array.from({ length: MONTHLY_ROOM_SCAN_LIMIT }, () => ({
      room_id: 'r1',
      sender_role: 'customer',
      created_at: NOW,
    }));
    const result = buildRoomMonth(inputs({ rooms: [room('r1')], messages }));
    expect(result.truncated).toBe(true);
  });

  it('is not truncated on an ordinary month', () => {
    const result = buildRoomMonth(inputs({ rooms: [room('r1')] }));
    expect(result.truncated).toBe(false);
  });
});

describe('roomMonthToAoa', () => {
  it('emits a header plus one row per room', () => {
    const result = buildRoomMonth(inputs({ rooms: [room('r1'), room('r2')] }));
    const aoa = roomMonthToAoa(result);
    expect(aoa).toHaveLength(3);
    expect(aoa[0][0]).toBe('투어일');
    expect(aoa.every((row) => row.length === aoa[0].length)).toBe(true);
  });
});
