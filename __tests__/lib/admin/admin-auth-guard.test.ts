import { decideAdminGuard } from '@/lib/admin/admin-auth-guard';

describe('decideAdminGuard (W3.8 M-8)', () => {
  it('admits an admin profile', () => {
    expect(decideAdminGuard({ role: 'admin' }, null)).toEqual({ kind: 'ok' });
  });

  it('treats a non-admin profile as not_admin (no mutation)', () => {
    expect(decideAdminGuard({ role: 'customer' }, null)).toEqual({
      kind: 'not_admin',
      role: 'customer',
    });
    expect(decideAdminGuard({ role: 'merchant' }, null)).toEqual({
      kind: 'not_admin',
      role: 'merchant',
    });
  });

  it('maps a missing profile (PGRST116) to no_profile — never auto-creates', () => {
    expect(decideAdminGuard(null, { code: 'PGRST116', message: 'no rows' })).toEqual({
      kind: 'no_profile',
    });
  });

  it('detects an expired JWT regardless of error code', () => {
    expect(decideAdminGuard(null, { message: 'JWT expired' })).toEqual({ kind: 'jwt_expired' });
    expect(decideAdminGuard(null, { code: 'PGRST301', message: 'jwt expired' })).toEqual({
      kind: 'jwt_expired',
    });
  });

  it('surfaces other lookup errors as query_failed', () => {
    expect(decideAdminGuard(null, { code: '500', message: 'boom' })).toEqual({
      kind: 'query_failed',
      message: 'boom',
    });
  });

  it('falls back to a non-empty message when the error message is blank', () => {
    const d = decideAdminGuard(null, { code: 'XYZ', message: '' });
    expect(d.kind).toBe('query_failed');
    if (d.kind === 'query_failed') expect(d.message.length).toBeGreaterThan(0);
  });

  it('treats a null profile with no error as not_admin (role null)', () => {
    expect(decideAdminGuard(null, null)).toEqual({ kind: 'not_admin', role: null });
  });
});
