'use client';

import { useTranslations } from '@/lib/i18n';

export default function HeroPaymentStrip() {
  const t = useTranslations();

  return (
    <section className="py-2 sm:py-2.5 bg-transparent" aria-labelledby="hero-payment-title">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 flex justify-center">
        <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 rounded-lg bg-white/70 backdrop-blur-sm border border-gray-200/50 px-3 py-2 sm:px-4 sm:py-2 shadow-sm max-w-2xl">
          <p id="hero-payment-title" className="text-xs sm:text-sm text-gray-700 text-center sm:text-left font-medium shrink-0">
            {t('home.payment.highlightBenefit')}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200/50 px-2 py-1 text-xs font-semibold text-blue-800">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('home.payment.depositCash')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 border border-orange-200/50 px-2 py-1 text-xs font-semibold text-orange-800">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {t('home.payment.fullAmount')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
