'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import ContactForm from '@/components/ContactForm';

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Contact Us</h1>

          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 space-y-6 mb-8">
            <div className="space-y-4 text-gray-700">
              <p>
                If you have questions about a booking, payment, cancellation, or refund, please contact us using the form below or email us directly.
              </p>
              <p className="font-semibold text-gray-900">
                ATOC KOREA LLC operates solely as a booking intermediary.
                We provide support for booking confirmations, payment status, refund status, and platform-related questions.
                Tour operation and on-site service matters are handled by the independent tour provider listed in your booking confirmation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 text-sm">
                <div>
                  <span className="font-semibold">Response time:</span> We aim to respond within 24–48 business hours.
                </div>
                <div>
                  <span className="font-semibold">Email:</span>{' '}
                  <a href="mailto:support@atockorea.com" className="text-blue-600 hover:underline">
                    support@atockorea.com
                  </a>
                </div>
              </div>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                <p className="text-sm font-semibold text-amber-900 mb-1">Before initiating a chargeback:</p>
                <p className="text-sm text-amber-800">
                  Please contact our support team first so we can review and resolve the issue.
                </p>
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}

