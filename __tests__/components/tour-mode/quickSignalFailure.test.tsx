/**
 * §D A1.6 P1 — a help signal that did not arrive must not look like one that did.
 *
 * 🔴 "I'm lost", "Pick me up here", "Running late" are the guest's one-tap way
 * of asking for help. On a failed POST the bar used to return to its normal
 * look with no message at all — identical to a successful send from the
 * guest's side. They stop worrying; nobody was told.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickSignalBar from '@/components/tour-mode/QuickSignalBar';

const props = { bookingId: 'booking-1', roomSession: 'session', locale: 'ko' as const };

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('🔴 says so when the signal did not reach the guide, and points at the chat', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
  render(<QuickSignalBar {...props} />);

  fireEvent.click(screen.getByText(/늦어요|늦을/));
  const failed = await screen.findByTestId('quick-signal-failed');
  expect(failed).toHaveTextContent('전달되지 않았어요');
  expect(failed).toHaveTextContent('채팅으로');
});

it('confirms a delivered signal, then gives the chips back', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
  jest.useFakeTimers();
  render(<QuickSignalBar {...props} />);

  fireEvent.click(screen.getByText(/늦어요|늦을/));
  await act(async () => {});
  expect(screen.getByTestId('quick-signal-sent')).toBeInTheDocument();

  // The confirmation used to be derived from Date.now() in render, so in a
  // quiet room nothing ever re-rendered and the chips stayed hidden.
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(screen.queryByTestId('quick-signal-sent')).toBeNull();
  expect(screen.getByTestId('quick-signal-bar')).toBeInTheDocument();
});
