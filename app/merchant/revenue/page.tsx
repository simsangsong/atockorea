'use client';

import { useState, useEffect } from 'react';
import RevenueChart from '@/components/charts/RevenueChart';

type DateRange = 'today' | 'week' | 'month' | 'custom';

interface RevenueItem {
  id: string;
  date: string;
  tourName: string;
  bookingId: string;
  guests: number;
  amount: number; // 客人支付金额
  platformFee?: number; // 平台手续费
  merchantPayout?: number; // 商家应收金额
  paymentStatus: 'pending' | 'paid' | 'settled' | 'refunded';
  settlementStatus: 'pending' | 'settled';
}

export default function MerchantRevenuePage() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [revenueData, setRevenueData] = useState<RevenueItem[]>([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0, // 客人支付总金额
    platformFee: 0, // 平台手续费
    merchantPayout: 0, // 实际应收金额（应付金额）
    pendingSettlement: 0, // 待结算金额
    settledRevenue: 0, // 已结算金额
    remainingBalance: 0, // 付后结余
    totalBookings: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRevenueData();
  }, [dateRange, customStartDate, customEndDate]);

  const fetchRevenueData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        dateRange,
        ...(dateRange === 'custom' && customStartDate && customEndDate
          ? { startDate: customStartDate, endDate: customEndDate }
          : {}),
      });

      const response = await fetch(`/api/merchant/revenue?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch revenue data');
      }

      const data = await response.json();
      setRevenueData(data.items || []);
      setSummary(data.summary || {
        totalRevenue: 0,
        platformFee: 0,
        merchantPayout: 0,
        pendingSettlement: 0,
        settledRevenue: 0,
        remainingBalance: 0,
        totalBookings: 0,
      });
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      // Fallback to mock data for development
      const mockData: RevenueItem[] = [
        {
          id: '1',
          date: new Date().toISOString().split('T')[0],
          tourName: 'Jeju: Eastern UNESCO Join in Tour',
          bookingId: 'BK-2024-001',
          guests: 2,
          amount: 93620,
          paymentStatus: 'paid',
          settlementStatus: 'pending',
        },
        {
          id: '2',
          date: new Date().toISOString().split('T')[0],
          tourName: 'Jeju: Eastern UNESCO Join in Tour',
          bookingId: 'BK-2024-002',
          guests: 1,
          amount: 46810,
          paymentStatus: 'paid',
          settlementStatus: 'settled',
        },
      ];
      setRevenueData(mockData);
      // Mock data with 10% platform fee
      const mockTotalRevenue = 140430;
      const mockPlatformFee = mockTotalRevenue * 0.1;
      const mockMerchantPayout = mockTotalRevenue - mockPlatformFee;
      const mockPendingSettlement = 93620 * 0.9; // 扣除10%手续费
      const mockSettledRevenue = 46810 * 0.9; // 扣除10%手续费
      
      setSummary({
        totalRevenue: mockTotalRevenue,
        platformFee: mockPlatformFee,
        merchantPayout: mockMerchantPayout,
        pendingSettlement: mockPendingSettlement,
        settledRevenue: mockSettledRevenue,
        remainingBalance: mockMerchantPayout - mockSettledRevenue,
        totalBookings: 2,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'today':
        return '오늘';
      case 'week':
        return '이번 주';
      case 'month':
        return '이번 달';
      case 'custom':
        return customStartDate && customEndDate
          ? `${customStartDate} ~ ${customEndDate}`
          : '기간 선택';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">매출내역</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">매출 및 정산 내역을 확인하세요</p>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">기간 선택</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              dateRange === 'today'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            오늘
          </button>
          <button
            onClick={() => setDateRange('week')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              dateRange === 'week'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            이번 주
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              dateRange === 'month'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            이번 달
          </button>
          <button
            onClick={() => setDateRange('custom')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              dateRange === 'custom'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            기간 선택
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={fetchRevenueData}
              className="px-4 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-indigo-700 transition-colors"
            >
              조회
            </button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          선택된 기간: <span className="font-medium">{getDateRangeLabel()}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">客人支付总金额</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            ₩{summary.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">平台手续费: ₩{summary.platformFee.toLocaleString()} (10%)</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">应付金额</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">
            ₩{summary.merchantPayout.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">实际应收金额（扣除10%手续费）</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">已结算金额</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            ₩{summary.settledRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">已支付给商家</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">付后结余</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">
            ₩{summary.remainingBalance.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">待支付金额</p>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      {revenueData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">收入趋势</h2>
          <RevenueChart 
            data={revenueData.map(item => ({
              date: item.date,
              amount: item.amount,
              platformFee: item.platformFee || 0,
              merchantPayout: item.merchantPayout || 0,
            }))}
          />
        </div>
      )}

      {/* Revenue Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">매출 상세 내역</h2>
          <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors">
            엑셀 다운로드
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">로딩 중...</p>
          </div>
        ) : revenueData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">데이터가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    날짜
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    상품명
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    예약번호
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    인원
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    客人支付金额
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    平台手续费
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    商家应收金额
                  </th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    결제상태
                  </th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700">
                    정산상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {revenueData.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900">
                      {new Date(item.date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900">
                      {item.tourName}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600">
                      {item.bookingId}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 text-right">
                      {item.guests}명
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 text-right">
                      ₩{item.amount.toLocaleString()}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 text-right">
                      ₩{((item.platformFee || item.amount * 0.1)).toLocaleString()}
                      <span className="text-xs text-gray-500 ml-1">(10%)</span>
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-indigo-600 text-right">
                      ₩{(item.merchantPayout || item.amount * 0.9).toLocaleString()}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          item.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : item.paymentStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.paymentStatus === 'paid'
                          ? '결제완료'
                          : item.paymentStatus === 'pending'
                          ? '결제대기'
                          : '환불'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          item.settlementStatus === 'settled'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.settlementStatus === 'settled' ? '정산완료' : '정산대기'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

