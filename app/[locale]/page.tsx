import { notFound, redirect } from 'next/navigation';
import { LocaleHomeClient } from '@/components/LocaleHomeClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/HeroSection';
import DestinationsCards from '@/components/DestinationsCards';
import TourList from '@/components/TourList';
import PaymentMethodInfo from '@/components/PaymentMethodInfo';
import TrustBar from '@/components/TrustBar';

const LOCALE_ROUTE_TO_I18N: Record<string, 'ko' | 'zh' | 'ja' | 'es'> = {
  ko: 'ko',
  'zh-CN': 'zh',
  ja: 'ja',
  es: 'es',
};

const SUPPORTED_LOCALE_ROUTES = ['ko', 'zh-CN', 'ja', 'es'];

type Props = { params: { locale: string } };

export const dynamic = 'force-dynamic';

export default function LocaleHomePage({ params }: Props) {
  const { locale } = params;

  if (locale === 'en') {
    redirect('/');
  }
  if (!SUPPORTED_LOCALE_ROUTES.includes(locale)) {
    notFound();
  }

  const i18nLocale = LOCALE_ROUTE_TO_I18N[locale];

  return (
    <LocaleHomeClient locale={i18nLocale}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
        <Header />
        <main>
          <HeroSection />
          <DestinationsCards />
          <TourList />
          <PaymentMethodInfo />
          <TrustBar />
        </main>
        <Footer />
        <BottomNav />
        <div className="h-16 md:hidden" />
      </div>
    </LocaleHomeClient>
  );
}
