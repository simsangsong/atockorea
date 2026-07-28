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
 * I7 / U-D25 — the promise that makes the restructure safe.
 *
 * The shape changed on 2026-07-29. I6 collapsed the grid entirely; the owner's
 * answer was that a guest reads "collapsed" as "there is nothing here", so the
 * grid now shows three tiles with the next row peeking its icon heads. What
 * did NOT change is the promise underneath: a guest who learned a tile has not
 * lost it. Everything is still there, one tap away, complete — including the
 * three the tab bar duplicates.
 *
 * 🔴 What these assertions can and cannot see. jsdom has no layout, so the peek
 * clip — a max-height and a mask — is invisible to it, and `toBeVisible()` on a
 * clipped tile would pass no matter what. So the contract is checked where it
 * is actually expressible:
 *
 *   the extras panel   `hidden` attribute      → toBeVisible() means something
 *   the peek strip     the class that clips it → asserted by name
 *   which three        the pure resolver       → homeTileOrder.test.ts
 *
 * The rendered result of the clip is proven by a Playwright walk, not here.
 * Asserting toBeVisible() on a peeked tile would be the shape of green this
 * codebase has been bitten by before: true, and about nothing.
 */
describe('I7 — the grid peeks, and 더 보기 holds all of it (U-D25)', () => {
  const ALWAYS_PRESENT = ['home-tile-chat', 'home-tile-schedule', 'home-tile-map', 'home-tile-pickup', 'home-tile-sos'];

  it('shows three tiles without being asked, and none of them is a tab twin (U-D24)', () => {
    renderRoom({ lifecycle: 'live' });
    const open = screen.getByTestId('home-grid').firstElementChild!;
    const peeked = [...open.children].map((el) => el.getAttribute('data-testid'));

    expect(peeked).toHaveLength(3);
    for (const twin of ['home-tile-chat', 'home-tile-schedule', 'home-tile-map']) {
      expect(peeked).not.toContain(twin);
    }
    expect(screen.getByTestId('home-more')).toHaveAttribute('aria-expanded', 'false');
  });

  it('clips the next row while shut, and stops clipping it when open', () => {
    renderRoom({ lifecycle: 'live' });
    const rest = screen.getByTestId('home-grid-rest');
    expect(rest.className).toContain('tr-home-grid-peek');

    fireEvent.click(screen.getByTestId('home-more'));
    expect(rest.className).not.toContain('tr-home-grid-peek');
  });

  it('keeps the extras behind the disclosure', () => {
    // Install, settings and review are rows rather than tiles; they are not
    // part of the peek and stay in the `hidden` panel, where toBeVisible() is
    // a real question.
    renderRoom({ lifecycle: 'ended' });
    expect(screen.getByTestId('home-more-review')).not.toBeVisible();
    fireEvent.click(screen.getByTestId('home-more'));
    expect(screen.getByTestId('home-more-review')).toBeVisible();
  });

  it('🔴 every destination survives, including the ones the tab bar duplicates', () => {
    renderRoom({ lifecycle: 'live' });
    fireEvent.click(screen.getByTestId('home-more'));

    for (const id of [...ALWAYS_PRESENT, 'home-tile-smart-guide', 'home-tile-signal']) {
      expect(screen.getByTestId(id)).toBeVisible();
    }
    expect(screen.getByTestId('home-more')).toHaveAttribute('aria-expanded', 'true');
  });

  it('settings and review moved into the same panel rather than a second one', () => {
    renderRoom({ lifecycle: 'ended' });
    fireEvent.click(screen.getByTestId('home-more'));
    expect(screen.getByTestId('home-more-review')).toBeVisible();
    fireEvent.click(screen.getByText('설정 · 언어'));
    expect(screen.getByText('settings-content')).toBeInTheDocument();
  });

  it('collapses again, so the choice is reversible', () => {
    renderRoom({ lifecycle: 'live' });
    fireEvent.click(screen.getByTestId('home-more'));
    expect(screen.getByTestId('home-grid-rest').className).not.toContain('tr-home-grid-peek');
    fireEvent.click(screen.getByTestId('home-more'));
    expect(screen.getByTestId('home-grid-rest').className).toContain('tr-home-grid-peek');
  });

  it('opens itself if focus reaches a clipped tile', () => {
    // A keyboard or switch user must never be left operating a control they can
    // only half see. This is why the peek strip is not aria-hidden and not
    // inert: it stays reachable, and reaching it reveals it.
    renderRoom({ lifecycle: 'live' });
    expect(screen.getByTestId('home-more')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(screen.getByTestId('home-tile-map'), { bubbles: true });
    expect(screen.getByTestId('home-more')).toHaveAttribute('aria-expanded', 'true');
  });

  it('the app manual is out of the overflow, on the first screen', () => {
    // 사장님 결정: a guest who does not know what the app is will not go looking
    // behind a "more" button to find out.
    renderRoom({ lifecycle: 'live', manualKind: 'private' });
    const slot = screen.queryByTestId('home-manual-slot');
    expect(slot).not.toBeNull();
    expect(slot!.closest('[data-testid="home-more-sheet"]')).toBeNull();
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
