'use client';

import { useTranslations } from '@/lib/i18n';

type IconType = 'star' | 'hotel' | 'card' | 'pin' | 'badge' | 'people' | 'currency' | 'chart';

/** Two items per box: icon + text each → 4 boxes total. Flat list for even grid. */
const ITEMS: Array<{ icon: IconType; titleKey: string }> = [
  { icon: 'star', titleKey: 'home.heroTrustBar.happyTravelersTitle' },
  { icon: 'hotel', titleKey: 'home.heroTrustBar.hotelPickupTitle' },
  { icon: 'card', titleKey: 'home.heroTrustBar.securePaymentTitle' },
  { icon: 'pin', titleKey: 'home.heroTrustBar.localGuidesTitle' },
  { icon: 'badge', titleKey: 'trustBar.licensedAgencies' },
  { icon: 'people', titleKey: 'trustBar.certifiedGuides' },
  { icon: 'currency', titleKey: 'trustBar.lowerPrices' },
  { icon: 'chart', titleKey: 'trustBar.localExpertise' },
];

function Icon({ type }: { type: IconType }) {
  const base = 'flex-shrink-0 w-6 h-6';
  if (type === 'star') return <svg className={`${base} text-amber-500`} fill="currentColor" viewBox="0 0 20 20" aria-hidden><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
  if (type === 'hotel') return <svg className={`${base} text-slate-600`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
  if (type === 'card') return <svg className={`${base} text-slate-600`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
  if (type === 'pin') return <svg className={`${base} text-slate-600`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
  if (type === 'badge') return <svg className={`${base} text-indigo-600`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a2 2 0 00-2-2h-2M6 5V7a2 2 0 00-2 2v2" /></svg>;
  if (type === 'people') return <svg className={`${base} text-slate-600`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
  if (type === 'currency') return <svg className={`${base} text-slate-600`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8M12 18V6" /></svg>;
  if (type === 'chart') return <svg className={`${base} text-slate-600`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
  return null;
}

export default function CompactTrustBar() {
  const t = useTranslations();

  return (
    <section className="py-2.5 sm:py-5 border-b border-gray-100 bg-slate-50/50" aria-label="Why book with us">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((boxIndex) => (
            <div
              key={boxIndex}
              className="rounded-xl border border-gray-200/80 bg-white p-3 sm:p-4 shadow-sm hover:shadow-md hover:border-gray-300/80 transition-all duration-200"
            >
              <div className="flex flex-col gap-3">
                {ITEMS.slice(boxIndex * 2, boxIndex * 2 + 2).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 min-h-[1.75rem]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                      <Icon type={item.icon} />
                    </div>
                    <p className="text-[11px] sm:text-sm font-bold text-gray-800 leading-snug flex-1 min-w-0">
                      {t(item.titleKey)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
