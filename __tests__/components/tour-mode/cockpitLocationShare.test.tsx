/**
 * §11.C C1 — the cockpit's vehicle-location toggle.
 *
 * The console only ever took one-shot fixes (parking pin / vehicle arrived);
 * this is what puts a moving van on the guest's map. Contract: ON for the tour
 * day, an explicit choice (either way) is remembered for that day, and turning
 * it off calls the relay's stop-sharing (DELETE) rather than just muting the UI.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import Cockpit, { vehicleShareKey, type CockpitRoom } from '@/components/tour-mode/cockpit/Cockpit';
import { kstToday } from '@/lib/tour-room/time';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

/**
 * The twelve action buttons now live in a KakaoTalk-style tray behind the "+"
 * in the composer instead of three permanently-open grids. Everything that
 * asserts on an action must open it first.
 */
function openActionTray() {
  fireEvent.click(screen.getByTestId('cockpit-actions-toggle'));
}

const mockChannelState = {
  messages: [] as RoomMessage[],
  connection: 'realtime',
  sendText: jest.fn().mockResolvedValue(true),
  sendPreset: jest.fn().mockResolvedValue(true),
  retryFailed: jest.fn(),
  failedCount: 0,
};
jest.mock('@/hooks/useTourRoomChannel', () => ({
  useTourRoomChannel: () => mockChannelState,
}));
jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => true),
  startVoiceRecording: jest.fn(),
}));
jest.mock('@/lib/tour-room/deviceStt', () => ({
  isDeviceSttSupported: jest.fn(() => false),
  startDeviceStt: jest.fn(),
}));

const stopSharingMock = jest.fn().mockResolvedValue(undefined);
const geoWatcherCalls: Array<{ bookingId: string; roomSession: string; enabled: boolean }> = [];
let geoStatus = 'idle';
// The label now distinguishes "the device is emitting" from "the server
// accepted a position" — a coarse fix publishes nothing (P0: the button used
// to read 공유 중 while the room got nothing).
let geoPublishedAt: number | null = 1;
let geoAccuracyBlocked = false;
jest.mock('@/hooks/useGeoWatcher', () => ({
  useGeoWatcher: (options: { bookingId: string; roomSession: string; enabled: boolean }) => {
    geoWatcherCalls.push({ ...options });
    return {
      status: options.enabled ? geoStatus : 'idle',
      lastPosition: null,
      lastPublishedAtMs: options.enabled ? geoPublishedAt : null,
      accuracyBlocked: options.enabled ? geoAccuracyBlocked : false,
      stopSharing: stopSharingMock,
    };
  },
}));

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = jest.fn();
});

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
  geoWatcherCalls.length = 0;
  stopSharingMock.mockClear();
  geoStatus = 'watching';
  geoPublishedAt = 1;
  geoAccuracyBlocked = false;
});

const room: CockpitRoom = {
  booking_id: 'b1',
  number_of_guests: 2,
  pickup: { name: '제주공항', lat: 33.5, lng: 126.5, pickup_time: '09:00' },
  schedule_source: 'plan',
  schedule: [{ time: '10:00', title: '성산일출봉', poi_key: 'seongsan', lat: 33.45, lng: 126.94 }],
};

const base = {
  tourTitle: '제주 동부 투어',
  lifecycle: 'live' as const,
  room,
  bookingId: 'b1',
  session: 'sess',
  channelTopic: 'topic',
  initialMessages: [],
};

const lastEnabled = () => geoWatcherCalls[geoWatcherCalls.length - 1].enabled;

const KEY = () => vehicleShareKey('b1', kstToday());

/**
 * 🔴 CONTRACT CHANGE, 사장님 2026-08-07 — "투어 당일 자동으로 켜기".
 *
 * This used to open with "starts OFF — first use is always a deliberate tap".
 * That contract lost the morning it was written for: a guest opens the map to
 * find their ride, and the one position that matters is missing because the
 * driver had not tapped a button on their own screen. The deliberate tap is now
 * the tap that turns it OFF.
 *
 * What did NOT change: sharing is still foreground-only (the watcher pauses on
 * a hidden tab and stops on unmount), the off switch is still one tap away, and
 * turning it off still clears the server snapshot.
 */
