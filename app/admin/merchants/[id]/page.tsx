'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, BadgeCheck, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConfirmSheet } from '@/components/admin/ConfirmSheet';
import { Skeleton } from '@/components/admin/Skeleton';
import { cn } from '@/lib/utils';

interface Merchant {
  id: string;
  company_name: string;
  business_registration_number: string | null;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  user_profiles: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  tours: Array<{
    id: string;
    title: string;
    city: string;
    price: number;
    is_active: boolean;
    created_at: string;
  }>;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기' },
  { value: 'active', label: '운영중' },
  { value: 'suspended', label: '중지' },
  { value: 'inactive', label: '비활성' },
] as const;

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

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}

export default function MerchantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const merchantId = params?.id as string;

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (merchantId) fetchMerchant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const fetchMerchant = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        router.push('/signin?redirect=/admin/merchants');
        return;
      }

      const response = await fetch(`/api/admin/merchants/${merchantId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('관리자 권한이 필요합니다');
          router.push('/');
          return;
        }
        throw new Error('업체 정보를 불러오지 못했습니다');
      }

      const data = await response.json();
      setMerchant(data.merchant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Error fetching merchant:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const patchMerchant = async (body: Record<string, unknown>): Promise<boolean> => {
    setUpdating(true);
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (!session) {
        toast.error('로그인이 필요합니다');
        return false;
      }
      const response = await fetch(`/api/admin/merchants/${merchantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || '업데이트하지 못했습니다');
      }
      const data = await response.json();
      setMerchant(data.merchant);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Error updating merchant:', err);
      toast.error(message);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatus) return;
    const ok = await patchMerchant({ status: pendingStatus });
    if (ok) toast.success(`상태를 '${statusLabel(pendingStatus)}'(으)로 변경했습니다`);
    setPendingStatus(null);
  };

  const handleVerifyToggle = async () => {
    const next = !merchant?.is_verified;
    const ok = await patchMerchant({ isVerified: next });
    if (ok) toast.success(next ? '인증 처리했습니다' : '인증을 해제했습니다');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-design-md" />
        <Skeleton className="h-28 w-full rounded-design-md" />
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="rounded-design-md border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-800">오류: {error || '업체를 찾을 수 없습니다'}</p>
        <Link
          href="/admin/merchants"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
        >
          업체 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/merchants"
            className="mb-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <ChevronLeft className="size-4" /> 업체 목록
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{merchant.company_name}</h1>
            {merchant.is_verified && <BadgeCheck className="size-5 text-blue-600" />}
          </div>
          <p className="mt-1 text-sm text-slate-500">업체 상세</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={merchant.status}
            onChange={(e) => setPendingStatus(e.target.value)}
            disabled={updating}
            className={cn('min-h-11 rounded-lg border-0 px-3 text-sm font-semibold', statusPillClass(merchant.status))}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={handleVerifyToggle}
            disabled={updating}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-50',
              merchant.is_verified
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            <ShieldCheck className="size-4" />
            {merchant.is_verified ? '인증됨' : '인증하기'}
          </button>
        </div>
      </div>

      {/* Company info */}
      <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">회사 정보</h2>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Detail label="회사명" value={merchant.company_name} />
          <Detail label="사업자등록번호" value={merchant.business_registration_number || 'N/A'} />
          <Detail label="담당자" value={merchant.contact_person} />
          <Detail label="이메일" value={merchant.contact_email} />
          <Detail label="연락처" value={merchant.contact_phone} />
          <Detail
            label="상태"
            value={
              <span className={cn('inline-block rounded-full px-3 py-1 text-sm font-semibold', statusPillClass(merchant.status))}>
                {statusLabel(merchant.status)}
              </span>
            }
          />
        </dl>

        {merchant.address_line1 && (
          <div className="mt-5">
            <dt className="mb-1 text-sm font-medium text-slate-500">주소</dt>
            <dd className="text-slate-900">
              {merchant.address_line1}
              {merchant.address_line2 && `, ${merchant.address_line2}`}
              {merchant.city && `, ${merchant.city}`}
              {merchant.province && `, ${merchant.province}`}
              {merchant.postal_code && ` ${merchant.postal_code}`}
              {`, ${merchant.country}`}
            </dd>
          </div>
        )}
      </section>

      {/* User account */}
      {merchant.user_profiles && (
        <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">로그인 계정</h2>
          <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Detail label="이름" value={merchant.user_profiles.full_name || 'N/A'} />
            <Detail label="이메일" value={merchant.user_profiles.email} />
          </dl>
        </section>
      )}

      {/* Tours */}
      <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">등록 투어 ({merchant.tours?.length || 0})</h2>
        {merchant.tours && merchant.tours.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-admin-border bg-slate-50">
                <tr>
                  {['투어', '도시', '가격', '상태', '등록일'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {merchant.tours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-admin-surface-hover">
                    <td className="px-4 py-3">
                      <Link href={`/tour/${tour.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                        {tour.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{tour.city}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-900">₩{parseFloat(String(tour.price)).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        tour.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700',
                      )}>
                        {tour.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{new Date(tour.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-slate-500">등록된 투어가 없습니다</p>
        )}
      </section>

      <ConfirmSheet
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        title="상태 변경"
        subtitle={pendingStatus ? `'${merchant.company_name}' 상태를 '${statusLabel(pendingStatus)}'(으)로 변경합니다.` : undefined}
        confirmLabel="변경"
        confirming={updating}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
