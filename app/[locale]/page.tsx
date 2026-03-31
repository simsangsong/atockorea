'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroPremium from '@/src/components/home/HeroPremium';
import ProductCardsPremium from '@/src/components/home/ProductCardsPremium';
import SmallGroupValuePremium from '@/src/components/home/SmallGroupValuePremium';
import HowItWorksPremium from '@/src/components/home/HowItWorksPremium';
import TrustAndReviewsSection from '@/src/components/home/TrustAndReviewsSection';
import ClassicBusSection from '@/components/ClassicBusSection';
import FinalCtaPremium from '@/src/components/home/FinalCtaPremium';
import { LocaleHomeClient } from '@/components/LocaleHomeClient';

const SUPPORTED_LOCALE_ROUTES = ['ko', 'zh-CN', 'zh-TW', 'ja', 'es'];

/** URL locale segment -> i18n Locale (zh-CN -> zh, zh-TW stays zh-TW) */
function toI18nLocale(segment: string): 'ko' | 'zh' | 'zh-TW' | 'ja' | 'es' {
  if (segment === 'zh-CN') return 'zh';
  if (segment === 'zh-TW') return 'zh-TW';
  return segment as 'ko' | 'zh' | 'ja' | 'es';
}

export default function LocaleHomePage() {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale as string | undefined;

  if (!locale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (locale === 'en') {
    router.replace('/');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Redirecting...</p>
      </div>
    );
  }

  if (!SUPPORTED_LOCALE_ROUTES.includes(locale)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Locale not found</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const i18nLocale = toI18nLocale(locale);

  return (
    <LocaleHomeClient locale={i18nLocale}>
      <div className="relative min-h-screen overflow-x-hidden bg-transparent text-slate-900 selection:bg-blue-100">
        <div className="relative z-10">
          <Header />
          <main className="bg-transparent">
            <HeroPremium />
            <ProductCardsPremium />
            <SmallGroupValuePremium />
            <HowItWorksPremium />
            <TrustAndReviewsSection />
            <ClassicBusSection />
            <FinalCtaPremium />
          </main>
          <Footer />
          <BottomNav />
          <div className="h-16 md:hidden" aria-hidden />
        </div>
      </div>
    </LocaleHomeClient>
  );
}
