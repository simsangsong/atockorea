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
  number_of_people: number;
  pickup_point_id: string | null;
  unit_price: number;
  total_price: number;
  discount_amount: number;
  final_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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

      // Fetch booking with related data
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          tours (
            id,
            title,
            slug,
            city
          ),
          user_profiles (
            id,
            full_name,
            email,
            phone
          ),
          pickup_points (
            id,
            name,
            address
          )
        `)
        .eq('id', orderId)
        .single();

      if (fetchError) {
        throw new Error('Failed to fetch order');
      }

      setBooking(data as any);
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

      const response = await fetch(`/api/bookings/${orderId}`, {
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
          </div>
        </div>

        {/* Pricing Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pricing</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Number of People:</span>
              <span className="text-gray-900">{booking.number_of_people}</span>
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

      {booking.cancellation_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Cancellation Reason</h3>
          <p className="text-red-800">{booking.cancellation_reason}</p>
        </div>
      )}
    </div>
  );
}

