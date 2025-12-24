'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PickupPointSelector from '@/components/maps/PickupPointSelector';

interface Tour {
  id: string;
  title: string;
  slug: string;
  city: 'Seoul' | 'Busan' | 'Jeju';
  price: number;
  original_price: number | null;
  price_type: 'person' | 'group';
  image_url: string;
  gallery_images?: Array<string | { url: string; title?: string; description?: string }>;
  tag?: string;
  subtitle?: string;
  description?: string;
  duration?: string;
  lunch_included?: boolean;
  ticket_included?: boolean;
  pickup_info?: string;
  notes?: string;
  highlights?: string[];
  includes?: string[];
  excludes?: string[];
  schedule?: Array<{ time: string; title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  keywords?: string[];
  is_active: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  pickup_points?: Array<{
    id: string;
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    pickup_time?: string;
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
  
  // Edit modal state
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [formData, setFormData] = useState<Partial<Tour>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [currency, setCurrency] = useState('KRW');
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);

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

  const handleEdit = (tour: Tour) => {
    setEditingTour(tour);
    const originalPrice = tour.original_price || tour.price;
    const currentPrice = tour.price;
    const discount = originalPrice > currentPrice 
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : null;
    
    setFormData({
      title: tour.title,
      slug: tour.slug,
      city: tour.city,
      price: tour.price,
      original_price: tour.original_price,
      price_type: tour.price_type,
      image_url: tour.image_url,
      gallery_images: tour.gallery_images || [],
      tag: tour.tag,
      subtitle: tour.subtitle,
      description: tour.description,
      duration: tour.duration,
      lunch_included: tour.lunch_included,
      ticket_included: tour.ticket_included,
      pickup_info: tour.pickup_info,
      notes: tour.notes,
      highlights: tour.highlights || [],
      includes: tour.includes || [],
      excludes: tour.excludes || [],
      schedule: tour.schedule || [],
      faqs: tour.faqs || [],
      keywords: tour.keywords || [],
      is_active: tour.is_active,
      is_featured: tour.is_featured,
      pickup_points: tour.pickup_points || [],
    });
    setDiscountPercent(discount);
    setActiveTab('basic');
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingTour(null);
    setFormData({});
  };

  const handleUploadThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'product');
      uploadFormData.append('folder', 'tours');

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: uploadFormData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload image');
      }

      const result = await response.json();
      setFormData((prev) => ({ ...prev, image_url: result.url }));
      alert('Thumbnail uploaded successfully!');
    } catch (err: any) {
      console.error('Error uploading image:', err);
      alert(`Failed to upload image: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingGallery(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const uploadFormData = new FormData();
      for (let i = 0; i < files.length; i++) {
        uploadFormData.append('files', files[i]);
      }
      uploadFormData.append('type', 'gallery');
      uploadFormData.append('folder', 'tours/gallery');

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: uploadFormData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload images');
      }

      const result = await response.json();
      const newUrls = result.files.map((f: any) => f.url);
      const existingGallery = formData.gallery_images || [];
      setFormData((prev) => ({ ...prev, gallery_images: [...existingGallery, ...newUrls] }));
      alert(`${newUrls.length} images uploaded successfully!`);
    } catch (err: any) {
      console.error('Error uploading gallery:', err);
      alert(`Failed to upload images: ${err.message}`);
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleRemoveGalleryImage = (index: number) => {
    const gallery = formData.gallery_images || [];
    setFormData({ ...formData, gallery_images: gallery.filter((_, i) => i !== index) });
  };

  const handleUpdateGalleryImage = (index: number, field: 'title' | 'description', value: string) => {
    const gallery = formData.gallery_images || [];
    const updatedGallery = gallery.map((img, i) => {
      if (i === index) {
        const imageObj = typeof img === 'string' ? { url: img, title: '', description: '' } : img;
        return { ...imageObj, [field]: value };
      }
      return img;
    });
    setFormData({ ...formData, gallery_images: updatedGallery });
  };

  const handleSave = async () => {
    if (!editingTour) return;

    try {
      setSaving(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const response = await fetch(`/api/admin/tours?id=${editingTour.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update tour');
      }

      alert('Tour updated successfully!');
      handleCloseModal();
      fetchTours();
    } catch (err: any) {
      console.error('Error updating tour:', err);
      alert(`Failed to update tour: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tourId: string, currentStatus: boolean) => {
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in');
        return;
      }

      const response = await fetch(`/api/admin/tours?id=${tourId}`, {
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

      const response = await fetch(`/api/admin/tours?id=${tourId}`, {
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
                          onClick={() => handleEdit(tour)}
                          className="px-3 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                          title="Edit tour"
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

      {/* Edit Modal */}
      {isEditModalOpen && editingTour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Edit Tour</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
    </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 px-6">
              <div className="flex gap-1">
                {['basic', 'pricing', 'images', 'details', 'pickup', 'content'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'basic' ? 'Basic Info' : tab === 'pricing' ? 'Pricing' : tab === 'images' ? 'Images' : tab === 'details' ? 'Details' : tab === 'pickup' ? 'Pickup Points' : 'Content'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slug *
                      </label>
                      <input
                        type="text"
                        value={formData.slug || ''}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tag
                      </label>
                      <input
                        type="text"
                        value={formData.tag || ''}
                        onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                        placeholder="e.g., Private Tour · Day tour"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subtitle
                      </label>
                      <input
                        type="text"
                        value={formData.subtitle || ''}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        placeholder="e.g., Customized Experience"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City *
                      </label>
                      <select
                        value={formData.city || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Seoul">Seoul</option>
                        <option value="Busan">Busan</option>
                        <option value="Jeju">Jeju</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={formData.duration || ''}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        placeholder="e.g., 9 hours"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Keywords (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={Array.isArray(formData.keywords) ? formData.keywords.join(', ') : (formData.keywords as string) || ''}
                      onChange={(e) => {
                        const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k.length > 0);
                        setFormData({ ...formData, keywords });
                      }}
                      placeholder="e.g., Duration: 9 hours, Difficulty: Easy, Group Size: Up to 6"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter keywords separated by commas. Format: "Label: Value" (e.g., "Duration: 9 hours")
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.lunch_included || false}
                        onChange={(e) => setFormData({ ...formData, lunch_included: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Lunch Included</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.ticket_included || false}
                        onChange={(e) => setFormData({ ...formData, ticket_included: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Ticket Included</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active || false}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_featured || false}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Featured</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Pricing Tab */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="KRW">KRW (₩)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="JPY">JPY (¥)</option>
                        <option value="CNY">CNY (¥)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price Type *
                      </label>
                      <select
                        value={formData.price_type || 'person'}
                        onChange={(e) => setFormData({ ...formData, price_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="person">Person</option>
                        <option value="group">Group</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Original Price *
                      </label>
                      <input
                        type="number"
                        value={formData.original_price || formData.price || ''}
                        onChange={(e) => {
                          const originalPrice = e.target.value ? parseFloat(e.target.value) : null;
                          const currentPrice = formData.price || 0;
                          const discount = originalPrice && originalPrice > currentPrice
                            ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
                            : null;
                          setFormData({ ...formData, original_price: originalPrice });
                          setDiscountPercent(discount);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount (%)
                      </label>
                      <input
                        type="number"
                        value={discountPercent || ''}
                        onChange={(e) => {
                          const discount = e.target.value ? parseFloat(e.target.value) : null;
                          setDiscountPercent(discount);
                          if (discount && formData.original_price) {
                            const newPrice = Math.round(formData.original_price * (1 - discount / 100));
                            setFormData({ ...formData, price: newPrice });
                          }
                        }}
                        placeholder="Auto-calculated"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Final Price (Sale Price) *
                      </label>
                      <input
                        type="number"
                        value={formData.price || ''}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value);
                          setFormData({ ...formData, price });
                          if (formData.original_price && price < formData.original_price) {
                            const discount = Math.round(((formData.original_price - price) / formData.original_price) * 100);
                            setDiscountPercent(discount);
                          } else {
                            setDiscountPercent(null);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {discountPercent && (
                        <p className="text-sm text-green-600 mt-1">
                          {discountPercent}% discount applied
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thumbnail Image *
                    </label>
                    <div className="flex items-center gap-4">
                      {formData.image_url && (
                        <img
                          src={formData.image_url}
                          alt="Thumbnail"
                          className="w-32 h-32 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadThumbnail}
                          disabled={uploadingImage}
                          className="hidden"
                          id="thumbnail-upload"
                        />
                        <label
                          htmlFor="thumbnail-upload"
                          className={`inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {uploadingImage ? 'Uploading...' : 'Upload Thumbnail'}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gallery Images
                    </label>
                    <div className="space-y-4 mb-4">
                      {(formData.gallery_images || []).map((img, index) => {
                        const imageUrl = typeof img === 'string' ? img : img.url;
                        const imageTitle = typeof img === 'string' ? '' : (img.title || '');
                        const imageDesc = typeof img === 'string' ? '' : (img.description || '');
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg p-3">
                            <div className="relative mb-3">
                              <img
                                src={imageUrl}
                                alt={`Gallery ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <button
                                onClick={() => handleRemoveGalleryImage(index)}
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Image Title
                                </label>
                                <input
                                  type="text"
                                  value={imageTitle}
                                  onChange={(e) => handleUpdateGalleryImage(index, 'title', e.target.value)}
                                  placeholder="Enter image title"
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Image Description
                                </label>
                                <textarea
                                  value={imageDesc}
                                  onChange={(e) => handleUpdateGalleryImage(index, 'description', e.target.value)}
                                  placeholder="Enter image description"
                                  rows={2}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadGallery}
                      disabled={uploadingGallery}
                      className="hidden"
                      id="gallery-upload"
                    />
                    <label
                      htmlFor="gallery-upload"
                      className={`inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer ${uploadingGallery ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploadingGallery ? 'Uploading...' : 'Add Gallery Images'}
                    </label>
                  </div>
                </div>
              )}

              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pickup Info
                    </label>
                    <textarea
                      value={formData.pickup_info || ''}
                      onChange={(e) => setFormData({ ...formData, pickup_info: e.target.value })}
                      rows={4}
                      placeholder="Information about pickup locations and times..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes / Important Information
                    </label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={6}
                      placeholder="Important information, cancellation policy, etc..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Pickup Points Tab */}
              {activeTab === 'pickup' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pickup Points
                    </label>
                    <div className="space-y-4">
                      {(formData.pickup_points || []).map((point, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4 mb-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                              <input
                                type="text"
                                value={point.name}
                                onChange={(e) => {
                                  const updated = [...(formData.pickup_points || [])];
                                  updated[index] = { ...updated[index], name: e.target.value };
                                  setFormData({ ...formData, pickup_points: updated });
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Time</label>
                              <input
                                type="time"
                                value={point.pickup_time || ''}
                                onChange={(e) => {
                                  const updated = [...(formData.pickup_points || [])];
                                  updated[index] = { ...updated[index], pickup_time: e.target.value };
                                  setFormData({ ...formData, pickup_points: updated });
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                            <input
                              type="text"
                              value={point.address}
                              onChange={(e) => {
                                const updated = [...(formData.pickup_points || [])];
                                updated[index] = { ...updated[index], address: e.target.value };
                                setFormData({ ...formData, pickup_points: updated });
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const updated = (formData.pickup_points || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, pickup_points: updated });
                            }}
                            className="text-red-600 text-sm hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <PickupPointSelector
                          onLocationSelect={(location) => {
                            const newPoint = {
                              name: '',
                              address: location.address,
                              lat: location.lat,
                              lng: location.lng,
                              pickup_time: '',
                            };
                            setFormData({
                              ...formData,
                              pickup_points: [...(formData.pickup_points || []), newPoint],
                            });
                          }}
                          height="300px"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Search for a location on the map above to add a new pickup point
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Tab */}
              {activeTab === 'content' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Highlights
                    </label>
                    <div className="space-y-2">
                      {(formData.highlights || []).map((highlight, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={highlight}
                            onChange={(e) => {
                              const updated = [...(formData.highlights || [])];
                              updated[index] = e.target.value;
                              setFormData({ ...formData, highlights: updated });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                          <button
                            onClick={() => {
                              const updated = (formData.highlights || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, highlights: updated });
                            }}
                            className="px-3 py-2 text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFormData({ ...formData, highlights: [...(formData.highlights || []), ''] })}
                        className="text-indigo-600 text-sm hover:text-indigo-800"
                      >
                        + Add Highlight
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Includes
                    </label>
                    <div className="space-y-2">
                      {(formData.includes || []).map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const updated = [...(formData.includes || [])];
                              updated[index] = e.target.value;
                              setFormData({ ...formData, includes: updated });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                          <button
                            onClick={() => {
                              const updated = (formData.includes || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, includes: updated });
                            }}
                            className="px-3 py-2 text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFormData({ ...formData, includes: [...(formData.includes || []), ''] })}
                        className="text-indigo-600 text-sm hover:text-indigo-800"
                      >
                        + Add Include
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Excludes
                    </label>
                    <div className="space-y-2">
                      {(formData.excludes || []).map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const updated = [...(formData.excludes || [])];
                              updated[index] = e.target.value;
                              setFormData({ ...formData, excludes: updated });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                          <button
                            onClick={() => {
                              const updated = (formData.excludes || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, excludes: updated });
                            }}
                            className="px-3 py-2 text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFormData({ ...formData, excludes: [...(formData.excludes || []), ''] })} 
                        className="text-indigo-600 text-sm hover:text-indigo-800"
                      >
                        + Add Exclude
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Itinerary / Schedule
                    </label>
                    <div className="space-y-4">
                      {(formData.schedule || []).map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                              <input
                                type="text"
                                value={item.time || ''}
                                onChange={(e) => {
                                  const updated = [...(formData.schedule || [])];
                                  updated[index] = { ...updated[index], time: e.target.value };
                                  setFormData({ ...formData, schedule: updated });
                                }}
                                placeholder="e.g., 09:00-18:00"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                              <input
                                type="text"
                                value={item.title || ''}
                                onChange={(e) => {
                                  const updated = [...(formData.schedule || [])];
                                  updated[index] = { ...updated[index], title: e.target.value };
                                  setFormData({ ...formData, schedule: updated });
                                }}
                                placeholder="e.g., Hotel Pickup"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea
                              value={item.description || ''}
                              onChange={(e) => {
                                const updated = [...(formData.schedule || [])];
                                updated[index] = { ...updated[index], description: e.target.value };
                                setFormData({ ...formData, schedule: updated });
                              }}
                              rows={2}
                              placeholder="Detailed description..."
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const updated = (formData.schedule || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, schedule: updated });
                            }}
                            className="text-red-600 text-sm hover:text-red-800"
                          >
                            Remove Schedule Item
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFormData({ 
                          ...formData, 
                          schedule: [...(formData.schedule || []), { time: '', title: '', description: '' }] 
                        })}
                        className="text-indigo-600 text-sm hover:text-indigo-800"
                      >
                        + Add Schedule Item
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      FAQs
                    </label>
                    <div className="space-y-4">
                      {(formData.faqs || []).map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Question</label>
                            <input
                              type="text"
                              value={item.question || ''}
                              onChange={(e) => {
                                const updated = [...(formData.faqs || [])];
                                updated[index] = { ...updated[index], question: e.target.value };
                                setFormData({ ...formData, faqs: updated });
                              }}
                              placeholder="e.g., What are the advantages of a private tour?"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Answer</label>
                            <textarea
                              value={item.answer || ''}
                              onChange={(e) => {
                                const updated = [...(formData.faqs || [])];
                                updated[index] = { ...updated[index], answer: e.target.value };
                                setFormData({ ...formData, faqs: updated });
                              }}
                              rows={3}
                              placeholder="Detailed answer..."
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const updated = (formData.faqs || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, faqs: updated });
                            }}
                            className="text-red-600 text-sm hover:text-red-800"
                          >
                            Remove FAQ
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFormData({ 
                          ...formData, 
                          faqs: [...(formData.faqs || []), { question: '', answer: '' }] 
                        })}
                        className="text-indigo-600 text-sm hover:text-indigo-800"
                      >
                        + Add FAQ
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

