import {
  extractEmailFromVerifiedToken,
  statesMatch,
  LINE_VERIFY_ENDPOINT,
  LINE_OAUTH_STATE_COOKIE,
} from '@/lib/line-auth';

describe('extractEmailFromVerifiedToken (N18)', () => {
  const CHANNEL = '1234567890';

  it('returns the (lowercased, trimmed) email when the audience matches', () => {
    expect(
      extractEmailFromVerifiedToken({ aud: CHANNEL, email: '  User@Example.COM ' }, CHANNEL),
    ).toBe('user@example.com');
  });

  it('returns null when the audience does not match our channel (forged/foreign token)', () => {
    expect(
      extractEmailFromVerifiedToken({ aud: 'other-channel', email: 'user@example.com' }, CHANNEL),
    ).toBeNull();
  });

  it('returns null when there is no email to trust', () => {
    expect(extractEmailFromVerifiedToken({ aud: CHANNEL }, CHANNEL)).toBeNull();
    expect(extractEmailFromVerifiedToken({ aud: CHANNEL, email: '   ' }, CHANNEL)).toBeNull();
  });

  it('returns null for missing payload or missing channel id', () => {
    expect(extractEmailFromVerifiedToken(null, CHANNEL)).toBeNull();
    expect(extractEmailFromVerifiedToken(undefined, CHANNEL)).toBeNull();
    expect(extractEmailFromVerifiedToken({ aud: CHANNEL, email: 'a@b.com' }, undefined)).toBeNull();
  });
});

describe('statesMatch (N18 CSRF)', () => {
  it('matches identical non-empty states', () => {
    expect(statesMatch('abc123', 'abc123')).toBe(true);
  });

  it('rejects mismatched states', () => {
    expect(statesMatch('abc123', 'abc124')).toBe(false);
    expect(statesMatch('abc123', 'abc1234')).toBe(false);
  });

  it('rejects when either side is missing/empty (no state on the request)', () => {
    expect(statesMatch('', 'abc')).toBe(false);
    expect(statesMatch('abc', '')).toBe(false);
    expect(statesMatch(null, 'abc')).toBe(false);
    expect(statesMatch('abc', undefined)).toBe(false);
    expect(statesMatch(undefined, null)).toBe(false);
  });
});

describe('constants', () => {
  it('point at LINE endpoints / cookie names', () => {
    expect(LINE_VERIFY_ENDPOINT).toBe('https://api.line.me/oauth2/v2.1/verify');
    expect(LINE_OAUTH_STATE_COOKIE).toBe('line_oauth_state');
  });
});
