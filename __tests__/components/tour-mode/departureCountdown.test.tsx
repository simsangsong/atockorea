/**
 * §11.D D4 — DepartureCountdown: end-of-included-time countdown for a private
 * tour (target = departure_time + baseHoursForCity). Client-derived, no server
 * timer. Verifies the target formula, the ended state, and the hide gates.
 */
import { render, screen } from '@testing-library/react';
import DepartureCountdown from '@/components/tour-mode/DepartureCountdown';

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
