/**
 * Wave T3 UI — LocationShareCard states (T3.4), PresenceBar (T3.5),
 * PickupBoard (T3.7), FindGuideCard (T3.3).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import LocationShareCard from '@/components/tour-mode/map/LocationShareCard';
import FindGuideCard from '@/components/tour-mode/map/FindGuideCard';
import PresenceBar from '@/components/tour-mode/PresenceBar';
import PickupBoard from '@/components/tour-mode/PickupBoard';
import type { PickupBoardState } from '@/lib/tour-room/pickup';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

describe('LocationShareCard (T3.4)', () => {
  it.each(ROOM_LOCALES)('shows consent copy and toggles in %s', (locale) => {
    const onToggle = jest.fn();
    render(<LocationShareCard locale={locale} enabled={false} status="idle" onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('location-toggle'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('denied state disables the switch and shows settings guidance (no re-request loop)', () => {
    const onToggle = jest.fn();
    render(<LocationShareCard locale="en" enabled={false} status="denied" onToggle={onToggle} />);
    const toggle = screen.getByTestId('location-toggle');
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/browser settings/i)).toBeInTheDocument();
  });

  it('active sharing shows the live indicator', () => {
    render(<LocationShareCard locale="en" enabled status="watching" onToggle={jest.fn()} />);
    expect(screen.getByText(/Sharing live/)).toBeInTheDocument();
  });
});

describe('PresenceBar (T3.5)', () => {
  const presence = [
    { participantId: 'c1', role: 'customer', displayName: 'Alex', onlineAt: '' },
    { participantId: 'g1', role: 'guide', displayName: 'Kim', onlineAt: '' },
  ];

  it('renders the online count with the guide first', () => {
    render(<PresenceBar presence={presence} locale="en" myParticipantId="c1" />);
    const bar = screen.getByTestId('presence-bar');
    expect(bar).toHaveTextContent('2 online');
    const chips = bar.querySelectorAll('span[title]');
    expect(chips[0].getAttribute('title')).toBe('Kim'); // guide sorted first
  });

  it('renders nothing while presence has not synced', () => {
    render(<PresenceBar presence={[]} locale="en" />);
    expect(screen.queryByTestId('presence-bar')).not.toBeInTheDocument();
  });
});

describe('FindGuideCard (T3.3)', () => {
  it('shows distance, direction and the walking deep link', () => {
    render(
      <FindGuideCard
        me={{ latitude: 35.1, longitude: 129.0 }}
        guide={{ latitude: 35.11, longitude: 129.0 }}
        locale="en"
      />,
    );
    const card = screen.getByTestId('find-guide-card');
    expect(card).toHaveTextContent('Find my guide');
    const link = card.querySelector('a');
    expect(link!.getAttribute('href')).toContain('destination=35.11,129');
    expect(link!.getAttribute('href')).toContain('travelmode=walking');
  });

  it('renders nothing without both positions', () => {
    render(<FindGuideCard me={null} guide={{ latitude: 1, longitude: 2 }} locale="en" />);
    expect(screen.queryByTestId('find-guide-card')).not.toBeInTheDocument();
  });
});

describe('PickupBoard (T3.7)', () => {
  const LIVE: PickupBoardState = {
    visible: true,
    mode: 'live',
    rank: 2,
    totalStops: 5,
    myStop: { booking_id: 'mine', pickup_point_id: 'pp', name: 'Seomyeon Stn', lat: 1, lng: 2, pickup_time: '08:50:00' },
    etaMinutes: 12,
    distanceM: 4000,
  };

  it.each(ROOM_LOCALES)('renders rank, ETA and status buttons in %s', (locale) => {
    const onSendPreset = jest.fn();
    render(<PickupBoard state={LIVE} locale={locale} onSendPreset={onSendPreset} />);
    const board = screen.getByTestId('pickup-board');
    expect(board).toHaveTextContent('2');
    expect(screen.getByTestId('pickup-eta')).toHaveTextContent('12');
    const buttons = board.querySelectorAll('button');
    expect(buttons).toHaveLength(2); // arrived + running_late presets
    fireEvent.click(buttons[0]);
    expect(onSendPreset).toHaveBeenCalledWith(expect.objectContaining({ key: 'arrived' }));
  });

  it('static mode shows the scheduled time instead of an ETA', () => {
    render(
      <PickupBoard state={{ ...LIVE, mode: 'static', etaMinutes: null, distanceM: null }} locale="en" onSendPreset={jest.fn()} />,
    );
    expect(screen.queryByTestId('pickup-eta')).not.toBeInTheDocument();
    expect(screen.getByTestId('pickup-board')).toHaveTextContent('08:50');
  });

  it('renders nothing when hidden', () => {
    render(
      <PickupBoard
        state={{ visible: false, mode: 'static', rank: null, totalStops: 0, myStop: null, etaMinutes: null, distanceM: null }}
        locale="en"
        onSendPreset={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('pickup-board')).not.toBeInTheDocument();
  });
});
