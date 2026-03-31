'use client';

import { useTranslations } from '@/lib/i18n';

export default function HeroPaymentStrip() {
  const t = useTranslations();

  return (
    <section className="py-4 sm:py-5 bg-slate-50" aria-labelledby="hero-payment-title">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 flex justify-center">
        <div className="w-full max-w-3xl">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-6 py-4 sm:py-5 shadow-sm sm:shadow-md flex flex-col items-center gap-3 sm:gap-4">
            <p
              id="hero-payment-title"
              className="text-xs sm:text-sm md:text-base font-medium text-slate-800 text-center leading-snug"
            >
              {t('home.payment.highlightBenefit')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 border border-orange-200/60 px-2.5 py-1.5 text-xs font-bold text-orange-800">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                {t('home.payment.fullAmount')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
