/**
 * A1.1 P1 — the guest must tell the guide from the driver at a glance.
 *
 * 🔴 Both roles used the same flag glyph, separated only by near-identical
 *    grays in a 36px circle. The driver speaks only Korean over the W3 bridge,
 *    so "who is speaking" decides what the guest can ask. ReplyPreview already
 *    labels the roles in words; the feed avatar must not contradict it.
 */

import { render, screen } from '@testing-library/react';
import Avatar from '@/components/tour-mode/Avatar';

it('renders a different glyph for guide vs driver', () => {
  const { container: guide } = render(<Avatar role="guide" />);
  const { container: driver } = render(<Avatar role="driver" />);

  const guideSvg = guide.querySelector('[data-testid="avatar-guide"] svg')?.innerHTML ?? '';
  const driverSvg = driver.querySelector('[data-testid="avatar-driver"] svg')?.innerHTML ?? '';

  expect(guideSvg).not.toBe('');
  expect(driverSvg).not.toBe('');
  // The whole point: the two icons are no longer identical.
  expect(driverSvg).not.toBe(guideSvg);
});

it('still renders the distinct role avatars (guide/driver/admin/anon)', () => {
  render(<Avatar role="guide" />);
  render(<Avatar role="driver" />);
  render(<Avatar role="admin" />);
  render(<Avatar role="customer" />);
  expect(screen.getByTestId('avatar-guide')).toBeInTheDocument();
  expect(screen.getByTestId('avatar-driver')).toBeInTheDocument();
  expect(screen.getByTestId('avatar-admin')).toBeInTheDocument();
  expect(screen.getByTestId('avatar-anon')).toBeInTheDocument();
});
