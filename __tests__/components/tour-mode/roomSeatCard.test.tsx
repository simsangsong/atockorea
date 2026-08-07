/**
 * The in-room seat door — the card, and the read that feeds it.
 *
 * 🔴 The picker has always worked. The only way to reach it was an ops-issued
 * claim link, and the live DB says that link has been minted zero times —
 * `tour_room_invites` holds no `room_claim` row and `ops_seat_assignments` is
 * empty. This card is the door; these tests pin the states it must tell the
 * truth about, and that it never offers a button the server will refuse.
 *
 * 🔴 2026-08-07 — the read moved into `useMySeat` so the home tile can open the
 * same sheet. The card is presentational now, so the two halves are tested
 * where they live: rendering here, token recovery + `pickable` in the hook
 * block below. Those cache cases are the reason a guest who relaunched the PWA
 * still has a door at all, so they must not be lost in the move.
 */
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import RoomSeatCard from '@/components/tour-mode/seat/RoomSeatCard';
import { useMySeat, type MySeat } from '@/hooks/useMySeat';
import { PERSONAL_TOKENS_KEY } from '@/lib/ops/seating/personalTokens';

const BOOKING = 'booking-1';
const SESSION = 'signed-room-session';

function seat(payload: Partial<MySeat> & Pick<MySeat, 'state'>): MySeat {
  return {
    seat_number: null,
    plate_number: null,
    can_pick: false,
    room_id: 'room-1',
    party_size: 2,
    ...payload,
  };
}

function mockMySeat(payload: Partial<MySeat> & Pick<MySeat, 'state'>) {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => seat(payload),
  })) as unknown as typeof fetch;
  global.fetch = fetchMock;
  return fetchMock;
}

/** A token whose payload decodes to this booking (signature is the server's job). */
function personalToken(bookingId: string): string {
  const body = Buffer.from(
    JSON.stringify({ scope: 'booking', bookingId, displayName: 'Alex', exp: 4102444800 }),
  ).toString('base64url');
  return `${body}.sig`;
}

const noop = () => undefined;

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('RoomSeatCard', () => {
  it('renders nothing when the tour has no seating at all (private charter)', () => {
    render(<RoomSeatCard seat={seat({ state: 'none' })} locale="en" pickable={false} onOpen={noop} />);
    expect(screen.queryByTestId('room-seat-card')).not.toBeInTheDocument();
  });

  it('renders nothing before the first answer lands, rather than guessing', () => {
    render(<RoomSeatCard seat={null} locale="en" pickable={false} onOpen={noop} />);
    expect(screen.queryByTestId('room-seat-card')).not.toBeInTheDocument();
  });

  it('shows the assigned seat and the plate to find the vehicle', () => {
    render(
      <RoomSeatCard
        seat={seat({ state: 'assigned', seat_number: 12, plate_number: '12가 3456' })}
        locale="en"
        pickable
        onOpen={noop}
      />,
    );
    const card = screen.getByTestId('room-seat-card');
    expect(card).toHaveTextContent('Seat 12');
    expect(card).toHaveTextContent('12가 3456');
  });

  it('offers the picker when the server says seats are open', () => {
    const onOpen = jest.fn();
    render(<RoomSeatCard seat={seat({ state: 'pending', can_pick: true })} locale="en" pickable onOpen={onOpen} />);
    const card = screen.getByTestId('room-seat-card');
    expect(card.tagName).toBe('BUTTON');
    card.click();
    expect(onOpen).toHaveBeenCalled();
  });

  /**
   * 🔴 The state that never rendered. The server used to answer `none` for a
   * tour that simply had no vehicle yet, and the card returned null on `none` —
   * so with live dispatch at zero, EVERY guest saw no seat door at all. This is
   * the regression that hid the whole feature.
   */
  it('keeps the door visible, closed, while dispatch has not happened yet', () => {
    render(<RoomSeatCard seat={seat({ state: 'awaiting' })} locale="en" pickable={false} onOpen={noop} />);
    const card = screen.getByTestId('room-seat-card');
    expect(card).toHaveAttribute('data-seat-state', 'awaiting');
    expect(card).toHaveTextContent(/vehicle is assigned/i);
  });

  /**
   * A dispatched bus with no seat of mine is NOT "waiting for a vehicle" — the
   * vehicle is right there. Saying `seatSoon` here was a lie the old card told.
   */
  it('says the guide will seat me when the bus exists but I may not pick', () => {
    render(<RoomSeatCard seat={seat({ state: 'pending' })} locale="en" pickable={false} onOpen={noop} />);
    const card = screen.getByTestId('room-seat-card');
    expect(card.tagName).not.toBe('BUTTON');
    expect(card).toHaveTextContent(/guide will seat you/i);
    expect(card).not.toHaveTextContent(/vehicle is assigned/i);
  });

  /** Mid-tour the seat is locked but still a question the guest asks. */
  it('stays tappable for an assigned seat that can no longer be changed', () => {
    const onOpen = jest.fn();
    render(
      <RoomSeatCard
        seat={seat({ state: 'assigned', seat_number: 4 })}
        locale="en"
        pickable={false}
        onOpen={onOpen}
      />,
    );
    const card = screen.getByTestId('room-seat-card');
    expect(card.tagName).toBe('BUTTON');
    card.click();
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('useMySeat', () => {
  const renderSeatHook = (authToken?: string | null) =>
    renderHook(() => useMySeat({ bookingId: BOOKING, roomSession: SESSION, authToken }));

  it('recovers the personal token from the cache when ?rt= is long gone', async () => {
    // The seats API takes a booking-scope token, NOT the room session. A guest
    // who relaunched the PWA has no ?rt= in memory — without the cache lookup
    // the door would be permanently shut for them.
    window.localStorage.setItem(PERSONAL_TOKENS_KEY, JSON.stringify([personalToken(BOOKING)]));
    mockMySeat({ state: 'pending', can_pick: true });
    const { result } = renderSeatHook();
    await waitFor(() => expect(result.current.seat).not.toBeNull());
    expect(result.current.pickable).toBe(true);
  });

  it('does not call a seat pickable with no usable token', async () => {
    mockMySeat({ state: 'pending', can_pick: true });
    const { result } = renderSeatHook();
    await waitFor(() => expect(result.current.seat).not.toBeNull());
    expect(result.current.pickable).toBe(false);
  });

  it('ignores a cached token belonging to a different booking', async () => {
    window.localStorage.setItem(PERSONAL_TOKENS_KEY, JSON.stringify([personalToken('someone-else')]));
    mockMySeat({ state: 'pending', can_pick: true });
    const { result } = renderSeatHook();
    await waitFor(() => expect(result.current.seat).not.toBeNull());
    expect(result.current.pickable).toBe(false);
  });

  it('never claims pickable when the server refused, token or not', async () => {
    mockMySeat({ state: 'pending', can_pick: false });
    const { result } = renderSeatHook(personalToken(BOOKING));
    await waitFor(() => expect(result.current.seat).not.toBeNull());
    expect(result.current.pickable).toBe(false);
  });

  /** `hasSeating` is what decides the home tile exists at all. */
  it('reports no seating for a private charter, and seating while awaiting dispatch', async () => {
    mockMySeat({ state: 'none' });
    const priv = renderSeatHook();
    await waitFor(() => expect(priv.result.current.seat).not.toBeNull());
    expect(priv.result.current.hasSeating).toBe(false);

    mockMySeat({ state: 'awaiting' });
    const join = renderSeatHook();
    await waitFor(() => expect(join.result.current.seat).not.toBeNull());
    expect(join.result.current.hasSeating).toBe(true);
  });
});