describe('Cockpit vehicle-location toggle (§11.C C1)', () => {
  it('starts ON on the tour day — the guest map has a van without anyone tapping', () => {
    render(<Cockpit {...base} />);
    expect(lastEnabled()).toBe(true);
    openActionTray();
    const toggle = screen.getByTestId('action-grid-share');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent('공유 중');
  });

  it('stays OFF before and after the tour day', () => {
    const { unmount } = render(<Cockpit {...base} lifecycle="lobby" />);
    expect(lastEnabled()).toBe(false);
    unmount();

    render(<Cockpit {...base} lifecycle="ended" />);
    expect(lastEnabled()).toBe(false);
  });

  it('turning it off is remembered for the day — auto-on must not undo it', () => {
    render(<Cockpit {...base} />);
    openActionTray();
    fireEvent.click(screen.getByTestId('action-grid-share'));

    expect(stopSharingMock).toHaveBeenCalledTimes(1);
    expect(lastEnabled()).toBe(false);
    // 🔴 '0', not a cleared key: "no record" means "follow the tour day", so
    // removing it would switch the staff device back on behind them.
    expect(window.localStorage.getItem(KEY())).toBe('0');
  });

  it('a remembered OFF survives the next mount', () => {
    window.localStorage.setItem(KEY(), '0');
    render(<Cockpit {...base} />);
    expect(lastEnabled()).toBe(false);
    openActionTray();
    expect(screen.getByTestId('action-grid-share')).toHaveAttribute('aria-pressed', 'false');
  });

  it('turning it back on is remembered too', () => {
    window.localStorage.setItem(KEY(), '0');
    render(<Cockpit {...base} />);
    openActionTray();
    fireEvent.click(screen.getByTestId('action-grid-share'));
    expect(lastEnabled()).toBe(true);
    expect(window.localStorage.getItem(KEY())).toBe('1');
    expect(screen.getByTestId('action-grid-active-share')).toBeInTheDocument();
  });

  it('an explicit ON before the tour day still wins', () => {
    window.localStorage.setItem(vehicleShareKey('b1', kstToday()), '1');
    render(<Cockpit {...base} lifecycle="lobby" />);
    expect(lastEnabled()).toBe(true);
  });

  it('a choice is scoped to the booking AND the day', () => {
    window.localStorage.setItem(vehicleShareKey('other-booking', kstToday()), '0');
    window.localStorage.setItem(vehicleShareKey('b1', '2020-01-01'), '0');
    render(<Cockpit {...base} lifecycle="lobby" />);
    // Neither key belongs to this booking-and-day, so neither silences it;
    // 'lobby' is what keeps it off here.
    expect(lastEnabled()).toBe(false);
    expect(window.localStorage.getItem(KEY())).toBeNull();
  });

  it('a denied permission is surfaced, not retried in a loop', () => {
    // Auto-on means the denial now surfaces without anyone tapping — which is
    // the point: the staff member finds out at the start of the day, not when a
    // guest asks why the van is missing.
    geoStatus = 'denied';
    render(<Cockpit {...base} />);
    openActionTray();
    expect(screen.getByTestId('action-grid-share')).toHaveTextContent('권한 필요');
    expect(screen.getByText('위치 권한을 허용해 주세요 (설정 > 위치)')).toBeInTheDocument();
  });

  it('stays available on a join tour (vehicle position is kind-neutral)', () => {
    render(<Cockpit {...base} tourKind="join" />);
    openActionTray();
    expect(screen.getByTestId('action-grid-share')).toBeInTheDocument();
    expect(screen.queryByTestId('action-grid-expense')).not.toBeInTheDocument();
  });
});
