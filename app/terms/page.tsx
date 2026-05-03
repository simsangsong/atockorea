import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service | AtoC Korea",
  description:
    "AtoC Korea Terms of Service governing the use of www.atockorea.com, tour bookings, payments, and user accounts.",
  alternates: { canonical: "https://www.atockorea.com/terms" },
};

const LAST_UPDATED = "2026-05-03";

export default function TermsOfServicePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mb-8 text-sm text-gray-600">
            Effective {LAST_UPDATED}. These Terms govern your use of the AtoC Korea website at{" "}
            <a href="https://www.atockorea.com" className="text-blue-600 hover:underline">
              www.atockorea.com
            </a>
            , our mobile applications, and any related services (collectively, the
            &quot;Services&quot;). By accessing or using the Services you agree to these Terms and
            to our{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/refund-policy" className="text-blue-600 hover:underline">
              Refund Policy
            </Link>
            .
          </p>

          <Section title="1. About AtoC Korea">
            <p>
              The Services are operated by <strong>Atockorea Co., Ltd.</strong> (&quot;AtoC,&quot;
              &quot;we,&quot; &quot;us&quot;), a corporation organized under the laws of the Republic
              of Korea. Registered office: 302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do, Republic of
              Korea. Customer service:{" "}
              <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                support@atockorea.com
              </a>
              .
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 18 years old (or the age of majority in your jurisdiction) to
              create an account and make a booking. By using the Services, you represent that you
              meet this requirement and have the legal capacity to enter into binding contracts.
            </p>
          </Section>

          <Section title="3. Accounts">
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                You may create an account using an email address and password, or by signing in with
                a supported third-party identity provider (Google).
              </li>
              <li>
                You are responsible for maintaining the confidentiality of your account credentials
                and for all activity that occurs under your account.
              </li>
              <li>
                You must provide accurate, current, and complete information and update it as
                needed.
              </li>
              <li>
                We may suspend or terminate accounts that violate these Terms, harm other users, or
                are inactive for a prolonged period (see our{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>{" "}
                for the inactive-account schedule).
              </li>
            </ul>
          </Section>

          <Section title="4. Bookings, pricing, and payment">
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                AtoC acts as the contracting tour operator (or, where indicated on a specific
                product, as a marketplace agent for a licensed local operator). Tour content,
                pickup-time windows, and route adjustments are described on each tour product page.
              </li>
              <li>
                Prices are shown in USD by default and may be displayed in your selected currency
                using a daily exchange rate. The amount actually charged to your card may vary
                slightly because of currency conversion by your card issuer.
              </li>
              <li>
                Payments are processed by <strong>Stripe, Inc.</strong> AtoC does not store your
                full card number; we store only the Stripe customer reference and (for repeat-
                booking convenience) a saved payment-method handle.
              </li>
              <li>
                A booking is confirmed only when our system returns a confirmation email or in-app
                confirmation. If a tour cannot be operated (insufficient minimum group size,
                weather, force majeure), we will offer rebooking or a full refund per the{" "}
                <Link href="/refund-policy" className="text-blue-600 hover:underline">
                  Refund Policy
                </Link>
                .
              </li>
              <li>
                For some tours, a card-on-file authorization may be held without immediate capture
                and released or captured according to the no-show policy disclosed at checkout.
              </li>
            </ul>
          </Section>

          <Section title="5. Cancellations and refunds">
            <p>
              The cancellation window, refund schedule, and no-show policy applicable to your
              booking are set out in the{" "}
              <Link href="/refund-policy" className="text-blue-600 hover:underline">
                Refund Policy
              </Link>{" "}
              and on the tour product page at the time of booking. Where the two differ, the more
              specific policy on the product page controls.
            </p>
          </Section>

          <Section title="6. Acceptable use">
            <p>You agree not to:</p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                use the Services for any unlawful purpose or in violation of any applicable law or
                regulation;
              </li>
              <li>
                attempt to reverse-engineer, decompile, or scrape the Services beyond what is
                permitted by our robots and rate-limit policies;
              </li>
              <li>
                upload content that is infringing, defamatory, harassing, hateful, fraudulent,
                obscene, or otherwise objectionable;
              </li>
              <li>
                impersonate another person or misrepresent your affiliation with any person or
                entity;
              </li>
              <li>
                interfere with the security, availability, or integrity of the Services (e.g.,
                denial-of-service attempts, intrusion, malware).
              </li>
            </ul>
          </Section>

          <Section title="7. User content and reviews">
            <p>
              You retain ownership of any content you submit (including reviews, photos, and chat
              messages). By submitting, you grant AtoC a worldwide, non-exclusive, royalty-free
              license to host, display, reproduce, and adapt the content for the purpose of
              operating and promoting the Services. We may remove content that violates these Terms
              or applicable law.
            </p>
          </Section>

          <Section title="8. Intellectual property">
            <p>
              The Services, including their text, images, code, logos, designs, and structure, are
              owned by AtoC or our licensors and are protected by copyright, trademark, and other
              intellectual-property laws. We grant you a limited, non-exclusive, non-transferable,
              revocable license to access and use the Services for personal, non-commercial purposes
              consistent with these Terms.
            </p>
          </Section>

          <Section title="9. Third-party services">
            <p>
              The Services integrate third-party providers (including Stripe for payments, Supabase
              for data storage, Vercel for hosting, Google for sign-in, and email-delivery
              services). Your use of those providers is also governed by their own terms and
              privacy policies, which you should review. AtoC is not responsible for the acts or
              omissions of any third-party tour, restaurant, or transport partner you choose to
              engage outside the Services.
            </p>
          </Section>

          <Section title="10. Disclaimer of warranties">
            <p>
              The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis.
              To the maximum extent permitted by law, AtoC disclaims all warranties, express or
              implied, including warranties of merchantability, fitness for a particular purpose,
              and non-infringement. We do not warrant that the Services will be uninterrupted,
              error-free, or secure, or that any defects will be corrected.
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              To the maximum extent permitted by law, AtoC, its directors, employees, and partners
              will not be liable for any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits or revenues, whether incurred directly or indirectly,
              arising from your use of the Services. Our aggregate liability for any claim arising
              from or related to the Services will not exceed the greater of (a) the amount you paid
              to AtoC in the twelve months preceding the event giving rise to the claim, or (b) USD
              100. Nothing in these Terms limits liability that cannot be limited under applicable
              law (including, where applicable, consumer-protection law).
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify and hold harmless AtoC and its directors, employees, and
              agents from and against any claims, losses, liabilities, damages, costs, and expenses
              (including reasonable attorneys&apos; fees) arising out of or related to (a) your use
              of the Services in breach of these Terms, (b) your violation of any applicable law,
              or (c) your infringement of any third-party right.
            </p>
          </Section>

          <Section title="13. Governing law and dispute resolution">
            <p>
              These Terms are governed by the laws of the Republic of Korea, without regard to its
              conflict-of-laws principles. Any dispute arising out of or in connection with these
              Terms or the Services shall be submitted to the exclusive jurisdiction of the Jeju
              District Court of the Republic of Korea, except that nothing in this section affects
              your statutory consumer-protection rights in your country of residence.
            </p>
          </Section>

          <Section title="14. Changes to these Terms">
            <p>
              We may update these Terms from time to time. Material changes will be notified in-
              product or by email. Your continued use of the Services after the effective date of
              the updated Terms constitutes your acceptance of those changes. The &quot;Effective&quot;
              date at the top reflects the most recent revision.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              For questions about these Terms, contact us at{" "}
              <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                support@atockorea.com
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900">{title}</h2>
      <div className="space-y-3 text-[14.5px] leading-[1.7] text-gray-700">{children}</div>
    </section>
  );
}
