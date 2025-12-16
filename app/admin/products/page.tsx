'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Tour {
  id: string;
  title: string;
  slug: string;
  city: 'Seoul' | 'Busan' | 'Jeju';
  price: number;
  original_price: number | null;
  price_type: 'person' | 'group';
  image_url: string;
  is_active: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  pickup_points: Array<{
    id: string;
    name: string;
    address: string;
  }>;
}

export default function ProductsPage() {
  const router = useRouter();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchTours();
  }, [cityFilter, statusFilter]);

  const fetchTours = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin?redirect=/admin/products');
        return;
      }

      const params = new URLSearchParams();
      if (cityFilter) {
        params.append('city', cityFilter);
      }
      if (statusFilter === 'active') {
        params.append('is_active', 'true');
      } else if (statusFilter === 'inactive') {
        params.append('is_active', 'false');
      }

      const response = await fetch(`/api/admin/tours?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('Admin access required');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch tours');
      }

      const data = await response.json();
      setTours(data.data || []);
    } catch (err: any) {
      console.error('Error fetching tours:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (tourId: string, currentStatus: boolean) => {
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update tour');
      }

      alert('Tour status updated successfully');
      fetchTours();
    } catch (err: any) {
      console.error('Error updating tour:', err);
      alert(`Failed to update tour: ${err.message}`);
    }
  };

  const handleDelete = async (tourId: string) => {
    if (!confirm('Are you sure you want to delete this tour? This action cannot be undone.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete tour');
      }

      alert('Tour deleted successfully');
      fetchTours();
    } catch (err: any) {
      console.error('Error deleting tour:', err);
      alert(`Failed to delete tour: ${err.message}`);
    }
  };

  const handleToggleFeatured = async (tourId: string, currentStatus: boolean) => {
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ is_featured: !currentStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update tour');
      }

      fetchTours();
    } catch (err: any) {
      console.error('Error updating tour:', err);
      alert(`Failed to update tour: ${err.message}`);
    }
  };

  const filteredTours = tours.filter((tour) =>
    !searchQuery ||
    tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tour.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tour.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tours...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchTours}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-600 mt-2">Manage all tours and products</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              // API를 통해 투어 추가하는 스크립트 실행 안내
              const message = `투어 추가는 API를 사용하세요.\n\n방법:\n1. 브라우저 콘솔 열기 (F12)\n2. scripts/add-jeju-cruise-tour-simple.js 파일 내용 복사\n3. 콘솔에 붙여넣기 후 Enter\n\n또는 API 직접 호출:\nPOST /api/admin/tours`;
              alert(message);
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            ➕ Add Tour via API
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by title, slug, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Cities</option>
            <option value="Seoul">Seoul</option>
            <option value="Busan">Busan</option>
            <option value="Jeju">Jeju</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={fetchTours}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Tours Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tour
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTours.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No tours found
                  </td>
                </tr>
              ) : (
                filteredTours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={tour.image_url}
                          alt={tour.title}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {tour.title}
                          </div>
                          <div className="text-xs text-gray-500">{tour.slug}</div>
                          {tour.is_featured && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                              Featured
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {tour.city}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₩{tour.price.toLocaleString()}
                      </div>
                      {tour.original_price && (
                        <div className="text-xs text-gray-500 line-through">
                          ₩{tour.original_price.toLocaleString()}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        / {tour.price_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">⭐</span>
                        <span className="text-sm font-medium text-gray-900">
                          {tour.rating.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({tour.review_count})
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(tour.id, tour.is_active)}
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          tour.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tour.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tour.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/tour/${tour.slug}`}
                          target="_blank"
                          className="px-3 py-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors"
                          title="View on site"
                        >
                          👁️
                        </Link>
                        <button
                          onClick={() => {
                            // Copy tour data to clipboard for API editing
                            const tourData = {
                              id: tour.id,
                              title: tour.title,
                              slug: tour.slug,
                              city: tour.city,
                              price: tour.price,
                              original_price: tour.original_price,
                              price_type: tour.price_type,
                              image_url: tour.image_url,
                              is_active: tour.is_active,
                              is_featured: tour.is_featured,
                            };
                            navigator.clipboard.writeText(JSON.stringify(tourData, null, 2));
                            alert('Tour data copied to clipboard! Use API to edit.');
                          }}
                          className="px-3 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                          title="Copy tour data for editing"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(tour.id, tour.is_featured)}
                          className={`px-3 py-1 rounded transition-colors ${
                            tour.is_featured
                              ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                          }`}
                          title={tour.is_featured ? 'Remove from featured' : 'Add to featured'}
                        >
                          ⭐
                        </button>
                        <button
                          onClick={() => handleDelete(tour.id)}
                          className="px-3 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                          title="Delete tour"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
