import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | AtoC Korea",
  description:
    "How AtoC Korea collects, uses, stores, shares, and protects personal data and Google user data. Compliant with the Google API Services User Data Policy and Korean PIPA.",
  alternates: { canonical: "https://www.atockorea.com/privacy" },
};

const LAST_UPDATED = "2026-05-03";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mb-8 text-sm text-gray-600">
            Effective {LAST_UPDATED}. This Privacy Policy explains how AtoC Korea (&quot;we,&quot;
            &quot;us,&quot; or &quot;AtoC&quot;) collects, uses, stores, shares, and protects personal
            information when you use the website at{" "}
            <a href="https://www.atockorea.com" className="text-blue-600 hover:underline">
              www.atockorea.com
            </a>{" "}
            and any related applications (collectively, the &quot;Services&quot;). It also describes the
            specific practices we follow for Google user data accessed via Google OAuth, in
            compliance with the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Google API Services User Data Policy
            </a>{" "}
            (including the Limited Use requirements). By using the Services, you agree to the
            practices described here. See also our{" "}
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/cookies" className="text-blue-600 hover:underline">
              Cookie Policy
            </Link>
            .
          </p>

          <Section title="1. Who we are">
            <p>
              <strong>AtoC Korea</strong> is the trading name of <strong>Atockorea Co., Ltd.</strong>
              , a Republic of Korea travel-services company. Registered office: 302, 32, Doryeong-ro
              7-gil, Jeju-si, Jeju-do, Republic of Korea. Contact:{" "}
              <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                support@atockorea.com
              </a>
              .
            </p>
            <p>
              For requests under Korea&apos;s Personal Information Protection Act (PIPA), the GDPR,
              the UK GDPR, the CCPA/CPRA, or other applicable data-protection law, you may contact
              us at the email above.
            </p>
          </Section>

          <Section title="2. Data we collect (general)">
            <p>We collect the following categories of personal information:</p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Account data</strong> — name, email address, password hash, profile photo (if
                you provide one), preferred language, locale, and the third-party identity
                provider(s) you use to sign in.
              </li>
              <li>
                <strong>Booking and transaction data</strong> — tour selections, traveler names,
                contact phone, pickup-point selections, special requests (dietary, accessibility),
                booking dates, payment confirmations, and payment-status records.
              </li>
              <li>
                <strong>Payment data</strong> — processed by Stripe, Inc. We never store your full
                card number, CVV, or full bank-account number on our servers; we store a Stripe
                customer ID and (for repeat-booking convenience) a Stripe payment-method handle.
              </li>
              <li>
                <strong>Communication data</strong> — messages, emails, KakaoTalk / WhatsApp messages,
                and customer-support transcripts you send to us.
              </li>
              <li>
                <strong>Device and log data</strong> — IP address, browser type and version, operating
                system, device identifiers, referring URL, language preference, and timestamps.
              </li>
              <li>
                <strong>Location data</strong> — coarse location derived from your IP address; precise
                location only if you grant permission to find pickup points near you.
              </li>
              <li>
                <strong>Cookies and similar technologies</strong> — see our{" "}
                <Link href="/cookies" className="text-blue-600 hover:underline">
                  Cookie Policy
                </Link>
                .
              </li>
            </ul>
          </Section>

          <Section title="3. Google user data — specific disclosures">
            <p>
              When you choose to sign in with Google, our application accesses, uses, stores, and
              protects Google user data as described in this section, in addition to the general
              practices in Section 2. AtoC&apos;s use of information received from Google APIs adheres
              to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the <strong>Limited Use</strong> requirements.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">3.1 Data accessed</h3>
            <p>We request only the minimum scopes required to operate the sign-in feature:</p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">openid</code> — to
                authenticate the user via Google&apos;s OpenID Connect.
              </li>
              <li>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">profile</code> — to
                read your <em>name</em>, <em>profile picture URL</em>, and <em>locale</em>, used to
                personalize your account.
              </li>
              <li>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">email</code> — to
                read your <em>primary email address</em>, used as the unique identifier of your
                account and for transactional booking communication.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> request access to Gmail content, Google Calendar, Google
              Drive, Google Contacts, Google Photos, YouTube, or any other restricted scope. We do
              not request offline access or refresh tokens beyond the active session.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">3.2 How we use Google user data</h3>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                To create and authenticate your AtoC Korea account (a single AtoC account is keyed to
                the Google email address you sign in with).
              </li>
              <li>
                To pre-fill your name and profile photo on your account page so you can recognize the
                signed-in identity.
              </li>
              <li>
                To send transactional booking communications (booking confirmation, pickup time,
                cancellation receipt) to the email address provided by Google.
              </li>
              <li>
                To detect duplicate accounts and to support customer-service requests you initiate
                (e.g., &quot;reset my password,&quot; &quot;link my account&quot;).
              </li>
            </ul>
            <p>
              We <strong>do not</strong> use Google user data for advertising, do not sell or rent
              it, do not transfer it to third parties for advertising, and do not use it to train,
              evaluate, or improve generalized AI / ML models. Human review of Google user data is
              limited to (a) explicit user consent, (b) security investigations, (c) legal compliance,
              or (d) as needed to provide a user-facing feature you requested. These uses comply with
              the Google API Services User Data Policy, including the Limited Use requirements.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">3.3 How we share Google user data</h3>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Service providers (sub-processors).</strong> We share the minimum data needed
                with the following processors operating on our behalf under contractual data-protection
                obligations: <strong>Supabase, Inc.</strong> (managed PostgreSQL hosting and
                authentication), <strong>Vercel Inc.</strong> (web hosting and edge runtime),
                <strong>Stripe, Inc.</strong> (payments), <strong>Resend, Inc.</strong> /
                transactional-email providers (delivery of booking emails). Each processor only
                receives the fields required for its function (for example, Stripe receives the
                billing email and amount, not your profile photo).
              </li>
              <li>
                <strong>No sale, no advertising sharing.</strong> We do not sell Google user data and
                do not share it with advertisers, ad networks, data brokers, or analytics providers
                that use it for cross-context behavioral advertising.
              </li>
              <li>
                <strong>Legal disclosure.</strong> We may disclose Google user data when required by
                law, valid legal process (subpoena, court order), or to protect the rights, safety,
                or property of AtoC, our users, or the public.
              </li>
              <li>
                <strong>Corporate transactions.</strong> If we are involved in a merger, acquisition,
                financing, or asset sale, Google user data may be transferred subject to the
                acquirer&apos;s commitment to honor this Privacy Policy.
              </li>
            </ul>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">3.4 Storage and protection</h3>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                Account records (including the email and profile fields received from Google) are
                stored in encrypted PostgreSQL databases managed by Supabase, hosted in the
                Asia-Pacific region (Seoul / Singapore) with daily automated backups.
              </li>
              <li>
                Data in transit is protected with TLS 1.2 or higher. Data at rest is encrypted at the
                disk-volume level (AES-256). Access to production data is restricted to a small
                number of named engineers under role-based access control with audit logging.
              </li>
              <li>
                Authentication tokens issued by Google are kept only for the duration of your active
                session and are revoked when you sign out, change your password, or delete your
                account. We do not persist long-lived Google OAuth refresh tokens.
              </li>
              <li>
                Database row-level security policies prevent any user from reading another user&apos;s
                personal data. Application secrets and API keys are stored in encrypted environment
                variables, never in code or version control.
              </li>
              <li>
                We perform regular security reviews, dependency vulnerability scans, and incident
                response drills. We will notify affected users and the relevant data-protection
                authority of any qualifying personal-data breach within 72 hours of becoming aware,
                as required by applicable law.
              </li>
            </ul>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">3.5 Retention and deletion</h3>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Active accounts.</strong> We retain your account data (including the Google
                email and profile fields) for as long as your account is active.
              </li>
              <li>
                <strong>Inactive accounts.</strong> Accounts with no sign-in activity for{" "}
                <strong>24 consecutive months</strong> are automatically scheduled for deletion after
                a 30-day grace-period notice sent to the email on file.
              </li>
              <li>
                <strong>Booking records.</strong> Confirmed booking records are retained for{" "}
                <strong>5 years</strong> from the tour date to comply with Korean commercial-law and
                tax recordkeeping obligations, after which they are permanently deleted or
                irreversibly anonymized.
              </li>
              <li>
                <strong>User-initiated deletion.</strong> You may delete your account and the
                associated Google user data at any time from <em>My Page → Settings → Delete
                Account</em>, or by emailing{" "}
                <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                  support@atockorea.com
                </a>
                . We process verified deletion requests within <strong>30 days</strong>. Records that
                must be retained for legal reasons (e.g., booking records under tax law) are kept in
                a restricted archive accessible only for those legal purposes.
              </li>
              <li>
                <strong>Revoking Google access.</strong> You may also revoke our application&apos;s
                access to your Google account at any time at{" "}
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

          <Section title="4. How we use your data (general purposes)">
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Providing the Services</strong> — accepting bookings, processing payments,
                arranging pickup, sending tour confirmations and reminders.
              </li>
              <li>
                <strong>Customer support</strong> — responding to your messages, resolving disputes,
                handling refunds.
              </li>
              <li>
                <strong>Account security</strong> — preventing fraud, abuse, account takeover, and
                policy violations.
              </li>
              <li>
                <strong>Legal compliance</strong> — Korean Personal Information Protection Act
                (PIPA), Tourism Promotion Act, Commercial Act recordkeeping, tax reporting, and
                applicable foreign data-protection law.
              </li>
              <li>
                <strong>Service improvement</strong> — aggregated and de-identified usage analytics
                to improve the routes we offer and the website experience. We do not use Google user
                data for this purpose.
              </li>
              <li>
                <strong>Marketing (opt-in only)</strong> — we send promotional email only to users
                who have opted in. You can unsubscribe at any time using the link in the email or by
                writing to support@atockorea.com.
              </li>
            </ul>
          </Section>

          <Section title="5. Legal bases (GDPR / UK GDPR users)">
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Contract</strong> — to provide the booking service you requested (Article 6
                (1)(b) GDPR).
              </li>
              <li>
                <strong>Legal obligation</strong> — to satisfy commercial-law, tax, and consumer-
                protection record-keeping (Article 6(1)(c) GDPR).
              </li>
              <li>
                <strong>Legitimate interests</strong> — to keep our Services secure, prevent fraud,
                and improve the user experience, balanced against your privacy rights (Article 6(1)
                (f) GDPR).
              </li>
              <li>
                <strong>Consent</strong> — for optional cookies, marketing email, and any further
                processing where consent is required (Article 6(1)(a) GDPR).
              </li>
            </ul>
          </Section>

          <Section title="6. International transfers">
            <p>
              We are based in the Republic of Korea, which has been recognized by the European
              Commission as offering an adequate level of personal-data protection. When we transfer
              personal data to processors located in other jurisdictions (including the United
              States), we rely on standard contractual clauses, supplementary safeguards, and the
              processor&apos;s certifications (e.g., the EU–US Data Privacy Framework).
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>
              Depending on where you live, you may have the right to access, correct, delete,
              restrict, port, or object to the processing of your personal data, and to withdraw
              consent at any time. California residents have additional rights under the CCPA / CPRA,
              including the right to know what personal information is collected and the right to opt
              out of the &quot;sale&quot; or &quot;sharing&quot; of personal information (we do
              neither). To exercise any right, email{" "}
              <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                support@atockorea.com
              </a>
              . We will verify your identity and respond within the timeframe required by applicable
              law (typically 30 days).
            </p>
          </Section>

          <Section title="8. Children">
            <p>
              The Services are not directed to children under 14. We do not knowingly collect
              personal information from children under 14. If you believe a child under 14 has
              provided us with personal information, please contact us so we can delete it.
            </p>
          </Section>

          <Section title="9. Changes to this Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in law, our
              Services, or our practices. Material changes will be notified in-product or by email.
              The &quot;Effective&quot; date at the top reflects the most recent revision.
            </p>
          </Section>

          <Section title="10. Contact us">
            <p>
              For any privacy question, complaint, or data-rights request, contact us at{" "}
              <a className="text-blue-600 hover:underline" href="mailto:support@atockorea.com">
                support@atockorea.com
              </a>
              . You also have the right to lodge a complaint with your local supervisory authority
              (in Korea, the Personal Information Protection Commission;{" "}
              <a
                className="text-blue-600 hover:underline"
                href="https://www.pipc.go.kr"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.pipc.go.kr
              </a>
              ).
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
