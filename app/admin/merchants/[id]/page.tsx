'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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

export default function MerchantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const merchantId = params?.id as string;
  
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (merchantId) {
      fetchMerchant();
    }
  }, [merchantId]);

  const fetchMerchant = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin?redirect=/admin/merchants');
        return;
      }

      const response = await fetch(`/api/admin/merchants/${merchantId}`, {
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
        throw new Error('Failed to fetch merchant');
      }

      const data = await response.json();
      setMerchant(data.merchant);
    } catch (err: any) {
      console.error('Error fetching merchant:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) {
      return;
    }

    try {
      setUpdating(true);
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

      const data = await response.json();
      setMerchant(data.merchant);
      alert('Merchant status updated successfully');
    } catch (err: any) {
      console.error('Error updating merchant:', err);
      alert(`Failed to update merchant: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyToggle = async () => {
    const newVerified = !merchant?.is_verified;
    
    try {
      setUpdating(true);
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
        body: JSON.stringify({ isVerified: newVerified }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update merchant');
      }

      const data = await response.json();
      setMerchant(data.merchant);
      alert(`Merchant ${newVerified ? 'verified' : 'unverified'} successfully`);
    } catch (err: any) {
      console.error('Error updating merchant:', err);
      alert(`Failed to update merchant: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading merchant details...</p>
        </div>
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error: {error || 'Merchant not found'}</p>
          <Link
            href="/admin/merchants"
            className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Merchants
          </Link>
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/merchants"
            className="text-indigo-600 hover:text-indigo-700 text-sm mb-2 inline-block"
          >
            ← Back to Merchants
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{merchant.company_name}</h1>
          <p className="text-gray-600 mt-2">Merchant Details</p>
        </div>
        <div className="flex gap-3">
          <select
            value={merchant.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updating}
            className={`px-4 py-2 rounded-lg border-0 font-semibold ${getStatusColor(merchant.status)}`}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={handleVerifyToggle}
            disabled={updating}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              merchant.is_verified
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {merchant.is_verified ? '✓ Verified' : 'Verify'}
          </button>
        </div>
      </div>

      {/* Merchant Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <p className="text-gray-900">{merchant.company_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Registration</label>
            <p className="text-gray-900">{merchant.business_registration_number || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <p className="text-gray-900">{merchant.contact_person}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <p className="text-gray-900">{merchant.contact_email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <p className="text-gray-900">{merchant.contact_phone}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(merchant.status)}`}>
              {merchant.status}
            </span>
          </div>
        </div>

        {merchant.address_line1 && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <p className="text-gray-900">
              {merchant.address_line1}
              {merchant.address_line2 && `, ${merchant.address_line2}`}
              {merchant.city && `, ${merchant.city}`}
              {merchant.province && `, ${merchant.province}`}
              {merchant.postal_code && ` ${merchant.postal_code}`}
              {`, ${merchant.country}`}
            </p>
          </div>
        )}
      </div>

      {/* User Account */}
      {merchant.user_profiles && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">User Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <p className="text-gray-900">{merchant.user_profiles.full_name || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-gray-900">{merchant.user_profiles.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tours */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Tours ({merchant.tours?.length || 0})</h2>
        </div>
        {merchant.tours && merchant.tours.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {merchant.tours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/tour/${tour.id}`}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {tour.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{tour.city}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">₩{parseFloat(tour.price.toString()).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        tour.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tour.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(tour.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No tours found</p>
        )}
      </div>
    </div>
  );
}



