'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function ForgotIDPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  // Function to mask email (e.g., abc***xyz@email.com)
  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`;
    }
    const visibleStart = localPart.substring(0, 3);
    const visibleEnd = localPart.substring(localPart.length - 3);
    return `${visibleStart}***${visibleEnd}@${domain}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call to find email
    setTimeout(() => {
      setIsLoading(false);
      // In production, this would check if the email exists in the database
      // For demo purposes, we'll use the entered email
      setFoundEmail(email);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-md mx-auto">
          {/* Forgot ID Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-8">
            {!foundEmail ? (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Forgot ID?</h1>
                <p className="text-gray-600 text-center mb-8">
                  Enter your email address to find your account ID.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Searching...' : 'Find My ID'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    href="/signin"
                    className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Found</h2>
                <p className="text-gray-600 mb-4">Your account email is:</p>
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-6">
                  <p className="text-lg font-mono font-semibold text-indigo-900">
                    {maskEmail(foundEmail)}
                  </p>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  This is a masked version of your email for security purposes.
                </p>
                <div className="space-y-3">
                  <Link
                    href="/signin"
                    className="block w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md hover:shadow-lg text-center"
                  >
                    Back to Sign In
                  </Link>
                  <button
                    onClick={() => {
                      setFoundEmail(null);
                      setEmail('');
                    }}
                    className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold"
                  >
                    Search Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

