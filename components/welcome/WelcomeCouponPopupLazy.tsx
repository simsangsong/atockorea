'use client';

/**
 * Lazy mount for the welcome-coupon popup — keeps the Stripe-free marketing
 * popup (and its Base UI dialog/sheet chunk) out of the initial bundle. Same
 * pattern as `components/home/v2/MatcherBottomSheetLazy.tsx`.
 */
import dynamic from 'next/dynamic';

const WelcomeCouponPopup = dynamic(() => import('./WelcomeCouponPopup'), {
  ssr: false,
});

export default function WelcomeCouponPopupLazy() {
  return <WelcomeCouponPopup />;
}
