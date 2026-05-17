'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BookingStatusBadge } from '@/components/admin/BookingStatusBadge';

interface Booking {
  id: string;
  booking_date?: string;
  tour_date?: string;
  number_of_guests?: number;
  number_of_people?: number;
  total_price?: number;
  final_price: number;
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

type OrderBy = 'created_at' | 'tour_date' | 'booking_date';
type OrderDir = 'asc' | 'desc';

export default function OrdersPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [orderBy, setOrderBy] = useState<OrderBy>('created_at');
  const [orderDir, setOrderDir] = useState<OrderDir>('desc');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, orderBy, orderDir]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        router.push('/signin?redirect=/admin/orders');
        return;
      }

      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('orderBy', orderBy);
      params.set('order', orderDir);
      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('Admin access required');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setBookings(data.orders || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message);
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

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach((b) => {
      const key = dateKey(b);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    const keys = Array.from(map.keys()).sort((a, b) =>
      orderDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b),
    );
    return keys.map((key) => ({ date: key, items: map.get(key)! }));
  }, [bookings, orderDir]);

  const exportToExcel = () => {
    setExporting(true);
    try {
      const BOM = '\uFEFF';
      const headers = [
        'Order ID',
        'Created At',
        'Tour Date',
        'Tour',
        'Customer',
        'Email',
        'Phone',
        'Guests',
        'Pickup',
        'Address',
        'Amount',
        'Status',
        'Payment Status',
      ];
      const rows = bookings.map((b) => [
        b.id,
        b.created_at ? formatDate(b.created_at) : '',
        b.tour_date || '',
        b.tours?.title || '',
        b.user_profiles?.full_name || b.contact_name || 'Guest',
        b.user_profiles?.email || b.contact_email || '',
        b.contact_phone || '',
        String(b.number_of_guests ?? b.number_of_people ?? 1),
        b.pickup_points?.name || '',
        b.pickup_points?.address || '',
        String(b.final_price ?? ''),
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-5">
          <p className="text-sm text-red-800 font-medium">Error: {error}</p>
          <button
            onClick={fetchBookings}
            className="mt-3 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-sm text-gray-600 mt-1">View and manage all bookings ({bookings.length})</p>
        </div>
        <button
          type="button"
          onClick={exportToExcel}
          disabled={exporting || bookings.length === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-4 flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        <span className="text-sm text-gray-500">Sort</span>
        <select
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value as OrderBy)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="created_at">Created at</option>
          <option value="tour_date">Tour date</option>
          <option value="booking_date">Booking date</option>
        </select>
        <select
          value={orderDir}
          onChange={(e) => setOrderDir(e.target.value as OrderDir)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </div>

      <div className="space-y-8">
        {groupedByDate.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-8 text-center text-gray-500">
            No orders found {statusFilter && `(status: ${statusFilter})`}
          </div>
        ) : (
          groupedByDate.map(({ date, items }) => (
            <div key={date}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {date === 'no-date'
                  ? 'No date'
                  : new Date(date + 'T12:00:00').toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                <span className="ml-2 text-sm font-normal text-gray-500">({items.length})</span>
              </h2>
              <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order ID</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Guests</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pickup</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((booking) => (
                        <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{booking.id.substring(0, 8)}...</td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-medium text-gray-900">{booking.tours?.title || 'Tour'}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-sm text-gray-900">{booking.user_profiles?.full_name || booking.contact_name || 'Guest'}</div>
                            <div className="text-xs text-gray-500">{booking.user_profiles?.email || booking.contact_email || 'N/A'}</div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(booking.tour_date || booking.created_at)}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {booking.number_of_guests ?? booking.number_of_people ?? 1}
                          </td>
                          <td className="px-5 py-4">
                            {booking.pickup_points ? (
                              <div className="text-xs">
                                <div className="font-medium text-gray-900">{booking.pickup_points.name}</div>
                                <div className="text-gray-500 mt-0.5">{booking.pickup_points.address}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not selected</span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              ${parseFloat(String(booking.final_price)).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <BookingStatusBadge status={booking.status} className="font-semibold" />
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/admin/orders/${booking.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
