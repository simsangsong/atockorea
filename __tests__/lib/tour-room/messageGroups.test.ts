import { buildFeedItems, kstDayKey, GROUP_WINDOW_MS } from '@/lib/tour-room/messageGroups';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

function msg(partial: Partial<RoomMessage> & { id: string; created_at: string }): RoomMessage {
  return {
    sender_role: 'customer',
    source_text: 'hello',
    ...partial,
  } as RoomMessage;
}

describe('kstDayKey', () => {
  it('maps a UTC evening to the next KST day', () => {
    // 2026-07-14T20:00Z = 2026-07-15 05:00 KST
    expect(kstDayKey('2026-07-14T20:00:00Z')).toBe('2026-07-15');
    expect(kstDayKey('2026-07-14T10:00:00Z')).toBe('2026-07-14');
  });

  it('is safe on malformed input', () => {
    expect(kstDayKey('not-a-date')).toBe('invalid');
  });
});

describe('buildFeedItems', () => {
  it('inserts a date separator before the first message and at day changes', () => {
    const items = buildFeedItems(
      [
        msg({ id: 'a', created_at: '2026-07-14T10:00:00Z' }),
        msg({ id: 'b', created_at: '2026-07-14T20:00:00Z' }), // next KST day
      ],
      'customer',
    );
    expect(items.map((i) => i.type)).toEqual(['date', 'message', 'date', 'message']);
    expect(items[0].type === 'date' && items[0].dayKey).toBe('2026-07-14');
    expect(items[2].type === 'date' && items[2].dayKey).toBe('2026-07-15');
  });

  it('groups consecutive same-role messages within the window', () => {
    const items = buildFeedItems(
      [
        msg({ id: 'a', sender_role: 'guide', created_at: '2026-07-14T10:00:00Z' }),
        msg({ id: 'b', sender_role: 'guide', created_at: '2026-07-14T10:01:00Z' }),
        msg({ id: 'c', sender_role: 'guide', created_at: '2026-07-14T10:02:00Z' }),
      ],
      'customer',
    );
    const bubbles = items.filter((i) => i.type === 'message');
    expect(bubbles.map((b) => b.type === 'message' && b.groupStart)).toEqual([true, false, false]);
    expect(bubbles.map((b) => b.type === 'message' && b.groupEnd)).toEqual([false, false, true]);
  });

  it('breaks the group when the window is exceeded', () => {
    const items = buildFeedItems(
      [
        msg({ id: 'a', sender_role: 'guide', created_at: '2026-07-14T10:00:00Z' }),
        msg({
          id: 'b',
          sender_role: 'guide',
          created_at: new Date(Date.parse('2026-07-14T10:00:00Z') + GROUP_WINDOW_MS + 1000).toISOString(),
        }),
      ],
      'customer',
    );
    const bubbles = items.filter((i): i is Extract<typeof items[number], { type: 'message' }> => i.type === 'message');
    expect(bubbles[0].groupEnd).toBe(true);
    expect(bubbles[1].groupStart).toBe(true);
  });

  it('breaks the group on role change and around system messages', () => {
    const items = buildFeedItems(
      [
        msg({ id: 'a', sender_role: 'guide', created_at: '2026-07-14T10:00:00Z' }),
        msg({ id: 's', sender_role: 'system', created_at: '2026-07-14T10:00:30Z' }),
        msg({ id: 'b', sender_role: 'guide', created_at: '2026-07-14T10:01:00Z' }),
      ],
      'customer',
    );
    const bubbles = items.filter((i): i is Extract<typeof items[number], { type: 'message' }> => i.type === 'message');
    expect(bubbles[0].groupEnd).toBe(true);
    expect(bubbles[1].system).toBe(true);
    expect(bubbles[2].groupStart).toBe(true);
  });

  it('marks mine by viewer role and never marks system as mine', () => {
    const items = buildFeedItems(
      [
        msg({ id: 'a', sender_role: 'customer', created_at: '2026-07-14T10:00:00Z' }),
        msg({ id: 's', sender_role: 'system', created_at: '2026-07-14T10:00:10Z' }),
        msg({ id: 'g', sender_role: 'guide', created_at: '2026-07-14T10:00:20Z' }),
      ],
      'customer',
    );
    const bubbles = items.filter((i): i is Extract<typeof items[number], { type: 'message' }> => i.type === 'message');
    expect(bubbles.map((b) => b.mine)).toEqual([true, false, false]);
  });
});
