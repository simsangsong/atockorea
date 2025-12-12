'use client';

interface PaymentMethodsBannerProps {
  variant?: 'banner' | 'card';
}

export default function PaymentMethodsBanner({ variant = 'banner' }: PaymentMethodsBannerProps) {
  if (variant === 'card') {
    return (
      <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 rounded-xl shadow-sm border border-indigo-200/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          支付方式
        </h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-semibold text-sm">1</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">保证金 + 现金支付</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                每单支付 <span className="font-semibold text-indigo-600">10% 保证金</span>，余款在旅游当日向导游支付现金
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-semibold text-sm">2</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">线上全款支付</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                在线上一次性支付全额费用，安全便捷
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="py-8 md:py-12 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-indigo-200/50 p-6 md:p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
                <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                灵活的支付方式
              </h2>
              <p className="text-gray-600">选择最适合您的支付方式</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* 方式一：保证金 + 现金 */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">保证金 + 现金支付</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-gray-700">
                      <span className="font-semibold text-indigo-600">10% 保证金</span> 在线支付
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-gray-700">
                      余款在 <span className="font-semibold">旅游当日</span> 向导游支付现金
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-indigo-200">
                    <p className="text-xs text-gray-500">适合希望保留更多现金灵活性的旅客</p>
                  </div>
                </div>
              </div>

              {/* 方式二：线上全款 */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">线上全款支付</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-gray-700">
                      一次性支付 <span className="font-semibold text-purple-600">全额费用</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-gray-700">
                      支持多种支付方式，<span className="font-semibold">安全便捷</span>
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <p className="text-xs text-gray-500">适合希望提前完成所有支付的旅客</p>
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

