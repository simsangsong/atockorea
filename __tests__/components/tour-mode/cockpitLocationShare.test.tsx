/**
 * §11.C C1 — the cockpit's vehicle-location toggle.
 *
 * The console only ever took one-shot fixes (parking pin / vehicle arrived);
 * this opt-in is what puts a moving van on the guest's map. Contract: OFF on
 * first use, remembered per booking once enabled, and turning it off calls the
 * relay's stop-sharing (DELETE) rather than just muting the UI.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import Cockpit, { vehicleShareKey, type CockpitRoom } from '@/components/tour-mode/cockpit/Cockpit';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

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
jest.mock('@/hooks/useGeoWatcher', () => ({
  useGeoWatcher: (options: { bookingId: string; roomSession: string; enabled: boolean }) => {
    geoWatcherCalls.push({ ...options });
    return {
      status: options.enabled ? geoStatus : 'idle',
      lastPosition: null,
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

describe('Cockpit vehicle-location toggle (§11.C C1)', () => {
  it('starts OFF — the watcher is mounted but not publishing', () => {
    render(<Cockpit {...base} />);
    const toggle = screen.getByTestId('driver-action-location-share');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent('위치공유');
    expect(lastEnabled()).toBe(false);
    expect(screen.queryByTestId('driver-share-dot')).not.toBeInTheDocument();
  });

  it('turning it on enables the watcher and remembers the booking', () => {
    render(<Cockpit {...base} />);
    fireEvent.click(screen.getByTestId('driver-action-location-share'));
    expect(lastEnabled()).toBe(true);
    expect(window.localStorage.getItem(vehicleShareKey('b1'))).toBe('1');
    expect(screen.getByTestId('driver-action-location-share')).toHaveTextContent('공유 중');
    expect(screen.getByTestId('driver-share-dot')).toBeInTheDocument();
  });

  it('auto-resumes on the next mount once remembered', () => {
    window.localStorage.setItem(vehicleShareKey('b1'), '1');
    render(<Cockpit {...base} />);
    expect(lastEnabled()).toBe(true);
    expect(screen.getByTestId('driver-action-location-share')).toHaveAttribute('aria-pressed', 'true');
  });

  it('the memory is per booking — another booking still starts OFF', () => {
    window.localStorage.setItem(vehicleShareKey('other-booking'), '1');
    render(<Cockpit {...base} />);
    expect(lastEnabled()).toBe(false);
  });

  it('turning it off clears the server snapshot and the memory', () => {
    window.localStorage.setItem(vehicleShareKey('b1'), '1');
    render(<Cockpit {...base} />);
    fireEvent.click(screen.getByTestId('driver-action-location-share'));
    expect(stopSharingMock).toHaveBeenCalledTimes(1);
    expect(lastEnabled()).toBe(false);
    expect(window.localStorage.getItem(vehicleShareKey('b1'))).toBeNull();
  });

  it('a denied permission is surfaced, not retried in a loop', () => {
    geoStatus = 'denied';
    render(<Cockpit {...base} />);
    fireEvent.click(screen.getByTestId('driver-action-location-share'));
    expect(screen.getByTestId('driver-action-location-share')).toHaveTextContent('권한 필요');
    expect(screen.getByText('위치 권한을 허용해 주세요 (설정 > 위치)')).toBeInTheDocument();
  });

  it('stays available on a join tour (vehicle position is kind-neutral)', () => {
    render(<Cockpit {...base} tourKind="join" />);
    expect(screen.getByTestId('driver-action-location-share')).toBeInTheDocument();
    expect(screen.queryByTestId('driver-action-expense')).not.toBeInTheDocument();
  });
});
