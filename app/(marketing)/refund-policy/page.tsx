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

export default function RefundPolicyPage() {
  const t = useTranslations();
  const date = new Date().toISOString().split('T')[0];

  return (
    <>
      <Header />
      <main className={LEGAL_DOC_MAIN_CLASS}>
        <LegalDocContainer>
          <LegalDocTitle>{t('refund.title')}</LegalDocTitle>
          <LegalDocEffectiveDate className="mb-6">
            {t('refund.introPrefix')}
            {date}
            {t('refund.introSuffix')}
            <Link href="/terms">{t('home.footer.terms')}</Link>
            {t('refund.introAfterTerms')}
            <Link href="/privacy">{t('home.footer.privacy')}</Link>
            {t('refund.introAfter')}
          </LegalDocEffectiveDate>

          <LegalDocumentShell>
            <LegalSection title={t('refund.s1.title')}>
              <p>{t('refund.s1.p1')}</p>
              <p>{t('refund.s1.p2')}</p>
              <p>{t('refund.s1.p3')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s2.title')}>
              <ul>
                <li>{t('refund.s2.booking')}</li>
                <li>{t('refund.s2.platform')}</li>
                <li>{t('refund.s2.tourProvider')}</li>
                <li>{t('refund.s2.platformFees')}</li>
                <li>{t('refund.s2.tourFees')}</li>
                <li>{t('refund.s2.totalPrice')}</li>
              </ul>
            </LegalSection>

            <LegalSection title={t('refund.s3.title')}>
              <p>{t('refund.s3.p1')}</p>
              <p>{t('refund.s3.p2')}</p>
              <p>{t('refund.s3.p3')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s4.title')}>
              <p>{t('refund.s4.p1')}</p>
              <ul>
                <li>{t('refund.s4.li1')}</li>
                <li>{t('refund.s4.li2')}</li>
                <li>{t('refund.s4.li3')}</li>
                <li>{t('refund.s4.li4')}</li>
              </ul>
              <p>{t('refund.s4.p2')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s5.title')}>
              <p>{t('refund.s5.p1')}</p>
              <ul>
                <li>{t('refund.s5.li1')}</li>
                <li>{t('refund.s5.li2')}</li>
                <li>{t('refund.s5.li3')}</li>
              </ul>
              <p>{t('refund.s5.p2')}</p>
              <p>{t('refund.s5.p3')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s6.title')}>
              <p>
                {t('refund.s6.p1Before')}
                <a href="mailto:support@atockorea.com">support@atockorea.com</a>
                {t('refund.s6.p1After')}
              </p>
              <p>{t('refund.s6.p2')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s7.title')}>
              <p>{t('refund.s7.p1')}</p>
              <p>{t('refund.s7.p2')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s8.title')}>
              <p>{t('refund.s8.p1')}</p>
              <p>{t('refund.s8.p2')}</p>
              <p>{t('refund.s8.p3')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s9.title')}>
              <p>{t('refund.s9.p1')}</p>
              <ul>
                <li>{t('refund.s9.li1')}</li>
                <li>{t('refund.s9.li2')}</li>
                <li>{t('refund.s9.li3')}</li>
                <li>{t('refund.s9.li4')}</li>
                <li>{t('refund.s9.li5')}</li>
              </ul>
            </LegalSection>

            <LegalSection title={t('refund.s10.title')}>
              <p>{t('refund.s10.p1')}</p>
              <p>{t('refund.s10.p2')}</p>
            </LegalSection>

            <LegalSection title={t('refund.s11.title')}>
              <p>{t('refund.s11.p1')}</p>
              <p>{t('refund.s11.operations')}</p>
              <p>{t('refund.s11.p2')}</p>
              <ul>
                <li>
                  <strong>{t('refund.s11.email')}</strong>{' '}
                  <a href="mailto:support@atockorea.com">support@atockorea.com</a> {t('refund.s11.emailNote')}
                </li>
                <li>
                  <strong>{t('refund.s11.phone')}</strong> +82 10 9780 8027
                </li>
                <li>
                  <strong>{t('refund.s11.entity')}</strong> AtoC Korea, LLC
                </li>
                <li>
                  <strong>{t('refund.s11.address')}</strong> #221-8, 284 Gilju-ro, Wonmi-gu, Bucheon-si, Gyeonggi-do, Republic of Korea
                </li>
              </ul>
            </LegalSection>
          </LegalDocumentShell>

          <nav className={legalDocFooterNavClass} aria-label="Related policies">
            <Link href="/legal" className={legalDocFooterLinkClass}>
              {t('refund.backToLegal')}
            </Link>
            <Link href="/terms" className={legalDocFooterLinkClass}>
              {t('home.footer.terms')}
            </Link>
            <Link href="/privacy" className={legalDocFooterLinkClass}>
              {t('home.footer.privacy')}
            </Link>
          </nav>
        </LegalDocContainer>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
