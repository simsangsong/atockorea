'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function LegalPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Legal</h1>

          {/* Terms of Service */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Terms of Service</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                Our full Terms of Service are designed for our tour booking intermediary platform and to align with applicable law in the Republic of Korea and the United States. They cover your agreement with us, definitions, bookings, payments, cancellations and refunds, user conduct, disclaimers, limitation of liability, dispute resolution, and more.
              </p>
              <p>
                <a href="/terms" className="text-blue-600 hover:underline font-semibold">Read the full Terms of Service →</a>
              </p>
              <p className="text-sm text-gray-600">
                Summary: ATOC KOREA LLC operates only as a booking intermediary. We do not operate tours; tour services are delivered by independent third parties. Responsibility for tour execution, safety, and service quality rests with the tour provider. Full terms govern booking, payments, cancellations, liability limitations, and dispute handling.
              </p>
            </div>
          </section>

          {/* Privacy Policy */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Privacy Policy</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                Our full Privacy Policy is designed to comply with the Republic of Korea’s Personal Information Protection Act (PIPA) and U.S. state privacy laws (e.g., California CCPA/CPRA). It covers data we collect, purposes, retention, your rights (access, correction, deletion, opt-out, etc.), and how to contact us.
              </p>
              <p>
                <a href="/privacy" className="text-blue-600 hover:underline font-semibold">Read the full Privacy Policy →</a>
              </p>
              <p className="text-sm text-gray-600">Summary: We collect data only as needed for bookings, communications, and legal compliance. We share with payment processors and tour providers for fulfillment. We do not sell your personal data.</p>
            </div>
          </section>

          {/* Cookie Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Cookie Policy</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                Our full Cookie Policy describes in detail how we and our service providers use cookies and similar technologies for essential functionality, security, fraud prevention, payment processing (when we use third-party payment providers), and preferences. It is designed to meet transparency requirements under applicable law.
              </p>
              <p>
                <a href="/cookies" className="text-blue-600 hover:underline font-semibold">Read the full Cookie Policy →</a>
              </p>
              <p className="text-sm text-gray-600">
                Summary: We use strictly necessary cookies (session, auth, security, fraud prevention), functional cookies (e.g., language preference), and may use performance/analytics cookies. When we offer online payment, our payment provider may set cookies during checkout. You can manage cookies via your browser or our site where we offer a preference tool; blocking essential or payment-related cookies may affect login or checkout.
              </p>
            </div>
          </section>

          {/* DSA Information */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">DSA (EU) Information</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                For information according to the Digital Services Act (EU), please visit our{' '}
                <a href="/dsa" className="text-blue-600 hover:underline">DSA Information page</a>.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}

