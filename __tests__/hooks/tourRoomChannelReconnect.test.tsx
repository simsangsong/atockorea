/**
 * K1a (client half) — the room reopens the fallback when the browser will not.
 *
 * The defect this pins, measured in a real browser with realtime blocked
 * (`scripts/qa-sse-reconnect.ts`):
 *
 *   · /events aborted at the transport layer → 9 attempts in 26s. The browser
 *     owns that failure and recovers from it.
 *   · /events answered with one 500        → 1 attempt, 0 retries in 26s, and
 *     the header still read "Reconnecting…". A non-200 closes `EventSource`
 *     PERMANENTLY per spec, realtime is already down (that is why the fallback
 *     is running), and the hook has no third transport. The room was over.
 *
 * Both failures arrive on the same `error` event; only `readyState` separates
 * them. These tests assert the separation in both directions, because a reopen
 * on the transport case would be a second stream competing with the browser's
 * own retry — the K1a load problem coming back from the client side.
 */
import { act, renderHook } from '@testing-library/react';
import { useTourRoomChannel } from '@/hooks/useTourRoomChannel';
import { SSE_CLIENT_RETRY_MAX_MS, SSE_CLIENT_RETRY_MIN_MS } from '@/lib/tour-room/sseFallback';

const CONNECTING = 0;
const CLOSED = 2;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  readyState = CONNECTING;
  closed = false;
  private listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  close() {
    this.closed = true;
    this.readyState = CLOSED;
  }

  /** What the browser does on a good connection. */
  emitOpen() {
    this.readyState = 1;
    for (const h of this.listeners.get('open') ?? []) h(new Event('open'));
  }

  /** `state` is what the browser leaves behind: CONNECTING = it will retry. */
  emitError(state: number) {
    this.readyState = state;
    for (const h of this.listeners.get('error') ?? []) h(new Event('error'));
  }
}

/** Realtime that fails to subscribe, which is the only reason SSE ever runs. */
class DeadChannel {
  statusCallback: ((status: string) => void) | null = null;
  on() {
    return this;
  }
  subscribe(callback: (status: string) => void) {
    this.statusCallback = callback;
    callback('CHANNEL_ERROR');
    return this;
  }
  presenceState() {
    return {};
  }
  track() {
    return Promise.resolve('ok');
  }
}

let lastChannel: DeadChannel | null = null;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: () => {
      lastChannel = new DeadChannel();
      return lastChannel;
    },
    removeChannel: jest.fn(),
  },
}));

const OPTIONS = {
  bookingId: 'booking-1',
  channelTopic: 'tour-room:room-1:secret',
  roomSession: 'signed-session',
};

function mount() {
  return renderHook(() => useTourRoomChannel(OPTIONS));
}

beforeEach(() => {
  jest.useFakeTimers();
  FakeEventSource.instances = [];
  lastChannel = null;
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('K1a — EventSource gives up, the room does not', () => {
  it('falls to SSE when realtime cannot subscribe', () => {
    mount();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain('/api/tour-rooms/booking-1/events');
  });

  it('🔴 reopens the stream after a non-200 closes it for good', () => {
    mount();
    const first = FakeEventSource.instances[0];
    act(() => first.emitOpen());

    act(() => first.emitError(CLOSED));
    // Nothing yet — reopening instantly would stampede a server that just 500'd.
    expect(FakeEventSource.instances).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(SSE_CLIENT_RETRY_MIN_MS * 2);
    });
    expect(FakeEventSource.instances.length).toBeGreaterThan(1);
    expect(first.closed).toBe(true);
  });

  it('🔴 leaves a transport drop to the browser instead of racing it', () => {
    // readyState CONNECTING means the browser is already retrying. Opening a
    // second stream here would be two clients for one room — K1a's own problem.
    mount();
    const first = FakeEventSource.instances[0];
    act(() => first.emitOpen());

    act(() => first.emitError(CONNECTING));
    act(() => {
      jest.advanceTimersByTime(SSE_CLIENT_RETRY_MAX_MS * 3);
    });
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(first.closed).toBe(false);
  });

  it('🔴 stops promising a reconnection nobody is performing', () => {
    // The measured header read "Reconnecting…" forever because the state was
    // left at 'connecting' when the very first attempt failed before opening.
    const { result } = mount();
    expect(result.current.connection).toBe('connecting');

    act(() => FakeEventSource.instances[0].emitError(CLOSED));
    expect(result.current.connection).toBe('offline');
  });

  it('reports a live fallback once it opens, and again after it recovers', () => {
    const { result } = mount();
    act(() => FakeEventSource.instances[0].emitOpen());
    expect(result.current.connection).toBe('sse');

    act(() => FakeEventSource.instances[0].emitError(CLOSED));
    act(() => {
      jest.advanceTimersByTime(SSE_CLIENT_RETRY_MIN_MS * 2);
    });
    const reopened = FakeEventSource.instances[FakeEventSource.instances.length - 1];
    act(() => reopened.emitOpen());
    expect(result.current.connection).toBe('sse');
  });

  it('backs off instead of hammering a server that keeps failing', () => {
    mount();
    // Every reopen fails the same way. Over a minute the count has to stay in
    // single digits — recovery that becomes load is the bug, restaged.
    for (let elapsed = 0; elapsed < 60_000; elapsed += 1_000) {
      const latest = FakeEventSource.instances[FakeEventSource.instances.length - 1];
      if (!latest.closed) act(() => latest.emitError(CLOSED));
      act(() => {
        jest.advanceTimersByTime(1_000);
      });
    }
    expect(FakeEventSource.instances.length).toBeLessThanOrEqual(8);
    expect(FakeEventSource.instances.length).toBeGreaterThan(2);
  });

  it('does not open a stream into an unmounted room', () => {
    const { unmount } = mount();
    act(() => FakeEventSource.instances[0].emitError(CLOSED));
    const beforeUnmount = FakeEventSource.instances.length;
    unmount();
    act(() => {
      jest.advanceTimersByTime(SSE_CLIENT_RETRY_MAX_MS * 2);
    });
    expect(FakeEventSource.instances).toHaveLength(beforeUnmount);
  });

  it('drops a pending reopen the moment realtime comes back', () => {
    mount();
    act(() => FakeEventSource.instances[0].emitError(CLOSED));
    act(() => lastChannel!.statusCallback!('SUBSCRIBED'));
    act(() => {
      jest.advanceTimersByTime(SSE_CLIENT_RETRY_MAX_MS * 2);
    });
    // One stream, the dead one. A fallback landing after recovery is a second
    // transport for a room that already has one.
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
