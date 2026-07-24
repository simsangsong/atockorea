/**
 * §D A1.6 P1 — the SOS must leave the device even when the position never comes.
 *
 * 🔴 `getCurrentPosition`'s `timeout` does not count the time the guest spends
 * on the browser's permission dialog. A guest who has never granted location —
 * or who is staring at the SOS screen and never processes the system prompt —
 * used to sit on a spinner with the alert still undelivered. In an emergency.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SosButton from '@/components/tour-mode/SosButton';

function installGeolocation(behaviour: 'never' | 'fast' | 'denied') {
  const getCurrentPosition = jest.fn((success: PositionCallback, error?: PositionErrorCallback) => {
    if (behaviour === 'fast') {
      success({ coords: { latitude: 33.45, longitude: 126.56 } } as GeolocationPosition);
    } else if (behaviour === 'denied') {
      error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
    }
    // 'never' — the permission prompt is still open. No callback, ever.
  });
  Object.defineProperty(global.navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

function sosBody() {
  const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('/sos'));
  return JSON.parse(String((call?.[1] as RequestInit).body)) as Record<string, unknown>;
}

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('🔴 sends without coordinates when the permission prompt never resolves', async () => {
  installGeolocation('never');
  render(<SosButton bookingId="booking-1" roomSession="session" locale="en" />);
  fireEvent.click(screen.getByTestId('sos-button'));
  jest.useFakeTimers();
  fireEvent.click(screen.getByTestId('sos-send'));

  await act(async () => {
    jest.advanceTimersByTime(4_000);
  });
  jest.useRealTimers();

  await waitFor(() => expect(screen.getByTestId('sos-sent')).toBeInTheDocument());
  const body = sosBody();
  expect(body.latitude).toBeUndefined();
  expect(body.longitude).toBeUndefined();
});

it('still attaches the position when the device has one', async () => {
  installGeolocation('fast');
  render(<SosButton bookingId="booking-1" roomSession="session" locale="en" />);
  fireEvent.click(screen.getByTestId('sos-button'));
  fireEvent.click(screen.getByTestId('sos-send'));

  await waitFor(() => expect(screen.getByTestId('sos-sent')).toBeInTheDocument());
  expect(sosBody()).toMatchObject({ latitude: 33.45, longitude: 126.56 });
});

it('a denied guest still gets the alert out (existing contract)', async () => {
  installGeolocation('denied');
  render(<SosButton bookingId="booking-1" roomSession="session" locale="en" />);
  fireEvent.click(screen.getByTestId('sos-button'));
  fireEvent.click(screen.getByTestId('sos-send'));

  await waitFor(() => expect(screen.getByTestId('sos-sent')).toBeInTheDocument());
  expect(sosBody().latitude).toBeUndefined();
});

it('asks for the fix while the guest reads the consent sheet, not after Send', () => {
  const getCurrentPosition = installGeolocation('never');
  render(<SosButton bookingId="booking-1" roomSession="session" locale="en" />);
  fireEvent.click(screen.getByTestId('sos-button'));
  // The prompt and the GPS warm-up overlap with reading; Send is not blocked on
  // starting them.
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
});
