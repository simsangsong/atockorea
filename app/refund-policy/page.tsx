'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function RefundPolicyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Refund Policy</h1>

          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 space-y-6 text-gray-700">
            <p>
              This Refund Policy applies to booking and reservation services facilitated through the platform.
            </p>
            <p className="font-semibold text-gray-900">
              ATOC KOREA LLC acts solely as an intermediary and does not provide tour services directly. Tour services are provided by independent third-party tour operators.
            </p>

            {/* Booking Fees vs. Tour Fees */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Booking Fees vs. Tour Fees</h2>
              <p className="mb-3">Payments made through the platform may include:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Booking / reservation service fees (platform services)</li>
                <li>Tour service fees (provided by third-party tour operators)</li>
              </ul>
              <p className="mt-3">These components may be subject to different refund rules.</p>
            </section>

            {/* Platform Service Fees */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Platform Service Fees</h2>
              <p className="mb-3 font-semibold">Once a booking is confirmed:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Platform service fees are generally non-refundable</li>
                <li>These fees cover reservation processing, payment handling, and administrative services</li>
              </ul>
              <p className="mt-3 mb-3 font-semibold">Platform service fees may be refunded only if:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The booking cannot be confirmed due to a system error, or</li>
                <li>The tour provider cancels the tour before confirmation</li>
              </ul>
            </section>

            {/* Tour Service Refunds */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Tour Service Refunds</h2>
              <p className="mb-3">Refund eligibility for tour services depends on:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The tour provider's cancellation policy</li>
                <li>The timing of the cancellation</li>
              </ul>
              <p className="mt-3 mb-3">Applicable cancellation and refund conditions are:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Displayed before booking</li>
                <li>Included in the booking confirmation</li>
              </ul>
              <p className="mt-3 font-semibold text-gray-900">
                ATOC KOREA LLC does not override tour provider refund policies.
              </p>
            </section>

            {/* Chargebacks */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Chargebacks</h2>
              <p>
                Customers are encouraged to contact support before initiating a chargeback. Chargebacks that conflict with clearly disclosed and accepted policies may be disputed.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}

