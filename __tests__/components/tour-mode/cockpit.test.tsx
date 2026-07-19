/**
 * Phase 2 (unified cockpit) — the shared dark <Cockpit/>.
 *
 * One surface serves the pure driver and the guide who is driving today; the
 * only difference is `onExit` (the guide's way back to dispatch). This locks
 * the shared render contract: the core driving controls always mount, and the
 * exit affordance appears only when a way back is provided.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import Cockpit, { type CockpitRoom } from '@/components/tour-mode/cockpit/Cockpit';

jest.mock('@/hooks/useTourRoomChannel', () => ({
  useTourRoomChannel: () => ({ messages: [], connection: 'realtime' }),
}));
jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => true),
  startVoiceRecording: jest.fn(),
}));

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

describe('shared Cockpit', () => {
  it('mounts the core driving controls (mic, typed send, one-tap actions)', () => {
    render(<Cockpit {...base} />);
    expect(screen.getByTestId('driver-console')).toBeInTheDocument();
    expect(screen.getByTestId('driver-mic')).toBeInTheDocument();
    expect(screen.getByTestId('driver-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-타세요')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-expense')).toBeInTheDocument();
    expect(screen.getByText('제주 동부 투어 · 연결됨')).toBeInTheDocument();
  });

  it('omits the exit affordance for the pure driver (no onExit)', () => {
    render(<Cockpit {...base} />);
    expect(screen.queryByTestId('cockpit-exit')).not.toBeInTheDocument();
  });

  it('shows an exit-to-dispatch control for the guide and fires onExit', () => {
    const onExit = jest.fn();
    render(<Cockpit {...base} onExit={onExit} />);
    const exit = screen.getByTestId('cockpit-exit');
    expect(exit).toBeInTheDocument();
    fireEvent.click(exit);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('shows the pickup as the destination while in the lobby phase', () => {
    render(<Cockpit {...base} lifecycle="lobby" />);
    expect(screen.getByText('픽업')).toBeInTheDocument();
    expect(screen.getByText('09:00 제주공항')).toBeInTheDocument();
  });
});
