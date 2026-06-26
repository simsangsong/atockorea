'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Eye, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConfirmSheet } from '@/components/admin/ConfirmSheet';
import { Skeleton } from '@/components/admin/Skeleton';
import { SavedViews } from '@/components/admin/SavedViews';
import { useUrlFilters } from '@/lib/admin/useUrlFilters';
import { cn } from '@/lib/utils';

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

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기' },
  { value: 'active', label: '운영중' },
  { value: 'suspended', label: '중지' },
  { value: 'inactive', label: '비활성' },
] as const;

const FILTER_DEFAULTS = { status: '' };

/** ConfirmSheet-backed pending action — replaces window.confirm() for both the
 *  status change and the destructive delete. */
type PendingAction =
  | { kind: 'delete'; merchant: Merchant }
  | { kind: 'status'; merchant: Merchant; newStatus: string };

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800';
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'suspended':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function MerchantsPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { filters, setFilter, setFilters } = useUrlFilters(FILTER_DEFAULTS);
  const filtersAreDefault = filters.status === '';
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchMerchants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status]);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        router.push('/signin?redirect=/admin/merchants');
        return;
      }

      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/merchants?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('관리자 권한이 필요합니다');
          router.push('/');
          return;
        }
        const data = await response.json().catch(() => null);
        throw new Error(data?.details || data?.error || '업체 목록을 불러오지 못했습니다');
      }

      const data = await response.json();
      setMerchants(data.merchants || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Error fetching merchants:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const runPending = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (!session) {
        toast.error('로그인이 필요합니다');
        return;
      }

      if (pending.kind === 'status') {
        const response = await fetch(`/api/admin/merchants/${pending.merchant.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status: pending.newStatus }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || '상태를 변경하지 못했습니다');
        }
        toast.success(`상태를 '${statusLabel(pending.newStatus)}'(으)로 변경했습니다`);
      } else {
        const response = await fetch(`/api/admin/merchants/${pending.merchant.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || '업체를 삭제하지 못했습니다');
        }
        toast.success('업체를 삭제했습니다');
      }

      setPending(null);
      fetchMerchants();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Merchant action failed:', err);
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  };

  const filteredMerchants = merchants.filter((merchant) =>
    !searchQuery ||
    merchant.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    merchant.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    merchant.contact_person.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="size-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">업체 관리</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500 md:text-base">등록된 여행사 계정과 운영 상태를 관리합니다.</p>
      </div>
      <Link
        href="/admin/merchants/create"
        className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 font-semibold text-white transition-colors hover:bg-blue-700 md:px-5"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">업체 추가</span>
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      {header}

      {/* Search and Filters */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              inputMode="search"
              placeholder="회사명, 이메일, 담당자로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchMerchants();
              }}
              className="min-h-11 w-full rounded-lg border border-admin-border bg-admin-surface pl-9 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-admin-border bg-admin-surface px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:flex-none"
            >
              <option value="">전체 상태</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={fetchMerchants}
              className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              <Search className="size-4" />
              검색
            </button>
          </div>
        </div>

        {/* U-8 saved views — bookmark the status filter (S-U2 spread). */}
        <div className="mt-3">
          <SavedViews
            storageKey="admin:merchants:saved-views"
            currentFilters={filters}
            isDefault={filtersAreDefault}
            onApply={(viewFilters) => setFilters({ ...FILTER_DEFAULTS, ...viewFilters })}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-design-md" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-design-md border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">오류: {error}</p>
          <button
            onClick={fetchMerchants}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <RefreshCw className="size-4" />
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-design-md border border-admin-border bg-admin-surface shadow-admin-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-admin-border bg-slate-50">
                  <tr>
                    {['업체명', '담당자', '연락처', '상태', '등록일', ''].map((h, i) => (
                      <th
                        key={i}
                        className={cn(
                          'px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-500',
                          i === 5 ? 'text-right' : 'text-left',
                        )}
                      >
                        {h || '작업'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {filteredMerchants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        등록된 업체가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filteredMerchants.map((merchant) => (
                      <tr key={merchant.id} className="hover:bg-admin-surface-hover">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{merchant.company_name}</div>
                          {merchant.is_verified && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <CheckCircle2 className="size-3" />
                              인증됨
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{merchant.contact_person}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm text-slate-900">{merchant.contact_email}</div>
                          <div className="text-sm text-slate-500">{merchant.contact_phone}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <select
                            value={merchant.status}
                            onChange={(e) =>
                              setPending({ kind: 'status', merchant, newStatus: e.target.value })
                            }
                            className={cn(
                              'rounded-full border-0 px-2 py-1 text-xs font-semibold',
                              statusPillClass(merchant.status),
                            )}
                          >
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                          {new Date(merchant.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <Link
                            href={`/admin/merchants/${merchant.id}`}
                            className="mr-4 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="size-4" />
                            보기
                          </Link>
                          <button
                            onClick={() => setPending({ kind: 'delete', merchant })}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
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

          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {filteredMerchants.length === 0 ? (
              <div className="rounded-design-md border border-admin-border bg-admin-surface p-8 text-center text-sm text-slate-500 shadow-admin-card">
                등록된 업체가 없습니다
              </div>
            ) : (
              filteredMerchants.map((merchant) => (
                <div key={merchant.id} className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{merchant.company_name}</h3>
                      {merchant.is_verified && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600">
                          <CheckCircle2 className="size-3" />
                          인증됨
                        </span>
                      )}
                    </div>
                    <span className={cn('flex-shrink-0 rounded-full px-2 py-1 text-xs font-semibold', statusPillClass(merchant.status))}>
                      {statusLabel(merchant.status)}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex gap-2">
                      <dt className="w-12 flex-shrink-0 text-slate-400">담당자</dt>
                      <dd className="min-w-0 truncate text-slate-700">{merchant.contact_person || '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-12 flex-shrink-0 text-slate-400">이메일</dt>
                      <dd className="min-w-0 truncate text-slate-700">{merchant.contact_email || '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-12 flex-shrink-0 text-slate-400">연락처</dt>
                      <dd className="min-w-0 truncate text-slate-700">{merchant.contact_phone || '—'}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center justify-between border-t border-admin-border pt-3">
                    <span className="text-xs text-slate-400">{new Date(merchant.created_at).toLocaleDateString('ko-KR')}</span>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/merchants/${merchant.id}`}
                        className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-blue-600"
                      >
                        <Eye className="size-4" />
                        보기
                      </Link>
                      <button
                        onClick={() => setPending({ kind: 'delete', merchant })}
                        className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-red-600"
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
        </>
      )}

      <ConfirmSheet
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending?.kind === 'delete' ? '업체 삭제' : '상태 변경'}
        subtitle={
          pending?.kind === 'delete'
            ? `'${pending.merchant.company_name}' 업체를 삭제합니다.`
            : pending
              ? `'${pending.merchant.company_name}' 상태를 '${statusLabel(pending.newStatus)}'(으)로 변경합니다.`
              : undefined
        }
        note={pending?.kind === 'delete' ? '이 작업은 되돌릴 수 없습니다.' : undefined}
        noteTone="danger"
        destructive={pending?.kind === 'delete'}
        confirmLabel={pending?.kind === 'delete' ? '삭제' : '변경'}
        confirming={confirming}
        onConfirm={runPending}
      />
    </div>
  );
}
