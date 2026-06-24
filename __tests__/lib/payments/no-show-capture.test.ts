import { noShowCaptureAmount } from '@/lib/payments/no-show-capture';

describe('noShowCaptureAmount (B-1)', () => {
  it('golden: $300 hold, $60 no-show fee → captures $60 (6000 cents)', () => {
    expect(
      noShowCaptureAmount({
        reason: 'no_show',
        holdCurrency: 'usd',
        noShowFeeUsdCents: 6000,
        authorizedAmountMinor: 30000,
      }),
    ).toBe(6000);
  });

  it('no-op for current data where fee == full hold (USD)', () => {
    expect(
      noShowCaptureAmount({
        reason: 'no_show',
        holdCurrency: 'usd',
        noShowFeeUsdCents: 30000,
        authorizedAmountMinor: 30000,
      }),
    ).toBe(30000);
  });

  it('clamps a fee larger than the authorization to the authorized amount', () => {
    expect(
      noShowCaptureAmount({
        reason: 'no_show',
        holdCurrency: 'usd',
        noShowFeeUsdCents: 99999,
        authorizedAmountMinor: 30000,
      }),
    ).toBe(30000);
  });

  it('tour_completed → undefined (full capture)', () => {
    expect(
      noShowCaptureAmount({
        reason: 'tour_completed',
        holdCurrency: 'usd',
        noShowFeeUsdCents: 6000,
        authorizedAmountMinor: 30000,
      }),
    ).toBeUndefined();
  });

  it('KRW no-show → undefined (no USD-cents fee snapshot; full capture)', () => {
    expect(
      noShowCaptureAmount({
        reason: 'no_show',
        holdCurrency: 'krw',
        noShowFeeUsdCents: null,
        authorizedAmountMinor: 300000,
      }),
    ).toBeUndefined();
  });

  it('USD no-show with null/zero/invalid fee → undefined (full capture)', () => {
    for (const fee of [null, undefined, 0, -100, 12.5, NaN]) {
      expect(
        noShowCaptureAmount({
          reason: 'no_show',
          holdCurrency: 'usd',
          noShowFeeUsdCents: fee as number | null | undefined,
          authorizedAmountMinor: 30000,
        }),
      ).toBeUndefined();
    }
  });

  it('uppercase currency is handled case-insensitively', () => {
    expect(
      noShowCaptureAmount({
        reason: 'no_show',
        holdCurrency: 'USD',
        noShowFeeUsdCents: 6000,
        authorizedAmountMinor: 30000,
      }),
    ).toBe(6000);
  });
});
