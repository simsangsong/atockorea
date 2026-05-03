import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Cookie Policy | AtoC Korea",
  description:
    "How AtoC Korea uses cookies and similar technologies on www.atockorea.com, what data they collect, and how to manage them.",
  alternates: { canonical: "https://www.atockorea.com/cookies" },
};

const LAST_UPDATED = "2026-05-03";

export default function CookiePolicyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Cookie Policy
          </h1>
          <p className="mb-8 text-sm text-gray-600">
            Effective {LAST_UPDATED}. This Cookie Policy explains how AtoC Korea uses cookies and
            similar technologies on{" "}
            <a href="https://www.atockorea.com" className="text-blue-600 hover:underline">
              www.atockorea.com
            </a>
            . It supplements our{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <Section title="1. What are cookies?">
            <p>
              Cookies are small text files placed on your device when you visit a website. They are
              widely used to make websites work, to remember your preferences, and to provide
              information to the site owner. Similar technologies include local storage, session
              storage, pixels, and SDKs.
            </p>
          </Section>

          <Section title="2. Categories of cookies we use">
            <h3 className="mt-2 text-lg font-semibold text-gray-900">Strictly necessary</h3>
            <p>
              Required for the Services to function. Examples: session cookie maintaining your
              signed-in state, locale preference cookie (<code>NEXT_LOCALE</code>),
              currency-preference cookie, and Stripe&apos;s checkout session. Without these the site
              cannot operate; they are not subject to consent.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">Functional</h3>
            <p>
              Remember choices you make to improve your experience. Examples: chosen language and
              currency, last-viewed tour, accessibility preferences.
            </p>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">Performance / analytics</h3>
            <p>
              Help us understand how visitors use the Services in aggregate so we can improve them.
              We use first-party measurement and may use Google Analytics. Analytics cookies are set
              only with your consent in jurisdictions where consent is required (e.g., the EU/UK).
            </p>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">Marketing</h3>
            <p>
              We do not currently set marketing or advertising cookies for behavioral advertising.
              If we add any in the future, we will request prior consent in jurisdictions where it
              is required and update this Policy.
            </p>
          </Section>

          <Section title="3. Third-party cookies">
            <ul className="ml-6 list-disc space-y-1.5">
              <li>
                <strong>Stripe</strong> — fraud prevention and payment processing during checkout.
              </li>
              <li>
                <strong>Google</strong> — Sign-in (OAuth) and, with consent, Google Analytics.
              </li>
              <li>
                <strong>Vercel</strong> — request-routing and performance metrics for the host.
              </li>
            </ul>
            <p>
              These third parties&apos; use of cookies is governed by their own privacy policies.
            </p>
          </Section>

          <Section title="4. Managing cookies">
            <p>
              You can accept, reject, or delete cookies in your browser settings. Note that
              rejecting strictly-necessary cookies may prevent parts of the Services (sign-in,
              checkout, language switching) from working correctly. Most browsers allow you to:
            </p>
            <ul className="ml-6 list-disc space-y-1.5">
              <li>view what cookies are set and delete them individually;</li>
              <li>block third-party cookies;</li>
              <li>block cookies from particular sites;</li>
              <li>block all cookies; and</li>
              <li>delete all cookies when you close the browser.</li>
            </ul>
            <p>
              For more information about cookies generally, see{" "}
              <a
                className="text-blue-600 hover:underline"
                href="https://www.aboutcookies.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.aboutcookies.org
              </a>
              .
            </p>
          </Section>

          <Section title="5. Changes to this Cookie Policy">
            <p>
              We may update this Policy from time to time. The &quot;Effective&quot; date above
              reflects the most recent revision. Material changes will be notified in-product or by
              email.
            </p>
          </Section>

          <Section title="6. Contact">
            <p>
              For any cookie or privacy question, contact{" "}
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
