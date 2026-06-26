'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Search, X, Download, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BookingStatusBadge } from '@/components/admin/BookingStatusBadge';
import { Skeleton } from '@/components/admin/Skeleton';
import { ConfirmSheet } from '@/components/admin/ConfirmSheet';
import { SavedViews } from '@/components/admin/SavedViews';
import { useUrlFilters } from '@/lib/admin/useUrlFilters';
import { useRealtimeActivity } from '@/lib/admin/useRealtimeActivity';
import { formatBookingPrice, type BookingCurrency } from '@/lib/format/currency';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  booking_date?: string;
  tour_date?: string;
  number_of_guests?: number;
  number_of_people?: number;
  total_price?: number;
  final_price: number | null;
  /** Phase 10.6 — present for all rows after the bookings.currency column
   *  default 'usd' was added; KRW for itinerary_builder rows. */
  currency?: BookingCurrency;
  /** Phase 10.6 — 'tour_product' (default) | 'itinerary_builder'. */
  source?: 'tour_product' | 'itinerary_builder' | string;
  booking_reference?: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  payment_status: string;
  created_at: string;
  pickup_point_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  tours: {
    id: string;
    title: string;
  } | null;
  user_profiles: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  pickup_points?: {
    id: string;
    name: string;
    address: string;
  } | null;
}

const SOURCE_CHIPS = [
  { value: '', label: '전체' },
  { value: 'tour_product', label: '투어 상품' },
  { value: 'itinerary_builder', label: '커스텀 일정' },
] as const;

const FILTER_DEFAULTS = {
  status: '',
  source: '',
  orderBy: 'created_at',
  order: 'desc',
};

