'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function TermsOfServicePage() {
  const t = useTranslations();
  const date = '2026-05-03';

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">{t('terms.title')}</h1>
          <p className="mb-8 text-gray-600">
            {t('terms.introPrefix')}
            {date}
            {t('terms.introSuffix')}
          </p>

          <div className="space-y-10 text-gray-700">
            {/* 1. Agreement to Terms */}
            <Section title={t('terms.s1.title')}>
              <p className="mb-2">
                {t('terms.s1.p1Before')}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  {t('home.footer.privacy')}
                </Link>
                {t('terms.s1.p1After')}
              </p>
              <p className="mb-2">{t('terms.s1.p2')}</p>
              <p>{t('terms.s1.p3')}</p>
            </Section>

            {/* 2. Definitions */}
            <Section title={t('terms.s2.title')}>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('terms.s2.platform')}</li>
                <li>{t('terms.s2.services')}</li>
                <li>{t('terms.s2.tourProvider')}</li>
                <li>{t('terms.s2.booking')}</li>
                <li>{t('terms.s2.tourService')}</li>
                <li>{t('terms.s2.platformFees')}</li>
                <li>{t('terms.s2.tourFees')}</li>
              </ul>
            </Section>

            {/* 3. Nature of Our Service */}
            <Section title={t('terms.s3.title')}>
              <p className="mb-2">{t('terms.s3.p1')}</p>
              <p className="mb-2">{t('terms.s3.p2')}</p>
              <p>{t('terms.s3.p3')}</p>
            </Section>

            {/* 4. Account Registration and Eligibility */}
            <Section title={t('terms.s4.title')}>
              <p className="mb-2">{t('terms.s4.p1')}</p>
              <p>{t('terms.s4.p2')}</p>
            </Section>

            {/* 5. Bookings */}
            <Section title={t('terms.s5.title')}>
              <p className="mb-2">{t('terms.s5.p1')}</p>
              <p className="mb-2">
                {t('terms.s5.p2Before')}
                <Link href="/refund-policy" className="text-blue-600 hover:underline">
                  {t('home.footer.refundPolicy')}
                </Link>
                {t('terms.s5.p2After')}
              </p>
              <p>{t('terms.s5.p3')}</p>
            </Section>

            {/* 6. Payment Terms */}
            <Section title={t('terms.s6.title')}>
              <p className="mb-2">{t('terms.s6.p1')}</p>
              <p className="mb-2">
                {t('terms.s6.p2Before')}
                <Link href="/refund-policy" className="text-blue-600 hover:underline">
                  {t('home.footer.refundPolicy')}
                </Link>
                {t('terms.s6.p2After')}
              </p>
              <p>{t('terms.s6.p3')}</p>
            </Section>

            {/* 7. Cancellation and Refunds */}
            <Section title={t('terms.s7.title')}>
              <p className="mb-2">
                {t('terms.s7.p1Before')}
                <Link href="/refund-policy" className="text-blue-600 hover:underline">
                  {t('home.footer.refundPolicy')}
                </Link>
                {t('terms.s7.p1Between')}
                <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                  support@atockorea.com
                </a>
                {t('terms.s7.p1After')}
              </p>
              <p>{t('terms.s7.p2')}</p>
            </Section>

            {/* 8. User Conduct and Prohibited Uses */}
            <Section title={t('terms.s8.title')}>
              <p className="mb-2">{t('terms.s8.agreeNotTo')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('terms.s8.li1')}</li>
                <li>{t('terms.s8.li2')}</li>
                <li>{t('terms.s8.li3')}</li>
                <li>{t('terms.s8.li4')}</li>
                <li>{t('terms.s8.li5')}</li>
                <li>{t('terms.s8.li6')}</li>
                <li>{t('terms.s8.li7')}</li>
              </ul>
              <p className="mt-2">{t('terms.s8.p2')}</p>
            </Section>

            {/* 9. Intellectual Property */}
            <Section title={t('terms.s9.title')}>
              <p>{t('terms.s9.p1')}</p>
            </Section>

            {/* 10. Disclaimers */}
            <Section title={t('terms.s10.title')}>
              <p className="mb-2">{t('terms.s10.p1')}</p>
              <p>{t('terms.s10.p2')}</p>
            </Section>

            {/* 11. Limitation of Liability */}
            <Section title={t('terms.s11.title')}>
              <p className="mb-2">{t('terms.s11.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('terms.s11.li1')}</li>
                <li>{t('terms.s11.li2')}</li>
                <li>{t('terms.s11.li3')}</li>
              </ul>
              <p className="mt-2">{t('terms.s11.p2')}</p>
            </Section>

            {/* 12. Indemnification */}
            <Section title={t('terms.s12.title')}>
              <p>{t('terms.s12.p1')}</p>
            </Section>

            {/* 13. Termination */}
            <Section title={t('terms.s13.title')}>
              <p className="mb-2">{t('terms.s13.p1')}</p>
              <p>{t('terms.s13.p2')}</p>
            </Section>

            {/* 14. Governing Law and Dispute Resolution */}
            <Section title={t('terms.s14.title')}>
              <p className="mb-2">
                <strong>{t('terms.s14.governingLabel')}</strong> {t('terms.s14.p1')}
              </p>
              <p className="mb-2">
                <strong>{t('terms.s14.disputesLabel')}</strong>{' '}
                {t('terms.s14.p2Before')}
                <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                  support@atockorea.com
                </a>
                {t('terms.s14.p2After')}
              </p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('terms.s14.li1')}</li>
                <li>{t('terms.s14.li2')}</li>
                <li>{t('terms.s14.li3')}</li>
              </ul>
              <p className="mt-2">{t('terms.s14.p3')}</p>
            </Section>

            {/* 15. General Provisions */}
            <Section title={t('terms.s15.title')}>
              <p className="mb-2">
                <strong>{t('terms.s15.entireLabel')}</strong> {t('terms.s15.entire')}
              </p>
              <p className="mb-2">
                <strong>{t('terms.s15.severabilityLabel')}</strong> {t('terms.s15.severability')}
              </p>
              <p className="mb-2">
                <strong>{t('terms.s15.waiverLabel')}</strong> {t('terms.s15.waiver')}
              </p>
              <p className="mb-2">
                <strong>{t('terms.s15.assignmentLabel')}</strong> {t('terms.s15.assignment')}
              </p>
              <p className="mb-2">
                <strong>{t('terms.s15.noticesLabel')}</strong>{' '}
                {t('terms.s15.noticesBefore')}
                <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                  support@atockorea.com
                </a>
                {t('terms.s15.noticesAfter')}
              </p>
              <p>
                <strong>{t('terms.s15.forceLabel')}</strong> {t('terms.s15.force')}
              </p>
            </Section>

            {/* 16. Contact */}
            <Section title={t('terms.s16.title')}>
              <p className="mb-2">{t('terms.s16.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>
                  <strong>{t('terms.s16.entity')}</strong> ATOC KOREA LLC
                </li>
                <li>
                  <strong>{t('terms.s16.email')}</strong>{' '}
                  <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                    support@atockorea.com
                  </a>
                </li>
                <li>
                  <strong>{t('terms.s16.phone')}</strong> +82 10 9780 8027
                </li>
                <li>
                  <strong>{t('terms.s16.address')}</strong> 302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do, Republic of Korea
                </li>
                <li>
                  <strong>{t('terms.s16.registered')}</strong> 30 N Gould St, STE R, Sheridan, WY 82801, USA
                </li>
              </ul>
            </Section>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/legal" className="font-medium text-blue-600 hover:underline">
              {t('terms.backToLegal')}
            </Link>
            <Link href="/privacy" className="font-medium text-blue-600 hover:underline">
              {t('home.footer.privacy')}
            </Link>
            <Link href="/cookies" className="font-medium text-blue-600 hover:underline">
              {t('home.footer.cookies')}
            </Link>
            <Link href="/refund-policy" className="font-medium text-blue-600 hover:underline">
              {t('home.footer.refundPolicy')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-3 text-xl font-semibold text-gray-800">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
