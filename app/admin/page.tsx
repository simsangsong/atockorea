'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalMerchants: 0,
    activeMerchants: 0,
    totalProducts: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    // TODO: Fetch stats from API
    // For now, use placeholder data
    setStats({
      totalMerchants: 12,
      activeMerchants: 8,
      totalProducts: 156,
      totalOrders: 1245,
      todayOrders: 23,
      totalRevenue: 1250000,
    });
  }, []);

  const statCards = [
    {
      title: '总商家数',
      value: stats.totalMerchants,
      subtitle: `${stats.activeMerchants} 活跃`,
      icon: '🏢',
      color: 'bg-blue-500',
    },
    {
      title: '总产品数',
      value: stats.totalProducts,
      subtitle: '所有商家产品',
      icon: '🎫',
      color: 'bg-green-500',
    },
    {
      title: '总订单数',
      value: stats.totalOrders,
      subtitle: `今日 ${stats.todayOrders} 单`,
      icon: '📦',
      color: 'bg-purple-500',
    },
    {
      title: '总营收',
      value: `₩${stats.totalRevenue.toLocaleString()}`,
      subtitle: '累计收入',
      icon: '💰',
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">总台管理后台</h1>
        <p className="text-gray-600 mt-2">系统概览和快速操作</p>
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
            <span>添加新商家</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <span>📊</span>
            <span>查看报表</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
            <span>⚙️</span>
            <span>系统设置</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">最近活动</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600">📦</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">新订单 #123{i}</p>
                <p className="text-xs text-gray-500">2分钟前</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

