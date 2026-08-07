/**
 * H1/H2 — home dashboard: the shell gains a 5th Home tab and lands on it
 * (customers), the launcher grid re-entrances existing surfaces per
 * lifecycle, and the chat preview mirrors the latest bubble. Guides (no
 * `home` prop) keep the classic chat-first 4-tab shell.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import RoomShell from '@/components/tour-mode/RoomShell';
import HomeTab from '@/components/tour-mode/HomeTab';
import { kstToday } from '@/lib/tour-room/time';
import { resolveReviewPolicy, type RoomReviewPolicy } from '@/lib/tour-room/reviewPolicy';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { VehicleLocationLike } from '@/lib/tour-room/vehicleEta';

const DIRECT_POLICY = resolveReviewPolicy({ source: 'tour_product', tourSlug: 'busan-signature' });

/**
 * The home tab asks the server about this booking's seat on mount (the seat
 * door), and jsdom has no fetch. Answering "no seating on this tour" keeps
 * these cases about what they were always about — the launcher grid and the
 * lifecycle cards — while the seat card has its own suite.
 */
beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ state: 'none', seat_number: null, can_pick: false, room_id: null, party_size: 1 }),
  })) as unknown as typeof fetch;
});

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
  manualKind,
}: {
  lifecycle: 'lobby' | 'live' | 'ended';
  withHome?: boolean;
  canSignal?: boolean;
  showConcierge?: boolean;
  schedule?: Array<Record<string, unknown>>;
  isPrivate?: boolean;
  locations?: Record<string, VehicleLocationLike>;
  reviewPolicy?: RoomReviewPolicy;
  manualKind?: 'private' | 'join';
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
                manualKind={manualKind}
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

  it('pickup tile opens the meeting-point sheet, settings row reaches settings', () => {
    renderRoom({ lifecycle: 'live' });
    fireEvent.click(screen.getByTestId('home-tile-pickup'));
    expect(screen.getByText('Seomyeon Stn Exit 2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('room-sheet-close'));

    fireEvent.click(screen.getByText('설정 · 언어'));
    expect(screen.getByText('settings-content')).toBeInTheDocument();
  });
});

/**
 * I7v4 / U-D25 — nothing folds, so nothing can be taken away.
 *
 * The shape changed four times. I6 collapsed the grid entirely behind a quiet
 * text pill; the owner's 07-29 answer was the peek strip (icon heads showing),
 * because a guest read that pill's "collapsed" as "there is nothing here". On
 * 2026-07-31 the door became a card-weight long row, and round 2 that same day
 * folded EVERY tile behind it.
 *
 * 2026-08-07 ends the sequence. 사장님, from the room on their own phone:
 * "다른 화면 선택하기만 하면 대시보드 자체가 사라져 버려 … 각 기능들 버튼들
 * 전부 다 사라지는거잖아? … 다시 대시보드가 항시 보이도록 해줘." The fold was
 * worse than a fold: `HomeTab` unmounts on every tab switch (RoomShell renders
 * it only while `tab === 'home'`), so `moreOpen` reset to false on every
 * return. Opening the grid never stuck. That is the case pinned first below —
 * it is the one that was actually reported, and it is invisible to any test
 * that renders the home tab once and never leaves it.
 *
 * The promise underneath never changed: a guest who learned a tile has not
 * lost it. It is just no longer conditional on finding a door.
 */
describe('I7v4 — the dashboard is always on screen (U-D25)', () => {
  const ALWAYS_PRESENT = ['home-tile-chat', 'home-tile-schedule', 'home-tile-map', 'home-tile-pickup', 'home-tile-sos'];

  it('🔴 survives a round trip through another tab — the reported defect', () => {
    // The fold could not be kept open across tabs, so this is the regression
    // that matters: leave home, come back, and every tile is still there.
    renderRoom({ lifecycle: 'live' });
    expect(screen.getByTestId('home-tile-sos')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: '채팅' }));
    expect(screen.queryByTestId('home-tab')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '홈' }));
    for (const id of [...ALWAYS_PRESENT, 'home-tile-smart-guide', 'home-tile-signal']) {
      expect(screen.getByTestId(id)).toBeVisible();
    }
  });

  it('at rest, every tile is visible — no door to open first', () => {
    renderRoom({ lifecycle: 'live' });
    expect(screen.queryByTestId('home-more')).not.toBeInTheDocument();
    for (const id of [...ALWAYS_PRESENT, 'home-tile-smart-guide', 'home-tile-signal']) {
      expect(screen.getByTestId(id)).toBeVisible();
    }
  });

  it('🔴 the grid really lays out, rather than only lacking [hidden]', () => {
    // The fold's own bug, inverted into a guard: `hidden` (UA-level display
    // none) and the `grid` utility (an author declaration) disagree, and the
    // author declaration wins — which is how folded tiles once rendered in a
    // real browser while jsdom's toBeVisible() stayed green. So assert the
    // display class by token, not by substring: `grid-cols-3` contains "grid".
    renderRoom({ lifecycle: 'live' });
    const grid = screen.getByTestId('home-grid-tiles');
    const tokens = grid.className.split(/\s+/);
    expect(tokens).toContain('grid');
    expect(tokens).not.toContain('hidden');
    expect(grid).not.toHaveAttribute('hidden');
  });

  it('keeps the extras on screen too — install, settings, review', () => {
    // These rode inside the same fold, so they vanished with it.
    renderRoom({ lifecycle: 'ended' });
    expect(screen.getByTestId('home-more-review')).toBeVisible();
    expect(screen.getByTestId('home-more-sheet')).not.toHaveAttribute('hidden');
  });

  it('settings and review live in one panel rather than a second overflow', () => {
    renderRoom({ lifecycle: 'ended' });
    expect(screen.getByTestId('home-more-review')).toBeVisible();
    fireEvent.click(screen.getByText('설정 · 언어'));
    expect(screen.getByText('settings-content')).toBeInTheDocument();
  });

  it('the app manual is on the first screen', () => {
    // 사장님 결정: a guest who does not know what the app is will not go looking
    // behind a "more" button to find out.
    renderRoom({ lifecycle: 'live', manualKind: 'private' });
    expect(screen.queryByTestId('home-manual-slot')).not.toBeNull();
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

describe('I3 — the state change is the feedback (U-D26)', () => {
  it('the hero carries the swap animation and announces itself', () => {
    const schedule = [
      { time: '00:00', title: 'Gamcheon Village' },
      { time: '23:59', title: 'Night market' },
    ];
    renderRoom({ lifecycle: 'live', schedule });
    const hero = screen.getByTestId('home-status-live');
    expect(hero.className).toContain('tr-now-swap');
    // Polite for an ordinary change; assertive is reserved for the card that
    // says the group is already waiting.
    expect(hero).toHaveAttribute('aria-live', 'polite');
    expect(hero).toHaveAttribute('aria-atomic', 'true');
  });

  it('🔴 reduced motion turns the animation off rather than shortening it', () => {
    // Asserted against the shipped CSS, because a rule that only exists in a
    // component comment is a rule nobody enforces.
    const css = readFileSync(join(process.cwd(), 'app', 'tour-room-theme.css'), 'utf8');
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('.tr-now-swap');
  });
});
