'use client';

import { useState, useEffect } from 'react';

interface Order {
  id: string;
  tour_date: string;
  number_of_people: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  final_price: number;
  contact_name: string;
  contact_email: string;
  tour: {
    title: string;
    city: string;
  };
}

export default function MerchantOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    // TODO: Fetch orders from API
    setOrders([
      {
        id: '1',
        tour_date: '2024-01-20',
        number_of_people: 2,
        status: 'pending',
        final_price: 160000,
        contact_name: 'John Doe',
        contact_email: 'john@example.com',
        tour: { title: 'Jeju UNESCO Tour', city: 'Jeju' },
      },
    ]);
    setLoading(false);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = statusFilter
    ? orders.filter((o) => o.status === statusFilter)
    : orders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">订单管理</h1>
          <p className="text-gray-600 mt-2">管理您的所有订单</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">所有状态</option>
            <option value="pending">待确认</option>
            <option value="confirmed">已确认</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">产品</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">人数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">加载中...</td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">没有订单</td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">#{order.id.slice(0, 8)}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{order.tour.title}</div>
                    <div className="text-sm text-gray-500">{order.tour.city}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{order.contact_name}</div>
                    <div className="text-sm text-gray-500">{order.contact_email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{order.tour_date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{order.number_of_people} 人</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    ₩{order.final_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {order.status === 'pending' ? '待确认' :
                       order.status === 'confirmed' ? '已确认' :
                       order.status === 'completed' ? '已完成' : '已取消'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {order.status === 'pending' && (
                      <button className="text-green-600 hover:text-green-900 mr-4">
                        确认
                      </button>
                    )}
                    <button className="text-indigo-600 hover:text-indigo-900">
                      详情
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

