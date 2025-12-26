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
              <p>ATOC KOREA LLC operates as a booking intermediary.</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We facilitate reservations and payments for booking services</li>
                <li>We are not the tour operator or service provider</li>
                <li>Tour services are delivered by independent third parties</li>
              </ul>
              <p className="font-semibold">
                Responsibility for tour execution, safety, and service quality rests with the tour provider.
              </p>
              <p>
                Full terms govern booking, payments, cancellations, liability limitations, and dispute handling.
              </p>
            </div>
          </section>

          {/* Privacy Policy */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Privacy Policy</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>We collect personal data only as necessary to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Process bookings</li>
                <li>Communicate essential information</li>
                <li>Comply with legal and accounting obligations</li>
              </ul>
              <p className="font-semibold">Personal data may be shared with:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Payment processors</li>
                <li>Assigned tour providers (limited to booking fulfillment)</li>
              </ul>
              <p className="font-semibold">We do not sell personal data.</p>
            </div>
          </section>

          {/* Cookie Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Cookie Policy</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Enable essential website functionality</li>
                <li>Improve platform performance</li>
                <li>Support analytics and marketing (where permitted)</li>
              </ul>
              <p>
                You can manage cookie preferences at any time through the website footer.
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

