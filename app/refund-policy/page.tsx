'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function RefundPolicyPage() {
  const t = useTranslations();
  const date = new Date().toISOString().split('T')[0];

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{t('refund.title')}</h1>
          <p className="text-gray-600 mb-8">
            {t('refund.introPrefix')}{date}{t('refund.introSuffix')}
            <Link href="/terms" className="text-blue-600 hover:underline">{t('home.footer.terms')}</Link>
            {t('refund.introAfterTerms')}
            <Link href="/privacy" className="text-blue-600 hover:underline">{t('home.footer.privacy')}</Link>
            {t('refund.introAfter')}
          </p>

          <div className="space-y-10 text-gray-700">
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s1.title')}</h2>
              <p className="mb-2">{t('refund.s1.p1')}</p>
              <p className="mb-2">{t('refund.s1.p2')}</p>
              <p>{t('refund.s1.p3')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s2.title')}</h2>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>{t('refund.s2.booking')}</li>
                <li>{t('refund.s2.platform')}</li>
                <li>{t('refund.s2.tourProvider')}</li>
                <li>{t('refund.s2.platformFees')}</li>
                <li>{t('refund.s2.tourFees')}</li>
                <li>{t('refund.s2.totalPrice')}</li>
              </ul>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s3.title')}</h2>
              <p className="mb-2">{t('refund.s3.p1')}</p>
              <p className="mb-2">{t('refund.s3.p2')}</p>
              <p>{t('refund.s3.p3')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s4.title')}</h2>
              <p className="mb-2">{t('refund.s4.p1')}</p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-2">
                <li>{t('refund.s4.li1')}</li>
                <li>{t('refund.s4.li2')}</li>
                <li>{t('refund.s4.li3')}</li>
                <li>{t('refund.s4.li4')}</li>
              </ul>
              <p>{t('refund.s4.p2')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s5.title')}</h2>
              <p className="mb-2">{t('refund.s5.p1')}</p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-2">
                <li>{t('refund.s5.li1')}</li>
                <li>{t('refund.s5.li2')}</li>
                <li>{t('refund.s5.li3')}</li>
              </ul>
              <p className="mb-2">{t('refund.s5.p2')}</p>
              <p>{t('refund.s5.p3')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s6.title')}</h2>
              <p className="mb-2">
                {t('refund.s6.p1Before')}
                <a href="mailto:support@atockorea.com" className="text-blue-600 hover:underline">support@atockorea.com</a>
                {t('refund.s6.p1After')}
              </p>
              <p>{t('refund.s6.p2')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s7.title')}</h2>
              <p className="mb-2">{t('refund.s7.p1')}</p>
              <p>{t('refund.s7.p2')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s8.title')}</h2>
              <p className="mb-2">{t('refund.s8.p1')}</p>
              <p className="mb-2">{t('refund.s8.p2')}</p>
              <p>{t('refund.s8.p3')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s9.title')}</h2>
              <p className="mb-2">{t('refund.s9.p1')}</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>{t('refund.s9.li1')}</li>
                <li>{t('refund.s9.li2')}</li>
                <li>{t('refund.s9.li3')}</li>
                <li>{t('refund.s9.li4')}</li>
                <li>{t('refund.s9.li5')}</li>
              </ul>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s10.title')}</h2>
              <p className="mb-2">{t('refund.s10.p1')}</p>
              <p>{t('refund.s10.p2')}</p>
            </section>

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('refund.s11.title')}</h2>
              <p className="mb-2">{t('refund.s11.p1')}</p>
              <p className="mb-2">{t('refund.s11.p2')}</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>{t('refund.s11.email')}</strong> <a href="mailto:support@atockorea.com" className="text-blue-600 hover:underline">support@atockorea.com</a> {t('refund.s11.emailNote')}</li>
                <li><strong>{t('refund.s11.phone')}</strong> +82 10 9780 8027</li>
                <li><strong>{t('refund.s11.entity')}</strong> ATOC KOREA LLC</li>
                <li><strong>{t('refund.s11.address')}</strong> 302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do, Republic of Korea</li>
              </ul>
            </section>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link href="/legal" className="text-blue-600 hover:underline font-medium">{t('refund.backToLegal')}</Link>
            <Link href="/terms" className="text-blue-600 hover:underline font-medium">{t('home.footer.terms')}</Link>
            <Link href="/privacy" className="text-blue-600 hover:underline font-medium">{t('home.footer.privacy')}</Link>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
