/**
 * §D A1.8 — the QR check-in landing must honour the device theme and the
 * tour-room brand palette, like its sibling entry screens (JoinFlow,
 * CompanionJoin).
 *
 * 🔴 It used raw `neutral-*` Tailwind with `dark:` variants, but the app runs
 * `darkMode: 'class'` and nothing in this route ever set a `.dark` ancestor —
 * so the dark styling was entirely dead. A guest scanning at 8am on a
 * dark-themed phone got a stuck-light, off-brand screen. This pins the fix:
 * a `.dark > .tr-root` shell driven by the device theme.
 */

import { render, waitFor } from '@testing-library/react';
import CheckinLanding from '@/components/tour-mode/checkin/CheckinLanding';

function mockMatchMedia(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: dark && query.includes('dark'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  // 'no_token' — a terminal state with no auto-submit, so we only exercise theme.
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ state: 'no_token' }),
  })) as unknown as typeof fetch;
});

afterEach(() => jest.restoreAllMocks());

it('🔴 wraps the screen in a .dark > .tr-root shell on a dark device', async () => {
  mockMatchMedia(true);
  const { container } = render(<CheckinLanding checkinToken="ct" nonce={null} />);

  await waitFor(() => expect(container.querySelector('[data-testid="checkin-no_token"]')).toBeTruthy());
  const darkWrap = container.querySelector('.dark');
  expect(darkWrap).toBeTruthy();
  expect(darkWrap!.querySelector('.tr-root')).toBeTruthy();
});

it('uses the tr-root shell without .dark on a light device', async () => {
  mockMatchMedia(false);
  const { container } = render(<CheckinLanding checkinToken="ct" nonce={null} />);

  await waitFor(() => expect(container.querySelector('[data-testid="checkin-no_token"]')).toBeTruthy());
  expect(container.querySelector('.dark')).toBeNull();
  expect(container.querySelector('.tr-root')).toBeTruthy();
});

it('no longer emits hard-coded neutral background classes', async () => {
  mockMatchMedia(false);
  const { container } = render(<CheckinLanding checkinToken="ct" nonce={null} />);

  await waitFor(() => expect(container.querySelector('[data-testid="checkin-no_token"]')).toBeTruthy());
  expect(container.querySelector('.bg-white')).toBeNull();
  expect(container.querySelector('[class*="bg-neutral"]')).toBeNull();
});
