'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">About Us</h1>

          {/* Our Story */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Our Story</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                ATOC KOREA LLC operates an online travel booking platform acting solely as an intermediary between travelers and independent tour providers.
              </p>
              <p>
                Our platform enables customers to discover, compare, and reserve travel experiences offered by third-party tour operators and professional guides.
              </p>
              <p className="font-semibold">We facilitate the booking process by:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Displaying tour information provided by tour operators</li>
                <li>Processing online payments for booking and reservation services</li>
                <li>Issuing booking confirmations</li>
                <li>Supporting communication related to bookings</li>
              </ul>
              <p className="font-semibold text-gray-900">
                ATOC KOREA LLC does not operate tours, employ guides or drivers, or provide on-site travel services. All tours and experiences are delivered by independent third-party providers.
              </p>
            </div>
          </section>

          {/* Why Choose Us */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Why Choose Us</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear Intermediary Model</h3>
                <p className="text-gray-700">
                  Our platform is designed around a transparent intermediary structure. We handle bookings and payments; tour providers deliver the experience.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Verified Independent Providers</h3>
                <p className="text-gray-700">
                  We work with independent tour providers who are responsible for holding required licenses, permits, and insurance.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Transparent Booking & Pricing</h3>
                <p className="text-gray-700 mb-2">Before booking, customers are clearly informed of:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                  <li>Payment structure (deposit or full payment)</li>
                  <li>Inclusions and exclusions</li>
                  <li>Cancellation and refund conditions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Online Payments</h3>
                <p className="text-gray-700">
                  Payments are processed through trusted third-party payment processors using industry-standard security practices.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Platform-Level Support</h3>
                <p className="text-gray-700">
                  We provide customer support for bookings, payments, and confirmations, ensuring a reliable booking experience.
                </p>
              </div>
            </div>
          </section>

          {/* Partners */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Partners</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                We collaborate with independent tour operators, guides, and travel service providers who wish to reach international travelers through our platform.
              </p>
              <p className="font-semibold">All partners:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Operate independently</li>
                <li>Remain responsible for tour execution and compliance</li>
                <li>Are not employees or agents of ATOC KOREA LLC</li>
              </ul>
              <p>
                For partnership inquiries, please contact us via the <a href="/support" className="text-blue-600 hover:underline">Contact Us</a> page.
              </p>
            </div>
          </section>

          {/* Careers */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Careers</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4 text-gray-700">
              <p>
                ATOC KOREA LLC is a technology-driven booking platform focused on building reliable and transparent travel infrastructure.
              </p>
              <p className="font-semibold">We occasionally seek professionals in:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Platform operations</li>
                <li>Customer support</li>
                <li>Product and technology</li>
              </ul>
              <p>
                Open positions, if any, will be listed on our website.
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

