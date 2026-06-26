import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import FloatingLanguageToggle from '@/components/FloatingLanguageToggle';
import { HomeMainBody } from '@/components/home/HomeMainBody';
import { LocaleHomeClient } from '@/components/LocaleHomeClient';

const SUPPORTED_LOCALE_ROUTES = ['ko', 'zh-CN', 'zh-TW', 'ja', 'es'];

/** URL locale segment -> i18n Locale (zh-CN -> zh, zh-TW stays zh-TW) */
function toI18nLocale(segment: string): 'ko' | 'zh' | 'zh-TW' | 'ja' | 'es' {
  if (segment === 'zh-CN') return 'zh';
  if (segment === 'zh-TW') return 'zh-TW';
  return segment as 'ko' | 'zh' | 'ja' | 'es';
}

/**
 * A1: this page was `'use client'`, so /ko /ja /zh-CN /zh-TW /es each shipped the
 * whole page module — plus its locale validation — as client JS. It's now a
 * server component: validation runs on the server and the only client boundary
 * is the thin LocaleHomeClient that syncs the i18n locale. Header, HomeMainBody,
 * Footer, etc. stay client components and hydrate at their own boundaries exactly
 * as before. The `/en → /` redirect now lives in middleware (a routing concern),
 * so `en` never reaches here; a stray one falls through to notFound().
 */
export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!SUPPORTED_LOCALE_ROUTES.includes(locale)) notFound();

  const i18nLocale = toI18nLocale(locale);

  return (
    <LocaleHomeClient locale={i18nLocale}>
      <div className="relative min-h-screen overflow-x-hidden bg-transparent text-slate-900 selection:bg-blue-100">
        <div className="relative z-10">
          <Header />
          <main className="bg-transparent">
            <HomeMainBody />
          </main>
          <Footer />
          <BottomNav />
          <div className="h-16 md:hidden" aria-hidden />
          <FloatingLanguageToggle />
        </div>
      </div>
    </LocaleHomeClient>
  );
}
