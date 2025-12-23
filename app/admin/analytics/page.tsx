'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Stats {
  totalMerchants: number;
  activeMerchants: number;
  totalProducts: number;
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalMerchants: 0,
    activeMerchants: 0,
    totalProducts: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin?redirect=/admin/analytics');
        return;
      }

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('Admin access required');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Analytics</h1>
        <p className="text-gray-600 mt-2">System statistics and insights</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Merchants</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalMerchants}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.activeMerchants} active</p>
            </div>
            <div className="bg-blue-500 w-12 h-12 rounded-lg flex items-center justify-center text-white text-2xl">
              🏢
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Products</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-xs text-gray-500 mt-1">Active tours</p>
            </div>
            <div className="bg-green-500 w-12 h-12 rounded-lg flex items-center justify-center text-white text-2xl">
              🎫
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.todayOrders} today</p>
            </div>
            <div className="bg-purple-500 w-12 h-12 rounded-lg flex items-center justify-center text-white text-2xl">
              📦
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 col-span-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-4xl font-bold text-gray-900">
                ₩{stats.totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Cumulative income</p>
            </div>
            <div className="bg-orange-500 w-16 h-16 rounded-lg flex items-center justify-center text-white text-3xl">
              💰
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Statistics</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Orders:</span>
              <span className="text-2xl font-bold text-gray-900">{stats.totalOrders}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Today's Orders:</span>
              <span className="text-xl font-semibold text-indigo-600">{stats.todayOrders}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Average per day: {stats.totalOrders > 0 ? (stats.totalOrders / 30).toFixed(1) : 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Overview</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Merchants:</span>
              <span className="text-2xl font-bold text-green-600">{stats.activeMerchants}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Products:</span>
              <span className="text-xl font-semibold text-blue-600">{stats.totalProducts}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Products per merchant: {stats.activeMerchants > 0 ? (stats.totalProducts / stats.activeMerchants).toFixed(1) : 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue Trends</h2>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            Chart visualization will be added here (e.g., using Recharts or Chart.js)
          </p>
        </div>
      </div>
    </div>
  );
}

