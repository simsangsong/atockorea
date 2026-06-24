import { kstDayBounds } from '@/lib/admin/kst-day';

describe('kstDayBounds (W3.2 / M-6)', () => {
  it('rolls into the next KST day during the UTC evening (the bug window)', () => {
    // 2026-06-24 16:00 UTC = 2026-06-25 01:00 KST
    const { date, startIso, endIso } = kstDayBounds(new Date('2026-06-24T16:00:00Z'));
    expect(date).toBe('2026-06-25');
    expect(startIso).toBe('2026-06-25T00:00:00+09:00');
    expect(endIso).toBe('2026-06-25T23:59:59.999+09:00');
  });

  it('matches the UTC date during KST daytime', () => {
    // 2026-06-25 03:00 UTC = 2026-06-25 12:00 KST
    expect(kstDayBounds(new Date('2026-06-25T03:00:00Z')).date).toBe('2026-06-25');
  });

  it('stays on the previous KST day just before KST midnight', () => {
    // 2026-06-25 14:59 UTC = 2026-06-25 23:59 KST (still the 25th)
    expect(kstDayBounds(new Date('2026-06-25T14:59:00Z')).date).toBe('2026-06-25');
    // 2026-06-25 15:00 UTC = 2026-06-26 00:00 KST (flips to the 26th)
    expect(kstDayBounds(new Date('2026-06-25T15:00:00Z')).date).toBe('2026-06-26');
  });

  it('the start instant precedes the end instant', () => {
    const { startIso, endIso } = kstDayBounds(new Date('2026-01-01T00:00:00Z'));
    expect(new Date(startIso).getTime()).toBeLessThan(new Date(endIso).getTime());
  });
});
