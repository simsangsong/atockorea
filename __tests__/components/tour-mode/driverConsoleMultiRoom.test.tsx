/**
 * 조인 투어 기사 단독 (2026-08-04) — DriverConsole used to read `rooms[0]`
 * ("private mode: one party per day"), silently cutting every party but the
 * first. Several rooms now get a pickup-ordered party list; one room keeps
 * the old straight-in flow.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DriverConsole from '@/components/tour-mode/driver/DriverConsole';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// The cockpit is its own 2,500-line surface with its own suite — stub it so
// this file tests the console's routing, not the cockpit.
jest.mock('@/components/tour-mode/cockpit/Cockpit', () => {
  const actual = jest.requireActual('@/components/tour-mode/cockpit/Cockpit');
  return {
    __esModule: true,
    ...actual,
    default: ({ bookingId }: { bookingId: string }) => <div data-testid="cockpit-stub">{bookingId}</div>,
  };
});

const ROOM = (bookingId: string, time: string, guests: number) => ({
  booking_id: bookingId,
  number_of_guests: guests,
  pickup: { name: `${time} 픽업지`, lat: 33.5, lng: 126.5, pickup_time: time },
  schedule_source: 'plan',
  schedule: [],
});

function mockFetch(rooms: unknown[]) {
  const calls: string[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input);
    calls.push(url);
    if (url.includes('/driver/overview')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          tour: { id: 't-1', title: '제주 동부 조인', city: 'jeju' },
          tour_kind: 'join',
          tour_date: '2099-01-01',
          lifecycle: 'live',
          driver_name: '기사님',
          rooms,
        }),
      } as Response);
    }
    if (url.includes('/join')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ session: 'sess', channel: { topic: 'topic' }, snapshot: { messages: [] } }),
      } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  sessionStorage.setItem('tour_mode_driver_token', 'drv-token');
});

describe('DriverConsole — join tours (multi-room)', () => {
  it('lists every party sorted by pickup time, and enters the tapped one', async () => {
    const calls = mockFetch([ROOM('b-2', '09:40', 3), ROOM('b-1', '09:10', 2), ROOM('b-3', '10:05', 4)]);
    render(<DriverConsole />);
    await waitFor(() => expect(screen.getByTestId('driver-room-list')).toBeInTheDocument());

    // Sorted by pickup time, not payload order.
    expect(screen.getByTestId('driver-room-row-0')).toHaveTextContent('09:10');
    expect(screen.getByTestId('driver-room-row-1')).toHaveTextContent('09:40');
    expect(screen.getByTestId('driver-room-row-2')).toHaveTextContent('10:05');
    // No join fired yet — the driver has not picked a party.
    expect(calls.filter((u) => u.includes('/join'))).toHaveLength(0);

    fireEvent.click(screen.getByTestId('driver-room-row-1')); // 09:40 → b-2
    await waitFor(() => expect(calls.some((u) => u.includes('/tour-rooms/b-2/join'))).toBe(true));

    // 운행 시작 (audio unlock) then the cockpit for that booking.
    fireEvent.click(await screen.findByTestId('driver-start'));
    expect(screen.getByTestId('cockpit-stub')).toHaveTextContent('b-2');
  });

  it('a single party skips the list — the private-mode flow is unchanged', async () => {
    const calls = mockFetch([ROOM('b-9', '09:00', 2)]);
    render(<DriverConsole />);
    await waitFor(() => expect(calls.some((u) => u.includes('/tour-rooms/b-9/join'))).toBe(true));
    expect(screen.queryByTestId('driver-room-list')).not.toBeInTheDocument();
  });
});
