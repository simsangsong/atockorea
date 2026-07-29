/**
 * X15 Phase 1 — the staff device detects arrival.
 *
 * 🔴 What this ticket actually was: not "build a geofence". The engine
 * (`lib/tour-room/geo` + `spotWatcher`) has existed and been unit-tested since
 * T4.4, and the cockpit has streamed position continuously since §11.C C1.
 * They had never been connected — the geofence's only consumer was the GUEST
 * map tab, behind a share that is opt-in, default OFF and foreground-only, so
 * arrivals were being detected for almost nobody.
 *
 * These tests therefore assert the WIRING, which is the part that was missing,
 * and the two rules that keep it safe:
 *   - it rides the existing opt-in stream (no share ⇒ no geofence);
 *   - it OFFERS the arrival sheet, it never sends on the driver's behalf.
 */
import type { ComponentProps } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Cockpit from '@/components/tour-mode/cockpit/Cockpit';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import { vehicleShareKey } from '@/components/tour-mode/cockpit/Cockpit';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('@/hooks/useTourRoomChannel', () => ({
  useTourRoomChannel: () => ({ messages: [], connection: 'realtime', presence: [], sendMessage: jest.fn() }),
}));
jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => true),
  startVoiceRecording: jest.fn(),
}));
jest.mock('@/lib/tour-room/deviceStt', () => ({
  isDeviceSttSupported: () => false,
  startDeviceStt: jest.fn(),
}));
jest.mock('@/lib/tour-room/tts', () => ({ primeAudio: jest.fn(), speak: jest.fn() }));

/** Captured so a test can push a sample the way a real device would. */
const geoWatcherCalls: Array<{ enabled: boolean; onSample?: (s: unknown) => void }> = [];
jest.mock('@/hooks/useGeoWatcher', () => ({
  useGeoWatcher: (options: { enabled: boolean; onSample?: (s: unknown) => void }) => {
    geoWatcherCalls.push({ enabled: options.enabled, onSample: options.onSample });
    return {
      status: options.enabled ? 'watching' : 'idle',
      lastPosition: null,
      lastPublishedAtMs: options.enabled ? 1 : null,
      accuracyBlocked: false,
      stopSharing: jest.fn().mockResolvedValue(undefined),
    };
  },
}));

/** The real geofence maths is unit-tested elsewhere; here we only need to know
 *  that the cockpit's samples reach a geofence armed with the room's spots. */
const geofenceCalls: Array<{ enabled: boolean; spots: unknown[] }> = [];
let fireArrival: ((a: { spotId: string; distanceM: number }) => void) | undefined;
jest.mock('@/hooks/useSpotGeofence', () => ({
  useSpotGeofence: (options: {
    enabled: boolean;
    spots: unknown[];
    onArrival?: (a: { spotId: string; distanceM: number }) => void;
  }) => {
    geofenceCalls.push({ enabled: options.enabled, spots: options.spots });
    fireArrival = options.onArrival;
    return { onSample: jest.fn() };
  },
}));

/** The cockpit remembers the vehicle-share opt-in per booking. */
function enableSharing() {
  window.localStorage.setItem(vehicleShareKey('b-1'), '1');
}

const SPOT = {
  id: 'spot-1',
  title: 'Seongsan Ilchulbong',
  poi_key: 'seongsan_ilchulbong',
  latitude: 33.4587,
  longitude: 126.9425,
  trigger_radius_m: 150,
  exit_radius_m: 250,
};

const ROOM = {
  booking_id: 'b-1',
  number_of_guests: 2,
  pickup: null,
  schedule_source: 'plan',
  schedule: [{ title: 'Seongsan Ilchulbong', poi_key: 'seongsan_ilchulbong', time: '09:00' }],
};

function mockSnapshot(spots: unknown[]) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/snapshot')) {
      return { ok: true, json: async () => ({ tour_guide_spots: spots }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

const BASE = {
  tourTitle: '제주 동부 투어',
  lifecycle: 'live' as const,
  room: ROOM,
  bookingId: 'b-1',
  session: 'sess-1',
  channelTopic: 'topic',
  initialMessages: [],
};

function mount() {
  return render(<Cockpit {...(BASE as unknown as ComponentProps<typeof Cockpit>)} />);
}

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
  geofenceCalls.length = 0;
  geoWatcherCalls.length = 0;
  fireArrival = undefined;
  mockSnapshot([SPOT]);
});

describe('cockpit arrival geofence (X15 Phase 1)', () => {
  /**
   * The whole ticket in one assertion: the cockpit's position stream is handed
   * to the geofence. Before this, `onSample` was simply not passed and the
   * engine never saw a staff sample.
   */
  it('feeds the staff position stream into the geofence once sharing is on', async () => {
    enableSharing();
    mount();
    await waitFor(() => expect(geoWatcherCalls.some((c) => c.enabled)).toBe(true));
    // `typeof`, not `toBeInstanceOf(Function)`: a jest.fn() created inside a
    // jest.mock factory does not satisfy the test realm's `Function` identity.
    expect(typeof geoWatcherCalls.filter((c) => c.enabled).at(-1)!.onSample).toBe('function');
  });

  it('arms the geofence with the room’s guide spots', async () => {
    enableSharing();
    mount();
    await waitFor(() => {
      const armed = geofenceCalls.filter((c) => c.enabled && c.spots.length > 0);
      expect(armed.length).toBeGreaterThan(0);
      expect((armed.at(-1)!.spots[0] as { id: string }).id).toBe('spot-1');
    });
  });

  /**
   * 🔴 No share, no geofence. The driver's location toggle is the single
   * consent point; arrival detection must not become a second, invisible reason
   * to read position.
   */
  it('stays disarmed while location sharing is off', async () => {
    mount();
    await waitFor(() => expect(geofenceCalls.length).toBeGreaterThan(0));
    expect(geofenceCalls.every((c) => !c.enabled)).toBe(true);
    expect(geoWatcherCalls.every((c) => !c.enabled)).toBe(true);
  });

  it('offers the arrival sheet when the geofence trips — and sends nothing', async () => {
    enableSharing();
    mount();
    await waitFor(() => expect(typeof fireArrival).toBe('function'));

    const before = (global.fetch as jest.Mock).mock.calls.length;
    fireArrival!({ spotId: 'spot-1', distanceM: 40 });

    const prompt = await screen.findByTestId('cockpit-arrival-prompt');
    expect(prompt).toHaveTextContent('Seongsan Ilchulbong');

    /**
     * The arrival bundle carries a meeting time and §A0 forbids a default one,
     * so firing it automatically would invent the single field a guest acts on.
     * Showing the prompt must therefore cost zero requests.
     */
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(before);
  });

  it('the prompt can be dismissed without opening anything', async () => {
    enableSharing();
    mount();
    await waitFor(() => expect(typeof fireArrival).toBe('function'));
    fireArrival!({ spotId: 'spot-1', distanceM: 40 });

    fireEvent.click(await screen.findByTestId('cockpit-arrival-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('cockpit-arrival-prompt')).toBeNull());
  });
});
