/**
 * SG-3a / E1 — on-device walk-back. Pinned: the math (70m/min, clamps,
 * 3-min buffer), the opt-in ladder (chip → line), consent persistence, and
 * the one property SG-D8 exists for — NOTHING leaves the device (no fetch).
 */
import { act, fireEvent, render } from '@testing-library/react';
import WalkBackLine, {
  haversineMeters,
  walkBackMinutes,
} from '@/components/tour-mode/WalkBackLine';

const TARGET = Date.UTC(2026, 6, 28, 3, 0, 0);

const mockGeo = (impl: (success: PositionCallback, error?: PositionErrorCallback) => void) => {
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: jest.fn(impl) },
  });
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('walk-back math', () => {
  it('haversine is sane at Jeju scale', () => {
    // ~111m per 0.001° latitude
    const d = haversineMeters(33.45, 126.57, 33.451, 126.57);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(122);
  });

  it('70m/min with floor 2 and ceiling 60', () => {
    expect(walkBackMinutes(420)).toBe(6);
    expect(walkBackMinutes(10)).toBe(2);
    expect(walkBackMinutes(100_000)).toBe(60);
  });
});

describe('<WalkBackLine />', () => {
  it('starts as an opt-in chip; tap computes ON DEVICE and renders the line', () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    mockGeo((success) =>
      success({
        coords: { latitude: 33.451, longitude: 126.57 },
      } as GeolocationPosition),
    );
    const { getByTestId, queryByTestId } = render(
      <WalkBackLine lat={33.455} lng={126.57} targetMs={TARGET} locale="en" />,
    );
    expect(queryByTestId('walkback-line')).not.toBeInTheDocument();
    act(() => {
      fireEvent.click(getByTestId('walkback-optin'));
    });
    const line = getByTestId('walkback-line');
    // ~445m → ceil(445/70)=7 min; leave-by = target − 7 − 3 buffer.
    expect(line.textContent).toMatch(/7 min walk from you — leave by/);
    expect(fetchSpy).not.toHaveBeenCalled(); // SG-D8: nothing leaves the phone
    expect(window.localStorage.getItem('tr-walkback-optin')).toBe('1');
  });

  it('with prior consent it computes on mount', () => {
    window.localStorage.setItem('tr-walkback-optin', '1');
    mockGeo((success) =>
      success({ coords: { latitude: 33.451, longitude: 126.57 } } as GeolocationPosition),
    );
    const { getByTestId } = render(
      <WalkBackLine lat={33.455} lng={126.57} targetMs={TARGET} locale="ko" />,
    );
    expect(getByTestId('walkback-line').textContent).toContain('도보 7분');
  });

  it('a refusal degrades back to the chip — never a fabricated number', () => {
    mockGeo((_success, error) =>
      error?.({ code: 1, message: 'denied' } as GeolocationPositionError),
    );
    const { getByTestId, queryByTestId } = render(
      <WalkBackLine lat={33.455} lng={126.57} targetMs={TARGET} locale="en" />,
    );
    act(() => {
      fireEvent.click(getByTestId('walkback-optin'));
    });
    expect(queryByTestId('walkback-line')).not.toBeInTheDocument();
    expect(getByTestId('walkback-optin')).toBeInTheDocument();
  });
});
