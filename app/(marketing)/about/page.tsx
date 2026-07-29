'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations } from '@/lib/i18n';
import Link from 'next/link';

export default function AboutPage() {
  const t = useTranslations();
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">{t('about.title')}</h1>

          {/* Our Story */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('about.ourStory.title')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>{t('about.ourStory.p1')}</p>
              <p>{t('about.ourStory.p2')}</p>
              <p className="font-semibold">{t('about.ourStory.facilitate')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('about.ourStory.li1')}</li>
                <li>{t('about.ourStory.li2')}</li>
                <li>{t('about.ourStory.li3')}</li>
                <li>{t('about.ourStory.li4')}</li>
              </ul>
              <p className="font-semibold text-gray-900">{t('about.ourStory.disclaimer')}</p>
            </div>
          </section>

          {/* Why Choose Us */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('about.whyChooseUs.title')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('about.whyChooseUs.clearModel')}</h3>
                <p className="text-gray-700">{t('about.whyChooseUs.clearModelP')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('about.whyChooseUs.verified')}</h3>
                <p className="text-gray-700">{t('about.whyChooseUs.verifiedP')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('about.whyChooseUs.transparent')}</h3>
                <p className="text-gray-700 mb-2">{t('about.whyChooseUs.transparentP')}</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                  <li>{t('about.whyChooseUs.transparentLi1')}</li>
                  <li>{t('about.whyChooseUs.transparentLi2')}</li>
                  <li>{t('about.whyChooseUs.transparentLi3')}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('about.whyChooseUs.secure')}</h3>
                <p className="text-gray-700">{t('about.whyChooseUs.secureP')}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('about.whyChooseUs.support')}</h3>
                <p className="text-gray-700">{t('about.whyChooseUs.supportP')}</p>
              </div>
            </div>
          </section>

          {/* Trust & Policies */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('about.trust.title')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>{t('about.trust.intro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><Link href="/terms" className="text-blue-600 hover:underline">{t('home.footer.terms')}</Link> — {t('about.trust.li1')}</li>
                <li><Link href="/privacy" className="text-blue-600 hover:underline">{t('home.footer.privacy')}</Link> — {t('about.trust.li2')}</li>
                <li><Link href="/refund-policy" className="text-blue-600 hover:underline">{t('home.footer.refundPolicy')}</Link> — {t('about.trust.li3')}</li>
                <li><Link href="/cookies" className="text-blue-600 hover:underline">{t('home.footer.cookies')}</Link> — {t('about.trust.li4')}</li>
              </ul>
              <p className="text-sm text-gray-600">{t('about.trust.note')}</p>
            </div>
          </section>

          {/* Partners */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('about.partners.title')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>{t('about.partners.p1')}</p>
              <p className="font-semibold">{t('about.partners.allPartners')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('about.partners.li1')}</li>
                <li>{t('about.partners.li2')}</li>
                <li>{t('about.partners.li3')}</li>
              </ul>
              <p>
                {t('about.partners.contactBefore')}
                <Link href="/contact" className="text-blue-600 hover:underline">{t('home.footer.contactUs')}</Link>
                {t('about.partners.contactAfter')}
              </p>
            </div>
          </section>

          {/* Careers */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('about.careers.title')}</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>{t('about.careers.p1')}</p>
              <p className="font-semibold">{t('about.careers.weSeek')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('about.careers.li1')}</li>
                <li>{t('about.careers.li2')}</li>
                <li>{t('about.careers.li3')}</li>
              </ul>
              <p>{t('about.careers.openPositions')}</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}






