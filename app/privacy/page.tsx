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

export default function PrivacyPolicyPage() {
  const t = useTranslations();
  const date = '2026-05-03';

  return (
    <>
      <Header />
      <main className={LEGAL_DOC_MAIN_CLASS}>
        <LegalDocContainer>
          <LegalDocTitle>{t('privacy.title')}</LegalDocTitle>
          <LegalDocEffectiveDate className="mb-6">
            {t('privacy.introPrefix')}
            {date}
            {t('privacy.introSuffix')}
          </LegalDocEffectiveDate>

          <LegalDocumentShell>
            {/* 1. Data Controller and Scope */}
            <LegalSection title={t('privacy.s1.title')}>
              <p>{t('privacy.s1.p1')}</p>
              <ul>
                <li>{t('privacy.s1.li1')}</li>
                <li>{t('privacy.s1.li2')}</li>
                <li>{t('privacy.s1.li3')}</li>
              </ul>
              <p>{t('privacy.s1.p2')}</p>
            </LegalSection>

            {/* 2. Information We Collect */}
            <LegalSection title={t('privacy.s2.title')}>
              <p>{t('privacy.s2.p1')}</p>
              <ul>
                <li>{t('privacy.s2.li1')}</li>
                <li>{t('privacy.s2.li2')}</li>
                <li>{t('privacy.s2.li3')}</li>
                <li>{t('privacy.s2.li4')}</li>
                <li>{t('privacy.s2.li5')}</li>
                <li>{t('privacy.s2.li6')}</li>
                <li>{t('privacy.s2.li7')}</li>
              </ul>
              <p>{t('privacy.s2.p2')}</p>
            </LegalSection>

            {/* 3. Purposes of Collection and Use */}
            <LegalSection title={t('privacy.s3.title')}>
              <p>{t('privacy.s3.p1')}</p>
              <ul>
                <li>{t('privacy.s3.li1')}</li>
                <li>{t('privacy.s3.li2')}</li>
                <li>{t('privacy.s3.li3')}</li>
                <li>{t('privacy.s3.li4')}</li>
                <li>{t('privacy.s3.li5')}</li>
                <li>{t('privacy.s3.li6')}</li>
                <li>{t('privacy.s3.li7')}</li>
                <li>{t('privacy.s3.li8')}</li>
              </ul>
              <p>{t('privacy.s3.p2')}</p>
            </LegalSection>

            {/* 4. Retention and Use Period */}
            <LegalSection title={t('privacy.s4.title')}>
              <p>{t('privacy.s4.p1')}</p>
              <ul>
                <li>{t('privacy.s4.li1')}</li>
                <li>{t('privacy.s4.li2')}</li>
                <li>{t('privacy.s4.li3')}</li>
                <li>{t('privacy.s4.li4')}</li>
                <li>{t('privacy.s4.li5')}</li>
              </ul>
              <p>{t('privacy.s4.p2')}</p>
            </LegalSection>

            {/* 5. Destruction Procedures and Methods */}
            <LegalSection title={t('privacy.s5.title')}>
              <p>{t('privacy.s5.p1')}</p>
              <ul>
                <li>{t('privacy.s5.li1')}</li>
                <li>{t('privacy.s5.li2')}</li>
                <li>{t('privacy.s5.li3')}</li>
              </ul>
            </LegalSection>

            {/* 6. How We Share Information */}
            <LegalSection title={t('privacy.s6.title')}>
              <p>{t('privacy.s6.p1')}</p>
              <h3>{t('privacy.s6.h31')}</h3>
              <p>{t('privacy.s6.p2')}</p>
              <ul>
                <li>{t('privacy.s6.li1')}</li>
                <li>{t('privacy.s6.li2')}</li>
                <li>{t('privacy.s6.li3')}</li>
              </ul>
              <h3>{t('privacy.s6.h32')}</h3>
              <p>{t('privacy.s6.p3')}</p>
              <ul>
                <li>{t('privacy.s6.li4')}</li>
                <li>{t('privacy.s6.li5')}</li>
                <li>{t('privacy.s6.li6')}</li>
              </ul>
              <p>{t('privacy.s6.p4')}</p>
            </LegalSection>

            {/* 7. We Do Not Sell or Share for Cross-Context Behavioral Advertising */}
            <LegalSection title={t('privacy.s7.title')}>
              <p>{t('privacy.s7.p1')}</p>
            </LegalSection>

            {/* 8. Cookies and Similar Technologies */}
            <LegalSection title={t('privacy.s8.title')}>
              <p>{t('privacy.s8.p1')}</p>
              <ul>
                <li>{t('privacy.s8.li1')}</li>
                <li>{t('privacy.s8.li2')}</li>
                <li>{t('privacy.s8.li3')}</li>
              </ul>
              <p>{t('privacy.s8.p2')}</p>
            </LegalSection>

            {/* 9. Security Measures */}
            <LegalSection title={t('privacy.s9.title')}>
              <p>{t('privacy.s9.p1')}</p>
              <ul>
                <li>{t('privacy.s9.li1')}</li>
                <li>{t('privacy.s9.li2')}</li>
                <li>{t('privacy.s9.li3')}</li>
                <li>{t('privacy.s9.li4')}</li>
              </ul>
              <p>{t('privacy.s9.p2')}</p>
            </LegalSection>

            {/* 10. International Transfers */}
            <LegalSection title={t('privacy.s10.title')}>
              <p>{t('privacy.s10.p1')}</p>
            </LegalSection>

            {/* 11. Your Rights and How to Exercise Them */}
            <LegalSection title={t('privacy.s11.title')}>
              <p>{t('privacy.s11.p1')}</p>
              <h3>{t('privacy.s11.h31')}</h3>
              <ul>
                <li>{t('privacy.s11.li1')}</li>
                <li>{t('privacy.s11.li2')}</li>
                <li>{t('privacy.s11.li3')}</li>
                <li>{t('privacy.s11.li4')}</li>
                <li>{t('privacy.s11.li5')}</li>
              </ul>
              <h3>{t('privacy.s11.h32')}</h3>
              <ul>
                <li>{t('privacy.s11.li6')}</li>
                <li>{t('privacy.s11.li7')}</li>
                <li>{t('privacy.s11.li8')}</li>
                <li>{t('privacy.s11.li9')}</li>
                <li>{t('privacy.s11.li10')}</li>
                <li>{t('privacy.s11.li11')}</li>
              </ul>
              <h3>{t('privacy.s11.h33')}</h3>
              <p>{t('privacy.s11.p2')}</p>
              <ul>
                <li>
                  Email:{' '}
                  <a href="mailto:support@atockorea.com">
                    support@atockorea.com
                  </a>{' '}
                  (subject line: &quot;Privacy Request&quot;)
                </li>
                <li>{t('privacy.s11.li13')}</li>
                <li>{t('privacy.s11.li14')}</li>
              </ul>
              <p>{t('privacy.s11.p3')}</p>
            </LegalSection>

            {/* 12. Children's Privacy */}
            <LegalSection title={t('privacy.s12.title')}>
              <p>{t('privacy.s12.p1')}</p>
            </LegalSection>

            {/* 13. Changes to This Policy */}
            <LegalSection title={t('privacy.s13.title')}>
              <p>{t('privacy.s13.p1')}</p>
            </LegalSection>

            {/* 14. Privacy Officer and Contact */}
            <LegalSection title={t('privacy.s14.title')}>
              <p>{t('privacy.s14.p1')}</p>
              <ul>
                <li>{t('privacy.s14.li1')}</li>
                <li>
                  Contact:{' '}
                  <a href="mailto:support@atockorea.com">
                    support@atockorea.com
                  </a>
                </li>
                <li>{t('privacy.s14.li3')}</li>
                <li>{t('privacy.s14.li4')}</li>
              </ul>
              <p>{t('privacy.s14.p2')}</p>
            </LegalSection>

            {/* 15. Google API Services User Data — required disclosures (added for Google OAuth verification) */}
            <LegalSection title={t('privacy.googleApi.title')}>
              <p>{t('privacy.googleApi.intro')}</p>

              <h3>
                {t('privacy.googleApi.s1.title')}
              </h3>
              <p>{t('privacy.googleApi.s1.p1')}</p>
              <ul>
                <li>{t('privacy.googleApi.s1.li1')}</li>
                <li>{t('privacy.googleApi.s1.li2')}</li>
                <li>{t('privacy.googleApi.s1.li3')}</li>
              </ul>
              <p>{t('privacy.googleApi.s1.p2')}</p>

              <h3>
                {t('privacy.googleApi.s2.title')}
              </h3>
              <p>{t('privacy.googleApi.s2.p1')}</p>
              <ul>
                <li>{t('privacy.googleApi.s2.li1')}</li>
                <li>{t('privacy.googleApi.s2.li2')}</li>
                <li>{t('privacy.googleApi.s2.li3')}</li>
                <li>{t('privacy.googleApi.s2.li4')}</li>
              </ul>
              <p>{t('privacy.googleApi.s2.p2')}</p>

              <h3>
                {t('privacy.googleApi.s3.title')}
              </h3>
              <ul>
                <li>{t('privacy.googleApi.s3.li1')}</li>
                <li>{t('privacy.googleApi.s3.li2')}</li>
                <li>{t('privacy.googleApi.s3.li3')}</li>
                <li>{t('privacy.googleApi.s3.li4')}</li>
              </ul>

              <h3>
                {t('privacy.googleApi.s4.title')}
              </h3>
              <ul>
                <li>{t('privacy.googleApi.s4.li1')}</li>
                <li>{t('privacy.googleApi.s4.li2')}</li>
                <li>{t('privacy.googleApi.s4.li3')}</li>
                <li>{t('privacy.googleApi.s4.li4')}</li>
                <li>{t('privacy.googleApi.s4.li5')}</li>
              </ul>

              <h3>
                {t('privacy.googleApi.s5.title')}
              </h3>
              <ul>
                <li>{t('privacy.googleApi.s5.li1')}</li>
                <li>{t('privacy.googleApi.s5.li2')}</li>
                <li>{t('privacy.googleApi.s5.li3')}</li>
                <li>
                  {t('privacy.googleApi.s5.li4')}{' '}
                  <a href="mailto:support@atockorea.com">
                    support@atockorea.com
                  </a>
                  .
                </li>
                <li>
                  {t('privacy.googleApi.s5.li5')}{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    myaccount.google.com/permissions
                  </a>
                  .
                </li>
              </ul>
            </LegalSection>
          </LegalDocumentShell>

          <nav className={legalDocFooterNavClass} aria-label="Related policies">
            <Link href="/legal" className={legalDocFooterLinkClass}>
              {t('privacy.backToLegal')}
            </Link>
            <Link href="/terms" className={legalDocFooterLinkClass}>
              {t('home.footer.terms')}
            </Link>
            <Link href="/cookies" className={legalDocFooterLinkClass}>
              {t('home.footer.cookies')}
            </Link>
          </nav>
        </LegalDocContainer>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
