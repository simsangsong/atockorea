'use client';

interface TrustIndicatorsProps {
  verifiedReviewsCount?: number;
  totalBookings?: number;
  cancellationPolicy?: string;
  refundPolicy?: string;
}

export default function TrustIndicators({ 
  verifiedReviewsCount = 0,
  totalBookings = 0,
  cancellationPolicy = "Free cancellation up to 24 hours before",
  refundPolicy = "Full refund if cancelled on time"
}: TrustIndicatorsProps) {
  return (
    <div className="space-y-3">
      {/* 신뢰 배지들 */}
      <div className="flex flex-wrap gap-2">
        {/* SSL 보안 */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs font-medium text-green-700">Secure Payment</span>
        </div>

        {/* 검증된 예약 */}
        {verifiedReviewsCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium text-blue-700">{verifiedReviewsCount}+ Verified Reviews</span>
          </div>
        )}

        {/* 환불 보장 */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-purple-700">Money Back Guarantee</span>
        </div>

        {/* 실시간 예약 */}
        {totalBookings > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-medium text-orange-700">{totalBookings}+ Bookings</span>
          </div>
        )}
      </div>

      {/* 취소/환불 정책 */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-900 mb-1">{cancellationPolicy}</p>
            <p className="text-xs text-gray-600">{refundPolicy}</p>
          </div>
        </div>
      </div>
    </div>
  );
}









