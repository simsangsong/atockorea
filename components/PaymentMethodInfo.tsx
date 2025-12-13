export default function PaymentMethodInfo() {
  return (
    <section className="py-6 sm:py-8 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/40 md:border-gray-200/30 p-4 sm:p-5 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="text-center mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
              Payment Options
            </h2>
            <p className="text-xs text-gray-600">
              Choose the payment method that works best for you
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
            {/* Deposit + Cash on Day Option */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-3 sm:p-4 border border-blue-200/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                    Deposit + Cash on Day
                  </h3>
                  <p className="text-xs text-gray-700 mb-2 leading-relaxed">
                    Pay a deposit online to secure your booking, then pay the remaining balance in cash to the guide on the day.
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>More flexible payment option</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Full Amount Online Option */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-lg p-3 sm:p-4 border border-orange-200/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 bg-orange-600 rounded-lg flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                    Full Amount Online
                  </h3>
                  <p className="text-xs text-gray-700 mb-2 leading-relaxed">
                    Pay the full amount online in advance. Quick, secure, and convenient. No need to worry about cash on the day.
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>All payments processed securely</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

