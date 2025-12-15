'use client';

import { useTranslations } from '@/lib/i18n';
import { useMemo } from 'react';

export default function TrustBar() {
  const t = useTranslations();
  
  const features = useMemo(() => [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0112 2.25c-2.717 0-5.216.568-7.499 1.632m-1.153 9.19c-1.06 0-1.915.873-1.915 1.945v10.361c0 1.071.855 1.945 1.915 1.945h14.17c1.06 0 1.915-.874 1.915-1.945V11.832c0-1.072-.855-1.945-1.915-1.945H4.5z" />
        </svg>
      ),
      title: t('trustBar.licensedAgencies'),
      description: t('trustBar.licensedAgenciesDesc'),
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      title: t('trustBar.certifiedGuides'),
      description: t('trustBar.certifiedGuidesDesc'),
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t('trustBar.lowerPrices'),
      description: t('trustBar.lowerPricesDesc'),
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      title: t('trustBar.localExpertise'),
      description: t('trustBar.localExpertiseDesc'),
    },
  ], [t]);

  return (
    <section className="py-6 sm:py-8 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Card Container */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/40 md:border-gray-200/30 p-4 sm:p-6 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1">
              {t('trustBar.title')}
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-600">
              {t('trustBar.subtitle')}
            </p>
          </div>
          
          {/* 2x2 Grid for all devices */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-3 sm:p-4 hover:from-gray-100 hover:to-gray-50 transition-all duration-300 border border-gray-200/40 hover:border-blue-200/50 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_1px_6px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.1),0_2px_10px_rgba(0,0,0,0.05)] transform hover:-translate-y-0.5"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-3 shadow-sm">
                    <div className="w-4 h-4 sm:w-5 sm:h-5">
                      {feature.icon}
                    </div>
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

