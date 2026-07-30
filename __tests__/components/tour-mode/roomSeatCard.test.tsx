/**
 * The in-room seat door.
 *
 * 🔴 The picker has always worked. The only way to reach it was an ops-issued
 * claim link, and the live DB says that link has been minted zero times —
 * `tour_room_invites` holds no `room_claim` row and `ops_seat_assignments` is
 * empty. This card is the door; these tests pin the four states it must tell
 * the truth about, and that it never offers a button the server will refuse.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RoomSeatCard from '@/components/tour-mode/seat/RoomSeatCard';
import { PERSONAL_TOKENS_KEY } from '@/lib/ops/seating/personalTokens';

const BOOKING = 'booking-1';
const SESSION = 'signed-room-session';

interface SeatPayload {
  state: 'assigned' | 'pending' | 'none';
  seat_number?: number | null;
  plate_number?: string | null;
  can_pick?: boolean;
  room_id?: string | null;
  party_size?: number;
}

function mockMySeat(payload: SeatPayload) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/my-seat')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          seat_number: null,
          plate_number: null,
          can_pick: false,
          room_id: 'room-1',
          party_size: 2,
          ...payload,
        }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ vehicles: [] }) } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** A token whose payload decodes to this booking (signature is the server's job). */
function personalToken(bookingId: string): string {
  const body = Buffer.from(
    JSON.stringify({ scope: 'booking', bookingId, displayName: 'Alex', exp: 4102444800 }),
  ).toString('base64url');
  return `${body}.sig`;
}

function renderCard(props: Partial<Parameters<typeof RoomSeatCard>[0]> = {}) {
  return render(
    <RoomSeatCard
      bookingId={BOOKING}
      roomSession={SESSION}
      locale="en"
      guestName="Alex"
      {...props}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('RoomSeatCard', () => {
  it('renders nothing when the tour has no seating at all', async () => {
    mockMySeat({ state: 'none' });
    renderCard({ authToken: personalToken(BOOKING) });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('room-seat-card')).not.toBeInTheDocument();
  });

  it('shows the assigned seat and the plate to find the vehicle', async () => {
    mockMySeat({ state: 'assigned', seat_number: 12, plate_number: '12가 3456' });
    renderCard({ authToken: personalToken(BOOKING) });
    const card = await screen.findByTestId('room-seat-card');
    expect(card).toHaveTextContent('Seat 12');
    expect(card).toHaveTextContent('12가 3456');
  });

  it('offers the picker when the server says seats are open', async () => {
    mockMySeat({ state: 'pending', can_pick: true });
    renderCard({ authToken: personalToken(BOOKING) });
    const card = await screen.findByTestId('room-seat-card');
    expect(card.tagName).toBe('BUTTON');
    fireEvent.click(card);
    await screen.findByTestId('room-seat-sheet');
  });

  it('waits, rather than offering a button the server would refuse', async () => {
    // can_pick:false is the tour-day lock (C-11) and the not-yet-assigned
    // vehicle. Either way the card informs; it does not invite a 400.
    mockMySeat({ state: 'pending', can_pick: false });
    renderCard({ authToken: personalToken(BOOKING) });
    const card = await screen.findByTestId('room-seat-card');
    expect(card.tagName).not.toBe('BUTTON');
    expect(card).toHaveTextContent(/vehicle is assigned/i);
  });

  it('recovers the personal token from the cache when ?rt= is long gone', async () => {
    // The seats API takes a booking-scope token, NOT the room session. A guest
    // who relaunched the PWA has no ?rt= in memory — without the cache lookup
    // the door would be permanently shut for them.
    window.localStorage.setItem(PERSONAL_TOKENS_KEY, JSON.stringify([personalToken(BOOKING)]));
    mockMySeat({ state: 'pending', can_pick: true });
    renderCard();
    const card = await screen.findByTestId('room-seat-card');
    expect(card.tagName).toBe('BUTTON');
  });

  it('does not offer picking with no usable token', async () => {
    mockMySeat({ state: 'pending', can_pick: true });
    renderCard();
    const card = await screen.findByTestId('room-seat-card');
    expect(card.tagName).not.toBe('BUTTON');
  });

  it('ignores a cached token belonging to a different booking', async () => {
    window.localStorage.setItem(PERSONAL_TOKENS_KEY, JSON.stringify([personalToken('someone-else')]));
    mockMySeat({ state: 'pending', can_pick: true });
    renderCard();
    const card = await screen.findByTestId('room-seat-card');
    expect(card.tagName).not.toBe('BUTTON');
  });
});
