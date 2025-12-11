'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import OrdersChart from '@/components/charts/OrdersChart';
import RevenueTrendChart from '@/components/charts/RevenueTrendChart';

export default function MerchantDashboard() {
  const [stats, setStats] = useState({
    // Order statistics
    todayOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    activeProducts: 0,
    
    // Today's financial metrics
    todayRevenue: 0,
    todayPlatformFee: 0,
    todayMerchantPayout: 0,
    todayPendingSettlement: 0,
    todaySettledRevenue: 0,
    
    // Total financial metrics
    totalRevenue: 0,
    totalPlatformFee: 0,
    totalMerchantPayout: 0,
    pendingSettlement: 0, // 待结算
    settledRevenue: 0, // 已结算
    remainingBalance: 0, // 付后结余
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch stats from API
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/merchant/dashboard/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }
        const data = await response.json();
        setStats(data.stats);
        setRecentOrders(data.recentOrders || []);

        // Fetch trend data for chart
        const trendResponse = await fetch('/api/merchant/dashboard/trend');
        if (trendResponse.ok) {
          const trendData = await trendResponse.json();
          setTrendData(trendData.trend || []);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Fallback to placeholder data on error
        setStats({
          todayOrders: 0,
          pendingOrders: 0,
          totalProducts: 0,
          activeProducts: 0,
          todayRevenue: 0,
          todayPlatformFee: 0,
          todayMerchantPayout: 0,
          todayPendingSettlement: 0,
          todaySettledRevenue: 0,
          totalRevenue: 0,
          totalPlatformFee: 0,
          totalMerchantPayout: 0,
          pendingSettlement: 0,
          settledRevenue: 0,
          remainingBalance: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    {
      title: '오늘 주문',
      value: stats.todayOrders,
      subtitle: `${stats.pendingOrders}건 대기`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      title: '내 상품',
      value: stats.totalProducts,
      subtitle: `${stats.activeProducts}개 판매중`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      title: '오늘 매출',
      value: `₩${stats.todayRevenue.toLocaleString()}`,
      subtitle: '오늘 수입',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-purple-500 to-violet-600',
    },
    {
      title: '총 매출',
      value: `₩${stats.totalRevenue.toLocaleString()}`,
      subtitle: `실수령: ₩${stats.totalMerchantPayout.toLocaleString()}`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: 'from-orange-500 to-amber-600',
    },
    {
      title: '정산 대기',
      value: `₩${stats.pendingSettlement.toLocaleString()}`,
      subtitle: '정산 대기 금액',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-yellow-500 to-orange-600',
    },
    {
      title: '정산 완료',
      value: `₩${stats.settledRevenue.toLocaleString()}`,
      subtitle: '정산 완료 금액',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-600',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">돌아오신 것을 환영합니다! 비즈니스 개요입니다</p>
      </div>

      {/* Stats Grid - Mobile First */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">{card.title}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
              </div>
              <div className={`bg-gradient-to-br ${card.gradient} w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0 ml-3`}>
                <div className="w-5 h-5 sm:w-6 sm:h-6">
                  {card.icon}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">빠른 작업</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <button className="flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
            <span>➕</span>
            <span>새 상품 추가</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <span>📦</span>
            <span>주문 처리</span>
          </button>
          <Link href="/merchant/revenue" className="flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
            <span>📊</span>
            <span>매출내역</span>
          </Link>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">收入趋势 (最近30天)</h2>
          <RevenueTrendChart 
            data={trendData.map(item => ({
              date: item.date,
              revenue: item.revenue,
              pendingSettlement: item.pendingSettlement || 0,
              settledRevenue: item.settledRevenue || 0,
            }))}
          />
        </div>
      )}

      {/* Orders Trend Chart */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">订单趋势 (最近30天)</h2>
          <OrdersChart data={trendData} />
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">최근 주문</h2>
          <Link href="/merchant/orders" className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700">
            전체보기 →
          </Link>
        </div>
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">로딩 중...</p>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">최근 주문이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{order.bookingId}</p>
                    <p className="text-xs text-gray-500">{order.guests}명 · {order.date}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs sm:text-sm font-semibold text-gray-900">₩{order.amount.toLocaleString()}</p>
                  <span className={`text-xs px-2 py-0.5 sm:py-1 rounded-full ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    order.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status === 'pending' ? '확인 대기' :
                     order.status === 'confirmed' ? '확인됨' :
                     order.status === 'completed' ? '완료' : order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


