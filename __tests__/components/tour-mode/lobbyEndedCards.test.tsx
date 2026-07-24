/**
 * T1.11 / §O-1 ⑥ — LobbyCard (D-day countdown + pickup plan + chat hint) and
 * EndedCard (read-only notice + lost-item action) across all 5 room locales.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import LobbyCard from '@/components/tour-mode/LobbyCard';
import EndedCard from '@/components/tour-mode/EndedCard';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import { kstDaysUntil, kstToday } from '@/lib/tour-room/time';

function ymdDaysFromToday(days: number): string {
  const [y, m, d] = kstToday().split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    shifted.getUTCDate(),
  ).padStart(2, '0')}`;
}

describe('kstDaysUntil', () => {
  it('is 0 for today, N for N days ahead, never negative', () => {
    expect(kstDaysUntil(kstToday())).toBe(0);
    expect(kstDaysUntil(ymdDaysFromToday(3))).toBe(3);
    expect(kstDaysUntil(ymdDaysFromToday(-2))).toBe(0);
  });
});

describe('LobbyCard', () => {
  const tourDate = ymdDaysFromToday(3);

  it.each(ROOM_LOCALES)('renders countdown, date and pickup in %s', (locale) => {
    render(
      <LobbyCard
        locale={locale}
        tourDate={tourDate}
        tourTime="09:30:00"
        pickupPoints={{ name: 'Seomyeon Stn Exit 2', address: 'Busanjin-gu', pickup_time: '08:50:00' }}
      />,
    );
    const card = screen.getByTestId('lobby-card');
    expect(card).toHaveTextContent('3'); // D-3 / あと3日 / 还有3天 / Faltan 3 días
    expect(card).toHaveTextContent(tourDate);
    expect(card).toHaveTextContent('09:30');
    expect(card).toHaveTextContent('Seomyeon Stn Exit 2');
    expect(card).toHaveTextContent('08:50');
    expect(card).toHaveTextContent('Busanjin-gu');
  });

  it('renders without pickup data and supports pickup arrays', () => {
    const { rerender } = render(<LobbyCard locale="en" tourDate={tourDate} pickupPoints={null} />);
    expect(screen.getByTestId('lobby-card')).toBeInTheDocument();
    expect(screen.queryByText(/Pickup/)).not.toBeInTheDocument();

    rerender(<LobbyCard locale="en" tourDate={tourDate} pickupPoints={[{ name: 'Hotel lobby' }]} />);
    expect(screen.getByText('Hotel lobby')).toBeInTheDocument();
  });
});

describe('EndedCard', () => {
  it.each(ROOM_LOCALES)('renders the ended notice and lost-item action in %s', (locale) => {
    render(<EndedCard locale={locale} bookingReference="ATC-1234" />);
    const card = screen.getByTestId('ended-card');
    expect(card).toBeInTheDocument();
    const action = card.querySelector('a[href^="mailto:support@atockorea.com"]');
    expect(action).not.toBeNull();
    expect(action!.getAttribute('href')).toContain(encodeURIComponent('booking ATC-1234'));
  });

  it('falls back to a generic subject without a booking reference', () => {
    render(<EndedCard locale="en" />);
    const action = screen.getByTestId('ended-card').querySelector('a[href^="mailto:"]');
    expect(action!.getAttribute('href')).toContain(encodeURIComponent('tour room'));
  });
});

/**
 * §D A1.6 — a lost-item report that never reached the server used to put the
 * button back untouched, indistinguishable from "not sent yet". The email path
 * is a real fallback; failure now routes to it and says why.
 */
describe('🔴 lost-item report failure', () => {
  it('falls back to email and says the report did not go through', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    // Yesterday (KST day end has passed, still inside the 48h window).
    const tourDate = ymdDaysFromToday(-1);
    render(
      <EndedCard
        locale="ko"
        bookingReference="ATOC-1"
        bookingId="booking-1"
        roomSession="session"
        tourDate={tourDate}
      />,
    );

    fireEvent.click(screen.getByTestId('lost-item-signal'));
    // The in-app prompt replaces window.prompt (M-D6): confirm with no text.
    fireEvent.click(await screen.findByRole('button', { name: '보내기' }));

    expect(await screen.findByTestId('lost-item-failed')).toHaveTextContent('이메일로 알려주세요');
    expect(screen.getByRole('link', { name: /분실물 신고하기/ })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:'),
    );
  });
});
