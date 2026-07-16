/**
 * W0.3 — tour_room_events helpers (smart-guide private-mode plan P-D5/P-D6).
 * The idempotency contract: a unique-violation on (room, subject, type) means
 * "the side-effect already ran" → inserted:false, never a throw.
 */
import { listRoomEvents, recordRoomEvent } from '@/lib/tour-room/events';
import type { RoomDbClient } from '@/lib/tour-room/access';

interface InsertCapture {
  table?: string;
  row?: Record<string, unknown>;
}

function fakeDb(options: {
  insertResult?: { data: unknown; error: unknown };
  listResult?: { data: unknown; error: unknown };
  capture?: InsertCapture;
  captureFilters?: Array<[string, string, unknown]>;
}): RoomDbClient {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {
        insert(row: Record<string, unknown>) {
          if (options.capture) {
            options.capture.table = table;
            options.capture.row = row;
          }
          return {
            select: () => ({
              single: async () => options.insertResult ?? { data: null, error: null },
            }),
          };
        },
        select: () => chain,
        eq(column: string, value: unknown) {
          options.captureFilters?.push(['eq', column, value]);
          return chain;
        },
        in(column: string, value: unknown) {
          options.captureFilters?.push(['in', column, value]);
          return chain;
        },
        gt(column: string, value: unknown) {
          options.captureFilters?.push(['gt', column, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(options.listResult ?? { data: [], error: null }).then(onFulfilled, onRejected),
      };
      return chain;
    },
  } as unknown as RoomDbClient;
}

const EVENT_ROW = {
  id: 'event-1',
  room_id: 'room-1',
  booking_id: 'booking-1',
  type: 'rally_stage',
  actor_role: 'system',
  actor_participant_id: null,
  subject_key: 'rally:r1:overdue',
  payload: { stage: 'overdue' },
  created_at: '2026-07-20T05:00:00Z',
};

describe('recordRoomEvent', () => {
  it('inserts and returns the row', async () => {
    const capture: InsertCapture = {};
    const db = fakeDb({ insertResult: { data: EVENT_ROW, error: null }, capture });
    const result = await recordRoomEvent(db, {
      roomId: 'room-1',
      bookingId: 'booking-1',
      type: 'rally_stage',
      actorRole: 'system',
      subjectKey: 'rally:r1:overdue',
      payload: { stage: 'overdue' },
    });
    expect(result.inserted).toBe(true);
    expect(result.event?.id).toBe('event-1');
    expect(capture.table).toBe('tour_room_events');
    expect(capture.row).toMatchObject({
      room_id: 'room-1',
      type: 'rally_stage',
      actor_role: 'system',
      subject_key: 'rally:r1:overdue',
    });
  });

  it('defaults optional fields (booking/participant/subject null, payload {})', async () => {
    const capture: InsertCapture = {};
    const db = fakeDb({ insertResult: { data: EVENT_ROW, error: null }, capture });
    await recordRoomEvent(db, { roomId: 'room-1', type: 'pin_dropped', actorRole: 'driver' });
    expect(capture.row).toMatchObject({
      booking_id: null,
      actor_participant_id: null,
      subject_key: null,
      payload: {},
    });
  });

  it('unique violation (23505) → inserted:false, no throw (P-D6 race contract)', async () => {
    const db = fakeDb({ insertResult: { data: null, error: { code: '23505', message: 'duplicate key value' } } });
    const result = await recordRoomEvent(db, {
      roomId: 'room-1',
      type: 'rally_stage',
      actorRole: 'system',
      subjectKey: 'rally:r1:overdue',
    });
    expect(result).toEqual({ inserted: false, event: null });
  });

  it('recognises duplicate-key by message when code is missing', async () => {
    const db = fakeDb({
      insertResult: { data: null, error: { message: 'duplicate key value violates unique constraint' } },
    });
    const result = await recordRoomEvent(db, {
      roomId: 'room-1',
      type: 'rally_stage',
      actorRole: 'system',
      subjectKey: 'rally:r1:overdue',
    });
    expect(result.inserted).toBe(false);
  });

  it('other DB errors throw (callers must notice real failures)', async () => {
    const db = fakeDb({ insertResult: { data: null, error: { code: '42P01', message: 'relation missing' } } });
    await expect(
      recordRoomEvent(db, { roomId: 'room-1', type: 'signal', actorRole: 'customer' }),
    ).rejects.toThrow('tour_room_events insert failed');
  });
});

describe('listRoomEvents', () => {
  it('returns rows and applies room/type/after filters', async () => {
    const filters: Array<[string, string, unknown]> = [];
    const db = fakeDb({ listResult: { data: [EVENT_ROW], error: null }, captureFilters: filters });
    const rows = await listRoomEvents(db, 'room-1', {
      types: ['rally_stage'],
      after: '2026-07-20T00:00:00Z',
    });
    expect(rows).toHaveLength(1);
    expect(filters).toEqual(
      expect.arrayContaining([
        ['eq', 'room_id', 'room-1'],
        ['in', 'type', ['rally_stage']],
        ['gt', 'created_at', '2026-07-20T00:00:00Z'],
      ]),
    );
  });

  it('degrades to [] on query error (read-bundle contract)', async () => {
    const db = fakeDb({ listResult: { data: null, error: { message: 'boom' } } });
    await expect(listRoomEvents(db, 'room-1')).resolves.toEqual([]);
  });
});
