/**
 * §11.D D4 — DepartureCountdown: end-of-included-time countdown for a private
 * tour (target = departure_time + baseHoursForCity). Client-derived, no server
 * timer. Verifies the target formula, the ended state, and the hide gates.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DepartureCountdown from '@/components/tour-mode/DepartureCountdown';

const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));

const TOUR_DATE = '2026-07-24';
// 2026-07-24 14:00 KST (UTC+9) — on the tour day.
const NOON_ISH_KST = Date.UTC(2026, 6, 24, 5, 0, 0);

describe('DepartureCountdown (§11.D D4)', () => {
  afterEach(() => {
    (Date.now as jest.Mock).mockRestore?.();
  });

  function fixClock(ms: number) {
    jest.spyOn(Date, 'now').mockReturnValue(ms);
  }

  it('targets departure + base hours (Jeju 9h) and shows remaining time', () => {
    fixClock(NOON_ISH_KST);
    // Departure 09:00 + 9h (Jeju) → included time ends 18:00 KST; 4h remain.
    render(
      <DepartureCountdown departureTime="09:00" tourDate={TOUR_DATE} city="Jeju" locale="en" />,
    );
    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/4h/);
    // Target wall-clock (18:00 KST) shown in the "ends around" line.
    expect(banner.textContent).toMatch(/6:00/);
  });

  it('uses Busan 8h base (departure 09:00 → ends 17:00, 3h left)', () => {
    fixClock(NOON_ISH_KST);
    render(
      <DepartureCountdown departureTime="09:00" tourDate={TOUR_DATE} city="Busan" locale="en" />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/3h/);
  });

  it('shows the ended state once the included time has passed', () => {
    // 19:00 KST — past the 18:00 Jeju end.
    fixClock(Date.UTC(2026, 6, 24, 10, 0, 0));
    render(
      <DepartureCountdown departureTime="09:00" tourDate={TOUR_DATE} city="Jeju" locale="en" />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/Included time is up/);
  });

  it('renders nothing when the departure time is unset', () => {
    fixClock(NOON_ISH_KST);
    render(<DepartureCountdown departureTime={null} tourDate={TOUR_DATE} city="Jeju" locale="en" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides itself when it is not the tour day', () => {
    fixClock(NOON_ISH_KST); // today = 2026-07-24
    render(<DepartureCountdown departureTime="09:00" tourDate="2026-07-25" city="Jeju" locale="en" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('DepartureCountdown add-time (§11.D D5)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOON_ISH_KST);
    fetchMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    (Date.now as jest.Mock).mockRestore?.();
  });

  const guestProps = {
    departureTime: '09:00',
    tourDate: TOUR_DATE,
    city: 'Busan', // rate 40,000/h
    locale: 'en' as const,
    bookingId: 'booking-1',
    roomSession: 'sess-abc',
    canExtend: true,
  };

  it('shows the [add time] button only for a guest with a session (canExtend)', () => {
    const { rerender } = render(<DepartureCountdown {...guestProps} canExtend={false} />);
    expect(screen.queryByTestId('add-time-button')).toBeNull();
    rerender(<DepartureCountdown {...guestProps} canExtend />);
    expect(screen.getByTestId('add-time-button')).toBeInTheDocument();
  });

  it('opening the sheet does NOT POST — an explicit hour tap is required', async () => {
    render(<DepartureCountdown {...guestProps} />);
    fireEvent.click(screen.getByTestId('add-time-button'));
    // Sheet is open with previews but nothing was sent yet.
    expect(screen.getByTestId('add-time-sheet')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    // Busan 40k/h → +2h preview shows ₩80,000.
    expect(screen.getByTestId('add-time-option-2').textContent).toMatch(/₩80,000/);
  });

  it('tapping an hour option POSTs { hours } (no client amount) and toasts success', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, hours: 2, amount_krw: 80000 }) });
    render(<DepartureCountdown {...guestProps} />);
    fireEvent.click(screen.getByTestId('add-time-button'));
    fireEvent.click(screen.getByTestId('add-time-option-2'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/tour-rooms/booking-1/extend');
    expect(init.headers['x-tour-room-auth']).toBe('sess-abc');
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ hours: 2 }); // hours only — no amount_krw
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('toasts an error when the POST fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'private_only' }) });
    render(<DepartureCountdown {...guestProps} />);
    fireEvent.click(screen.getByTestId('add-time-button'));
    fireEvent.click(screen.getByTestId('add-time-option-1'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
