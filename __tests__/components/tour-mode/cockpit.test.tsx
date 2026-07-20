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
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

// Controllable channel state so tests can seed the feed with guest messages.
const mockChannelState: { messages: RoomMessage[]; connection: string } = {
  messages: [],
  connection: 'realtime',
};
jest.mock('@/hooks/useTourRoomChannel', () => ({
  useTourRoomChannel: () => mockChannelState,
}));
jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => true),
  startVoiceRecording: jest.fn(),
}));

beforeEach(() => {
  mockChannelState.messages = [];
  mockChannelState.connection = 'realtime';
});

function guestMsg(extra: Partial<RoomMessage>): RoomMessage {
  return {
    id: 'm1',
    sender_role: 'customer',
    source_text: '',
    created_at: '2099-07-20T01:00:00Z',
    ...extra,
  };
}

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

  // TIER 0 P0 — a guest photo/file must be visible to the Korean-only driver,
  // not collapsed into an empty grey bubble.
  it('renders a caption-less guest photo (not an empty bubble)', () => {
    mockChannelState.messages = [
      guestMsg({
        input_kind: 'image',
        metadata: { attachment: { url: 'https://x/att/a.jpg', name: 'address.jpg' } },
      }),
    ];
    render(<Cockpit {...base} />);
    const img = screen.getByTestId('cockpit-image').querySelector('img');
    expect(img).toHaveAttribute('src', 'https://x/att/a.jpg');
  });

  it('renders a guest file attachment as a download chip with its name', () => {
    mockChannelState.messages = [
      guestMsg({
        id: 'm2',
        input_kind: 'file',
        metadata: { attachment: { url: 'https://x/att/t.pdf', name: 'ticket.pdf', size: 1024 } },
      }),
    ];
    render(<Cockpit {...base} />);
    const chip = screen.getByTestId('cockpit-file');
    expect(chip).toHaveAttribute('href', 'https://x/att/t.pdf');
    expect(screen.getByText('ticket.pdf')).toBeInTheDocument();
  });
});
