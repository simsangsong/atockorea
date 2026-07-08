import {
  computeCouponDiscount,
  majorToMinor,
  roundMajor,
} from '@/lib/coupons/discount';

const WELCOME10 = {
  discountType: 'percentage',
  discountValue: 10,
  maxDiscountAmount: null,
  minPurchaseAmount: 0,
};

describe('roundMajor / majorToMinor (currency rounding)', () => {
  it('USD rounds to cents; KRW rounds to whole won', () => {
    expect(roundMajor(123.456, 'usd')).toBe(123.46);
    expect(roundMajor(123.456, 'krw')).toBe(123);
  });

  it('USD minor = cents ×100; KRW minor = whole won ×1 (zero-decimal)', () => {
    expect(majorToMinor(120, 'usd')).toBe(12000);
    expect(majorToMinor(340000, 'krw')).toBe(340000);
  });
});

describe('computeCouponDiscount — WELCOME10 percentage', () => {
  it('USD: 10% off $120 → $12 off, $108 final, cents exact', () => {
    const b = computeCouponDiscount({ subtotalMajor: 120, currency: 'usd', coupon: WELCOME10 });
    expect(b).toEqual({
      currency: 'usd',
      subtotalMajor: 120,
      discountMajor: 12,
      finalMajor: 108,
      subtotalMinor: 12000,
      discountMinor: 1200,
      finalMinor: 10800,
    });
  });

  it('USD: cent rounding on odd subtotals ($99.99 → $10.00 off)', () => {
    const b = computeCouponDiscount({ subtotalMajor: 99.99, currency: 'usd', coupon: WELCOME10 });
    expect(b!.discountMajor).toBe(10); // 9.999 → 10.00
    expect(b!.finalMajor).toBe(89.99);
    expect(b!.discountMinor + b!.finalMinor).toBe(b!.subtotalMinor);
  });

  it('KRW: 10% off ₩735,000 → ₩73,500 off, whole-won integers (no ×100)', () => {
    const b = computeCouponDiscount({
      subtotalMajor: 735000,
      currency: 'krw',
      coupon: WELCOME10,
    });
    expect(b).toEqual({
      currency: 'krw',
      subtotalMajor: 735000,
      discountMajor: 73500,
      finalMajor: 661500,
      subtotalMinor: 735000,
      discountMinor: 73500,
      finalMinor: 661500,
    });
  });

  it('KRW: fractional 10% rounds to whole won (₩123,455 → ₩12,346 off)', () => {
    const b = computeCouponDiscount({
      subtotalMajor: 123455,
      currency: 'krw',
      coupon: WELCOME10,
    });
    expect(b!.discountMajor).toBe(12346); // 12345.5 rounds up
    expect(Number.isInteger(b!.discountMajor)).toBe(true);
    expect(Number.isInteger(b!.finalMajor)).toBe(true);
  });
});

describe('computeCouponDiscount — guardrails', () => {
  it('rejects non-positive subtotal', () => {
    expect(computeCouponDiscount({ subtotalMajor: 0, currency: 'usd', coupon: WELCOME10 })).toBeNull();
    expect(computeCouponDiscount({ subtotalMajor: -5, currency: 'usd', coupon: WELCOME10 })).toBeNull();
  });

  it('enforces min_purchase_amount on USD only', () => {
    const coupon = { ...WELCOME10, minPurchaseAmount: 100 };
    expect(computeCouponDiscount({ subtotalMajor: 50, currency: 'usd', coupon })).toBeNull();
    expect(computeCouponDiscount({ subtotalMajor: 150, currency: 'usd', coupon })).not.toBeNull();
    // KRW skips the dollar-denominated min (₩50 ≪ $100 but still applies)
    expect(computeCouponDiscount({ subtotalMajor: 50000, currency: 'krw', coupon })).not.toBeNull();
  });

  it('caps by max_discount_amount on USD', () => {
    const coupon = { ...WELCOME10, maxDiscountAmount: 5 };
    const b = computeCouponDiscount({ subtotalMajor: 120, currency: 'usd', coupon });
    expect(b!.discountMajor).toBe(5);
    expect(b!.finalMajor).toBe(115);
  });

  it('fixed_amount applies to USD, is refused on KRW (dollar-denominated legacy column)', () => {
    const coupon = { discountType: 'fixed_amount', discountValue: 15 };
    const usd = computeCouponDiscount({ subtotalMajor: 120, currency: 'usd', coupon });
    expect(usd!.discountMajor).toBe(15);
    expect(computeCouponDiscount({ subtotalMajor: 120000, currency: 'krw', coupon })).toBeNull();
  });

  it('refuses a discount that zeroes the price (Stripe cannot hold 0)', () => {
    const coupon = { discountType: 'fixed_amount', discountValue: 120 };
    expect(computeCouponDiscount({ subtotalMajor: 120, currency: 'usd', coupon })).toBeNull();
    const pct100 = { discountType: 'percentage', discountValue: 100 };
    expect(computeCouponDiscount({ subtotalMajor: 120, currency: 'usd', coupon: pct100 })).toBeNull();
  });

  it('refuses unknown discount types and out-of-range percentages', () => {
    expect(
      computeCouponDiscount({
        subtotalMajor: 120,
        currency: 'usd',
        coupon: { discountType: 'bogus', discountValue: 10 },
      }),
    ).toBeNull();
    expect(
      computeCouponDiscount({
        subtotalMajor: 120,
        currency: 'usd',
        coupon: { discountType: 'percentage', discountValue: 101 },
      }),
    ).toBeNull();
    expect(
      computeCouponDiscount({
        subtotalMajor: 120,
        currency: 'usd',
        coupon: { discountType: 'percentage', discountValue: 0 },
      }),
    ).toBeNull();
  });

  it('minor units always reconcile: discount + final = subtotal', () => {
    for (const subtotal of [37.13, 89.99, 250, 1234.56]) {
      const b = computeCouponDiscount({ subtotalMajor: subtotal, currency: 'usd', coupon: WELCOME10 });
      expect(b!.discountMinor + b!.finalMinor).toBe(b!.subtotalMinor);
    }
    for (const subtotal of [123455, 735000, 990001]) {
      const b = computeCouponDiscount({ subtotalMajor: subtotal, currency: 'krw', coupon: WELCOME10 });
      expect(b!.discountMinor + b!.finalMinor).toBe(b!.subtotalMinor);
    }
  });
});
