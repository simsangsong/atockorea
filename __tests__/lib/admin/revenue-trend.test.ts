import { buildRevenueTrend } from '@/lib/admin/revenue-trend';

describe('buildRevenueTrend (dashboard §8.1)', () => {
  // 2026-06-25 03:00 UTC = 2026-06-25 12:00 KST
  const now = new Date('2026-06-25T03:00:00Z');

  it('emits a dense series of `days` points ending on the KST today', () => {
    const series = buildRevenueTrend([], now, 7);
    expect(series).toHaveLength(7);
    expect(series.map((p) => p.date)).toEqual([
      '2026-06-19',
      '2026-06-20',
      '2026-06-21',
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
    ]);
    expect(series.every((p) => p.usd === 0 && p.krw === 0)).toBe(true);
  });

  it('buckets paid rows into the right KST day and keeps currencies separate', () => {
    const series = buildRevenueTrend(
      [
        { created_at: '2026-06-25T01:00:00Z', final_price: 300, currency: 'usd' },
        { created_at: '2026-06-25T02:00:00Z', final_price: '60', currency: 'usd' },
        { created_at: '2026-06-24T05:00:00Z', final_price: 150000, currency: 'krw' },
      ],
      now,
      7,
    );
    const today = series.find((p) => p.date === '2026-06-25')!;
    const yday = series.find((p) => p.date === '2026-06-24')!;
    expect(today.usd).toBe(360);
    expect(today.krw).toBe(0);
    expect(yday.krw).toBe(150000);
    expect(yday.usd).toBe(0);
  });

  it('rolls a UTC-evening booking into the next KST day (the off-by-one window)', () => {
    // 2026-06-24 16:00 UTC = 2026-06-25 01:00 KST -> counts as the 25th
    const series = buildRevenueTrend(
      [{ created_at: '2026-06-24T16:00:00Z', final_price: 100, currency: 'usd' }],
      now,
      7,
    );
    expect(series.find((p) => p.date === '2026-06-25')!.usd).toBe(100);
    expect(series.find((p) => p.date === '2026-06-24')!.usd).toBe(0);
  });

  it('ignores rows outside the window and non-finite / null amounts', () => {
    const series = buildRevenueTrend(
      [
        { created_at: '2026-06-10T00:00:00Z', final_price: 999, currency: 'usd' }, // too old
        { created_at: '2026-06-25T00:00:00Z', final_price: null, currency: 'usd' },
        { created_at: null, final_price: 50, currency: 'usd' },
        { created_at: '2026-06-25T00:00:00Z', final_price: 'NaN', currency: 'usd' },
      ],
      now,
      7,
    );
    expect(series.reduce((sum, p) => sum + p.usd + p.krw, 0)).toBe(0);
  });
});
