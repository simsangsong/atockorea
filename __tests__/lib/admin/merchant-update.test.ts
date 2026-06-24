import { validateMerchantUpdate } from '@/lib/admin/merchant-update';

describe('validateMerchantUpdate (W3.4 / N-5, S-F7)', () => {
  it('accepts a valid allowlisted update', () => {
    const r = validateMerchantUpdate({
      status: 'active',
      isVerified: true,
      contactEmail: ' merchant@example.com ',
      companyName: ' Acme ',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.updateData).toEqual({
        status: 'active',
        is_verified: true,
        contact_email: 'merchant@example.com',
        company_name: 'Acme',
      });
    }
  });

  it('rejects an unknown status (no ugly DB 500)', () => {
    const r = validateMerchantUpdate({ status: 'hacked' });
    expect(r.ok).toBe(false);
  });

  it('rejects a non-boolean isVerified', () => {
    expect(validateMerchantUpdate({ isVerified: 'true' }).ok).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(validateMerchantUpdate({ contactEmail: 'not-an-email' }).ok).toBe(false);
    expect(validateMerchantUpdate({ contactEmail: 'a@b' }).ok).toBe(false);
  });

  it('produces an empty update for an empty body (caller returns 400 — S-F7)', () => {
    const r = validateMerchantUpdate({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.updateData)).toHaveLength(0);
  });

  it('ignores unknown fields (allowlist)', () => {
    const r = validateMerchantUpdate({ role: 'admin', is_verified: true, evil: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.updateData).toEqual({});
  });
});
