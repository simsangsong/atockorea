import {
  isValidAdminStatus,
  isAllowedStatusTransition,
} from '@/lib/admin/booking-status-transition';

describe('booking status state machine (W3.2 / B-3)', () => {
  it('accepts only the admin-settable statuses', () => {
    for (const s of ['pending', 'confirmed', 'completed', 'cancelled']) {
      expect(isValidAdminStatus(s)).toBe(true);
    }
    for (const s of ['no_show', 'hacked', '', 'PAID', 'refunded']) {
      expect(isValidAdminStatus(s)).toBe(false);
    }
  });

  it('allows legal forward transitions', () => {
    expect(isAllowedStatusTransition('pending', 'confirmed')).toBe(true);
    expect(isAllowedStatusTransition('pending', 'cancelled')).toBe(true);
    expect(isAllowedStatusTransition('pending', 'completed')).toBe(true);
    expect(isAllowedStatusTransition('confirmed', 'completed')).toBe(true);
    expect(isAllowedStatusTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('rejects illegal transitions out of terminal states', () => {
    expect(isAllowedStatusTransition('completed', 'pending')).toBe(false);
    expect(isAllowedStatusTransition('completed', 'confirmed')).toBe(false);
    expect(isAllowedStatusTransition('cancelled', 'confirmed')).toBe(false);
    expect(isAllowedStatusTransition('cancelled', 'pending')).toBe(false);
    expect(isAllowedStatusTransition('no_show', 'confirmed')).toBe(false);
  });

  it('rejects backward transitions', () => {
    expect(isAllowedStatusTransition('confirmed', 'pending')).toBe(false);
  });

  it('treats same-status as an allowed no-op', () => {
    expect(isAllowedStatusTransition('confirmed', 'confirmed')).toBe(true);
    expect(isAllowedStatusTransition('cancelled', 'cancelled')).toBe(true);
  });

  it('rejects transitions from an unknown current state', () => {
    expect(isAllowedStatusTransition('weird', 'confirmed')).toBe(false);
  });
});
