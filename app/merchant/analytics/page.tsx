'use client';

import { useState, useEffect } from 'react';

export default function MerchantAnalyticsPage() {
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    topProducts: [] as any[],
  });

  useEffect(() => {
    // TODO: Fetch analytics from API
    setAnalytics({
      totalRevenue: 12500000,
      totalOrders: 156,
      averageOrderValue: 80128,
      topProducts: [
        { name: 'Jeju UNESCO Tour', orders: 45, revenue: 3600000 },
        { name: 'Seoul Palace Tour', orders: 32, revenue: 2208000 },
      ],
    });
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

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">热门产品</h2>
        <div className="space-y-4">
          {analytics.topProducts.map((product, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
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

      {/* Chart Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">销售趋势</h2>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">图表将在这里显示</p>
        </div>
      </div>
    </div>
  );
}

