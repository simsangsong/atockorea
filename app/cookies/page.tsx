'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function CookiePolicyPage() {
  const t = useTranslations();
  const date = '2026-05-03';

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">{t('cookiePolicy.title')}</h1>
          <p className="mb-8 text-gray-600">
            {t('cookiePolicy.introPrefix')}
            {date}
            {t('cookiePolicy.introSuffix')}
          </p>

          <div className="space-y-10 text-gray-700">
            {/* 1. Introduction and Scope */}
            <Section title={t('cookiePolicy.s1.title')}>
              <p className="mb-2">{t('cookiePolicy.s1.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('cookiePolicy.s1.li1')}</li>
                <li>{t('cookiePolicy.s1.li2')}</li>
                <li>{t('cookiePolicy.s1.li3')}</li>
                <li>{t('cookiePolicy.s1.li4')}</li>
              </ul>
              <p className="mt-2">
                {t('cookiePolicy.s1.p2Before')}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  {t('home.footer.privacy')}
                </Link>
                {t('cookiePolicy.s1.p2After')}
              </p>
            </Section>

            {/* 2. What Are Cookies */}
            <Section title={t('cookiePolicy.s2.title')}>
              <p className="mb-2">{t('cookiePolicy.s2.p1')}</p>
              <p className="mb-2">{t('cookiePolicy.s2.p2')}</p>
              <p>{t('cookiePolicy.s2.p3')}</p>
            </Section>

            {/* 3. Categories */}
            <Section title={t('cookiePolicy.s3.title')}>
              <p className="mb-2">{t('cookiePolicy.s3.p1')}</p>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('cookiePolicy.s3.h31')}
              </h3>
              <p className="mb-2">{t('cookiePolicy.s3.p2')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('cookiePolicy.s3.li1')}</li>
                <li>{t('cookiePolicy.s3.li2')}</li>
                <li>{t('cookiePolicy.s3.li3')}</li>
              </ul>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('cookiePolicy.s3.h32')}
              </h3>
              <p className="mb-2">{t('cookiePolicy.s3.p3')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('cookiePolicy.s3.li4')}</li>
              </ul>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('cookiePolicy.s3.h33')}
              </h3>
              <p className="mb-2">{t('cookiePolicy.s3.p4')}</p>

              <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">
                {t('cookiePolicy.s3.h34')}
              </h3>
              <p>{t('cookiePolicy.s3.p5')}</p>
            </Section>

            {/* 4. First-Party Cookies (table) */}
            <Section title={t('cookiePolicy.s4.title')}>
              <p className="mb-3">{t('cookiePolicy.s4.p1')}</p>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        {t('cookiePolicy.s4.tablePurpose')}
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        {t('cookiePolicy.s4.tableCategory')}
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        {t('cookiePolicy.s4.tableDuration')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row1Purpose')}</td>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row1Category')}</td>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row1Duration')}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row2Purpose')}</td>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row2Category')}</td>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row2Duration')}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row3Purpose')}</td>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row3Category')}</td>
                      <td className="border border-gray-200 px-3 py-2">{t('cookiePolicy.s4.row3Duration')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 5. Payment Processing */}
            <Section title={t('cookiePolicy.s5.title')}>
              <p className="mb-2">{t('cookiePolicy.s5.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('cookiePolicy.s5.li1')}</li>
                <li>{t('cookiePolicy.s5.li2')}</li>
                <li>{t('cookiePolicy.s5.li3')}</li>
              </ul>
              <p className="mt-2">{t('cookiePolicy.s5.p2')}</p>
            </Section>

            {/* 6. Other Third-Party */}
            <Section title={t('cookiePolicy.s6.title')}>
              <p>{t('cookiePolicy.s6.p1')}</p>
            </Section>

            {/* 7. Duration */}
            <Section title={t('cookiePolicy.s7.title')}>
              <p>{t('cookiePolicy.s7.p1')}</p>
            </Section>

            {/* 8. Control */}
            <Section title={t('cookiePolicy.s8.title')}>
              <p className="mb-2">{t('cookiePolicy.s8.p1')}</p>
              <p className="mb-2">{t('cookiePolicy.s8.p2')}</p>
              <p className="mb-2">{t('cookiePolicy.s8.p3')}</p>
              <p>{t('cookiePolicy.s8.p4')}</p>
            </Section>

            {/* 9. Updates */}
            <Section title={t('cookiePolicy.s9.title')}>
              <p>{t('cookiePolicy.s9.p1')}</p>
            </Section>

            {/* 10. Contact */}
            <Section title={t('cookiePolicy.s10.title')}>
              <p className="mb-2">{t('cookiePolicy.s10.p1')}</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>{t('cookiePolicy.s10.entity')}</li>
                <li>
                  <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                    {t('cookiePolicy.s10.email')}
                  </a>
                </li>
                <li>{t('cookiePolicy.s10.phone')}</li>
                <li>{t('cookiePolicy.s10.address')}</li>
              </ul>
            </Section>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/legal" className="font-medium text-blue-600 hover:underline">
              {t('cookiePolicy.backToLegal')}
            </Link>
            <Link href="/privacy" className="font-medium text-blue-600 hover:underline">
              {t('home.footer.privacy')}
            </Link>
            <Link href="/terms" className="font-medium text-blue-600 hover:underline">
              {t('home.footer.terms')}
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
