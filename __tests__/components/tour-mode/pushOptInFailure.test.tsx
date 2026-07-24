/**
 * §D A1.6 P2 — a push opt-in that failed must not look untouched.
 *
 * 🔴 The guest grants OS permission, the browser creates a subscription, and
 * the POST that stores it fails. The banner used to drop back to its original
 * "Turn on / Later" look — indistinguishable from never having tried — while
 * the two things it promises (meeting time, vehicle delay) can no longer be
 * delivered. The guest waits for a ping that cannot arrive.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PushOptInBanner from '@/components/tour-mode/PushOptInBanner';

const SUBSCRIPTION = { toJSON: () => ({ endpoint: 'https://push.example/abc' }) };

function installPushEnvironment() {
  process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager: { subscribe: async () => SUBSCRIPTION } }) },
    configurable: true,
  });
  (window as unknown as { PushManager: unknown }).PushManager = function PushManager() {};
  (global as unknown as { Notification: unknown }).Notification = {
    permission: 'default',
    requestPermission: async () => 'granted',
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  installPushEnvironment();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** The banner appears 1.2s after mount, once the room has settled. */
async function showBanner() {
  render(<PushOptInBanner bookingId="booking-1" roomSession="session" locale="ko" />);
  await act(async () => {
    jest.advanceTimersByTime(1200);
  });
  expect(screen.getByTestId('push-optin-banner')).toBeInTheDocument();
}

it('🔴 says it failed when the server rejects the subscription', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
  await showBanner();

  fireEvent.click(screen.getByTestId('push-enable'));
  await waitFor(() => expect(screen.getByTestId('push-failed')).toBeInTheDocument());
  expect(screen.getByTestId('push-failed')).toHaveTextContent('알림을 켜지 못했어요');
  // Still retryable — the button stays.
  expect(screen.getByTestId('push-enable')).toBeInTheDocument();
  // And nothing is remembered as subscribed.
  expect(window.localStorage.getItem('tour_mode_push_optin:booking-1')).toBeNull();
});

it('confirms success in the guest locale', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
  await showBanner();

  fireEvent.click(screen.getByTestId('push-enable'));
  await waitFor(() => expect(screen.getByText(/알림 켜짐/)).toBeInTheDocument());
  expect(window.localStorage.getItem('tour_mode_push_optin:booking-1')).toBe('subscribed');
});
