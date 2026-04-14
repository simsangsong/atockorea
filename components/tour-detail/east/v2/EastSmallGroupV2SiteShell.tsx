'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EastSmallGroupTourV2Page from '@/components/tour-detail/east/v2/EastSmallGroupTourV2Page';

export type EastSmallGroupV2SiteShellVariant = 'preview' | 'product';

type Props = {
  variant?: EastSmallGroupV2SiteShellVariant;
};

/**
 * Shared chrome for v0 East detail (static placeholders): site Header/Footer + v2 body.
 * Preview variant includes the amber strip and scroll offsets tuned for that strip.
 * Product variant matches preview body wiring without the strip (header-only offsets).
 */
export default function EastSmallGroupV2SiteShell({ variant = 'product' }: Props) {
  const isPreview = variant === 'preview';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-slate-900">
      <Header premiumTourDetail />
      {isPreview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] font-medium text-amber-950">
          Preview only — no tour data (placeholders). Live product:{' '}
          <code className="rounded bg-amber-100/80 px-1">/tour-product/east-signature-nature-core</code>
          .
        </div>
      ) : null}
      <main className="bg-transparent pt-0">
        <EastSmallGroupTourV2Page
          stickySubnavTopClass={
            isPreview ? 'top-[5.5rem] sm:top-[5.75rem] md:top-[6rem]' : undefined
          }
          scrollToSectionOffsetPx={isPreview ? 120 : undefined}
          scrollSpyViewportOffsetPx={isPreview ? 220 : undefined}
        />
      </main>
      <Footer premiumHandoff />
    </div>
  );
}
