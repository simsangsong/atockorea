'use client';

import { useTranslations } from '@/lib/i18n';
import { useMemo } from 'react';

export default function HeroTrustBar() {
  const t = useTranslations();

  const items = useMemo(
    () => [
      {
        icon: (
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ),
        titleKey: 'home.heroTrustBar.happyTravelersTitle' as const,
        descKey: 'home.heroTrustBar.happyTravelersDesc' as const,
      },
      {
        icon: (
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        titleKey: 'home.heroTrustBar.hotelPickupTitle' as const,
        descKey: 'home.heroTrustBar.hotelPickupDesc' as const,
      },
      {
        icon: (
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        ),
        titleKey: 'home.heroTrustBar.securePaymentTitle' as const,
        descKey: 'home.heroTrustBar.securePaymentDesc' as const,
      },
      {
        icon: (
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        titleKey: 'home.heroTrustBar.localGuidesTitle' as const,
        descKey: 'home.heroTrustBar.localGuidesDesc' as const,
      },
    ],
    []
  );

  return (
    <section className="py-4 sm:py-6 bg-transparent" aria-label="Why book with us">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center sm:items-start sm:text-left p-4 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200/40 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${index === 0 ? 'bg-amber-50 text-amber-500' : 'bg-gray-100 text-gray-700'}`}>
                {item.icon}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {t(item.titleKey)}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {t(item.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
