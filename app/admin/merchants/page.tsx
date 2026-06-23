'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, CheckCircle2, Eye, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Merchant {
  id: string;
  company_name: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  is_verified: boolean;
  created_at: string;
  user_profiles: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export default function MerchantsPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchMerchants();
  }, [statusFilter]);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin?redirect=/admin/merchants');
        return;
      }

      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/admin/merchants?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('Admin access required');
          router.push('/');
          return;
        }
        const data = await response.json().catch(() => null);
        throw new Error(data?.details || data?.error || '업체 목록을 불러오지 못했습니다');
      }

      const data = await response.json();
      setMerchants(data.merchants || []);
    } catch (err: any) {
      console.error('Error fetching merchants:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (merchantId: string, newStatus: string) => {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const response = await fetch(`/api/admin/merchants/${merchantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update merchant');
      }

      alert('Merchant status updated successfully');
      fetchMerchants();
    } catch (err: any) {
      console.error('Error updating merchant:', err);
      alert(`Failed to update merchant: ${err.message}`);
    }
  };

  const handleDelete = async (merchantId: string) => {
    if (!confirm('Are you sure you want to delete this merchant? This action cannot be undone.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const response = await fetch(`/api/admin/merchants/${merchantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete merchant');
      }

      alert('Merchant deleted successfully');
      fetchMerchants();
    } catch (err: any) {
      console.error('Error deleting merchant:', err);
      alert(`Failed to delete merchant: ${err.message}`);
    }
  };

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return '운영중';
      case 'pending':
        return '대기';
      case 'suspended':
        return '중지';
      case 'inactive':
        return '비활성';
      default:
        return status;
    }
  };

  const filteredMerchants = merchants.filter((merchant) =>
    !searchQuery ||
    merchant.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    merchant.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    merchant.contact_person.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">업체 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">오류: {error}</p>
          <button
            onClick={fetchMerchants}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <RefreshCw className="size-4" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">업체 관리</h1>
          </div>
          <p className="text-sm text-gray-600 mt-2 md:text-base">등록된 여행사 계정과 운영 상태를 관리합니다.</p>
        </div>
        <Link
          href="/admin/merchants/create"
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 md:px-5"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">업체 추가</span>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="회사명, 이메일, 담당자로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchMerchants();
                }
              }}
              className="w-full px-4 py-2 pl-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-0 flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 sm:flex-none"
            >
              <option value="">전체 상태</option>
              <option value="active">운영중</option>
              <option value="pending">대기</option>
              <option value="suspended">중지</option>
              <option value="inactive">비활성</option>
            </select>
            <button
              onClick={fetchMerchants}
              className="inline-flex flex-shrink-0 items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Search className="size-4" />
              검색
            </button>
          </div>
        </div>
      </div>

      {/* Merchants Table — desktop only (6 columns don't fit on mobile) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업체명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  담당자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  연락처
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  등록일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMerchants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    등록된 업체가 없습니다
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
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <CheckCircle2 className="size-3" />
                              인증됨
                            </span>
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
                      <select
                        value={merchant.status}
                        onChange={(e) => handleStatusChange(merchant.id, e.target.value)}
                        className={`px-2 py-1 text-xs font-semibold rounded-full border-0 ${getStatusColor(merchant.status)}`}
                      >
                        <option value="pending">대기</option>
                        <option value="active">운영중</option>
                        <option value="suspended">중지</option>
                        <option value="inactive">비활성</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(merchant.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/merchants/${merchant.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <Eye className="size-4" />
                        보기
                      </Link>
                      <button
                        onClick={() => handleDelete(merchant.id)}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="size-4" />
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Merchants cards — mobile only */}
      <div className="space-y-2.5 md:hidden">
        {filteredMerchants.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            등록된 업체가 없습니다
          </div>
        ) : (
          filteredMerchants.map((merchant) => (
            <div key={merchant.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{merchant.company_name}</h3>
                  {merchant.is_verified && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600">
                      <CheckCircle2 className="size-3" />
                      인증됨
                    </span>
                  )}
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(merchant.status)}`}
                >
                  {getStatusLabel(merchant.status)}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="w-12 flex-shrink-0 text-gray-400">담당자</dt>
                  <dd className="min-w-0 truncate text-gray-700">{merchant.contact_person || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-12 flex-shrink-0 text-gray-400">이메일</dt>
                  <dd className="min-w-0 truncate text-gray-700">{merchant.contact_email || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-12 flex-shrink-0 text-gray-400">연락처</dt>
                  <dd className="min-w-0 truncate text-gray-700">{merchant.contact_phone || '—'}</dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-400">
                  {new Date(merchant.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/admin/merchants/${merchant.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"
                  >
                    <Eye className="size-4" />
                    보기
                  </Link>
                  <button
                    onClick={() => handleDelete(merchant.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-red-600"
                  >
                    <Trash2 className="size-4" />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
