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
import { resolveReviewPolicy, type RoomReviewPolicy } from '@/lib/tour-room/reviewPolicy';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { VehicleLocationLike } from '@/lib/tour-room/vehicleEta';

const DIRECT_POLICY = resolveReviewPolicy({ source: 'tour_product', tourSlug: 'busan-signature' });

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
  isPrivate = true,
  locations,
  reviewPolicy = DIRECT_POLICY,
}: {
  lifecycle: 'lobby' | 'live' | 'ended';
  withHome?: boolean;
  canSignal?: boolean;
  showConcierge?: boolean;
  schedule?: Array<Record<string, unknown>>;
  isPrivate?: boolean;
  locations?: Record<string, VehicleLocationLike>;
  reviewPolicy?: RoomReviewPolicy;
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
                reviewPolicy={reviewPolicy}
                canSignal={canSignal}
                showConcierge={showConcierge}
                isPrivate={isPrivate}
                locations={locations}
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
  it('lobby (private): LobbyCard status + plan tile link, no signal tile', () => {
    renderRoom({ lifecycle: 'lobby', canSignal: false, isPrivate: true });
    expect(screen.getByTestId('lobby-card')).toBeInTheDocument();
    expect(screen.getByTestId('home-tile-plan')).toHaveAttribute('href', '/tour-mode/plan/bk-1');
    expect(screen.queryByTestId('home-tile-signal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-tile-review')).not.toBeInTheDocument();
  });

  it('lobby (join): D2 hides the plan tile for a shared/join tour', () => {
    renderRoom({ lifecycle: 'lobby', canSignal: false, isPrivate: false });
    expect(screen.getByTestId('lobby-card')).toBeInTheDocument();
    expect(screen.queryByTestId('home-tile-plan')).not.toBeInTheDocument();
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

  // §11.C C1 — the vehicle card is wired into the home dashboard and hands
  // off to the map tab; it stays silent when nobody in the van is sharing.
  describe('vehicle location card', () => {
    const driver: Record<string, VehicleLocationLike> = {
      'p-driver': {
        participant_id: 'p-driver',
        role: 'driver',
        latitude: 33.458,
        longitude: 126.9425,
        recorded_at: new Date().toISOString(),
      },
    };

    beforeEach(() => {
      global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as never;
    });
    afterEach(() => {
      // @ts-expect-error — ad-hoc fetch mock.
      delete global.fetch;
    });

    it('mounts while live and opens the map tab', () => {
      renderRoom({ lifecycle: 'live', locations: driver });
      fireEvent.click(screen.getByTestId('vehicle-see-map'));
      expect(screen.getByRole('tab', { name: '지도' })).toHaveAttribute('aria-selected', 'true');
    });

    it('absent without a shared vehicle position, and after the tour ends', () => {
      renderRoom({ lifecycle: 'live' });
      expect(screen.queryByTestId('vehicle-location-card')).not.toBeInTheDocument();

      renderRoom({ lifecycle: 'ended', canSignal: false, showConcierge: false, locations: driver });
      expect(screen.queryByTestId('vehicle-location-card')).not.toBeInTheDocument();
    });
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

/**
 * I2 / U-D25 — the promise that makes the restructure safe.
 *
 * The first screen lost the tile grid. That is only acceptable if the grid is
 * still THERE, one tap away, complete. A guest who learned a tile has not lost
 * it; they have to press one more thing.
 *
 * 🔴 These assertions use toBeVisible(), not toBeInTheDocument(). The panel is
 * hidden with the `hidden` attribute, so every tile is still in the DOM while
 * collapsed — a presence check would pass whether the disclosure worked or not,
 * and would keep passing if someone later made it permanently invisible. This
 * codebase has been bitten by exactly that shape of green.
 */
describe('I2 — 더 보기 holds the whole grid (U-D25)', () => {
  const ALWAYS_PRESENT = ['home-tile-chat', 'home-tile-schedule', 'home-tile-map', 'home-tile-pickup', 'home-tile-sos'];

  it('the first screen is quieter: no grid until asked', () => {
    renderRoom({ lifecycle: 'live' });
    for (const id of ALWAYS_PRESENT) {
      expect(screen.getByTestId(id)).not.toBeVisible();
    }
    expect(screen.getByTestId('home-more')).toBeVisible();
    expect(screen.getByTestId('home-more')).toHaveAttribute('aria-expanded', 'false');
  });

  it('🔴 one tap and every destination is back, including the ones the tab bar duplicates', () => {
    renderRoom({ lifecycle: 'live' });
    fireEvent.click(screen.getByTestId('home-more'));

    for (const id of [...ALWAYS_PRESENT, 'home-tile-smart-guide', 'home-tile-signal']) {
      expect(screen.getByTestId(id)).toBeVisible();
    }
    expect(screen.getByTestId('home-more')).toHaveAttribute('aria-expanded', 'true');
  });

  it('settings and review moved into the same panel rather than a second one', () => {
    // Two overflow containers for one screen is one too many; the old sheet is
    // gone, so its rows have to be findable here or they are simply missing.
    renderRoom({ lifecycle: 'ended' });
    fireEvent.click(screen.getByTestId('home-more'));
    expect(screen.getByTestId('home-more-review')).toBeVisible();
    fireEvent.click(screen.getByText('설정 · 언어'));
    expect(screen.getByText('settings-content')).toBeInTheDocument();
  });

  it('collapses again, so the choice is reversible', () => {
    renderRoom({ lifecycle: 'live' });
    fireEvent.click(screen.getByTestId('home-more'));
    expect(screen.getByTestId('home-tile-map')).toBeVisible();
    fireEvent.click(screen.getByTestId('home-more'));
    expect(screen.getByTestId('home-tile-map')).not.toBeVisible();
  });
});

describe('I2 — the now card is the hero', () => {
  // The resolver only claims the hero when it HAS an answer. With no schedule
  // and no events there is nothing to say, and the old now/next strip stays —
  // which is the honest outcome, not a bug.
  it('renders the resolver state as a data attribute, so a walk can read it', () => {
    const schedule = [
      { time: '00:00', title: 'Gamcheon Village' },
      { time: '23:59', title: 'Night market' },
    ];
    renderRoom({ lifecycle: 'live', schedule });
    const hero = screen.getByTestId('home-status-live');
    expect(hero).toHaveAttribute('data-now-state');
    expect(hero).toBeVisible();
  });

  it('🔴 keeps the vehicle line, which used to live inside the card it replaced', () => {
    const schedule = [
      { time: '00:00', title: 'Gamcheon Village' },
      { time: '23:59', title: 'Night market' },
    ];
    renderRoom({ lifecycle: 'live', schedule });
    expect(screen.getByTestId('home-vehicle')).toBeVisible();
  });

  it('offers exactly one primary action', () => {
    const schedule = [
      { time: '00:00', title: 'Gamcheon Village' },
      { time: '23:59', title: 'Night market' },
    ];
    renderRoom({ lifecycle: 'live', schedule });
    expect(screen.getAllByTestId('home-now-action')).toHaveLength(1);
  });
});
