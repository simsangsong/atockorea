'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MerchantDashboard() {
  const [stats, setStats] = useState({
    todayOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    todayRevenue: 0,
    totalRevenue: 0,
    activeProducts: 0,
  });

  useEffect(() => {
    // TODO: Fetch stats from API
    // For now, use placeholder data
    setStats({
      todayOrders: 5,
      pendingOrders: 3,
      totalProducts: 12,
      todayRevenue: 450000,
      totalRevenue: 12500000,
      activeProducts: 10,
    });
  }, []);

  const statCards = [
    {
      title: '今日订单',
      value: stats.todayOrders,
      subtitle: `${stats.pendingOrders} 待处理`,
      icon: '📦',
      color: 'bg-blue-500',
    },
    {
      title: '我的产品',
      value: stats.totalProducts,
      subtitle: `${stats.activeProducts} 在售`,
      icon: '🎫',
      color: 'bg-green-500',
    },
    {
      title: '今日营收',
      value: `₩${stats.todayRevenue.toLocaleString()}`,
      subtitle: '今日收入',
      icon: '💰',
      color: 'bg-purple-500',
    },
    {
      title: '累计营收',
      value: `₩${stats.totalRevenue.toLocaleString()}`,
      subtitle: '总收入',
      icon: '💵',
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">仪表板</h1>
        <p className="text-gray-600 mt-2">欢迎回来！这里是您的业务概览</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
              </div>
              <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center text-white text-2xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
            <span>➕</span>
            <span>添加新产品</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <span>📦</span>
            <span>处理订单</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
            <span>📊</span>
            <span>查看报表</span>
          </button>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">最近订单</h2>
          <Link href="/merchant/orders" className="text-sm text-indigo-600 hover:text-indigo-700">
            查看全部 →
          </Link>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600">📦</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">订单 #123{i}</p>
                  <p className="text-xs text-gray-500">2位客人 · 2024-01-15</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">₩{((i + 1) * 50000).toLocaleString()}</p>
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  待确认
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

