/**
 * H1/H2 — home dashboard: the shell gains a 5th Home tab and lands on it
 * (customers), the launcher grid re-entrances existing surfaces per
 * lifecycle, and the chat preview mirrors the latest bubble. Guides (no
 * `home` prop) keep the classic chat-first 4-tab shell.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import RoomShell from '@/components/tour-mode/RoomShell';
import HomeTab from '@/components/tour-mode/HomeTab';
import { kstToday } from '@/lib/tour-room/time';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const messages: RoomMessage[] = [
  {
    id: 'm1',
    sender_role: 'guide',
    source_text: 'Good morning!',
    created_at: '2026-07-14T00:00:00Z',
    translations: { ko: '좋은 아침이에요!' },
  } as RoomMessage,
];

function renderRoom({
  lifecycle,
  withHome = true,
  canSignal = lifecycle === 'live',
  showConcierge = lifecycle !== 'ended',
  schedule = [] as Array<Record<string, unknown>>,
}: {
  lifecycle: 'lobby' | 'live' | 'ended';
  withHome?: boolean;
  canSignal?: boolean;
  showConcierge?: boolean;
  schedule?: Array<Record<string, unknown>>;
}) {
  return render(
    <RoomShell
      title="Busan Signature"
      lifecycle={lifecycle}
      connection="realtime"
      locale="ko"
      schedule={schedule}
      chat={<div>chat-content</div>}
      settings={<div>settings-content</div>}
      concierge={showConcierge ? <div>concierge-content</div> : undefined}
      home={
        withHome
          ? (api) => (
              <HomeTab
                api={api}
                locale="ko"
                lifecycle={lifecycle}
                bookingId="bk-1"
                roomSession="sess-1"
                messages={messages}
                schedule={schedule}
                tourDate={kstToday()}
                tourTime="09:00:00"
                pickupPoints={{ name: 'Seomyeon Stn Exit 2' }}
                busPayload={{ vehicle_number: '48버 1234' }}
                tourSlug="busan-signature"
                canSignal={canSignal}
                showConcierge={showConcierge}
              />
            )
          : undefined
      }
    />,
  );
}

describe('RoomShell home tab (H1)', () => {
  it('lands on Home with 5 tabs when the home prop is present', () => {
    renderRoom({ lifecycle: 'live' });
    expect(screen.getByTestId('home-panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '홈' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.queryByText('chat-content')).not.toBeInTheDocument();
  });

  it('keeps the chat-first 4-tab shell without a home prop (guides)', () => {
    renderRoom({ lifecycle: 'live', withHome: false });
    expect(screen.queryByRole('tab', { name: '홈' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByText('chat-content')).toBeInTheDocument();
  });

  it('grid tiles switch shell tabs (chat, map) and open shell sheets (SOS, Smart Guide)', () => {
    renderRoom({ lifecycle: 'live' });

    fireEvent.click(screen.getByTestId('home-tile-sos'));
    expect(screen.getByTestId('room-sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('room-sheet-close'));

    fireEvent.click(screen.getByTestId('home-tile-smart-guide'));
    expect(screen.getByText('concierge-content')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('home-tile-chat'));
    expect(screen.getByText('chat-content')).toBeInTheDocument();
  });

  it('chat preview shows the latest bubble in the viewer locale and jumps to chat', () => {
    renderRoom({ lifecycle: 'live' });
    expect(screen.getByTestId('home-chat-preview')).toHaveTextContent('좋은 아침이에요!');
    fireEvent.click(screen.getByTestId('home-chat-preview'));
    expect(screen.getByText('chat-content')).toBeInTheDocument();
  });
});

describe('HomeTab lifecycle variants (H2)', () => {
  it('lobby: LobbyCard status + plan tile link, no signal tile', () => {
    renderRoom({ lifecycle: 'lobby', canSignal: false });
    expect(screen.getByTestId('lobby-card')).toBeInTheDocument();
    expect(screen.getByTestId('home-tile-plan')).toHaveAttribute('href', '/tour-mode/plan/bk-1');
    expect(screen.queryByTestId('home-tile-signal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-tile-review')).not.toBeInTheDocument();
  });

  it('live: now/next status from the KST schedule + vehicle line', () => {
    renderRoom({
      lifecycle: 'live',
      schedule: [
        { time: '00:00', title: 'Gamcheon Village' },
        { time: '23:59', title: 'Night market' },
      ],
    });
    const status = screen.getByTestId('home-status-live');
    expect(status).toHaveTextContent('Gamcheon Village');
    expect(status).toHaveTextContent('Night market');
    expect(screen.getByTestId('home-vehicle')).toHaveTextContent('48버 1234');
  });

  it('live: signal tile opens the quick-signal sheet', () => {
    renderRoom({ lifecycle: 'live' });
    fireEvent.click(screen.getByTestId('home-tile-signal'));
    expect(screen.getByTestId('quick-signal-bar')).toBeInTheDocument();
    expect(screen.getByTestId('signal-running_late')).toBeInTheDocument();
  });

  it('ended: recap status, timeline + review tiles, no signal/plan/smart-guide', () => {
    renderRoom({ lifecycle: 'ended', canSignal: false, showConcierge: false });
    expect(screen.getByTestId('home-status-ended')).toBeInTheDocument();
    expect(screen.getByTestId('home-tile-review')).toHaveAttribute(
      'href',
      '/tour-product/busan-signature#reviews',
    );
    expect(screen.queryByTestId('home-tile-signal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-tile-plan')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-tile-smart-guide')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('home-tile-timeline'));
    expect(screen.getByTestId('timeline-panel')).toBeInTheDocument();
  });

  it('pickup tile opens the meeting-point sheet, more row reaches settings', () => {
    renderRoom({ lifecycle: 'live' });
    fireEvent.click(screen.getByTestId('home-tile-pickup'));
    expect(screen.getByText('Seomyeon Stn Exit 2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('room-sheet-close'));

    fireEvent.click(screen.getByTestId('home-more'));
    fireEvent.click(screen.getByText('설정 · 언어'));
    expect(screen.getByText('settings-content')).toBeInTheDocument();
  });
});
