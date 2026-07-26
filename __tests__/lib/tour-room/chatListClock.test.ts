/**
 * C-D7 — chat-list timestamps (KakaoTalk grammar): today → KST HH:MM,
 * older → M/D, garbage → ''.
 */
import { chatListClock } from '@/lib/tour-room/time';

describe('chatListClock', () => {
  // 2026-07-27 14:30 KST == 2026-07-27T05:30:00Z
  const now = Date.parse('2026-07-27T05:30:00Z');

  it('shows a KST wall clock for same-KST-day messages', () => {
    expect(chatListClock('2026-07-27T01:05:00Z', now)).toBe('10:05');
    // 23:59 KST the same day (14:59Z)
    expect(chatListClock('2026-07-27T14:59:00Z', now)).toBe('23:59');
  });

  it('rolls to M/D across the KST midnight, not UTC midnight', () => {
    // 2026-07-26 23:00 KST == 2026-07-26T14:00:00Z → previous KST day
    expect(chatListClock('2026-07-26T14:00:00Z', now)).toBe('7/26');
    // 2026-07-27 00:30 KST == 2026-07-26T15:30:00Z → SAME KST day (UTC says 26th)
    expect(chatListClock('2026-07-26T15:30:00Z', now)).toBe('00:30');
  });

  it('returns empty string for missing or malformed input', () => {
    expect(chatListClock(undefined, now)).toBe('');
    expect(chatListClock(null, now)).toBe('');
    expect(chatListClock('not-a-date', now)).toBe('');
  });
});
