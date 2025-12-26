'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function SupportPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Support</h1>

          {/* Booking Help */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Booking Help</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>Our platform facilitates tour reservations only.</p>
              <p className="font-semibold">When you book through our website:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You reserve a tour operated by an independent provider</li>
                <li>We process your online payment for booking services</li>
                <li>A booking confirmation is issued with provider details</li>
              </ul>
              <p>
                Payment structure varies by product and is clearly disclosed before booking.
              </p>
            </div>
          </section>

          {/* Contact Us */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Contact Us</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                For booking-related questions, payment inquiries, or support requests, please contact us via:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Email:</strong> <a href="mailto:support@atockorea.com" className="text-blue-600 hover:underline">support@atockorea.com</a></li>
                <li><strong>Website contact form:</strong> <a href="/contact" className="text-blue-600 hover:underline">Contact Us</a></li>
              </ul>
              <p>
                We aim to respond within 24–48 business hours.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">FAQ</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Q: Do you operate the tours?</h3>
                <p className="text-gray-700">No. Tours are operated by independent third-party providers.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Q: Who processes my payment?</h3>
                <p className="text-gray-700">Payments are processed through third-party payment providers for booking services.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Q: Who is responsible for the tour service?</h3>
                <p className="text-gray-700">The tour provider listed in your booking confirmation is responsible for tour execution.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Q: Can I cancel my booking?</h3>
                <p className="text-gray-700">Cancellation and refund eligibility depend on the policy disclosed before booking.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}

