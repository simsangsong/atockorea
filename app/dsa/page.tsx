'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function DSAPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
            Information according to the Digital Services Act (EU)
          </h1>

          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 space-y-6 text-gray-700">
            <p>
              This website is operated by ATOC KOREA LLC, an online travel booking platform.
            </p>
            <p>
              The platform facilitates reservations between users and independent third-party tour providers. ATOC KOREA LLC does not provide tour services directly.
            </p>

            {/* Contact Point for Authorities and Users */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Contact Point for Authorities and Users (Article 11 & 12 DSA)
              </h2>
              <ul className="space-y-2">
                <li>
                  <strong>Email:</strong> <a href="mailto:legal@atockorea.com" className="text-blue-600 hover:underline">legal@atockorea.com</a>
                </li>
                <li>
                  <strong>Language of communication:</strong> English
                </li>
              </ul>
            </section>

            {/* Role under the DSA */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Role under the DSA</h2>
              <p>
                ATOC KOREA LLC qualifies as an online intermediary service provider under the Digital Services Act.
              </p>
              <p>
                We do not host illegal content knowingly and cooperate with lawful orders from competent authorities.
              </p>
            </section>

            {/* Average Monthly Active Recipients in the EU */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Average Monthly Active Recipients in the EU
              </h2>
              <p>
                The number of average monthly active recipients of the service in the European Union is below the threshold for designation as a Very Large Online Platform (VLOP) under Article 33 DSA.
              </p>
              <p className="mt-3">
                This information may be updated as required by law.
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



