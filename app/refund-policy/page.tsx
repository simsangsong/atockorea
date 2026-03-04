'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations } from '@/lib/i18n';

export default function RefundPolicyPage() {
  const t = useTranslations();
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{t('refund.title')}</h1>
          <p className="text-sm text-gray-500 mb-8">{t('refund.lastUpdated')}: March 2025</p>

          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 space-y-6 text-gray-700">
            <p>{t('refund.intro')}</p>
            <p className="font-semibold text-gray-900">{t('refund.scope')}</p>

            {/* Definitions */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.definitions.title')}</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><span className="font-medium">Booking:</span> {t('refund.definitions.booking')}</li>
                <li><span className="font-medium">Platform service fees:</span> {t('refund.definitions.platformFees')}</li>
                <li><span className="font-medium">Tour service fees:</span> {t('refund.definitions.tourFees')}</li>
              </ul>
            </section>

            {/* Booking vs Tour */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.bookingVsTour.title')}</h2>
              <p>{t('refund.bookingVsTour.p')}</p>
            </section>

            {/* Platform Fees */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.platformFees.title')}</h2>
              <p className="mb-3">{t('refund.platformFees.nonRefundable')}</p>
              <p>{t('refund.platformFees.refundableOnly')}</p>
            </section>

            {/* Tour Refunds */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.tourRefunds.title')}</h2>
              <p className="mb-3">{t('refund.tourRefunds.p1')}</p>
              <p className="mb-3">{t('refund.tourRefunds.p2')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('refund.tourRefunds.li1')}</li>
                <li>{t('refund.tourRefunds.li2')}</li>
                <li>{t('refund.tourRefunds.li3')}</li>
              </ul>
            </section>

            {/* Cancellation by You */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.cancellationByYou.title')}</h2>
              <p>{t('refund.cancellationByYou.p')}</p>
            </section>

            {/* Cancellation by Operator */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.cancellationByOperator.title')}</h2>
              <p>{t('refund.cancellationByOperator.p')}</p>
            </section>

            {/* No-Show */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.noShow.title')}</h2>
              <p>{t('refund.noShow.p')}</p>
            </section>

            {/* Refund Process */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.process.title')}</h2>
              <p className="mb-3">{t('refund.process.p1')}</p>
              <p>{t('refund.process.p2')}</p>
            </section>

            {/* Exclusions */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.exclusions.title')}</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('refund.exclusions.li1')}</li>
                <li>{t('refund.exclusions.li2')}</li>
                <li>{t('refund.exclusions.li3')}</li>
                <li>{t('refund.exclusions.li4')}</li>
              </ul>
            </section>

            {/* Chargebacks */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.chargebacks.title')}</h2>
              <p>{t('refund.chargebacks.p')}</p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('refund.contact.title')}</h2>
              <p>{t('refund.contact.p')}</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
