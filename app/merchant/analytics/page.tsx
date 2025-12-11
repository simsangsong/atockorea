'use client';

import { useState, useEffect } from 'react';
import SalesTrendChart from '@/components/charts/SalesTrendChart';
import TopProductsChart from '@/components/charts/TopProductsChart';

export default function MerchantAnalyticsPage() {
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalPlatformFee: 0,
    totalMerchantPayout: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    topProducts: [] as any[],
    salesTrend: [] as any[],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/merchant/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        setAnalytics(data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        // Fallback to empty data on error
        setAnalytics({
          totalRevenue: 0,
          totalPlatformFee: 0,
          totalMerchantPayout: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          topProducts: [],
          salesTrend: [],
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">数据分析</h1>
        <p className="text-gray-600 mt-2">查看您的业务数据和趋势</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">总营收</p>
          <p className="text-3xl font-bold text-gray-900">
            ₩{analytics.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            平台手续费: ₩{analytics.totalPlatformFee?.toLocaleString() || '0'} (10%)
          </p>
          <p className="text-xs text-gray-500">
            实际应收: ₩{analytics.totalMerchantPayout?.toLocaleString() || '0'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">总订单数</p>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">平均订单金额</p>
          <p className="text-3xl font-bold text-gray-900">
            ₩{analytics.averageOrderValue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">销售趋势</h2>
        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : analytics.salesTrend && analytics.salesTrend.length > 0 ? (
          <SalesTrendChart data={analytics.salesTrend} />
        ) : (
          <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">暂无数据</p>
          </div>
        )}
      </div>

      {/* Top Products Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">热门产品趋势</h2>
        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : analytics.topProducts && analytics.topProducts.length > 0 ? (
          <>
            <TopProductsChart data={analytics.topProducts} />
            {/* Also show list view */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">产品详情</h3>
              <div className="space-y-3">
                {analytics.topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.orders} 订单</p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      ₩{product.revenue.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">暂无数据</p>
          </div>
        )}
      </div>
    </div>
  );
}

