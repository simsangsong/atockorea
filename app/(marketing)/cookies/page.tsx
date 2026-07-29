'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import {
  LegalDocContainer,
  LegalDocEffectiveDate,
  LEGAL_DOC_MAIN_CLASS,
  legalDocFooterLinkClass,
  legalDocFooterNavClass,
  LegalDocTitle,
  LegalDocumentShell,
  LegalSection,
} from '@/components/legal/legal-document';
import { useTranslations } from '@/lib/i18n';

export default function CookiePolicyPage() {
  const t = useTranslations();
  const date = '2026-05-03';

  return (
    <>
      <Header />
      <main className={LEGAL_DOC_MAIN_CLASS}>
        <LegalDocContainer>
          <LegalDocTitle>{t('cookiePolicy.title')}</LegalDocTitle>
          <LegalDocEffectiveDate className="mb-6">
            {t('cookiePolicy.introPrefix')}
            {date}
            {t('cookiePolicy.introSuffix')}
          </LegalDocEffectiveDate>

          <LegalDocumentShell>
            <LegalSection title={t('cookiePolicy.s1.title')}>
              <p>{t('cookiePolicy.s1.p1')}</p>
              <ul>
                <li>{t('cookiePolicy.s1.li1')}</li>
                <li>{t('cookiePolicy.s1.li2')}</li>
                <li>{t('cookiePolicy.s1.li3')}</li>
                <li>{t('cookiePolicy.s1.li4')}</li>
              </ul>
              <p>
                {t('cookiePolicy.s1.p2Before')}
                <Link href="/privacy">{t('home.footer.privacy')}</Link>
                {t('cookiePolicy.s1.p2After')}
              </p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s2.title')}>
              <p>{t('cookiePolicy.s2.p1')}</p>
              <p>{t('cookiePolicy.s2.p2')}</p>
              <p>{t('cookiePolicy.s2.p3')}</p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s3.title')}>
              <p>{t('cookiePolicy.s3.p1')}</p>

              <h3>{t('cookiePolicy.s3.h31')}</h3>
              <p>{t('cookiePolicy.s3.p2')}</p>
              <ul>
                <li>{t('cookiePolicy.s3.li1')}</li>
                <li>{t('cookiePolicy.s3.li2')}</li>
                <li>{t('cookiePolicy.s3.li3')}</li>
              </ul>

              <h3>{t('cookiePolicy.s3.h32')}</h3>
              <p>{t('cookiePolicy.s3.p3')}</p>
              <ul>
                <li>{t('cookiePolicy.s3.li4')}</li>
              </ul>

              <h3>{t('cookiePolicy.s3.h33')}</h3>
              <p>{t('cookiePolicy.s3.p4')}</p>

              <h3>{t('cookiePolicy.s3.h34')}</h3>
              <p>{t('cookiePolicy.s3.p5')}</p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s4.title')}>
              <p>{t('cookiePolicy.s4.p1')}</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white/50">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th>{t('cookiePolicy.s4.tablePurpose')}</th>
                      <th>{t('cookiePolicy.s4.tableCategory')}</th>
                      <th>{t('cookiePolicy.s4.tableDuration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{t('cookiePolicy.s4.row1Purpose')}</td>
                      <td>{t('cookiePolicy.s4.row1Category')}</td>
                      <td>{t('cookiePolicy.s4.row1Duration')}</td>
                    </tr>
                    <tr>
                      <td>{t('cookiePolicy.s4.row2Purpose')}</td>
                      <td>{t('cookiePolicy.s4.row2Category')}</td>
                      <td>{t('cookiePolicy.s4.row2Duration')}</td>
                    </tr>
                    <tr>
                      <td>{t('cookiePolicy.s4.row3Purpose')}</td>
                      <td>{t('cookiePolicy.s4.row3Category')}</td>
                      <td>{t('cookiePolicy.s4.row3Duration')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s5.title')}>
              <p>{t('cookiePolicy.s5.p1')}</p>
              <ul>
                <li>{t('cookiePolicy.s5.li1')}</li>
                <li>{t('cookiePolicy.s5.li2')}</li>
                <li>{t('cookiePolicy.s5.li3')}</li>
              </ul>
              <p>{t('cookiePolicy.s5.p2')}</p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s6.title')}>
              <p>{t('cookiePolicy.s6.p1')}</p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s7.title')}>
              <p>{t('cookiePolicy.s7.p1')}</p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s8.title')}>
              <p>{t('cookiePolicy.s8.p1')}</p>
              <p>{t('cookiePolicy.s8.p2')}</p>
              <p>{t('cookiePolicy.s8.p3')}</p>
              <p>{t('cookiePolicy.s8.p4')}</p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s9.title')}>
              <p>{t('cookiePolicy.s9.p1')}</p>
            </LegalSection>

            <LegalSection title={t('cookiePolicy.s10.title')}>
              <p>{t('cookiePolicy.s10.p1')}</p>
              <ul>
                <li>{t('cookiePolicy.s10.entity')}</li>
                <li>
                  <a href="mailto:support@atockorea.com">{t('cookiePolicy.s10.email')}</a>
                </li>
                <li>{t('cookiePolicy.s10.phone')}</li>
                <li>{t('cookiePolicy.s10.address')}</li>
              </ul>
            </LegalSection>
          </LegalDocumentShell>

          <nav className={legalDocFooterNavClass} aria-label="Related policies">
            <Link href="/legal" className={legalDocFooterLinkClass}>
              {t('cookiePolicy.backToLegal')}
            </Link>
            <Link href="/privacy" className={legalDocFooterLinkClass}>
              {t('home.footer.privacy')}
            </Link>
            <Link href="/terms" className={legalDocFooterLinkClass}>
              {t('home.footer.terms')}
            </Link>
          </nav>
        </LegalDocContainer>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
