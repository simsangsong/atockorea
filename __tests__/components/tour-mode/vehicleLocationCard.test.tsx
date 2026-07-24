/**
 * §11.C C1/C3 — the guest vehicle card: silent when nobody is sharing, an
 * instant zero-network ETA when they are, no ETA on a stale position, and the
 * [see vehicle] affordance handing off to the map tab.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VehicleLocationCard from '@/components/tour-mode/map/VehicleLocationCard';
import { kstToday } from '@/lib/tour-room/time';
import type { VehicleLocationLike } from '@/lib/tour-room/vehicleEta';

const PICKUP = { lat: 33.5045, lng: 126.9523, name: '우도항' };

function driverAt(agoMs: number): Record<string, VehicleLocationLike> {
  return {
    'p-driver': {
      participant_id: 'p-driver',
      role: 'driver',
      latitude: 33.458,
      longitude: 126.9425,
      recorded_at: new Date(Date.now() - agoMs).toISOString(),
    },
  };
}

function renderCard(over: Partial<React.ComponentProps<typeof VehicleLocationCard>> = {}) {
  const onOpenMap = jest.fn();
  render(
    <VehicleLocationCard
      locale="ko"
      locations={driverAt(30_000)}
      pickup={PICKUP}
      bookingId="bk-1"
      roomSession="sess-1"
      tourDate={kstToday()}
      pickupTime={null}
      onOpenMap={onOpenMap}
      {...over}
    />,
  );
  return { onOpenMap };
}

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as never;
});

afterEach(() => {
  // @ts-expect-error — ad-hoc fetch mock per test.
  delete global.fetch;
});

describe('VehicleLocationCard', () => {
  it('renders nothing when no driver/guide position exists', () => {
    const { container } = render(
      <VehicleLocationCard
        locale="ko"
        locations={{ c1: { participant_id: 'c1', role: 'customer', latitude: 33.1, longitude: 126.1 } }}
        pickup={PICKUP}
        bookingId="bk-1"
        roomSession="sess-1"
        tourDate={kstToday()}
        onOpenMap={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the instant synthetic ETA + freshness with zero network dependency', () => {
    renderCard();
    expect(screen.getByTestId('vehicle-location-card')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-eta-line')).toHaveTextContent(/약 \d+분/);
    expect(screen.getByTestId('vehicle-age-line')).toHaveTextContent('방금 위치');
    expect(screen.getByTestId('vehicle-live-dot')).toBeInTheDocument();
  });

  it('hides the ETA for a stale position and shows only how old it is', () => {
    renderCard({ locations: driverAt(20 * 60_000) });
    expect(screen.queryByTestId('vehicle-eta-line')).not.toBeInTheDocument();
    expect(screen.getByTestId('vehicle-age-line')).toHaveTextContent('20분 전 위치');
    expect(screen.queryByTestId('vehicle-live-dot')).not.toBeInTheDocument();
  });

  it('omits the ETA when the booking has no meeting-point coordinates', () => {
    renderCard({ pickup: null });
    expect(screen.queryByTestId('vehicle-eta-line')).not.toBeInTheDocument();
    expect(screen.getByTestId('vehicle-location-card')).toBeInTheDocument();
  });

  it('upgrades to the server estimate and passes the destination + room session', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ vehicle: {}, eta: { minutes: 42, distanceM: 14200, source: 'kakao' } }),
    })) as never;
    renderCard();
    await waitFor(() => expect(screen.getByTestId('vehicle-eta-line')).toHaveTextContent('약 42분'));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/tour-rooms/bk-1/vehicle-eta?toLat=33.5045&toLng=126.9523');
    expect(init.headers['x-tour-room-auth']).toBe('sess-1');
  });

  it('adds the pickup-window emphasis only inside the window', () => {
    const nowHhmm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    renderCard({ pickupTime: nowHhmm });
    expect(screen.getByTestId('vehicle-pickup-line')).toHaveTextContent('픽업하러 이동 중이에요');
  });

  it('both tap targets hand off to the map tab', () => {
    const { onOpenMap } = renderCard();
    fireEvent.click(screen.getByTestId('vehicle-see-map'));
    fireEvent.click(screen.getByTestId('vehicle-open-map'));
    expect(onOpenMap).toHaveBeenCalledTimes(2);
  });
});
