/**
 * 개인 토큰 클라이언트 저장·인식 검증 — AtoC 통합 플랜 §5.2 C-4.
 */
import {
  decodeTokenBody,
  findRecognizedToken,
  readStoredPersonalTokens,
  storePersonalToken,
  PERSONAL_TOKENS_KEY,
} from '@/lib/ops/seating/personalTokens';

function mkToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.deadbeef`;
}

const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 3600;

beforeEach(() => {
  window.localStorage.clear();
});

describe('decodeTokenBody', () => {
  it('decodes the base64url payload without verifying the signature', () => {
    const token = mkToken({ scope: 'booking', bookingId: 'b1', displayName: 'Massimo', exp: future });
    expect(decodeTokenBody(token)).toMatchObject({ scope: 'booking', bookingId: 'b1', displayName: 'Massimo' });
  });
  it('returns null for malformed tokens', () => {
    expect(decodeTokenBody(null)).toBeNull();
    expect(decodeTokenBody('nodot')).toBeNull();
    expect(decodeTokenBody('!!!.sig')).toBeNull();
  });
});

describe('storePersonalToken / readStoredPersonalTokens', () => {
  it('prepends newest-first and de-dupes, capped at 10', () => {
    storePersonalToken('a');
    storePersonalToken('b');
    storePersonalToken('a'); // move to front, no dup
    expect(readStoredPersonalTokens()).toEqual(['a', 'b']);
    expect(JSON.parse(window.localStorage.getItem(PERSONAL_TOKENS_KEY)!)).toEqual(['a', 'b']);
  });
});

describe('findRecognizedToken (C-4)', () => {
  it('matches a stored token whose booking is on this room roster and not expired', () => {
    const good = mkToken({ scope: 'booking', bookingId: 'b2', displayName: 'Sofia', exp: future });
    const expired = mkToken({ scope: 'booking', bookingId: 'b1', exp: past });
    const found = findRecognizedToken(['b1', 'b2'], [expired, good]);
    expect(found).toMatchObject({ bookingId: 'b2', displayName: 'Sofia', token: good });
  });
  it('returns null when no stored token is on the roster', () => {
    const other = mkToken({ scope: 'booking', bookingId: 'zzz', exp: future });
    expect(findRecognizedToken(['b1', 'b2'], [other])).toBeNull();
  });
});
