/**
 * T1.5 — pure merge/cursor logic of the room channel (dedupe across
 * Broadcast + SSE + resync sources, §O-6).
 */
import { latestCursor, mergeRoomMessages, type RoomMessage } from '@/hooks/useTourRoomChannel';

function msg(id: string, createdAt: string, extra?: Partial<RoomMessage>): RoomMessage {
  return { id, sender_role: 'customer', source_text: id, created_at: createdAt, ...extra };
}

describe('mergeRoomMessages', () => {
  it('dedupes by id when the same message arrives via Broadcast and SSE', () => {
    const a = msg('m1', '2026-07-14T01:00:00Z');
    const merged = mergeRoomMessages([a], [msg('m1', '2026-07-14T01:00:00Z'), msg('m2', '2026-07-14T01:01:00Z')]);
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('sorts by created_at regardless of arrival order (reconnect backlog)', () => {
    const merged = mergeRoomMessages(
      [msg('m3', '2026-07-14T03:00:00Z')],
      [msg('m1', '2026-07-14T01:00:00Z'), msg('m2', '2026-07-14T02:00:00Z')],
    );
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('lets the server copy replace an optimistic one, never the reverse', () => {
    const optimistic = msg('m1', '2026-07-14T01:00:00Z', { _local: 'sending' });
    const server = msg('m1', '2026-07-14T01:00:00Z', { translations: { ko: '번역' } });
    const upgraded = mergeRoomMessages([optimistic], [server]);
    expect(upgraded[0]._local).toBeUndefined();
    expect(upgraded[0].translations).toEqual({ ko: '번역' });

    const notDowngraded = mergeRoomMessages([server], [optimistic]);
    expect(notDowngraded[0]._local).toBeUndefined();
  });

  it('ignores frames without an id and returns existing on empty incoming', () => {
    const existing = [msg('m1', '2026-07-14T01:00:00Z')];
    expect(mergeRoomMessages(existing, [])).toBe(existing);
    expect(mergeRoomMessages(existing, [{ ...msg('', '2026-07-14T02:00:00Z'), id: '' }])).toHaveLength(1);
  });
});

describe('latestCursor', () => {
  it('returns the newest server timestamp, skipping optimistic entries', () => {
    const messages = [
      msg('m1', '2026-07-14T01:00:00Z'),
      msg('m2', '2026-07-14T02:00:00Z'),
      msg('local-1', '2026-07-14T03:00:00Z', { _local: 'sending' }),
    ];
    expect(latestCursor(messages)).toBe('2026-07-14T02:00:00Z');
    expect(latestCursor([])).toBeNull();
  });
});
