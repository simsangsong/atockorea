'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Merchant {
  id: string;
  company_name: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  is_verified: boolean;
  created_at: string;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // TODO: Fetch merchants from API
    // For now, use placeholder data
    setMerchants([
      {
        id: '1',
        company_name: 'Jeju Travel Agency',
        contact_person: 'Kim Min-soo',
        contact_email: 'kim@jejutravel.com',
        contact_phone: '010-1234-5678',
        status: 'active',
        is_verified: true,
        created_at: '2024-01-15',
      },
      {
        id: '2',
        company_name: 'Seoul City Tours',
        contact_person: 'Park Ji-eun',
        contact_email: 'park@seoulcity.com',
        contact_phone: '010-2345-6789',
        status: 'active',
        is_verified: true,
        created_at: '2024-01-20',
      },
    ]);
    setLoading(false);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMerchants = merchants.filter((merchant) =>
    merchant.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    merchant.contact_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">商家管理</h1>
          <p className="text-gray-600 mt-2">管理所有入驻商家</p>
        </div>
        <Link
          href="/admin/merchants/create"
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors inline-block"
        >
          ➕ 添加新商家
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="搜索商家名称或邮箱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">所有状态</option>
            <option value="active">活跃</option>
            <option value="pending">待审核</option>
            <option value="suspended">已暂停</option>
            <option value="inactive">已停用</option>
          </select>
        </div>
      </div>

      {/* Merchants Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                商家名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                联系人
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                联系方式
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                注册时间
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  加载中...
                </td>
              </tr>
            ) : filteredMerchants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  没有找到商家
                </td>
              </tr>
            ) : (
              filteredMerchants.map((merchant) => (
                <tr key={merchant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {merchant.company_name}
                        </div>
                        {merchant.is_verified && (
                          <span className="text-xs text-blue-600">✓ 已认证</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{merchant.contact_person}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{merchant.contact_email}</div>
                    <div className="text-sm text-gray-500">{merchant.contact_phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        merchant.status
                      )}`}
                    >
                      {merchant.status === 'active' ? '活跃' :
                       merchant.status === 'pending' ? '待审核' :
                       merchant.status === 'suspended' ? '已暂停' : '已停用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {merchant.created_at}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/merchants/${merchant.id}`}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      查看
                    </Link>
                    <button className="text-gray-600 hover:text-gray-900">
                      编辑
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

