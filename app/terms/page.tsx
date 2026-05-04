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

export default function TermsOfServicePage() {
  const t = useTranslations();
  const date = '2026-05-03';

  return (
    <>
      <Header />
      <main className={LEGAL_DOC_MAIN_CLASS}>
        <LegalDocContainer>
          <LegalDocTitle>{t('terms.title')}</LegalDocTitle>
          <LegalDocEffectiveDate className="mb-6">
            {t('terms.introPrefix')}
            {date}
            {t('terms.introSuffix')}
          </LegalDocEffectiveDate>

          <LegalDocumentShell>
            <LegalSection title={t('terms.s1.title')}>
              <p>
                {t('terms.s1.p1Before')}
                <Link href="/privacy">{t('home.footer.privacy')}</Link>
                {t('terms.s1.p1After')}
              </p>
              <p>{t('terms.s1.p2')}</p>
              <p>{t('terms.s1.p3')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s2.title')}>
              <ul>
                <li>{t('terms.s2.platform')}</li>
                <li>{t('terms.s2.services')}</li>
                <li>{t('terms.s2.tourProvider')}</li>
                <li>{t('terms.s2.booking')}</li>
                <li>{t('terms.s2.tourService')}</li>
                <li>{t('terms.s2.platformFees')}</li>
                <li>{t('terms.s2.tourFees')}</li>
              </ul>
            </LegalSection>

            <LegalSection title={t('terms.s3.title')}>
              <p>{t('terms.s3.p1')}</p>
              <p>{t('terms.s3.p2')}</p>
              <p>{t('terms.s3.p3')}</p>
              <p>{t('terms.s3.p4')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s4.title')}>
              <p>{t('terms.s4.p1')}</p>
              <p>{t('terms.s4.p2')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s5.title')}>
              <p>{t('terms.s5.p1')}</p>
              <p>
                {t('terms.s5.p2Before')}
                <Link href="/refund-policy">{t('home.footer.refundPolicy')}</Link>
                {t('terms.s5.p2After')}
              </p>
              <p>{t('terms.s5.p3')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s6.title')}>
              <p>{t('terms.s6.p1')}</p>
              <p>
                {t('terms.s6.p2Before')}
                <Link href="/refund-policy">{t('home.footer.refundPolicy')}</Link>
                {t('terms.s6.p2After')}
              </p>
              <p>{t('terms.s6.p3')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s7.title')}>
              <p>
                {t('terms.s7.p1Before')}
                <Link href="/refund-policy">{t('home.footer.refundPolicy')}</Link>
                {t('terms.s7.p1Between')}
                <a href="mailto:support@atockorea.com">support@atockorea.com</a>
                {t('terms.s7.p1After')}
              </p>
              <p>{t('terms.s7.p2')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s8.title')}>
              <p>{t('terms.s8.agreeNotTo')}</p>
              <ul>
                <li>{t('terms.s8.li1')}</li>
                <li>{t('terms.s8.li2')}</li>
                <li>{t('terms.s8.li3')}</li>
                <li>{t('terms.s8.li4')}</li>
                <li>{t('terms.s8.li5')}</li>
                <li>{t('terms.s8.li6')}</li>
                <li>{t('terms.s8.li7')}</li>
              </ul>
              <p>{t('terms.s8.p2')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s9.title')}>
              <p>{t('terms.s9.p1')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s10.title')}>
              <p>{t('terms.s10.p1')}</p>
              <p>{t('terms.s10.p2')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s11.title')}>
              <p>{t('terms.s11.p1')}</p>
              <ul>
                <li>{t('terms.s11.li1')}</li>
                <li>{t('terms.s11.li2')}</li>
                <li>{t('terms.s11.li3')}</li>
              </ul>
              <p>{t('terms.s11.p2')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s12.title')}>
              <p>{t('terms.s12.p1')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s13.title')}>
              <p>{t('terms.s13.p1')}</p>
              <p>{t('terms.s13.p2')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s14.title')}>
              <p>
                <strong>{t('terms.s14.governingLabel')}</strong> {t('terms.s14.p1')}
              </p>
              <p>
                <strong>{t('terms.s14.disputesLabel')}</strong> {t('terms.s14.p2Before')}
                <a href="mailto:support@atockorea.com">support@atockorea.com</a>
                {t('terms.s14.p2After')}
              </p>
              <ul>
                <li>{t('terms.s14.li1')}</li>
                <li>{t('terms.s14.li2')}</li>
                <li>{t('terms.s14.li3')}</li>
              </ul>
              <p>{t('terms.s14.p3')}</p>
            </LegalSection>

            <LegalSection title={t('terms.s15.title')}>
              <p>
                <strong>{t('terms.s15.entireLabel')}</strong> {t('terms.s15.entire')}
              </p>
              <p>
                <strong>{t('terms.s15.severabilityLabel')}</strong> {t('terms.s15.severability')}
              </p>
              <p>
                <strong>{t('terms.s15.waiverLabel')}</strong> {t('terms.s15.waiver')}
              </p>
              <p>
                <strong>{t('terms.s15.assignmentLabel')}</strong> {t('terms.s15.assignment')}
              </p>
              <p>
                <strong>{t('terms.s15.noticesLabel')}</strong> {t('terms.s15.noticesBefore')}
                <a href="mailto:support@atockorea.com">support@atockorea.com</a>
                {t('terms.s15.noticesAfter')}
              </p>
              <p>
                <strong>{t('terms.s15.forceLabel')}</strong> {t('terms.s15.force')}
              </p>
            </LegalSection>

            <LegalSection title={t('terms.s16.title')}>
              <p>{t('terms.s16.p1')}</p>
              <ul>
                <li>
                  <strong>{t('terms.s16.entity')}</strong> ATOC KOREA LLC
                </li>
                <li>
                  <strong>{t('terms.s16.email')}</strong>{' '}
                  <a href="mailto:support@atockorea.com">support@atockorea.com</a>
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
            </LegalSection>
          </LegalDocumentShell>

          <nav className={legalDocFooterNavClass} aria-label="Related policies">
            <Link href="/legal" className={legalDocFooterLinkClass}>
              {t('terms.backToLegal')}
            </Link>
            <Link href="/privacy" className={legalDocFooterLinkClass}>
              {t('home.footer.privacy')}
            </Link>
            <Link href="/cookies" className={legalDocFooterLinkClass}>
              {t('home.footer.cookies')}
            </Link>
            <Link href="/refund-policy" className={legalDocFooterLinkClass}>
              {t('home.footer.refundPolicy')}
            </Link>
          </nav>
        </LegalDocContainer>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
