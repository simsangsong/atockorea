/**
 * @jest-environment node
 *
 * §5.2 C-1/C-2 — 이름 마스킹 + 확인 질문 검증 순수 로직.
 */
import { maskGuestName, verifyClaimAnswer } from '@/lib/ops/seating/claim';

describe('maskGuestName (C-1 PII 최소화)', () => {
  it('masks family names to initials', () => {
    expect(maskGuestName('Massimo Colombo')).toBe('Massimo C.');
    expect(maskGuestName('Tanaka Yuki Aoi')).toBe('Tanaka Y. A.');
    expect(maskGuestName('  jose   garcia ')).toBe('jose G.');
  });

  it('keeps single-word names and falls back to Guest', () => {
    expect(maskGuestName('Cher')).toBe('Cher');
    expect(maskGuestName('')).toBe('Guest');
    expect(maskGuestName(null)).toBe('Guest');
    expect(maskGuestName(undefined)).toBe('Guest');
  });
});

describe('verifyClaimAnswer (C-2 확인 질문)', () => {
  const booking = { contact_name: 'Massimo Colombo', contact_email: 'M.Colombo88@Gmail.com', number_of_guests: 3 };

  it('accepts an email tail match (case-insensitive, local part or full address)', () => {
    expect(verifyClaimAnswer(booking, { emailTail: 'bo88' })).toBe(true);
    expect(verifyClaimAnswer(booking, { emailTail: 'colombo88' })).toBe(true);
    expect(verifyClaimAnswer(booking, { emailTail: 'GMAIL.COM' })).toBe(true);
  });

  it('rejects short or wrong email tails', () => {
    expect(verifyClaimAnswer(booking, { emailTail: '88' })).toBe(false); // 3자 미만
    expect(verifyClaimAnswer(booking, { emailTail: 'rossi' })).toBe(false);
  });

  it('accepts an exact party-size match only', () => {
    expect(verifyClaimAnswer(booking, { partySize: 3 })).toBe(true);
    expect(verifyClaimAnswer(booking, { partySize: 2 })).toBe(false);
    expect(verifyClaimAnswer(booking, { partySize: 0 })).toBe(false);
  });

  it('fails closed with no answer or missing booking data', () => {
    expect(verifyClaimAnswer(booking, {})).toBe(false);
    expect(verifyClaimAnswer(booking, null)).toBe(false);
    expect(verifyClaimAnswer({ contact_name: null, contact_email: null, number_of_guests: null }, { emailTail: 'abc', partySize: 1 })).toBe(false);
  });
});
