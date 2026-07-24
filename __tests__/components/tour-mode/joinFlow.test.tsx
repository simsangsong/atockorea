/**
 * 게스트 claim→좌석→확정 플로우 + 좌석 Realtime 잠금 — AtoC 플랜 §5.2/§5.3.
 * 네트워크 0 (fetch mock). channelTopic=null 이라 useSeatChannel은 no-op.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import JoinFlow from '@/components/tour-mode/join/JoinFlow';
import { VEHICLE_LAYOUT_SEEDS } from '@/lib/ops/seating/layouts';

const VEHICLE = {
  roomVehicleId: 'v1',
  model: 'bus_45',
  plateNumber: null,
  totalSeats: 45,
  layout: VEHICLE_LAYOUT_SEEDS.bus_45.layout,
  // seat 5 already taken by someone else (§5.3 C-10 — 타인 선택 비활성)
  seatStates: { 5: 'taken' } as Record<number, string>,
  seats: [
    { seatNumber: 5, bookingId: 'other', guestLabel: null, checkedInAt: null, absentAt: null, locked: false },
  ],
};

function mockFetch() {
  const reply = (body: unknown, status = 200) =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
  return jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.includes('/claim') && method === 'GET') {
      return reply({
        roomId: 'room1',
        tourDate: '2026-08-17',
        bookings: [
          { bookingId: 'b1', name: 'Massimo C.', partySize: 2, claimed: false },
          { bookingId: 'b2', name: 'Sofia R.', partySize: 1, claimed: true },
        ],
      });
    }
    if (url.includes('/claim') && method === 'POST') {
      return reply({ token: 'BODY.sig', bookingId: 'b1', partySize: 2, displayName: 'Massimo C.' }, 201);
    }
    if (url.includes('/join') && method === 'POST') return reply({ channel: null });
    if (url.endsWith('/seats') && method === 'GET') return reply({ vehicles: [VEHICLE] });
    if (url.endsWith('/seats') && method === 'POST') return reply({ vehicles: [VEHICLE] }, 201);
    return reply({}, 404);
  });
}

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = mockFetch() as unknown as typeof fetch;
});

describe('JoinFlow — claim → seat → confirm (§5.2/§5.3)', () => {
  it('walks the roster, verify, seat selection and confirmation', async () => {
    const { container } = render(<JoinFlow claimToken="CT" roomId="room1" tourDate="2026-08-17" />);

    // roster (masked names, claimed disabled)
    await screen.findByTestId('join-roster');
    const entries = screen.getAllByTestId('roster-entry');
    expect(entries).toHaveLength(2);
    expect(entries[1]).toBeDisabled(); // b2 already claimed

    // pick b1 -> verify
    fireEvent.click(entries[0]);
    await screen.findByTestId('join-verify');
    fireEvent.change(screen.getByTestId('verify-party'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('verify-confirm'));

    // seat selection
    await screen.findByTestId('join-seats');
    const seat = (n: number) => container.querySelector(`[data-seat="${n}"]`)!;

    // §5.3 C-10 — the taken seat renders taken and is not selectable
    expect(seat(5).getAttribute('class')).toContain('sm-seat--taken');
    fireEvent.click(seat(5));
    expect(screen.getByTestId('seat-count')).toHaveTextContent('0');

    // pick two free seats (party cap 2); a third tap is ignored at the cap
    fireEvent.click(seat(1));
    fireEvent.click(seat(2));
    expect(seat(1).getAttribute('class')).toContain('sm-seat--mine');
    fireEvent.click(seat(3));
    expect(seat(3).getAttribute('class')).not.toContain('sm-seat--mine');
    expect(screen.getByTestId('seat-count')).toHaveTextContent('2');

    // confirm -> done, personal token stored (C-4)
    fireEvent.click(screen.getByTestId('confirm-seats'));
    await screen.findByTestId('join-done');
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('ops_personal_tokens') || '[]')).toContain('BODY.sig'),
    );
  });

  it('shows the already-registered guard on a 409 claim (C-5)', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const reply = (b: unknown, s = 200) =>
        Promise.resolve({ ok: s < 400, status: s, json: () => Promise.resolve(b) } as Response);
      if (url.includes('/claim') && method === 'GET')
        return reply({ roomId: 'room1', tourDate: '2026-08-17', bookings: [{ bookingId: 'b1', name: 'Massimo C.', partySize: 2, claimed: false }] });
      if (url.includes('/claim') && method === 'POST') return reply({ error: 'already_claimed', reviewQueued: true }, 409);
      return reply({}, 404);
    }) as unknown as typeof fetch;

    render(<JoinFlow claimToken="CT" roomId="room1" tourDate="2026-08-17" />);
    fireEvent.click(await screen.findByTestId('roster-entry'));
    await screen.findByTestId('join-verify');
    fireEvent.change(screen.getByTestId('verify-party'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('verify-confirm'));
    await screen.findByTestId('join-already');
    expect(within(screen.getByTestId('join-already')).getByTestId('reclaim-request')).toBeInTheDocument();
  });
});