export default function OrdersPage() {
  const router = useRouter();
  const { filters, setFilter, setFilters } = useUrlFilters(FILTER_DEFAULTS);
  const filtersAreDefault =
    JSON.stringify(filters) === JSON.stringify(FILTER_DEFAULTS);
  // U-1 — count new bookings arriving after load (realtime, non-disruptive).
  const realtime = useRealtimeActivity('bookings', { event: 'INSERT' });
  // U-7 — bulk status change (confirmed / completed only; state-machine gated).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState<'confirmed' | 'completed' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.source, filters.orderBy, filters.order]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        router.push('/signin?redirect=/admin/orders');
        return;
      }

      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.source) params.set('source', filters.source);
      params.set('orderBy', filters.orderBy);
      params.set('order', filters.order);
      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('관리자 권한이 필요합니다');
          router.push('/');
          return;
        }
        throw new Error('주문을 불러오지 못했습니다');
      }

      const data = await response.json();
      setBookings(data.orders || []);
      setSelected(new Set());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Error fetching orders:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const dateKey = (b: Booking) => {
    const raw = b.tour_date || b.booking_date || b.created_at || '';
    return raw ? new Date(raw).toISOString().slice(0, 10) : 'no-date';
  };

  // Client-side search over the loaded set (tour, customer, email, phone, id, ref).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      [
        b.tours?.title,
        b.user_profiles?.full_name,
        b.contact_name,
        b.user_profiles?.email,
        b.contact_email,
        b.contact_phone,
        b.id,
        b.booking_reference,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [bookings, search]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filtered.forEach((b) => {
      const key = dateKey(b);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    const keys = Array.from(map.keys()).sort((a, b) =>
      filters.order === 'desc' ? b.localeCompare(a) : a.localeCompare(b),
    );
    return keys.map((key) => ({ date: key, items: map.get(key)! }));
  }, [filtered, filters.order]);

  const fmtAmount = (b: Booking) =>
    b.final_price != null
      ? formatBookingPrice(parseFloat(String(b.final_price)), b.currency ?? 'usd')
      : '—';

  // U-7 bulk selection helpers (operate over the filtered set).
  const allSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((b) => b.id)));
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = async () => {
    if (!bulkPending || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const { data: { session } } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!session) {
        toast.error('로그인이 필요합니다');
        return;
      }
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selected), status: bulkPending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일괄 변경에 실패했습니다');
      const label = bulkPending === 'confirmed' ? '확정' : '완료';
      toast.success(`${data.updated}건 ${label}${data.skipped ? ` (건너뜀 ${data.skipped})` : ''}`);
      setBulkPending(null);
      setSelected(new Set());
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const exportToExcel = () => {
    setExporting(true);
    try {
      const BOM = '\uFEFF';
      const headers = [
        'Order ID', 'Created At', 'Tour Date', 'Tour', 'Source', 'Customer',
        'Email', 'Phone', 'Guests', 'Pickup', 'Address', 'Amount', 'Currency',
        'Status', 'Payment Status',
      ];
      const rows = filtered.map((b) => [
        b.id,
        b.created_at ? formatDate(b.created_at) : '',
        b.tour_date || '',
        b.source === 'itinerary_builder' ? 'Custom itinerary' : (b.tours?.title || ''),
        b.source || 'tour_product',
        b.user_profiles?.full_name || b.contact_name || 'Guest',
        b.user_profiles?.email || b.contact_email || '',
        b.contact_phone || '',
        String(b.number_of_guests ?? b.number_of_people ?? 1),
        b.pickup_points?.name || '',
        b.pickup_points?.address || '',
        // D-2 — keep the raw amount but pair it with an explicit Currency column
        // so KRW 340000 and USD 52.00 are no longer ambiguous in the export.
        b.final_price != null ? String(b.final_price) : '',
        (b.currency ?? 'usd').toUpperCase(),
        b.status,
        b.payment_status || '',
      ]);
      const csv = [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const selectClass =
    'min-h-11 min-w-0 flex-shrink-0 rounded-lg border border-admin-border bg-admin-surface px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div>
      {/* Sticky filter bar (§8.2) — search + chips stay pinned below the global
          header so filters never scroll out of reach on a long list. */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-admin-border bg-admin-surface/95 px-4 pb-3 pt-4 backdrop-blur md:-mx-5 md:-mt-5 md:px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="투어·고객·이메일·주문번호 검색"
            className="min-h-11 w-full rounded-lg border border-admin-border bg-admin-surface pl-9 pr-9 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              aria-label="검색 지우기"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SOURCE_CHIPS.map((opt) => {
            const active = filters.source === opt.value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => setFilter('source', opt.value)}
                className={cn(
                  'inline-flex min-h-9 flex-shrink-0 items-center rounded-full px-3 text-xs font-semibold transition-all',
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100',
                )}
              >
                {opt.label}
              </button>
            );
          })}
          <span className="mx-1 h-5 w-px flex-shrink-0 bg-slate-200" />
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className={selectClass}
            aria-label="상태 필터"
          >
            <option value="">전체 상태</option>
            <option value="pending">대기</option>
            <option value="confirmed">확정</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
            <option value="no_show">노쇼</option>
          </select>
          <select
            value={filters.orderBy}
            onChange={(e) => setFilter('orderBy', e.target.value)}
            className={selectClass}
            aria-label="정렬 기준"
          >
            <option value="created_at">생성일</option>
            <option value="tour_date">투어일</option>
            <option value="booking_date">예약일</option>
          </select>
          <select
            value={filters.order}
            onChange={(e) => setFilter('order', e.target.value)}
            className={selectClass}
            aria-label="정렬 방향"
          >
            <option value="desc">최신순</option>
            <option value="asc">오래된순</option>
          </select>
        </div>

        {/* U-8 saved views — bookmark the current filter combination. Applying a
            view resets every key (defaults overlaid by the view's filters). */}
        <div className="mt-2.5">
          <SavedViews
            storageKey="admin:orders:saved-views"
            currentFilters={filters}
            isDefault={filtersAreDefault}
            onApply={(viewFilters) => setFilters({ ...FILTER_DEFAULTS, ...viewFilters })}
          />
        </div>
      </div>

      <div className="pt-4">
        {/* Results meta + export */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {!loading && filtered.length > 0 && (
              <label className="flex flex-shrink-0 items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                  className="size-4 rounded border-admin-border"
                />
                전체
              </label>
            )}
            <p className="text-sm text-slate-500">
              {loading ? '불러오는 중…' : (
                <>
                  총 <span className="font-semibold tabular-nums text-slate-900">{filtered.length}</span>건
                  {search && bookings.length !== filtered.length ? ` (전체 ${bookings.length})` : ''}
                </>
              )}
            </p>
            {realtime.newCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  realtime.reset();
                  fetchBookings();
                }}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 transition-colors hover:bg-blue-100"
              >
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-blue-600" />
                </span>
                새 주문 {realtime.newCount}건 · 불러오기
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={exportToExcel}
            disabled={exporting || filtered.length === 0}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-4" /> {exporting ? '내보내는 중…' : 'CSV'}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-design-md" />
            ))}
          </div>
        ) : error ? (
          <div className="max-w-xl rounded-design-md border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-800">오류: {error}</p>
            <button
              onClick={fetchBookings}
              className="mt-3 min-h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="rounded-design-md border border-admin-border bg-admin-surface p-8 text-center text-slate-500 shadow-admin-card">
            {search ? `'${search}'에 대한 주문이 없습니다` : '주문이 없습니다'}
            {filters.status && ` (상태: ${filters.status})`}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByDate.map(({ date, items }) => (
              <div key={date}>
                <h2 className="mb-3 text-base font-semibold text-slate-900">
                  {date === 'no-date'
                    ? '날짜 없음'
                    : new Date(date + 'T12:00:00').toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                  <span className="ml-2 text-sm font-normal text-slate-500">({items.length})</span>
                </h2>

                {/* Desktop: full table. Hidden on mobile where 9 columns can't fit. */}
                <div className="hidden overflow-hidden rounded-design-md border border-admin-border bg-admin-surface shadow-admin-card md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-admin-border bg-slate-50">
                        <tr>
                          <th className="w-px px-5 py-3" />
                          {['주문 ID', '투어', '고객', '날짜', '인원', '픽업', '금액', '상태', ''].map((h, i) => (
                            <th
                              key={i}
                              className={cn(
                                'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600',
                                i === 8 ? 'text-right' : 'text-left',
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-admin-border">
                        {items.map((booking) => (
                          <tr key={booking.id} className="transition-colors hover:bg-admin-surface-hover">
                            <td className="px-5 py-4">
                              <input
                                type="checkbox"
                                checked={selected.has(booking.id)}
                                onChange={() => toggleSelect(booking.id)}
                                aria-label={`주문 ${booking.id.substring(0, 8)} 선택`}
                                className="size-4 rounded border-admin-border"
                              />
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500">{booking.id.substring(0, 8)}…</td>
                            <td className="px-5 py-4">
                              {booking.source === 'itinerary_builder' ? (
                                <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                  커스텀 일정
                                </span>
                              ) : (
                                <div className="text-sm font-medium text-slate-900">{booking.tours?.title || '투어'}</div>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm text-slate-900">{booking.user_profiles?.full_name || booking.contact_name || '게스트'}</div>
                              <div className="text-xs text-slate-500">{booking.user_profiles?.email || booking.contact_email || 'N/A'}</div>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                              {formatDate(booking.tour_date || booking.created_at)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                              {booking.number_of_guests ?? booking.number_of_people ?? 1}
                            </td>
                            <td className="px-5 py-4">
                              {booking.pickup_points ? (
                                <div className="text-xs">
                                  <div className="font-medium text-slate-900">{booking.pickup_points.name}</div>
                                  <div className="mt-0.5 text-slate-500">{booking.pickup_points.address}</div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">미선택</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4">
                              <div className="text-sm font-semibold tabular-nums text-slate-900">{fmtAmount(booking)}</div>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4">
                              <BookingStatusBadge status={booking.status} className="font-semibold" />
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-medium">
                              <Link href={`/admin/orders/${booking.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                                보기
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile: tap-through cards. */}
                <div className="space-y-2.5 md:hidden">
                  {items.map((booking) => (
                    <div key={booking.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(booking.id)}
                        onChange={() => toggleSelect(booking.id)}
                        aria-label={`주문 ${booking.id.substring(0, 8)} 선택`}
                        className="mt-4 size-4 flex-shrink-0 rounded border-admin-border"
                      />
                    <Link
                      href={`/admin/orders/${booking.id}`}
                      className="block flex-1 rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card transition-colors active:bg-admin-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {booking.source === 'itinerary_builder' ? (
                            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                              커스텀 일정
                            </span>
                          ) : (
                            <h3 className="truncate text-sm font-semibold text-slate-900">
                              {booking.tours?.title || '투어'}
                            </h3>
                          )}
                        </div>
                        <BookingStatusBadge status={booking.status} className="flex-shrink-0 font-semibold" />
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                        <span className="font-medium text-slate-900">
                          {booking.user_profiles?.full_name || booking.contact_name || '게스트'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>{booking.number_of_guests ?? booking.number_of_people ?? 1}명</span>
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(booking.tour_date || booking.created_at)}
                        {booking.pickup_points ? (
                          <>
                            <span className="mx-1 text-slate-300">·</span>
                            {booking.pickup_points.name}
                          </>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-admin-border pt-3">
                        <span className="text-base font-bold tabular-nums text-slate-900">{fmtAmount(booking)}</span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                          <ShoppingCart className="size-3.5" /> 상세 보기 →
                        </span>
                      </div>
                    </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* U-7 — sticky bulk action bar. Sits above the fixed mobile bottom nav. */}
      {selected.size > 0 && (
        <div className="sticky bottom-16 z-20 mt-3 flex items-center justify-between gap-3 rounded-design-md border border-admin-border bg-admin-surface/95 px-4 py-3 shadow-admin-float backdrop-blur md:bottom-0">
          <span className="text-sm font-medium text-slate-700">{selected.size}건 선택</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBulkPending('confirmed')}
              className="inline-flex min-h-11 items-center rounded-lg border border-admin-border px-4 text-sm font-semibold text-slate-700 hover:bg-admin-surface-hover"
            >
              확정
            </button>
            <button
              type="button"
              onClick={() => setBulkPending('completed')}
              className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              완료
            </button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={bulkPending !== null}
        onOpenChange={(open) => {
          if (!open) setBulkPending(null);
        }}
        title={bulkPending === 'confirmed' ? '일괄 확정' : '일괄 완료'}
        subtitle={
          bulkPending
            ? `${selected.size}건을 '${bulkPending === 'confirmed' ? '확정' : '완료'}'로 변경합니다.`
            : undefined
        }
        note="결제(카드 청구)에는 영향이 없습니다. 전환 불가한 건(취소·완료 등)은 자동으로 건너뜁니다."
        confirmLabel={bulkPending === 'confirmed' ? '확정' : '완료'}
        confirming={bulkBusy}
        onConfirm={runBulk}
      />
    </div>
  );
}
