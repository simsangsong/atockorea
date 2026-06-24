import { normalizeEmail, verifyCheckoutOwnership } from '@/lib/checkout-auth';

describe('normalizeEmail', () => {
  it('trims and lowercases strings', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('returns empty string for non-strings / blanks', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(123)).toBe('');
    expect(normalizeEmail('   ')).toBe('');
  });
});

describe('verifyCheckoutOwnership (N14)', () => {
  const CONTACT = 'guest@example.com';
  const USER = 'member@example.com';

  it('accepts a supplied email matching contact_email (guest flow)', () => {
    expect(verifyCheckoutOwnership(CONTACT, [CONTACT])).toEqual({ ok: true });
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(verifyCheckoutOwnership('  Guest@Example.com  ', [CONTACT])).toEqual({ ok: true });
  });

  it('accepts a match against the owning user email fallback', () => {
    // contact_email absent → only the user auth email is acceptable
    expect(verifyCheckoutOwnership(USER, [null, USER])).toEqual({ ok: true });
  });

  it("rejects a supplied email that doesn't match any owner email (IDOR regression)", () => {
    expect(verifyCheckoutOwnership('attacker@evil.com', [CONTACT])).toEqual({
      ok: false,
      reason: 'mismatch',
    });
  });

  it('rejects when the caller supplies no email', () => {
    expect(verifyCheckoutOwnership(undefined, [CONTACT])).toEqual({
      ok: false,
      reason: 'missing_email',
    });
    expect(verifyCheckoutOwnership('', [CONTACT])).toEqual({
      ok: false,
      reason: 'missing_email',
    });
  });

  it('rejects when the booking exposes no owner email to verify against', () => {
    expect(verifyCheckoutOwnership(CONTACT, [])).toEqual({
      ok: false,
      reason: 'no_owner_reference',
    });
    expect(verifyCheckoutOwnership(CONTACT, [null, undefined, '  '])).toEqual({
      ok: false,
      reason: 'no_owner_reference',
    });
  });

  it('does not let a blank supplied email pass even when an owner email is blank', () => {
    // both blank — must not be treated as a match
    expect(verifyCheckoutOwnership('', [''])).toEqual({ ok: false, reason: 'missing_email' });
  });
});
