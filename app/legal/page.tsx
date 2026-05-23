import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import {
  LegalDocContainer,
  LEGAL_DOC_MAIN_CLASS,
  LegalDocTitle,
  LegalDocumentShell,
  legalDocFooterLinkClass,
} from '@/components/legal/legal-document';

export default function LegalPage() {
  return (
    <>
      <Header />
      <main className={LEGAL_DOC_MAIN_CLASS}>
        <LegalDocContainer>
          <LegalDocTitle>Legal</LegalDocTitle>
          <p className="mt-2 mb-6 text-[13px] leading-snug text-slate-600 sm:text-[14px]">
            Policies for the AtoC Korea booking platform. The platform is operated by AtoC Korea, LLC (a
            Wyoming, USA limited liability company); local tour operations and partner management in the
            Republic of Korea are handled by AtoC Korea, Korea (General Travel Business; Business Registration No.
            277-01-03977). Full texts are linked below.
          </p>

          <LegalDocumentShell>
            <section className="scroll-mt-28 py-5 sm:py-6">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">Terms of Service</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700 sm:text-[14px] sm:leading-[1.65]">
                Our full Terms of Service cover your agreement with us, definitions, bookings, payments,
                cancellations and refunds, user conduct, disclaimers, limitation of liability, dispute resolution,
                and related matters for our tour booking intermediary platform (Republic of Korea and United States).
              </p>
              <p className="mt-3 text-[13px] text-slate-600">
                Summary: AtoC Korea, LLC operates only as a booking intermediary. We do not operate tours; independent
                third parties deliver tour services. Execution, safety, and quality are the tour provider’s
                responsibility.
              </p>
              <p className="mt-3">
                <Link href="/terms" className={legalDocFooterLinkClass}>
                  Read the full Terms of Service →
                </Link>
              </p>
            </section>

            <section className="scroll-mt-28 py-5 sm:py-6">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">Privacy Policy</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700 sm:text-[14px] sm:leading-[1.65]">
                Our Privacy Policy is designed to align with Korea’s Personal Information Protection Act (PIPA) and
                U.S. state privacy laws (including California CCPA/CPRA where applicable): what we collect, why,
                retention, your rights, and how to contact us.
              </p>
              <p className="mt-3 text-[13px] text-slate-600">
                Summary: We collect data as needed for bookings, communications, and legal compliance; we share with
                payment processors and tour providers for fulfillment. We do not sell your personal data.
              </p>
              <p className="mt-3">
                <Link href="/privacy" className={legalDocFooterLinkClass}>
                  Read the full Privacy Policy →
                </Link>
              </p>
            </section>

            <section className="scroll-mt-28 py-5 sm:py-6">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">Cookie Policy</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700 sm:text-[14px] sm:leading-[1.65]">
                Our Cookie Policy describes how we and service providers use cookies and similar technologies for
                essential functionality, security, fraud prevention, payments, and preferences, consistent with
                applicable transparency requirements.
              </p>
              <p className="mt-3 text-[13px] text-slate-600">
                Summary: We use necessary cookies (session, auth, security), functional cookies (e.g. language), and
                may use performance/analytics cookies. Payment providers may set cookies during checkout; blocking
                essential or payment-related cookies may affect login or checkout.
              </p>
              <p className="mt-3">
                <Link href="/cookies" className={legalDocFooterLinkClass}>
                  Read the full Cookie Policy →
                </Link>
              </p>
            </section>

            <section className="scroll-mt-28 py-5 sm:py-6">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">DSA (EU) Information</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700 sm:text-[14px] sm:leading-[1.65]">
                For disclosures under the EU Digital Services Act, see our dedicated page.
              </p>
              <p className="mt-3">
                <Link href="/dsa" className={legalDocFooterLinkClass}>
                  DSA Information →
                </Link>
              </p>
            </section>
          </LegalDocumentShell>
        </LegalDocContainer>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
