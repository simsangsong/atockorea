'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import {
  LegalDocContainer,
  LEGAL_DOC_MAIN_CLASS,
  LegalDocTitle,
  LegalDocumentShell,
  LegalSection,
  legalDocFooterLinkClass,
  legalDocFooterNavClass,
} from '@/components/legal/legal-document';

export default function DSAPage() {
  return (
    <>
      <Header />
      <main className={LEGAL_DOC_MAIN_CLASS}>
        <LegalDocContainer>
          <LegalDocTitle>Information according to the Digital Services Act (EU)</LegalDocTitle>

          <LegalDocumentShell>
            <LegalSection title="Overview">
              <p>This website is operated by ATOC KOREA LLC, an online travel booking platform.</p>
              <p>
                The platform facilitates reservations between users and independent third-party tour providers. ATOC
                KOREA LLC does not provide tour services directly.
              </p>
            </LegalSection>

            <LegalSection title="Contact Point for Authorities and Users (Article 11 & 12 DSA)">
              <ul>
                <li>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:legal@atockorea.com">legal@atockorea.com</a>
                </li>
                <li>
                  <strong>Language of communication:</strong> English
                </li>
              </ul>
            </LegalSection>

            <LegalSection title="Role under the DSA">
              <p>ATOC KOREA LLC qualifies as an online intermediary service provider under the Digital Services Act.</p>
              <p>
                We do not host illegal content knowingly and cooperate with lawful orders from competent authorities.
              </p>
            </LegalSection>

            <LegalSection title="Average Monthly Active Recipients in the EU">
              <p>
                The number of average monthly active recipients of the service in the European Union is below the
                threshold for designation as a Very Large Online Platform (VLOP) under Article 33 DSA.
              </p>
              <p>This information may be updated as required by law.</p>
            </LegalSection>
          </LegalDocumentShell>

          <nav className={legalDocFooterNavClass} aria-label="Related">
            <Link href="/legal" className={legalDocFooterLinkClass}>
              ← Legal overview
            </Link>
          </nav>
        </LegalDocContainer>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
