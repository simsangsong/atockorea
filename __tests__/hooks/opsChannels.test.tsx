/**
 * W2.2 — multi-room ops subscription: two rooms receiving concurrently keep
 * independent streams, unread counters follow the read cursor, and REST
 * ingestion dedupes against broadcast copies.
 */
import { act, renderHook } from '@testing-library/react';
import { useOpsChannels, countUnread, type OpsChannelDescriptor } from '@/hooks/useOpsChannels';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

type BroadcastHandler = (frame: { payload: Record<string, unknown> }) => void;

class FakeChannel {
  topic: string;
  handlers = new Map<string, BroadcastHandler>();
  statusCallback: ((status: string) => void) | null = null;

  constructor(topic: string) {
    this.topic = topic;
  }

  on(_type: string, filter: { event: string }, callback: BroadcastHandler) {
    this.handlers.set(filter.event, callback);
    return this;
  }

  subscribe(callback: (status: string) => void) {
    this.statusCallback = callback;
    callback('SUBSCRIBED');
    return this;
  }

  emit(event: string, payload: Record<string, unknown>) {
    this.handlers.get(event)?.({ payload });
  }
}

const fakeChannels = new Map<string, FakeChannel>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (topic: string) => {
      const channel = new FakeChannel(topic);
      fakeChannels.set(topic, channel);
      return channel;
    },
    removeChannel: jest.fn(),
  },
}));

const DESCRIPTORS: OpsChannelDescriptor[] = [
  { roomId: 'room-1', bookingId: 'booking-1', topic: 'tour-room:room-1:aaaa1111', status: 'active' },
  { roomId: 'room-2', bookingId: 'booking-2', topic: 'tour-room:room-2:bbbb2222', status: 'active' },
];

function msg(id: string, createdAt: string, extra?: Partial<RoomMessage>): RoomMessage {
  return { id, sender_role: 'customer', source_text: id, created_at: createdAt, ...extra };
}

beforeEach(() => {
  fakeChannels.clear();
  window.localStorage.clear();
});

describe('useOpsChannels (W2.2)', () => {
  it('streams two rooms concurrently without cross-talk and reports realtime', () => {
    const { result } = renderHook(() => useOpsChannels(DESCRIPTORS));
    expect(result.current.connection).toBe('realtime');

    act(() => {
      fakeChannels.get('tour-room:room-1:aaaa1111')!.emit('message', { message: msg('m1', '2099-07-20T01:00:00Z') });
      fakeChannels.get('tour-room:room-2:bbbb2222')!.emit('message', { message: msg('m2', '2099-07-20T01:00:30Z') });
      fakeChannels.get('tour-room:room-1:aaaa1111')!.emit('message', { message: msg('m3', '2099-07-20T01:01:00Z') });
    });

    expect(result.current.streams['room-1'].messages.map((m) => m.id)).toEqual(['m1', 'm3']);
    expect(result.current.streams['room-2'].messages.map((m) => m.id)).toEqual(['m2']);
    expect(result.current.unread).toEqual({ 'room-1': 2, 'room-2': 1 });
  });

  it('location frames update per-room maps via applyLocationFrame semantics', () => {
    const { result } = renderHook(() => useOpsChannels(DESCRIPTORS));
    act(() => {
      fakeChannels.get('tour-room:room-1:aaaa1111')!.emit('location', {
        location: { participant_id: 'p-1', latitude: 35.1, longitude: 129.0, recorded_at: '2099-07-20T01:00:00Z' },
      });
      // Stale out-of-order frame must not overwrite.
      fakeChannels.get('tour-room:room-1:aaaa1111')!.emit('location', {
        location: { participant_id: 'p-1', latitude: 34.0, longitude: 128.0, recorded_at: '2099-07-20T00:59:00Z' },
      });
    });
    expect(result.current.streams['room-1'].locations['p-1'].latitude).toBe(35.1);
    expect(result.current.streams['room-2']?.locations ?? {}).toEqual({});
  });

  it('markRead zeroes the unread badge and persists the cursor', () => {
    const { result } = renderHook(() => useOpsChannels(DESCRIPTORS));
    act(() => {
      fakeChannels.get('tour-room:room-1:aaaa1111')!.emit('message', { message: msg('m1', '2099-07-20T01:00:00Z') });
    });
    expect(result.current.unread['room-1']).toBe(1);

    act(() => result.current.markRead('room-1'));
    expect(result.current.unread['room-1']).toBe(0);
    expect(window.localStorage.getItem('tour_ops_read:room-1')).toBe('2099-07-20T01:00:00Z');

    // A newer message re-raises the badge; the pre-cursor one stays read.
    act(() => {
      fakeChannels.get('tour-room:room-1:aaaa1111')!.emit('message', { message: msg('m2', '2099-07-20T02:00:00Z') });
    });
    expect(result.current.unread['room-1']).toBe(1);
  });

  it('ingestMessages merges REST backlog without duplicating broadcast copies', () => {
    const { result } = renderHook(() => useOpsChannels(DESCRIPTORS));
    act(() => {
      fakeChannels.get('tour-room:room-1:aaaa1111')!.emit('message', { message: msg('m2', '2099-07-20T02:00:00Z') });
    });
    act(() => {
      result.current.ingestMessages('room-1', [msg('m1', '2099-07-20T01:00:00Z'), msg('m2', '2099-07-20T02:00:00Z')]);
    });
    expect(result.current.streams['room-1'].messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('drops to degraded when one of the topics errors', () => {
    const { result } = renderHook(() => useOpsChannels(DESCRIPTORS));
    act(() => {
      fakeChannels.get('tour-room:room-2:bbbb2222')!.statusCallback!('CHANNEL_ERROR');
    });
    expect(result.current.connection).toBe('degraded');
  });
});

describe('countUnread (W2.2)', () => {
  it('admin sends never count as unread', () => {
    const messages = [
      msg('m1', '2099-07-20T01:00:00Z'),
      msg('m2', '2099-07-20T02:00:00Z', { sender_role: 'admin' }),
      msg('local-1', '2099-07-20T03:00:00Z', { _local: 'sending' }),
    ];
    expect(countUnread(messages, '')).toBe(1);
    expect(countUnread(messages, '2099-07-20T01:00:00Z')).toBe(0);
  });
});
