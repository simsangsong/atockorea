/**
 * The arrival-commentary door.
 *
 * 🔴 Two defects are pinned here, and both were invisible to the existing
 * suites because nothing tested the CALLER:
 *
 *   1. `sharing` lived in RoomMapTab, which RoomShell unmounts on every tab
 *      change (`{tab === 'map' && …}`). The guest's opt-in — and the arrival
 *      geofence riding on it — was discarded the moment they opened Chat.
 *      `useLocationSharing` moves it above the switch and remembers it.
 *   2. Nothing in the app pointed at that toggle, and the manual promised
 *      automatic arrival cards without mentioning it.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import ArrivalUnlockCard, { ARRIVAL_UNLOCK_COPY } from '@/components/tour-mode/ArrivalUnlockCard';
import { useLocationSharing, locationSharingKey } from '@/hooks/useLocationSharing';
import { MANUAL_SECTIONS } from '@/lib/tour-room/appManual';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

const BOOKING = 'booking-1';
const TOUR_DATE = '2026-08-02';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useLocationSharing — survives the tab switch that used to reset it', () => {
  it('remembers the opt-in across a remount on the tour day', () => {
    const first = renderHook(() =>
      useLocationSharing({ bookingId: BOOKING, tourDate: TOUR_DATE, live: true }),
    );
    expect(first.result.current.sharing).toBe(false);
    act(() => first.result.current.setSharing(true));
    expect(first.result.current.sharing).toBe(true);
    first.unmount();

    // A fresh mount is what a tab change (and a reload) looks like.
    const second = renderHook(() =>
      useLocationSharing({ bookingId: BOOKING, tourDate: TOUR_DATE, live: true }),
    );
    expect(second.result.current.sharing).toBe(true);
  });

  it('turning it off forgets it', () => {
    const { result, unmount } = renderHook(() =>
      useLocationSharing({ bookingId: BOOKING, tourDate: TOUR_DATE, live: true }),
    );
    act(() => result.current.setSharing(true));
    act(() => result.current.setSharing(false));
    expect(window.localStorage.getItem(locationSharingKey(BOOKING, TOUR_DATE))).toBeNull();
    unmount();

    const again = renderHook(() =>
      useLocationSharing({ bookingId: BOOKING, tourDate: TOUR_DATE, live: true }),
    );
    expect(again.result.current.sharing).toBe(false);
  });

  it('never restores a remembered opt-in off the tour day, or for another day', () => {
    window.localStorage.setItem(locationSharingKey(BOOKING, TOUR_DATE), '1');

    const offDay = renderHook(() =>
      useLocationSharing({ bookingId: BOOKING, tourDate: TOUR_DATE, live: false }),
    );
    expect(offDay.result.current.sharing).toBe(false);

    const otherDay = renderHook(() =>
      useLocationSharing({ bookingId: BOOKING, tourDate: '2026-08-03', live: true }),
    );
    expect(otherDay.result.current.sharing).toBe(false);
  });

  it('starts off when storage throws (private mode)', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() =>
      useLocationSharing({ bookingId: BOOKING, tourDate: TOUR_DATE, live: true }),
    );
    expect(result.current.sharing).toBe(false);
    spy.mockRestore();
  });
});

describe('ArrivalUnlockCard', () => {
  const base = {
    sharing: false,
    status: 'idle' as const,
    hasGeofencedStops: true,
    onEnable: jest.fn(),
  };

  it.each(ROOM_LOCALES)('renders a one-tap enable in %s', (locale) => {
    const onEnable = jest.fn();
    const { unmount } = render(<ArrivalUnlockCard {...base} locale={locale} onEnable={onEnable} />);
    fireEvent.click(screen.getByTestId('arrival-unlock-enable'));
    expect(onEnable).toHaveBeenCalledTimes(1);
    unmount();
  });

  it.each(ROOM_LOCALES)('shows the %s consent line wherever it offers the switch', (locale) => {
    // Enabling from home must not tell the guest less than enabling from the
    // map tab, where the consent copy has always lived.
    render(<ArrivalUnlockCard {...base} locale={locale} />);
    expect(screen.getByTestId('arrival-unlock-card')).toHaveTextContent(
      ARRIVAL_UNLOCK_COPY[locale].consent,
    );
  });

  it('self-hides once sharing is on', () => {
    render(<ArrivalUnlockCard {...base} locale="en" sharing />);
    expect(screen.queryByTestId('arrival-unlock-card')).not.toBeInTheDocument();
  });

  it('stays away when the tour has no geofenced stops', () => {
    render(<ArrivalUnlockCard {...base} locale="en" hasGeofencedStops={false} />);
    expect(screen.queryByTestId('arrival-unlock-card')).not.toBeInTheDocument();
  });

  it.each(['denied', 'unsupported'] as const)('does not nag when location is %s', (status) => {
    render(<ArrivalUnlockCard {...base} locale="en" status={status} />);
    expect(screen.queryByTestId('arrival-unlock-card')).not.toBeInTheDocument();
  });
});

describe('the manual tells guests the one thing they must switch on', () => {
  const arrival = MANUAL_SECTIONS.find((section) => section.key === 'arrival')!;

  it.each(ROOM_LOCALES)('the %s arrival section points at the real button', (locale) => {
    // The invariant is not "the text got longer" — it is that the manual sends
    // the guest to a control that exists under that exact name. Rename the
    // button without updating the manual and this fails, which is the whole
    // failure mode: instructions naming something the screen does not have.
    expect(arrival.body[locale]).toContain(ARRIVAL_UNLOCK_COPY[locale].cta);
  });
});
