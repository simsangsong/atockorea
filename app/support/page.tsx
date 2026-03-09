'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function SupportPage() {
  const t = useTranslations();
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{t('support.title')}</h1>
          <p className="text-gray-600 mb-8">
            {t('support.introBefore')}
            <Link href="/terms" className="text-blue-600 hover:underline">{t('home.footer.terms')}</Link>, <Link href="/privacy" className="text-blue-600 hover:underline">{t('home.footer.privacy')}</Link>, <Link href="/refund-policy" className="text-blue-600 hover:underline">{t('home.footer.refundPolicy')}</Link>
            {t('support.introAfter')}
          </p>

          {/* Booking Help */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('support.bookingHelpTitle')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>{t('support.bookingHelpP1')}</p>
              <p className="font-semibold text-gray-900">{t('support.bookingHelpWhen')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('support.bookingHelpLi1')}</li>
                <li>{t('support.bookingHelpLi2')}</li>
                <li>{t('support.bookingHelpLi3')}</li>
              </ul>
              <p>
                {t('support.bookingHelpP2Before')}
                <Link href="/terms" className="text-blue-600 hover:underline">{t('home.footer.terms')}</Link>
                {t('support.bookingHelpP2After')}
              </p>
            </div>
          </section>

          {/* Cancellations and Refunds */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('support.cancellationsTitle')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                {t('support.cancellationsP1Before')}
                <Link href="/refund-policy" className="text-blue-600 hover:underline">{t('home.footer.refundPolicy')}</Link>
                {t('support.cancellationsP1After')}
              </p>
              <p>
                {t('support.cancellationsP2Before')}
                <a href="mailto:support@atockorea.com" className="text-blue-600 hover:underline">support@atockorea.com</a>
                {t('support.cancellationsP2Between')}
              </p>
            </div>
          </section>

          {/* Contact Us */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('support.contactTitle')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>{t('support.contactIntro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>{t('support.contactEmail')}</strong> <a href="mailto:support@atockorea.com" className="text-blue-600 hover:underline">support@atockorea.com</a> {t('support.contactEmailNote')}</li>
                <li><strong>{t('support.contactForm')}</strong> <Link href="/contact" className="text-blue-600 hover:underline">{t('home.footer.contactUs')}</Link></li>
                <li><strong>{t('support.contactPhone')}</strong> +82 10 9780 8027</li>
              </ul>
              <p>
                <strong>{t('support.contactEntity')}</strong> ATOC KOREA LLC · <strong>{t('support.contactAddress')}</strong> 302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do, Republic of Korea
              </p>
              <p>{t('support.contactResponse')}</p>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('support.faqTitle')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('support.faqOperateQ')}</h3>
                <p className="text-gray-700">{t('support.faqOperateA')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('support.faqPaymentQ')}</h3>
                <p className="text-gray-700">{t('support.faqPaymentA')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('support.faqResponsibleQ')}</h3>
                <p className="text-gray-700">{t('support.faqResponsibleA')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('support.faqCancelQ')}</h3>
                <p className="text-gray-700">{t('support.faqCancelA')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('support.faqSellQ')}</h3>
                <p className="text-gray-700">{t('support.faqSellA')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('support.faqCookiesQ')}</h3>
                <p className="text-gray-700">{t('support.faqCookiesA')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('support.faqWhereQ')}</h3>
                <p className="text-gray-700">
                  <Link href="/terms" className="text-blue-600 hover:underline">{t('home.footer.terms')}</Link> · <Link href="/privacy" className="text-blue-600 hover:underline">{t('home.footer.privacy')}</Link> · <Link href="/refund-policy" className="text-blue-600 hover:underline">{t('home.footer.refundPolicy')}</Link> · <Link href="/cookies" className="text-blue-600 hover:underline">{t('home.footer.cookies')}</Link> · <Link href="/legal" className="text-blue-600 hover:underline">{t('home.footer.legal')}</Link>
                </p>
              </div>
            </div>
          </section>

          {/* Legal and policies quick links */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('support.legalTitle')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-2 text-gray-700">
              <p>{t('support.legalIntro')}</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><Link href="/terms" className="text-blue-600 hover:underline">{t('home.footer.terms')}</Link> — {t('support.legalLi1')}</li>
                <li><Link href="/privacy" className="text-blue-600 hover:underline">{t('home.footer.privacy')}</Link> — {t('support.legalLi2')}</li>
                <li><Link href="/refund-policy" className="text-blue-600 hover:underline">{t('home.footer.refundPolicy')}</Link> — {t('support.legalLi3')}</li>
                <li><Link href="/cookies" className="text-blue-600 hover:underline">{t('home.footer.cookies')}</Link> — {t('support.legalLi4')}</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
