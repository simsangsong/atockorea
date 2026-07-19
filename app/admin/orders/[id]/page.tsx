'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatBookingPrice, formatHoldAmount } from '@/lib/format/currency';
import { toast } from 'sonner';
import { ConfirmSheet } from '@/components/admin/ConfirmSheet';
import { CreditCard, ClipboardList } from 'lucide-react';

/**
 * W4.1 — money confirmation sheet descriptor. Each money/state action opens a
 * ConfirmSheet (bottom sheet) instead of window.confirm(), which iOS WebView
 * silently returns `true` for — firing a charge with no dialog. `run` is the
 * executor invoked once the admin confirms.
 */
type MoneySheet = {
  title: string;
  subtitle?: string;
  amount?: string;
  note?: string;
  noteTone?: 'neutral' | 'warning' | 'danger';
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<void>;
};

interface Booking {
  id: string;
  user_id: string;
  /** Phase 10.5 — NULL for itinerary_builder bookings. */
  tour_id: string | null;
  tour_date: string;
  tour_time: string | null;
  number_of_people?: number;
  number_of_guests?: number;
  pickup_point_id: string | null;
  unit_price: number;
  total_price: number;
  discount_amount: number;
  final_price: number;
  /** Phase 10.6 — currency-aware money rendering. */
  currency?: 'usd' | 'krw' | string | null;
  /** Phase 10.6 — 'tour_product' (default) | 'itinerary_builder'. */
  source?: 'tour_product' | 'itinerary_builder' | string;
  booking_reference?: string | null;
  /** Phase 10.5 — builder booking payload (poi_keys, region, track,
   *  duration_hours, guide_language, breakdown, etc.). NULL for tour rows. */
  itinerary?: {
    poi_keys?: string[];
    region?: string;
    track?: string;
    duration_hours?: number;
    guide_language?: string;
    breakdown?: { code: string; amount: number; meta?: Record<string, unknown> }[];
    vehicle?: string;
  } | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  payment_intent_id: string | null;
  setup_intent_id: string | null;
  payment_intent_status: string | null;
  authorization_expires_at: string | null;
  no_show_fee_usd_cents: number | null;
  card_collection_method: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  special_requests: string | null;
  created_at: string;
  tours: {
    id: string;
    title: string;
    slug: string;
    city: string;
  } | null;
  user_profiles: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
  pickup_points: {
    id: string;
    name: string;
    address: string;
  } | null;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [settling, setSettling] = useState(false);
  const [dispatchingRoom, setDispatchingRoom] = useState(false);
  // W4.1 — money/state confirmation sheet (replaces window.confirm).
  const [sheet, setSheet] = useState<MoneySheet | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/signin?redirect=/admin/orders/' + orderId);
        return;
      }
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch order');
      }
      const { booking: data } = await res.json();
      setBooking(data as Booking);
    } catch (err: any) {
      console.error('Error fetching order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;

    try {
      setUpdating(true);

      if (!supabase) {
        toast.error('Supabase client not initialized');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('로그인이 필요합니다');
        return;
      }

      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update order');
      }

      toast.success('주문 상태가 변경되었습니다');
      fetchOrder();
    } catch (err: any) {
      console.error('Error updating order:', err);
      toast.error(`상태 변경 실패: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSettle = async (
    action: 'capture' | 'release',
    reason: 'tour_completed' | 'no_show' | 'collected_offline',
  ) => {
    if (!booking) return;

    try {
      setSettling(true);

      if (!supabase) {
        toast.error('Supabase client not initialized');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('로그인이 필요합니다');
        return;
      }

      const response = await fetch(`/api/admin/orders/${orderId}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          action,
          reason,
          collectedOffline: reason === 'collected_offline',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Settlement failed');
      }

      toast.success(data.message || '처리되었습니다');
      fetchOrder();
    } catch (err: any) {
      console.error('Error settling order:', err);
      toast.error(`실패: ${err.message}`);
    } finally {
      setSettling(false);
    }
  };

  // T5.3 — (re)dispatch the Tour Mode room links for this booking.
  const handleDispatchRoom = async () => {
    if (!booking) return;
    try {
      setDispatchingRoom(true);
      if (!supabase) {
        toast.error('Supabase client not initialized');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('로그인이 필요합니다');
        return;
      }
      const response = await fetch(`/api/admin/orders/${orderId}/dispatch-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '발송 실패');
      const parts = [
        data.customer?.sent ? `손님 ✓ (${data.customer.email})` : `손님 ✗ ${data.customer?.error ?? ''}`,
        data.guide?.sent ? `가이드 ✓ (${data.guide.email})` : `가이드 ✗ ${data.guide?.error ?? ''}`,
      ];
      toast.success(`투어룸 발송 완료 — ${parts.join(' · ')}${data.revokedCount ? ` · 이전 링크 ${data.revokedCount}건 폐기` : ''}`);
    } catch (err: any) {
      toast.error(`투어룸 발송 실패: ${err.message}`);
    } finally {
      setDispatchingRoom(false);
    }
  };

  // W4.1 — executes the action behind the currently open confirmation sheet.
  // The sheet's confirm button disables on first tap (idempotent) via sheetBusy.
  const runSheet = async () => {
    if (!sheet) return;
    setSheetBusy(true);
    try {
      await sheet.run();
      setSheet(null);
    } finally {
      setSheetBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-500">주문 정보를 불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-5">
          <p className="text-red-800">오류: {error || '주문을 찾을 수 없습니다'}</p>
          <Link
            href="/admin/orders"
            className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            주문 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no_show':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPiStatusColor = (status: string | null) => {
    switch (status) {
      case 'authorized':
        return 'bg-emerald-100 text-emerald-800';
      case 'captured':
        return 'bg-green-100 text-green-800';
      case 'setup_pending_hold':
      case 'auth_pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const holdMsLeft = booking.authorization_expires_at
    ? new Date(booking.authorization_expires_at).getTime() - Date.now()
    : null;
  const holdExpired = holdMsLeft !== null && holdMsLeft <= 0;
  const holdHoursLeft =
    holdMsLeft !== null ? Math.max(0, Math.floor(holdMsLeft / 3600000)) : null;
  const holdExpiringSoon =
    holdHoursLeft !== null && holdHoursLeft < 48 && !holdExpired;
  const holdAmountLabel = formatHoldAmount(
    booking.final_price,
    booking.currency,
    booking.no_show_fee_usd_cents,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-blue-600 hover:text-blue-700 mb-2 inline-block"
          >
            ← 주문 목록으로
          </Link>
          <h1 className="text-xl font-bold text-slate-900">주문 상세</h1>
          <p className="text-slate-500 mt-2">Order ID: {booking.id.substring(0, 8)}...</p>
        </div>
        <div className="flex gap-3">
          <select
            value={booking.status}
            onChange={(e) => {
              const next = e.target.value;
              if (next === booking.status) return;
              setSheet({
                title: '주문 상태 변경',
                subtitle: `${booking.status} → ${next}`,
                note: '결제에는 영향을 주지 않습니다. 상태 메타데이터만 변경됩니다.',
                noteTone: 'neutral',
                confirmLabel: '변경',
                run: () => handleStatusChange(next),
              });
            }}
            disabled={updating}
            className={`px-4 py-2 rounded-lg border-0 font-semibold ${getStatusColor(booking.status)}`}
          >
            <option value="pending">대기</option>
            <option value="confirmed">확정</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Information */}
        <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">주문 정보</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">주문 ID:</span>
              <span className="font-mono text-sm text-slate-900">{booking.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">상태:</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                {booking.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">결제 상태:</span>
              <span className="text-slate-900">{booking.payment_status || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">생성일:</span>
              <span className="text-slate-900">
                {new Date(booking.created_at).toLocaleString()}
              </span>
            </div>
            {booking.cancelled_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">취소일:</span>
                <span className="text-slate-900">
                  {new Date(booking.cancelled_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tour Information — Phase 10.6 branches to a Builder Itinerary
            section when source==='itinerary_builder'. Same card chrome so
            the admin layout stays consistent. */}
        {booking.source === 'itinerary_builder' ? (
          <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-slate-900">맞춤 일정</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                <ClipboardList className="h-3 w-3" />
                Builder
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">지역:</span>
                <span className="text-slate-900 capitalize">{booking.itinerary?.region ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">트랙:</span>
                <span className="text-slate-900 capitalize">{booking.itinerary?.track ?? '—'}</span>
              </div>
              {booking.itinerary?.duration_hours != null ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">소요 시간:</span>
                  <span className="text-slate-900">
                    {booking.itinerary.duration_hours > 0
                      ? `${booking.itinerary.duration_hours}h`
                      : '고정 상품'}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-slate-500">가이드 언어:</span>
                <span className="text-slate-900">{booking.itinerary?.guide_language ?? '—'}</span>
              </div>
              {booking.itinerary?.vehicle ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">차량:</span>
                  <span className="text-slate-900 capitalize">{booking.itinerary.vehicle}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-slate-500">투어 날짜:</span>
                <span className="text-slate-900">
                  {new Date(booking.tour_date).toLocaleDateString()}
                </span>
              </div>
              {booking.itinerary?.poi_keys && booking.itinerary.poi_keys.length > 0 ? (
                <div>
                  <span className="text-slate-500 block mb-2">장소 ({booking.itinerary.poi_keys.length}):</span>
                  <ol className="space-y-1 rounded-lg bg-slate-50 p-3">
                    {booking.itinerary.poi_keys.map((k, i) => (
                      <li key={k} className="flex items-center gap-2 text-sm">
                        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-slate-700">{k}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">투어 정보</h2>
            <div className="space-y-3">
              <div>
                <span className="text-slate-500">투어:</span>
                <Link
                  href={`/tour/${booking.tours?.slug}`}
                  target="_blank"
                  className="ml-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  {booking.tours?.title || 'N/A'}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">도시:</span>
                <span className="text-slate-900">{booking.tours?.city || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">투어 날짜:</span>
                <span className="text-slate-900">
                  {new Date(booking.tour_date).toLocaleDateString()}
                </span>
              </div>
              {booking.tour_time && (
                <div className="flex justify-between">
                  <span className="text-slate-500">투어 시간:</span>
                  <span className="text-slate-900">{booking.tour_time}</span>
                </div>
              )}
              {booking.pickup_points && (
                <div>
                  <span className="text-slate-500">픽업 장소:</span>
                  <div className="mt-1 text-sm text-slate-900">
                    <div className="font-medium">{booking.pickup_points.name}</div>
                    <div className="text-slate-500">{booking.pickup_points.address}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customer Information */}
        <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">고객 정보</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">이름:</span>
              <span className="text-slate-900">
                {booking.user_profiles?.full_name || booking.contact_name || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">이메일:</span>
              <span className="text-slate-900">
                {booking.user_profiles?.email || booking.contact_email || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">전화:</span>
              <span className="text-slate-900">
                {booking.user_profiles?.phone || booking.contact_phone || 'N/A'}
              </span>
            </div>
            {(() => {
              try {
                const sr = booking.special_requests ? JSON.parse(booking.special_requests) : {};
                const chatApp = sr.preferredChatApp || sr.preferred_chat_app;
                const chatContact = sr.chatAppContact || sr.chat_app_contact;
                if (!chatApp && !chatContact) return null;
                return (
                  <>
                    {chatApp && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">채팅 앱:</span>
                        <span className="text-slate-900 capitalize">{String(chatApp)}</span>
                      </div>
                    )}
                    {chatContact && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">채팅 연락처:</span>
                        <span className="text-slate-900">{String(chatContact)}</span>
                      </div>
                    )}
                  </>
                );
              } catch {
                return null;
              }
            })()}
          </div>
        </div>

        {/* Pricing Information */}
        <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">요금</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">인원:</span>
              <span className="text-slate-900">{booking.number_of_people ?? booking.number_of_guests ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">단가:</span>
              <span className="text-slate-900">{formatBookingPrice(booking.unit_price, booking.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">총 금액:</span>
              <span className="text-slate-900">{formatBookingPrice(booking.total_price, booking.currency)}</span>
            </div>
            {booking.discount_amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>할인:</span>
                <span>-{formatBookingPrice(booking.discount_amount, booking.currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-admin-border">
              <span className="text-lg font-semibold text-slate-900">최종 금액:</span>
              <span className="text-lg font-bold text-blue-600">
                {formatBookingPrice(booking.final_price, booking.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment / Settlement — capture the held card or release the hold */}
      <div className="bg-admin-surface rounded-design-md shadow-admin-card border border-admin-border p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">결제 / 정산</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">홀드 상태:</span>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${getPiStatusColor(
                  booking.payment_intent_status,
                )}`}
              >
                {booking.payment_intent_status || 'hold 없음'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">결제 상태:</span>
              <span className="text-slate-900">{booking.payment_status || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">홀드 금액:</span>
              {/* Phase 10.6 — currency-aware: KRW builder bookings have
                  no_show_fee_usd_cents=NULL (intentionally — final_price is the
                  canonical hold amount). holdAmountLabel falls back to
                  final_price + currency when the legacy USD-cents snapshot is
                  missing. */}
              <span className="text-slate-900 tabular-nums">{holdAmountLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">카드 수집:</span>
              <span className="text-slate-900">
                {booking.card_collection_method || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">결제 수단:</span>
              <span className="text-slate-900">{booking.payment_method || '—'}</span>
            </div>
            {booking.authorization_expires_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">홀드 만료:</span>
                <span
                  className={
                    holdExpired
                      ? 'text-red-600 font-semibold'
                      : holdExpiringSoon
                        ? 'text-amber-600 font-semibold'
                        : 'text-slate-900'
                  }
                >
                  {new Date(booking.authorization_expires_at).toLocaleString()}
                  {holdExpired
                    ? ' (만료됨)'
                    : holdExpiringSoon
                      ? ` (${holdHoursLeft}h 남음)`
                      : ''}
                </span>
              </div>
            )}
            {booking.paid_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">결제일:</span>
                <span className="text-slate-900">
                  {new Date(booking.paid_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {booking.payment_intent_status === 'authorized' && (
              <>
                {holdExpired && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    이 hold는 만료 시간이 지났습니다 — Stripe에서 청구가 거부될 수
                    있어요. 그럴 경우 다른 방법으로 수금하세요.
                  </p>
                )}
                <button
                  onClick={() =>
                    setSheet({
                      title: '카드 청구 — 투어 완료',
                      amount: holdAmountLabel,
                      note: '지금 카드에서 위 금액을 청구합니다. 청구 후 취소할 수 없습니다.',
                      noteTone: 'neutral',
                      confirmLabel: '청구',
                      run: () => handleSettle('capture', 'tour_completed'),
                    })
                  }
                  disabled={settling}
                  className="w-full min-h-11 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  카드로 청구 (투어 완료)
                </button>
                <button
                  onClick={() =>
                    setSheet({
                      title: '현장 수금 완료 — hold 해제',
                      subtitle: '카드는 청구하지 않습니다',
                      amount: holdAmountLabel,
                      note: 'hold를 해제하고 이 예약을 현장 수금(현금/이체)으로 표시합니다.',
                      noteTone: 'neutral',
                      confirmLabel: '해제',
                      run: () => handleSettle('release', 'collected_offline'),
                    })
                  }
                  disabled={settling}
                  className="w-full min-h-11 px-4 py-3 bg-admin-surface border border-admin-border text-slate-700 rounded-lg font-semibold hover:bg-admin-surface-hover disabled:opacity-50"
                >
                  현장 수금 완료 → hold 해제
                </button>
                <button
                  onClick={() =>
                    setSheet({
                      title: '노쇼 수동 청구',
                      amount: holdAmountLabel,
                      note: '노쇼 위약금으로 카드에서 위 금액을 청구합니다. 청구 후 취소할 수 없습니다. 자동 청구는 투어 당일 한국시간 10:00에 실행됩니다.',
                      noteTone: 'danger',
                      confirmLabel: '위약금 청구',
                      destructive: true,
                      run: () => handleSettle('capture', 'no_show'),
                    })
                  }
                  disabled={settling}
                  className="w-full min-h-11 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  노쇼 수동 청구
                </button>
              </>
            )}

            {booking.payment_intent_status === 'setup_pending_hold' && (
              <>
                <p className="text-sm text-slate-700 bg-slate-50 border border-admin-border rounded-lg p-3">
                  카드가 등록되어 있습니다. 투어 약 6일 전에 자동으로 승인(hold)이
                  잡히고, 투어 당일 한국시간 오전 10:00에 자동으로 청구됩니다.
                </p>
                <button
                  onClick={() =>
                    setSheet({
                      title: '현장 수금 완료 — 카드 해제',
                      subtitle: '저장된 카드를 해제합니다',
                      note: '저장된 카드를 해제하고 이 예약을 현장 수금(현금/이체)으로 표시합니다.',
                      noteTone: 'neutral',
                      confirmLabel: '해제',
                      run: () => handleSettle('release', 'collected_offline'),
                    })
                  }
                  disabled={settling}
                  className="w-full min-h-11 px-4 py-3 bg-admin-surface border border-admin-border text-slate-700 rounded-lg font-semibold hover:bg-admin-surface-hover disabled:opacity-50"
                >
                  현장 수금 완료 → 카드 해제
                </button>
              </>
            )}

            {booking.payment_intent_status === 'auth_pending' && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                손님의 카드 확인을 기다리는 중입니다. 아직 가능한 작업이 없어요.
              </p>
            )}

            {booking.payment_intent_status === 'captured' && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                카드 청구 완료 — 결제가 수금되었습니다. 추가 작업이 없어요.
              </p>
            )}

            {booking.payment_intent_status === 'canceled' && (
              <p className="text-sm text-slate-700 bg-slate-50 border border-admin-border rounded-lg p-3">
                Hold 해제됨 — 카드는 청구되지 않았습니다
                {booking.payment_status === 'paid'
                  ? ' (현장 수금으로 표시됨).'
                  : '.'}
              </p>
            )}

            {(booking.payment_intent_status === 'failed' ||
              booking.payment_intent_status === 'expired') && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {booking.payment_intent_status === 'expired'
                  ? '청구 전에 hold가 만료됐습니다. 다른 방법으로 수금하세요.'
                  : '카드 승인에 실패했습니다. 손님이 카드를 다시 확인하거나, 다른 방법으로 수금해야 해요.'}
              </p>
            )}

            {!booking.payment_intent_status && (
              <p className="text-sm text-slate-700 bg-slate-50 border border-admin-border rounded-lg p-3">
                이 예약에는 Stripe hold가 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>

      {booking.cancellation_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-red-900 mb-2">취소 사유</h3>
          <p className="text-red-800">{booking.cancellation_reason}</p>
        </div>
      )}

      {/* W4.1 — sticky mobile money action bar. Only renders when there is an
          actionable, time-sensitive authorized hold. Sits above the fixed
          mobile bottom nav (h-16); desktop keeps the inline payment card. */}
      {booking.payment_intent_status === 'authorized' && (
        <div className="sticky bottom-16 z-20 -mx-4 border-t border-admin-border bg-admin-surface/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">카드 hold</span>
                {holdExpired ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    만료됨
                  </span>
                ) : holdExpiringSoon ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {holdHoursLeft}h 남음
                  </span>
                ) : null}
              </div>
              <div className="truncate text-base font-bold tabular-nums text-slate-900">
                {holdAmountLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setSheet({
                  title: '카드 청구 — 투어 완료',
                  amount: holdAmountLabel,
                  note: '지금 카드에서 위 금액을 청구합니다. 청구 후 취소할 수 없습니다.',
                  noteTone: 'neutral',
                  confirmLabel: '청구',
                  run: () => handleSettle('capture', 'tour_completed'),
                })
              }
              disabled={settling}
              className="inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              카드 청구
            </button>
          </div>
        </div>
      )}

      {booking && booking.status !== 'cancelled' && (
        <div className="rounded-xl border border-admin-border bg-admin-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">투어모드 (실시간 투어룸)</div>
              <div className="mt-0.5 text-sm text-slate-700">
                손님·가이드에게 입장 링크를 이메일로 보냅니다. 재발송하면 이전 링크는 즉시 폐기돼요.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setSheet({
                  title: '투어룸 링크 발송',
                  note: '손님(예약 이메일)과 가이드(머천트 이메일)에게 투어룸 입장 링크를 보냅니다. 재발송 시 이전 링크는 폐기됩니다.',
                  noteTone: 'neutral',
                  confirmLabel: '발송',
                  run: handleDispatchRoom,
                })
              }
              disabled={dispatchingRoom}
              className="inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              🧭 투어룸 발송
            </button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        title={sheet?.title ?? ''}
        subtitle={sheet?.subtitle}
        amount={sheet?.amount}
        note={sheet?.note}
        noteTone={sheet?.noteTone}
        confirmLabel={sheet?.confirmLabel ?? '확인'}
        destructive={sheet?.destructive}
        confirming={sheetBusy}
        onConfirm={runSheet}
      />
    </div>
  );
}











