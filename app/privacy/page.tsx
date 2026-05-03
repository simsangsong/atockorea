'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function PrivacyPolicyPage() {
  const t = useTranslations();
  const date = '2026-05-03';

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">{t('privacy.title')}</h1>
          <p className="mb-8 text-gray-600">
            {t('privacy.introPrefix')}
            {date}
            {t('privacy.introSuffix')}
          </p>

          <div className="space-y-10 text-gray-700">
            {/* 1. Data Controller and Scope */}
            <Section title={t('privacy.s1.title')}>
              <p className="mb-2">{t('privacy.s1.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s1.li1')}</li>
                <li>{t('privacy.s1.li2')}</li>
                <li>{t('privacy.s1.li3')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s1.p2')}</p>
            </Section>

            {/* 2. Information We Collect */}
            <Section title={t('privacy.s2.title')}>
              <p className="mb-2">{t('privacy.s2.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s2.li1')}</li>
                <li>{t('privacy.s2.li2')}</li>
                <li>{t('privacy.s2.li3')}</li>
                <li>{t('privacy.s2.li4')}</li>
                <li>{t('privacy.s2.li5')}</li>
                <li>{t('privacy.s2.li6')}</li>
                <li>{t('privacy.s2.li7')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s2.p2')}</p>
            </Section>

            {/* 3. Purposes of Collection and Use */}
            <Section title={t('privacy.s3.title')}>
              <p className="mb-2">{t('privacy.s3.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s3.li1')}</li>
                <li>{t('privacy.s3.li2')}</li>
                <li>{t('privacy.s3.li3')}</li>
                <li>{t('privacy.s3.li4')}</li>
                <li>{t('privacy.s3.li5')}</li>
                <li>{t('privacy.s3.li6')}</li>
                <li>{t('privacy.s3.li7')}</li>
                <li>{t('privacy.s3.li8')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s3.p2')}</p>
            </Section>

            {/* 4. Retention and Use Period */}
            <Section title={t('privacy.s4.title')}>
              <p className="mb-2">{t('privacy.s4.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s4.li1')}</li>
                <li>{t('privacy.s4.li2')}</li>
                <li>{t('privacy.s4.li3')}</li>
                <li>{t('privacy.s4.li4')}</li>
                <li>{t('privacy.s4.li5')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s4.p2')}</p>
            </Section>

            {/* 5. Destruction Procedures and Methods */}
            <Section title={t('privacy.s5.title')}>
              <p className="mb-2">{t('privacy.s5.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s5.li1')}</li>
                <li>{t('privacy.s5.li2')}</li>
                <li>{t('privacy.s5.li3')}</li>
              </ul>
            </Section>

            {/* 6. How We Share Information */}
            <Section title={t('privacy.s6.title')}>
              <p className="mb-2">{t('privacy.s6.p1')}</p>
              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">{t('privacy.s6.h31')}</h3>
              <p className="mb-2">{t('privacy.s6.p2')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s6.li1')}</li>
                <li>{t('privacy.s6.li2')}</li>
                <li>{t('privacy.s6.li3')}</li>
              </ul>
              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">{t('privacy.s6.h32')}</h3>
              <p className="mb-2">{t('privacy.s6.p3')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s6.li4')}</li>
                <li>{t('privacy.s6.li5')}</li>
                <li>{t('privacy.s6.li6')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s6.p4')}</p>
            </Section>

            {/* 7. We Do Not Sell or Share for Cross-Context Behavioral Advertising */}
            <Section title={t('privacy.s7.title')}>
              <p>{t('privacy.s7.p1')}</p>
            </Section>

            {/* 8. Cookies and Similar Technologies */}
            <Section title={t('privacy.s8.title')}>
              <p className="mb-2">{t('privacy.s8.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s8.li1')}</li>
                <li>{t('privacy.s8.li2')}</li>
                <li>{t('privacy.s8.li3')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s8.p2')}</p>
            </Section>

            {/* 9. Security Measures */}
            <Section title={t('privacy.s9.title')}>
              <p className="mb-2">{t('privacy.s9.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s9.li1')}</li>
                <li>{t('privacy.s9.li2')}</li>
                <li>{t('privacy.s9.li3')}</li>
                <li>{t('privacy.s9.li4')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s9.p2')}</p>
            </Section>

            {/* 10. International Transfers */}
            <Section title={t('privacy.s10.title')}>
              <p>{t('privacy.s10.p1')}</p>
            </Section>

            {/* 11. Your Rights and How to Exercise Them */}
            <Section title={t('privacy.s11.title')}>
              <p className="mb-2">{t('privacy.s11.p1')}</p>
              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">{t('privacy.s11.h31')}</h3>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s11.li1')}</li>
                <li>{t('privacy.s11.li2')}</li>
                <li>{t('privacy.s11.li3')}</li>
                <li>{t('privacy.s11.li4')}</li>
                <li>{t('privacy.s11.li5')}</li>
              </ul>
              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">{t('privacy.s11.h32')}</h3>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s11.li6')}</li>
                <li>{t('privacy.s11.li7')}</li>
                <li>{t('privacy.s11.li8')}</li>
                <li>{t('privacy.s11.li9')}</li>
                <li>{t('privacy.s11.li10')}</li>
                <li>{t('privacy.s11.li11')}</li>
              </ul>
              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">{t('privacy.s11.h33')}</h3>
              <p className="mb-2">{t('privacy.s11.p2')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>
                  Email:{' '}
                  <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                    support@atockorea.com
                  </a>{' '}
                  (subject line: &quot;Privacy Request&quot;)
                </li>
                <li>{t('privacy.s11.li13')}</li>
                <li>{t('privacy.s11.li14')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s11.p3')}</p>
            </Section>

            {/* 12. Children's Privacy */}
            <Section title={t('privacy.s12.title')}>
              <p>{t('privacy.s12.p1')}</p>
            </Section>

            {/* 13. Changes to This Policy */}
            <Section title={t('privacy.s13.title')}>
              <p>{t('privacy.s13.p1')}</p>
            </Section>

            {/* 14. Privacy Officer and Contact */}
            <Section title={t('privacy.s14.title')}>
              <p className="mb-2">{t('privacy.s14.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.s14.li1')}</li>
                <li>
                  Contact:{' '}
                  <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                    support@atockorea.com
                  </a>
                </li>
                <li>{t('privacy.s14.li3')}</li>
                <li>{t('privacy.s14.li4')}</li>
              </ul>
              <p className="mt-2">{t('privacy.s14.p2')}</p>
            </Section>

            {/* 15. Google API Services User Data — required disclosures (added for Google OAuth verification) */}
            <Section title={t('privacy.googleApi.title')}>
              <p className="mb-3">{t('privacy.googleApi.intro')}</p>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('privacy.googleApi.s1.title')}
              </h3>
              <p className="mb-2">{t('privacy.googleApi.s1.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.googleApi.s1.li1')}</li>
                <li>{t('privacy.googleApi.s1.li2')}</li>
                <li>{t('privacy.googleApi.s1.li3')}</li>
              </ul>
              <p className="mt-2">{t('privacy.googleApi.s1.p2')}</p>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('privacy.googleApi.s2.title')}
              </h3>
              <p className="mb-2">{t('privacy.googleApi.s2.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.googleApi.s2.li1')}</li>
                <li>{t('privacy.googleApi.s2.li2')}</li>
                <li>{t('privacy.googleApi.s2.li3')}</li>
                <li>{t('privacy.googleApi.s2.li4')}</li>
              </ul>
              <p className="mt-2">{t('privacy.googleApi.s2.p2')}</p>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('privacy.googleApi.s3.title')}
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.googleApi.s3.li1')}</li>
                <li>{t('privacy.googleApi.s3.li2')}</li>
                <li>{t('privacy.googleApi.s3.li3')}</li>
                <li>{t('privacy.googleApi.s3.li4')}</li>
              </ul>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('privacy.googleApi.s4.title')}
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.googleApi.s4.li1')}</li>
                <li>{t('privacy.googleApi.s4.li2')}</li>
                <li>{t('privacy.googleApi.s4.li3')}</li>
                <li>{t('privacy.googleApi.s4.li4')}</li>
                <li>{t('privacy.googleApi.s4.li5')}</li>
              </ul>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('privacy.googleApi.s5.title')}
              </h3>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('privacy.googleApi.s5.li1')}</li>
                <li>{t('privacy.googleApi.s5.li2')}</li>
                <li>{t('privacy.googleApi.s5.li3')}</li>
                <li>
                  {t('privacy.googleApi.s5.li4')}{' '}
                  <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                    support@atockorea.com
                  </a>
                  .
                </li>
                <li>
                  {t('privacy.googleApi.s5.li5')}{' '}
                  <a
                    className="text-blue-600 hover:underline"
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    myaccount.google.com/permissions
                  </a>
                  .
                </li>
              </ul>
            </Section>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/legal" className="font-medium text-blue-600 hover:underline">
              {t('privacy.backToLegal')}
            </Link>
            <Link href="/terms" className="font-medium text-blue-600 hover:underline">
              {t('home.footer.terms')}
            </Link>
            <Link href="/cookies" className="font-medium text-blue-600 hover:underline">
              {t('home.footer.cookies')}
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
