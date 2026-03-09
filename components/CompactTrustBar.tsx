'use client';

import { useTranslations } from '@/lib/i18n';

type IconType = 'star' | 'hotel' | 'card' | 'pin' | 'badge' | 'people' | 'currency' | 'chart';

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

export default function CompactTrustBar() {
  const t = useTranslations();

  return (
    <section className="py-3 sm:py-4 border-b border-gray-100/80 bg-white/70 backdrop-blur-sm" aria-label="Why book with us">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-3 items-center justify-items-center sm:justify-items-start">
          {ITEMS.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-gray-700 min-w-0">
              {item.icon === 'star' && (
                <span className="flex-shrink-0 w-5 h-5 text-amber-500" aria-hidden>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </span>
              )}
              {item.icon === 'hotel' && (
                <span className="flex-shrink-0 w-5 h-5 text-gray-600" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </span>
              )}
              {item.icon === 'card' && (
                <span className="flex-shrink-0 w-5 h-5 text-gray-600" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </span>
              )}
              {item.icon === 'pin' && (
                <span className="flex-shrink-0 w-5 h-5 text-gray-600" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </span>
              )}
              {item.icon === 'badge' && (
                <span className="flex-shrink-0 w-5 h-5 text-indigo-600" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0112 2.25c-2.717 0-5.216.568-7.499 1.632m-1.153 9.19c-1.06 0-1.915.873-1.915 1.945v10.361c0 1.071.855 1.945 1.915 1.945h14.17c1.06 0 1.915-.874 1.915-1.945V11.832c0-1.072-.855-1.945-1.915-1.945H4.5z" /></svg>
                </span>
              )}
              {item.icon === 'people' && (
                <span className="flex-shrink-0 w-5 h-5 text-gray-600" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" /></svg>
                </span>
              )}
              {item.icon === 'currency' && (
                <span className="flex-shrink-0 w-5 h-5 text-gray-600" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
              )}
              {item.icon === 'chart' && (
                <span className="flex-shrink-0 w-5 h-5 text-gray-600" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                </span>
              )}
              <span className="text-xs sm:text-sm font-medium truncate">{t(item.titleKey)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
