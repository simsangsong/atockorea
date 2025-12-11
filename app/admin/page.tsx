'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalMerchants: 0,
    activeMerchants: 0,
    totalProducts: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    pendingSettlement: 0, // 待结账
    settledRevenue: 0, // 已结账
  });

  useEffect(() => {
    // Fetch stats from API
    const fetchStats = async () => {
      try {
        // TODO: Create API endpoint for dashboard stats
        // For now, use placeholder data
        setStats({
          totalMerchants: 12,
          activeMerchants: 8,
          totalProducts: 156,
          totalOrders: 1245,
          todayOrders: 23,
          totalRevenue: 12500000,
          pendingSettlement: 3500000, // 待结账金额
          settledRevenue: 9000000, // 已结账金额
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    {
      title: '总商家数',
      value: stats.totalMerchants,
      subtitle: `${stats.activeMerchants} 活跃`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      title: '总产品数',
      value: stats.totalProducts,
      subtitle: '所有商家产品',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      title: '总订单数',
      value: stats.totalOrders,
      subtitle: `今日 ${stats.todayOrders} 单`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      gradient: 'from-purple-500 to-violet-600',
    },
    {
      title: '总营业额',
      value: `₩${stats.totalRevenue.toLocaleString()}`,
      subtitle: '累计营业额',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-orange-500 to-amber-600',
    },
    {
      title: '待结账',
      value: `₩${stats.pendingSettlement.toLocaleString()}`,
      subtitle: '待结算金额',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-yellow-500 to-orange-600',
    },
    {
      title: '已结账',
      value: `₩${stats.settledRevenue.toLocaleString()}`,
      subtitle: '已结算金额',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">总台管理后台</h1>
        <p className="text-gray-600 mt-2">系统概览和快速操作</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <div className={`bg-gradient-to-br ${card.gradient} w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-md`}>
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
          <Link href="/admin/revenue" className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <span>📊</span>
            <span>매출내역</span>
          </Link>
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

