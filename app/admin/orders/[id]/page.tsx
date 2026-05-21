'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Booking {
  id: string;
  user_id: string;
  tour_id: string;
  tour_date: string;
  tour_time: string | null;
  number_of_people?: number;
  number_of_guests?: number;
  pickup_point_id: string | null;
  unit_price: number;
  total_price: number;
  discount_amount: number;
  final_price: number;
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

    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) {
      return;
    }

    try {
      setUpdating(true);
      
      if (!supabase) {
        alert('Supabase client not initialized');
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please sign in');
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

      alert('Order status updated successfully');
      fetchOrder();
    } catch (err: any) {
      console.error('Error updating order:', err);
      alert(`Failed to update order: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSettle = async (
    action: 'capture' | 'release',
    reason: 'tour_completed' | 'no_show' | 'collected_offline',
    confirmMsg: string,
  ) => {
    if (!booking) return;
    if (!confirm(confirmMsg)) return;

    try {
      setSettling(true);

      if (!supabase) {
        alert('Supabase client not initialized');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('Please sign in');
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

      alert(data.message || 'Done');
      fetchOrder();
    } catch (err: any) {
      console.error('Error settling order:', err);
      alert(`Failed: ${err.message}`);
    } finally {
      setSettling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error: {error || 'Order not found'}</p>
          <Link
            href="/admin/orders"
            className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Orders
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
        return 'bg-gray-100 text-gray-800';
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
        return 'bg-gray-100 text-gray-800';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-indigo-600 hover:text-indigo-700 mb-2 inline-block"
          >
            ← Back to Orders
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
          <p className="text-gray-600 mt-2">Order ID: {booking.id.substring(0, 8)}...</p>
        </div>
        <div className="flex gap-3">
          <select
            value={booking.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updating}
            className={`px-4 py-2 rounded-lg border-0 font-semibold ${getStatusColor(booking.status)}`}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Order ID:</span>
              <span className="font-mono text-sm text-gray-900">{booking.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                {booking.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Status:</span>
              <span className="text-gray-900">{booking.payment_status || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="text-gray-900">
                {new Date(booking.created_at).toLocaleString()}
              </span>
            </div>
            {booking.cancelled_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Cancelled:</span>
                <span className="text-gray-900">
                  {new Date(booking.cancelled_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tour Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Tour Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-gray-600">Tour:</span>
              <Link
                href={`/tour/${booking.tours?.slug}`}
                target="_blank"
                className="ml-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {booking.tours?.title || 'N/A'}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">City:</span>
              <span className="text-gray-900">{booking.tours?.city || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tour Date:</span>
              <span className="text-gray-900">
                {new Date(booking.tour_date).toLocaleDateString()}
              </span>
            </div>
            {booking.tour_time && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tour Time:</span>
                <span className="text-gray-900">{booking.tour_time}</span>
              </div>
            )}
            {booking.pickup_points && (
              <div>
                <span className="text-gray-600">Pickup Point:</span>
                <div className="mt-1 text-sm text-gray-900">
                  <div className="font-medium">{booking.pickup_points.name}</div>
                  <div className="text-gray-500">{booking.pickup_points.address}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="text-gray-900">
                {booking.user_profiles?.full_name || booking.contact_name || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="text-gray-900">
                {booking.user_profiles?.email || booking.contact_email || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span className="text-gray-900">
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
                        <span className="text-gray-600">Chat App:</span>
                        <span className="text-gray-900 capitalize">{String(chatApp)}</span>
                      </div>
                    )}
                    {chatContact && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Chat Contact:</span>
                        <span className="text-gray-900">{String(chatContact)}</span>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pricing</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Number of People:</span>
              <span className="text-gray-900">{booking.number_of_people ?? booking.number_of_guests ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Unit Price:</span>
              <span className="text-gray-900">₩{booking.unit_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Price:</span>
              <span className="text-gray-900">₩{booking.total_price.toLocaleString()}</span>
            </div>
            {booking.discount_amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-₩{booking.discount_amount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-gray-200">
              <span className="text-lg font-semibold text-gray-900">Final Price:</span>
              <span className="text-lg font-bold text-indigo-600">
                ₩{booking.final_price.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment / Settlement — capture the held card or release the hold */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment / Settlement</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Hold Status:</span>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${getPiStatusColor(
                  booking.payment_intent_status,
                )}`}
              >
                {booking.payment_intent_status || 'no hold'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Status:</span>
              <span className="text-gray-900">{booking.payment_status || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Hold Amount:</span>
              <span className="text-gray-900">
                {booking.no_show_fee_usd_cents != null
                  ? `$${(booking.no_show_fee_usd_cents / 100).toLocaleString()}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Card Collection:</span>
              <span className="text-gray-900">
                {booking.card_collection_method || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method:</span>
              <span className="text-gray-900">{booking.payment_method || '—'}</span>
            </div>
            {booking.authorization_expires_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Hold Expires:</span>
                <span
                  className={
                    holdExpired
                      ? 'text-red-600 font-semibold'
                      : holdExpiringSoon
                        ? 'text-amber-600 font-semibold'
                        : 'text-gray-900'
                  }
                >
                  {new Date(booking.authorization_expires_at).toLocaleString()}
                  {holdExpired
                    ? ' (EXPIRED)'
                    : holdExpiringSoon
                      ? ` (${holdHoursLeft}h left)`
                      : ''}
                </span>
              </div>
            )}
            {booking.paid_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Date:</span>
                <span className="text-gray-900">
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
                    This hold has passed its expiry — capture may be rejected by
                    Stripe. If so, collect payment another way.
                  </p>
                )}
                <button
                  onClick={() =>
                    handleSettle(
                      'capture',
                      'tour_completed',
                      'Charge the card for a completed tour? This collects the full held amount.',
                    )
                  }
                  disabled={settling}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  카드로 청구 (투어 완료) · Charge card — tour completed
                </button>
                <button
                  onClick={() =>
                    handleSettle(
                      'release',
                      'collected_offline',
                      'Release the hold and mark this booking as paid offline (cash/transfer received)?',
                    )
                  }
                  disabled={settling}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  현장 수금 완료 → hold 해제 · Collected offline — release hold
                </button>
                <button
                  onClick={() =>
                    handleSettle(
                      'capture',
                      'no_show',
                      'Charge the held card manually as a no-show? Auto charge normally runs at 10:00 AM Korea time on the tour date.',
                    )
                  }
                  disabled={settling}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  노쇼 수동 청구 · No-show — manual charge
                </button>
              </>
            )}

            {booking.payment_intent_status === 'setup_pending_hold' && (
              <>
                <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  Card is on file. The tour-day authorization is placed automatically
                  about 6 days before the tour, then charged automatically at 10:00 AM
                  Korea time on the tour date.
                </p>
                <button
                  onClick={() =>
                    handleSettle(
                      'release',
                      'collected_offline',
                      'Release the saved card and mark this booking as paid offline (cash/transfer received)?',
                    )
                  }
                  disabled={settling}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  현장 수금 완료 → 카드 해제 · Collected offline — release card
                </button>
              </>
            )}

            {booking.payment_intent_status === 'auth_pending' && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Waiting for the customer to confirm their card. No action available
                yet.
              </p>
            )}

            {booking.payment_intent_status === 'captured' && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                Card charged — payment collected. Nothing more to do.
              </p>
            )}

            {booking.payment_intent_status === 'canceled' && (
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                Hold released — the card was not charged
                {booking.payment_status === 'paid'
                  ? ' (booking marked paid offline).'
                  : '.'}
              </p>
            )}

            {(booking.payment_intent_status === 'failed' ||
              booking.payment_intent_status === 'expired') && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {booking.payment_intent_status === 'expired'
                  ? 'The hold expired before it was captured. Collect payment another way.'
                  : 'Card authorization failed. The customer needs to re-confirm their card, or collect payment another way.'}
              </p>
            )}

            {!booking.payment_intent_status && (
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                No Stripe hold on this booking.
              </p>
            )}
          </div>
        </div>
      </div>

      {booking.cancellation_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Cancellation Reason</h3>
          <p className="text-red-800">{booking.cancellation_reason}</p>
        </div>
      )}
    </div>
  );
}











