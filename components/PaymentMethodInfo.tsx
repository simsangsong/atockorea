"use client";

import { useTranslations } from "@/lib/i18n";

export default function PaymentMethodInfo() {
  const t = useTranslations();

  return (
    <section className="py-4 sm:py-6 bg-transparent" aria-labelledby="payment-section-title">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-gray-200/50 bg-white/90 backdrop-blur-sm p-3 sm:p-4 shadow-sm">
          <div className="text-center mb-3">
            <h2 id="payment-section-title" className="text-base sm:text-lg font-bold text-gray-900">
              {t("home.payment.title")}
            </h2>
            <p className="text-xs text-gray-600 mt-0.5 mb-2 leading-snug">
              {t("home.payment.highlightBenefit")}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-orange-50/80 border border-orange-200/40 p-2.5 sm:p-3">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t("home.payment.fullAmount")}</p>
              <p className="text-xs text-gray-600">{t("home.payment.fullAmountBenefit")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

