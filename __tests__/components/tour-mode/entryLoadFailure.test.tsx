/**
 * §D A1.6 P2 — "we couldn't load your tours" is not "you have no tours".
 *
 * 🔴 The entry screen treated any non-401 response as data. A 500 the night
 * before a tour therefore told a guest with a confirmed booking: "No upcoming
 * confirmed tours on this account." That reads as "your booking is gone" — at
 * the exact moment it is most alarming — and sends them to support.
 */

import { render, screen, waitFor } from '@testing-library/react';
import TourModeEntry from '@/components/tour-mode/TourModeEntry';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const NO_BOOKINGS = 'No upcoming confirmed tours on this account.';
const SIGN_IN_HINT = 'Signed-in customers see their tour rooms here.';

const BOOKING = {
  id: 'booking-1',
  booking_reference: 'ATOC-1',
  tour_date: '2026-08-17',
  tour_time: '08:30',
  number_of_guests: 2,
  tours: { title: 'Jeju East Highlights', city: 'Jeju', image_url: null },
};

afterEach(() => jest.restoreAllMocks());

it('🔴 a 500 says the load failed, never "no bookings"', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;

  render(<TourModeEntry />);

  await waitFor(() => expect(screen.getByTestId('entry-load-failed')).toBeInTheDocument());
  expect(screen.queryByText(NO_BOOKINGS)).toBeNull();
  // And it says whose fault it is, so the guest does not go hunting.
  expect(screen.getByTestId('entry-load-failed')).toHaveTextContent('this is on us');
});

it('a network error is not a signed-out session either', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;

  render(<TourModeEntry />);

  await waitFor(() => expect(screen.getByTestId('entry-load-failed')).toBeInTheDocument());
  expect(screen.queryByText(SIGN_IN_HINT)).toBeNull();
});

it('an empty list still says "none" — the honest empty state is unchanged', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ bookings: [] }),
  })) as unknown as typeof fetch;

  render(<TourModeEntry />);

  await waitFor(() => expect(screen.getByText(NO_BOOKINGS)).toBeInTheDocument());
  expect(screen.queryByTestId('entry-load-failed')).toBeNull();
});

it('lists the tours when the call succeeds', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ bookings: [BOOKING] }),
  })) as unknown as typeof fetch;

  render(<TourModeEntry />);

  await waitFor(() => expect(screen.getByText(/Jeju East Highlights/)).toBeInTheDocument());
  expect(screen.queryByTestId('entry-load-failed')).toBeNull();
});
