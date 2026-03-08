'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PickupPointSelector from '@/components/maps/PickupPointSelector';
import { CHILD_ELIGIBILITY_RULES, CHILD_SEAT_OPTIONS, STROLLER_WHEELCHAIR_OPTIONS } from '@/lib/participant-rules';

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
  schedule?: Array<{ time: string; title: string; description: string; images?: string[] }>;
  itinerary_details?: Array<{ time: string; activity: string; description: string; images?: string[] }>;
  faqs?: Array<{ question: string; answer: string }>;
  child_eligibility?: Array<{ id: string; num?: number; num1?: number; num2?: number; num3?: number; text?: string }>;
  suggested_to_bring?: string[];
  accessibility_facilities?: {
    note_children_counted?: boolean;
    child_seat?: string;
    child_seat_custom?: { num1?: number; num2?: number; num3?: number };
    stroller?: string;
    wheelchair?: string;
    stroller_wheelchair?: string;
  };
  keywords?: string[];
  is_active: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  translations?: Record<string, {
    title?: string;
    subtitle?: string;
    description?: string;
    tag?: string;
    duration?: string;
    pickup_info?: string;
    notes?: string;
    highlights?: string[];
    includes?: string[];
    excludes?: string[];
    schedule?: Array<{ time: string; title: string; description: string; images?: string[] }>;
    faqs?: Array<{ question: string; answer: string }>;
    pickup_points?: Array<{ id: string; name: string }>;
  }>;
  pickup_points?: Array<{
    id: string;
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    pickup_time?: string;
    image_url?: string;
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
  const [uploadingPickupImageIndex, setUploadingPickupImageIndex] = useState<number | null>(null);
  const pickupImageInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Tour>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [editLocale, setEditLocale] = useState<string>('en');
  const [localeBulkJson, setLocaleBulkJson] = useState('');
  const [localeBulkError, setLocaleBulkError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('KRW');
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [editingPickupIndex, setEditingPickupIndex] = useState<number | null>(null);

  const SUPPORTED_LOCALES = [
    { code: 'en', label: 'English' },
    { code: 'ko', label: '한국어' },
    { code: 'zh', label: '中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'ja', label: '日本語' },
    { code: 'es', label: 'Español' },
  ] as const;

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
      itinerary_details: tour.itinerary_details || [],
      faqs: tour.faqs || [],
      child_eligibility: tour.child_eligibility || [],
      suggested_to_bring: tour.suggested_to_bring || [],
      accessibility_facilities: tour.accessibility_facilities || {},
      keywords: tour.keywords || [],
      is_active: tour.is_active,
      is_featured: tour.is_featured,
      translations: tour.translations || {},
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

  const handlePickupImageUploadClick = (index: number) => {
    setUploadingPickupImageIndex(index);
    setTimeout(() => pickupImageInputRef.current?.click(), 0);
  };

  const handlePickupImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const index = uploadingPickupImageIndex;
    if (!file || index == null) {
      setUploadingPickupImageIndex(null);
      e.target.value = '';
      return;
    }
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (!session) {
        alert('로그인이 필요합니다.');
        return;
      }
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'product');
      uploadFormData.append('folder', 'tours/pickup');
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        credentials: 'include',
        body: uploadFormData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '업로드 실패');
      }
      const result = await response.json();
      const updated = [...(formData.pickup_points || [])];
      updated[index] = { ...updated[index], image_url: result.url };
      setFormData({ ...formData, pickup_points: updated });
    } catch (err: any) {
      console.error('Pickup image upload error:', err);
      alert(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setUploadingPickupImageIndex(null);
      e.target.value = '';
    }
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

    const points = formData.pickup_points || [];
    const emptyNameIndex = points.findIndex((p) => !String(p.name || '').trim());
    if (emptyNameIndex !== -1) {
      alert(`픽업장소 ${emptyNameIndex + 1}번의 장소명을 입력하세요.`);
      setActiveTab('pickup');
      return;
    }

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
          <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-sm text-gray-600 mt-1">모든 투어 및 상품 관리</p>
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

      {/* Edit Modal - Premium */}
      {isEditModalOpen && editingTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-gray-200/80">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-gray-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Edit Tour</h2>
                  <p className="text-sm text-gray-500">{editingTour.title}</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2.5 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white/95 px-6">
              <div className="flex gap-0.5 overflow-x-auto py-1 scrollbar-thin">
                {[
                  { id: 'basic', label: '기본 정보', icon: '📋' },
                  { id: 'pricing', label: '가격', icon: '💰' },
                  { id: 'images', label: '이미지', icon: '🖼️' },
                  { id: 'details', label: '상세 정보', icon: '📄' },
                  { id: 'itinerary', label: '일정', icon: '🗓️' },
                  { id: 'pickup', label: '픽업장소', icon: '📍' },
                  { id: 'content', label: '콘텐츠', icon: '📝' },
                  { id: 'languages', label: '다국어', icon: '🌐' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-t-lg whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'text-indigo-600 bg-indigo-50/80 border-b-2 border-indigo-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span aria-hidden>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/40 min-h-0">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-indigo-600">📋</span> 기본 정보
                    </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
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
                      value={Array.isArray(formData.keywords) ? formData.keywords.join(', ') : (formData.keywords ?? '')}
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
                  </section>
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

                  {/* 아동 자격 / 儿童资格 */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">* 儿童资格 (아동 자격) <span className="text-gray-500 font-normal">Suggested to add</span></h3>
                    <div className="space-y-2 mt-3">
                      {CHILD_ELIGIBILITY_RULES.map((rule) => {
                        const current = (formData.child_eligibility || []).find((r) => r.id === rule.id) || null;
                        const checked = !!current;
                        return (
                          <div key={rule.id} className="flex flex-wrap items-start gap-2 py-1.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const list = formData.child_eligibility || [];
                                  if (e.target.checked) {
                                    setFormData({ ...formData, child_eligibility: [...list.filter((r) => r.id !== rule.id), { id: rule.id }] });
                                  } else {
                                    setFormData({ ...formData, child_eligibility: list.filter((r) => r.id !== rule.id) });
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="text-sm text-gray-700">{rule.labelKo}</span>
                            </label>
                            {checked && rule.params.length > 0 && (
                              <div className="flex flex-wrap gap-2 ml-6">
                                {rule.params.includes('num') && (
                                  <input
                                    type="number"
                                    placeholder="num"
                                    value={current?.num ?? ''}
                                    onChange={(e) => {
                                      const list = [...(formData.child_eligibility || [])];
                                      const i = list.findIndex((r) => r.id === rule.id);
                                      if (i >= 0) list[i] = { ...list[i], num: e.target.value ? parseInt(e.target.value, 10) : undefined };
                                      setFormData({ ...formData, child_eligibility: list });
                                    }}
                                    className="w-16 px-2 py-1 text-sm border rounded"
                                  />
                                )}
                                {rule.params.includes('num1') && (
                                  <input
                                    type="number"
                                    placeholder="num1"
                                    value={current?.num1 ?? ''}
                                    onChange={(e) => {
                                      const list = [...(formData.child_eligibility || [])];
                                      const i = list.findIndex((r) => r.id === rule.id);
                                      if (i >= 0) list[i] = { ...list[i], num1: e.target.value ? parseInt(e.target.value, 10) : undefined };
                                      setFormData({ ...formData, child_eligibility: list });
                                    }}
                                    className="w-16 px-2 py-1 text-sm border rounded"
                                  />
                                )}
                                {rule.params.includes('num2') && (
                                  <input
                                    type="number"
                                    placeholder="num2"
                                    value={current?.num2 ?? ''}
                                    onChange={(e) => {
                                      const list = [...(formData.child_eligibility || [])];
                                      const i = list.findIndex((r) => r.id === rule.id);
                                      if (i >= 0) list[i] = { ...list[i], num2: e.target.value ? parseInt(e.target.value, 10) : undefined };
                                      setFormData({ ...formData, child_eligibility: list });
                                    }}
                                    className="w-16 px-2 py-1 text-sm border rounded"
                                  />
                                )}
                                {rule.params.includes('text') && (
                                  <input
                                    type="text"
                                    placeholder="text"
                                    value={current?.text ?? ''}
                                    onChange={(e) => {
                                      const list = [...(formData.child_eligibility || [])];
                                      const i = list.findIndex((r) => r.id === rule.id);
                                      if (i >= 0) list[i] = { ...list[i], text: e.target.value };
                                      setFormData({ ...formData, child_eligibility: list });
                                    }}
                                    className="min-w-[120px] px-2 py-1 text-sm border rounded"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 建议携带 / 권장 휴대품 */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">建议携带 (권장 휴대품) <span className="text-gray-500 font-normal">Suggested to add</span></h3>
                    <div className="space-y-2 mt-3">
                      {(formData.suggested_to_bring || []).map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const list = [...(formData.suggested_to_bring || [])];
                              list[index] = e.target.value;
                              setFormData({ ...formData, suggested_to_bring: list });
                            }}
                            placeholder="{{what_to_bring}}"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, suggested_to_bring: (formData.suggested_to_bring || []).filter((_, i) => i !== index) })}
                            className="text-red-600 text-sm"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, suggested_to_bring: [...(formData.suggested_to_bring || []), ''] })}
                        className="text-indigo-600 text-sm hover:text-indigo-800"
                      >
                        + Add new
                      </button>
                    </div>
                  </div>

                  {/* 无障碍设施 / 접근성 시설 */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">无障碍设施 (접근성 시설) <span className="text-gray-500 font-normal">Suggested to add</span></h3>
                    <p className="text-xs text-gray-500 mb-3">注意:婴幼儿和儿童将被计为乘客人数</p>
                    <div className="space-y-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!formData.accessibility_facilities?.note_children_counted}
                          onChange={(e) => setFormData({
                            ...formData,
                            accessibility_facilities: { ...formData.accessibility_facilities, note_children_counted: e.target.checked },
                          })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">注意:婴幼儿和儿童将被计为乘客人数</span>
                      </label>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">儿童座椅 (Child seat)</label>
                        <div className="space-y-2">
                          {CHILD_SEAT_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="child_seat"
                                checked={(formData.accessibility_facilities?.child_seat || '') === opt.value}
                                onChange={() => setFormData({
                                  ...formData,
                                  accessibility_facilities: { ...formData.accessibility_facilities, child_seat: opt.value },
                                })}
                                className="border-gray-300"
                              />
                              <span className="text-sm text-gray-700">{opt.labelKo}</span>
                            </label>
                          ))}
                        </div>
                        {(formData.accessibility_facilities?.child_seat === 'custom') && (
                          <div className="flex gap-2 mt-2 ml-4">
                            <input type="number" placeholder="num1" value={formData.accessibility_facilities?.child_seat_custom?.num1 ?? ''} onChange={(e) => setFormData({ ...formData, accessibility_facilities: { ...formData.accessibility_facilities, child_seat_custom: { ...formData.accessibility_facilities?.child_seat_custom, num1: e.target.value ? parseInt(e.target.value, 10) : undefined } } })} className="w-20 px-2 py-1 text-sm border rounded" />
                            <input type="number" placeholder="num2" value={formData.accessibility_facilities?.child_seat_custom?.num2 ?? ''} onChange={(e) => setFormData({ ...formData, accessibility_facilities: { ...formData.accessibility_facilities, child_seat_custom: { ...formData.accessibility_facilities?.child_seat_custom, num2: e.target.value ? parseInt(e.target.value, 10) : undefined } } })} className="w-20 px-2 py-1 text-sm border rounded" />
                            <input type="number" placeholder="num3(cm)" value={formData.accessibility_facilities?.child_seat_custom?.num3 ?? ''} onChange={(e) => setFormData({ ...formData, accessibility_facilities: { ...formData.accessibility_facilities, child_seat_custom: { ...formData.accessibility_facilities?.child_seat_custom, num3: e.target.value ? parseInt(e.target.value, 10) : undefined } } })} className="w-24 px-2 py-1 text-sm border rounded" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">此活动 (Stroller / Wheelchair)</label>
                        <div className="space-y-2">
                          {STROLLER_WHEELCHAIR_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="stroller_wheelchair"
                                checked={(formData.accessibility_facilities?.stroller_wheelchair || formData.accessibility_facilities?.stroller || formData.accessibility_facilities?.wheelchair || '') === opt.value}
                                onChange={() => setFormData({
                                  ...formData,
                                  accessibility_facilities: { ...formData.accessibility_facilities, stroller_wheelchair: opt.value, stroller: undefined, wheelchair: undefined },
                                })}
                                className="border-gray-300"
                              />
                              <span className="text-sm text-gray-700">{opt.labelKo}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pickup Points Tab */}
              {activeTab === 'pickup' && (
                <div className="space-y-4">
                  <input
                    ref={pickupImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePickupImageFileChange}
                  />
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      픽업장소 관리
                    </label>
                    <div className="space-y-4">
                      {(formData.pickup_points || []).map((point, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1.5">장소명</label>
                              <input
                                type="text"
                                value={point.name}
                                onChange={(e) => {
                                  const updated = [...(formData.pickup_points || [])];
                                  updated[index] = { ...updated[index], name: e.target.value };
                                  setFormData({ ...formData, pickup_points: updated });
                                }}
                                placeholder="예: 제주공항, 호텔 로비"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1.5">픽업 시간</label>
                              <input
                                type="time"
                                value={point.pickup_time || ''}
                                onChange={(e) => {
                                  const updated = [...(formData.pickup_points || [])];
                                  updated[index] = { ...updated[index], pickup_time: e.target.value };
                                  setFormData({ ...formData, pickup_points: updated });
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">주소</label>
                            <input
                              type="text"
                              value={point.address}
                              onChange={(e) => {
                                const updated = [...(formData.pickup_points || [])];
                                updated[index] = { ...updated[index], address: e.target.value };
                                setFormData({ ...formData, pickup_points: updated });
                              }}
                              placeholder="주소를 입력하거나 지도에서 선택하세요"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {(point.lat != null && point.lng != null) && (
                              <p className="mt-1 text-[11px] text-gray-500">
                                좌표: {Number(point.lat).toFixed(5)}, {Number(point.lng).toFixed(5)}
                              </p>
                            )}
                          </div>
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">사진 URL (선택)</label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={point.image_url || ''}
                                onChange={(e) => {
                                  const updated = [...(formData.pickup_points || [])];
                                  updated[index] = { ...updated[index], image_url: e.target.value };
                                  setFormData({ ...formData, pickup_points: updated });
                                }}
                                placeholder="https://... 또는 아래 업로드"
                                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => handlePickupImageUploadClick(index)}
                                disabled={uploadingPickupImageIndex === index}
                                className="flex-shrink-0 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {uploadingPickupImageIndex === index ? '업로드 중…' : '사진 업로드'}
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPickupIndex(index)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200/60 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              지도에서 핀 설정
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (formData.pickup_points || []).filter((_, i) => i !== index);
                                setFormData({ ...formData, pickup_points: updated });
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/30">
                        <p className="text-xs font-medium text-gray-700 mb-2">새 픽업장소 추가</p>
                        <PickupPointSelector
                          onLocationSelect={(location) => {
                            const newPoint = {
                              id: `temp-${Date.now()}`,
                              name: '',
                              address: location.address,
                              lat: location.lat,
                              lng: location.lng,
                              pickup_time: '',
                              image_url: '',
                            };
                            setFormData({
                              ...formData,
                              pickup_points: [...(formData.pickup_points || []), newPoint],
                            });
                          }}
                          height="300px"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          지도에서 위치를 검색하여 새 픽업장소를 추가하세요
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Itinerary Tab */}
              {activeTab === 'itinerary' && (
                <div className="space-y-6">
                  <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="text-indigo-600">🗓️</span> Schedule
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">Time, title, description and optional photos per step.</p>
                    <div className="space-y-4">
                      {(formData.schedule || []).map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                              <input type="text" value={item.time || ''} onChange={(e) => { const u = [...(formData.schedule || [])]; u[index] = { ...u[index], time: e.target.value }; setFormData({ ...formData, schedule: u }); }} placeholder="09:00" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                              <input type="text" value={item.title || ''} onChange={(e) => { const u = [...(formData.schedule || [])]; u[index] = { ...u[index], title: e.target.value }; setFormData({ ...formData, schedule: u }); }} placeholder="Hotel Pickup" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea value={item.description || ''} onChange={(e) => { const u = [...(formData.schedule || [])]; u[index] = { ...u[index], description: e.target.value }; setFormData({ ...formData, schedule: u }); }} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Photos (one URL per line)</label>
                            <textarea value={(item.images || []).join('\n')} onChange={(e) => { const u = [...(formData.schedule || [])]; const imgs = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); u[index] = { ...u[index], images: imgs }; setFormData({ ...formData, schedule: u }); }} rows={2} placeholder="https://..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                          </div>
                          <button type="button" onClick={() => setFormData({ ...formData, schedule: (formData.schedule || []).filter((_, i) => i !== index) })} className="text-red-600 text-sm hover:text-red-800">Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setFormData({ ...formData, schedule: [...(formData.schedule || []), { time: '', title: '', description: '', images: [] }] })} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">+ Add Schedule Item</button>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="text-indigo-600">📍</span> Itinerary details (timeline on detail page)
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">If set, the detail page shows this as the timeline. Each item: time, activity, description, optional photos.</p>
                    <div className="space-y-4">
                      {(formData.itinerary_details || []).map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                              <input type="text" value={item.time || ''} onChange={(e) => { const u = [...(formData.itinerary_details || [])]; u[index] = { ...u[index], time: e.target.value }; setFormData({ ...formData, itinerary_details: u }); }} placeholder="09:00" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Activity</label>
                              <input type="text" value={item.activity || ''} onChange={(e) => { const u = [...(formData.itinerary_details || [])]; u[index] = { ...u[index], activity: e.target.value }; setFormData({ ...formData, itinerary_details: u }); }} placeholder="e.g., Gamcheon Village" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea value={item.description || ''} onChange={(e) => { const u = [...(formData.itinerary_details || [])]; u[index] = { ...u[index], description: e.target.value }; setFormData({ ...formData, itinerary_details: u }); }} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Photos (one URL per line)</label>
                            <textarea value={(item.images || []).join('\n')} onChange={(e) => { const u = [...(formData.itinerary_details || [])]; u[index] = { ...u[index], images: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }; setFormData({ ...formData, itinerary_details: u }); }} rows={2} placeholder="https://..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                          </div>
                          <button type="button" onClick={() => setFormData({ ...formData, itinerary_details: (formData.itinerary_details || []).filter((_, i) => i !== index) })} className="text-red-600 text-sm hover:text-red-800">Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setFormData({ ...formData, itinerary_details: [...(formData.itinerary_details || []), { time: '', activity: '', description: '', images: [] }] })} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">+ Add Itinerary detail</button>
                    </div>
                  </section>
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

              {/* Languages Tab (다국어) - 기본정보·상세정보·일정·콘텐츠 전체 번역 */}
              {activeTab === 'languages' && (
                <div className="space-y-6">
                  <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="text-indigo-600">🌐</span> 다국어 편집
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">언어를 선택하면 해당 언어의 제목·부제·설명·상세정보·일정·콘텐츠(하이라이트·포함·미포함·FAQ)를 모두 편집할 수 있습니다. 저장 시 선택한 언어 번역만 반영됩니다.</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {SUPPORTED_LOCALES.map(({ code, label }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setEditLocale(code)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            editLocale === code
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {(() => {
                      const tr = (formData.translations || {})[editLocale] || {};
                      const setTr = (key: string, value: unknown) => setFormData({
                        ...formData,
                        translations: {
                          ...(formData.translations || {}),
                          [editLocale]: { ...tr, [key]: value },
                        },
                      });
                      const arr = (key: 'highlights' | 'includes' | 'excludes') => tr[key] ?? formData[key] ?? [];
                      const scheduleArr = tr.schedule ?? formData.schedule ?? [];
                      const faqsArr = tr.faqs ?? formData.faqs ?? [];
                      const pickupPointsList = formData.pickup_points || [];
                      const trPickupPoints = tr.pickup_points ?? [];
                      const getPickupTr = (pointId: string) => trPickupPoints.find((p: { id: string }) => p.id === pointId);
                      const handleExportLocaleJson = () => {
                        const obj = {
                          title: tr.title ?? formData.title ?? '',
                          tag: tr.tag ?? formData.tag ?? '',
                          subtitle: tr.subtitle ?? formData.subtitle ?? '',
                          duration: tr.duration ?? formData.duration ?? '',
                          description: tr.description ?? formData.description ?? '',
                          pickup_info: tr.pickup_info ?? formData.pickup_info ?? '',
                          notes: tr.notes ?? formData.notes ?? '',
                          pickup_points: pickupPointsList.map((p) => {
                            const t = getPickupTr(p.id);
                            return { id: p.id, name: t?.name ?? p.name };
                          }),
                          highlights: arr('highlights') as string[],
                          includes: arr('includes') as string[],
                          excludes: arr('excludes') as string[],
                          schedule: scheduleArr.map((s: { time?: string; title?: string; description?: string }) => ({ time: s.time ?? '', title: s.title ?? '', description: s.description ?? '' })),
                          faqs: faqsArr.map((f: { question?: string; answer?: string }) => ({ question: f.question ?? '', answer: f.answer ?? '' })),
                        };
                        setLocaleBulkJson(JSON.stringify(obj, null, 2));
                        setLocaleBulkError(null);
                      };
                      const handleApplyLocaleJson = () => {
                        setLocaleBulkError(null);
                        if (!localeBulkJson.trim()) {
                          setLocaleBulkError('JSON을 붙여넣은 뒤 적용하세요.');
                          return;
                        }
                        let parsed: Record<string, unknown>;
                        try {
                          parsed = JSON.parse(localeBulkJson);
                        } catch (e: unknown) {
                          setLocaleBulkError(e instanceof Error ? e.message : 'JSON 형식이 올바르지 않습니다.');
                          return;
                        }
                        const next: Record<string, unknown> = { ...tr };
                        if (parsed.title !== undefined) next.title = typeof parsed.title === 'string' ? parsed.title : '';
                        if (parsed.tag !== undefined) next.tag = typeof parsed.tag === 'string' ? parsed.tag : '';
                        if (parsed.subtitle !== undefined) next.subtitle = typeof parsed.subtitle === 'string' ? parsed.subtitle : '';
                        if (parsed.duration !== undefined) next.duration = typeof parsed.duration === 'string' ? parsed.duration : '';
                        if (parsed.description !== undefined) next.description = typeof parsed.description === 'string' ? parsed.description : '';
                        if (parsed.pickup_info !== undefined) next.pickup_info = typeof parsed.pickup_info === 'string' ? parsed.pickup_info : '';
                        if (parsed.notes !== undefined) next.notes = typeof parsed.notes === 'string' ? parsed.notes : '';
                        if (Array.isArray(parsed.highlights)) next.highlights = parsed.highlights.map((x) => (typeof x === 'string' ? x : String(x)));
                        if (Array.isArray(parsed.includes)) next.includes = parsed.includes.map((x) => (typeof x === 'string' ? x : String(x)));
                        if (Array.isArray(parsed.excludes)) next.excludes = parsed.excludes.map((x) => (typeof x === 'string' ? x : String(x)));
                        if (Array.isArray(parsed.schedule)) next.schedule = parsed.schedule.map((s: unknown) => {
                          const t = s && typeof s === 'object' ? s as Record<string, unknown> : {};
                          return { time: String(t.time ?? ''), title: String(t.title ?? ''), description: String(t.description ?? ''), images: [] };
                        });
                        if (Array.isArray(parsed.faqs)) next.faqs = parsed.faqs.map((f: unknown) => {
                          const o = f && typeof f === 'object' ? f as Record<string, unknown> : {};
                          return { question: String(o.question ?? ''), answer: String(o.answer ?? '') };
                        });
                        if (Array.isArray(parsed.pickup_points)) next.pickup_points = parsed.pickup_points.map((p: unknown) => {
                          const o = p && typeof p === 'object' ? p as Record<string, unknown> : {};
                          return { id: String(o.id ?? ''), name: String(o.name ?? '') };
                        });
                        setFormData({
                          ...formData,
                          translations: {
                            ...(formData.translations || {}),
                            [editLocale]: next,
                          },
                        });
                        setLocaleBulkError(null);
                      };
                      return (
                        <div className="space-y-8">
                          {/* 한 번에 JSON 내보내기 / 가져오기 */}
                          <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">한 번에 복사·붙여넣기 (JSON)</h4>
                            <p className="text-xs text-gray-600 mb-3">현재 선택한 언어를 JSON으로 내보낸 뒤 LLM 등으로 번역하고, 번역된 JSON을 붙여넣어 적용하면 모든 필드가 한 번에 채워집니다.</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <button type="button" onClick={handleExportLocaleJson} className="px-3 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50">
                                현재 언어 → JSON으로 내보내기
                              </button>
                              <button type="button" onClick={handleApplyLocaleJson} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                                아래 JSON 적용
                              </button>
                            </div>
                            {localeBulkError && <p className="text-sm text-red-600 mb-2">{localeBulkError}</p>}
                            <textarea
                              value={localeBulkJson}
                              onChange={(e) => { setLocaleBulkJson(e.target.value); setLocaleBulkError(null); }}
                              placeholder='{"title":"...","pickup_info":"...","notes":"...","pickup_points":[{"id":"...","name":"..."}],"highlights":["..."],"schedule":[...],"faqs":[...]}'
                              rows={12}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          {/* 기본 정보 */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase">기본 정보 ({editLocale})</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input type="text" value={tr.title ?? formData.title ?? ''} onChange={(e) => setTr('title', e.target.value || undefined)} placeholder={formData.title || 'Default title'} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                                <input type="text" value={tr.tag ?? formData.tag ?? ''} onChange={(e) => setTr('tag', e.target.value || undefined)} placeholder={formData.tag || ''} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                                <input type="text" value={tr.subtitle ?? formData.subtitle ?? ''} onChange={(e) => setTr('subtitle', e.target.value || undefined)} placeholder={formData.subtitle || ''} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                                <input type="text" value={tr.duration ?? formData.duration ?? ''} onChange={(e) => setTr('duration', e.target.value || undefined)} placeholder={formData.duration || 'e.g. 9 hours'} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea value={tr.description ?? formData.description ?? ''} onChange={(e) => setTr('description', e.target.value || undefined)} rows={5} placeholder={formData.description ? formData.description.slice(0, 80) + '...' : ''} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                              </div>
                            </div>
                          </div>
                          {/* 상세 정보 */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase">상세 정보 – Pickup Info / Notes ({editLocale})</h4>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Info</label>
                                <textarea value={tr.pickup_info ?? formData.pickup_info ?? ''} onChange={(e) => setTr('pickup_info', e.target.value || undefined)} rows={4} placeholder={formData.pickup_info ? formData.pickup_info.slice(0, 60) + '...' : 'Pickup information...'} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Important Information</label>
                                <textarea value={tr.notes ?? formData.notes ?? ''} onChange={(e) => setTr('notes', e.target.value || undefined)} rows={5} placeholder={formData.notes ? formData.notes.slice(0, 60) + '...' : 'Important information...'} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                              </div>
                            </div>
                          </div>
                          {/* 픽업장소 (장소명만) */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase">픽업장소 – 장소명 ({editLocale})</h4>
                            <p className="text-xs text-gray-500 mb-3">픽업장소 탭에서 추가한 각 장소의 이름만 이 언어로 입력하세요. JSON 내보내기/적용에도 포함됩니다.</p>
                            <div className="space-y-4">
                              {pickupPointsList.length === 0 ? (
                                <p className="text-sm text-gray-500">등록된 픽업장소가 없습니다. 상단 픽업장소 탭에서 먼저 추가하세요.</p>
                              ) : pickupPointsList.map((point) => {
                                const t = getPickupTr(point.id);
                                const updateName = (value: string) => {
                                  const existing = trPickupPoints.find((p: { id: string }) => p.id === point.id);
                                  const next = existing
                                    ? trPickupPoints.map((p: { id: string; name: string }) => p.id === point.id ? { ...p, name: value } : p)
                                    : [...trPickupPoints, { id: point.id, name: value }];
                                  setTr('pickup_points', next);
                                };
                                return (
                                  <div key={point.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                    <p className="text-xs text-gray-500 mb-2">기본: {point.name}</p>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">장소명</label>
                                      <input
                                        type="text"
                                        value={t?.name ?? point.name}
                                        onChange={(e) => updateName(e.target.value)}
                                        placeholder={point.name}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* 일정 */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase">일정 Schedule ({editLocale})</h4>
                            <div className="space-y-3">
                              {scheduleArr.map((item: { time?: string; title?: string; description?: string; images?: string[] }, index: number) => (
                                <div key={index} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                  <div className="grid grid-cols-3 gap-3 mb-2">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                                      <input type="text" value={item.time || ''} onChange={(e) => { const u = [...scheduleArr]; u[index] = { ...u[index], time: e.target.value }; setTr('schedule', u); }} placeholder="09:00" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                                    </div>
                                    <div className="col-span-2">
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                                      <input type="text" value={item.title || ''} onChange={(e) => { const u = [...scheduleArr]; u[index] = { ...u[index], title: e.target.value }; setTr('schedule', u); }} placeholder="Hotel Pickup" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                                    </div>
                                  </div>
                                  <div className="mb-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                                    <textarea value={item.description || ''} onChange={(e) => { const u = [...scheduleArr]; u[index] = { ...u[index], description: e.target.value }; setTr('schedule', u); }} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                                  </div>
                                  <button type="button" onClick={() => setTr('schedule', scheduleArr.filter((_: unknown, i: number) => i !== index))} className="text-red-600 text-sm hover:text-red-800">Remove</button>
                                </div>
                              ))}
                              <button type="button" onClick={() => setTr('schedule', [...scheduleArr, { time: '', title: '', description: '', images: [] }])} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">+ Add Schedule Item</button>
                            </div>
                          </div>
                          {/* 콘텐츠: Highlights, Includes, Excludes, FAQs */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase">콘텐츠 – Highlights / Includes / Excludes / FAQs ({editLocale})</h4>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Highlights</label>
                                <div className="space-y-2">
                                  {(arr('highlights') as string[]).map((highlight: string, index: number) => (
                                    <div key={index} className="flex gap-2">
                                      <input type="text" value={highlight} onChange={(e) => { const u = [...(arr('highlights') as string[])]; u[index] = e.target.value; setTr('highlights', u); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                                      <button type="button" onClick={() => setTr('highlights', (arr('highlights') as string[]).filter((_: string, i: number) => i !== index))} className="px-3 py-2 text-red-600 hover:text-red-800 text-sm">Remove</button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => setTr('highlights', [...(arr('highlights') as string[]), ''])} className="text-indigo-600 text-sm hover:text-indigo-800">+ Add Highlight</button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Includes</label>
                                <div className="space-y-2">
                                  {(arr('includes') as string[]).map((item: string, index: number) => (
                                    <div key={index} className="flex gap-2">
                                      <input type="text" value={item} onChange={(e) => { const u = [...(arr('includes') as string[])]; u[index] = e.target.value; setTr('includes', u); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                                      <button type="button" onClick={() => setTr('includes', (arr('includes') as string[]).filter((_: string, i: number) => i !== index))} className="px-3 py-2 text-red-600 hover:text-red-800 text-sm">Remove</button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => setTr('includes', [...(arr('includes') as string[]), ''])} className="text-indigo-600 text-sm hover:text-indigo-800">+ Add Include</button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Excludes</label>
                                <div className="space-y-2">
                                  {(arr('excludes') as string[]).map((item: string, index: number) => (
                                    <div key={index} className="flex gap-2">
                                      <input type="text" value={item} onChange={(e) => { const u = [...(arr('excludes') as string[])]; u[index] = e.target.value; setTr('excludes', u); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                                      <button type="button" onClick={() => setTr('excludes', (arr('excludes') as string[]).filter((_: string, i: number) => i !== index))} className="px-3 py-2 text-red-600 hover:text-red-800 text-sm">Remove</button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => setTr('excludes', [...(arr('excludes') as string[]), ''])} className="text-indigo-600 text-sm hover:text-indigo-800">+ Add Exclude</button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">FAQs</label>
                                <div className="space-y-4">
                                  {faqsArr.map((item: { question?: string; answer?: string }, index: number) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                                      <div className="mb-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Question</label>
                                        <input type="text" value={item.question || ''} onChange={(e) => { const u = [...faqsArr]; u[index] = { ...u[index], question: e.target.value }; setTr('faqs', u); }} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                                      </div>
                                      <div className="mb-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Answer</label>
                                        <textarea value={item.answer || ''} onChange={(e) => { const u = [...faqsArr]; u[index] = { ...u[index], answer: e.target.value }; setTr('faqs', u); }} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                                      </div>
                                      <button type="button" onClick={() => setTr('faqs', faqsArr.filter((_: unknown, i: number) => i !== index))} className="text-red-600 text-sm hover:text-red-800">Remove FAQ</button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => setTr('faqs', [...faqsArr, { question: '', answer: '' }])} className="text-indigo-600 text-sm hover:text-indigo-800">+ Add FAQ</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                </div>
              )}

            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 bg-white/95 border-t border-gray-200/80 backdrop-blur-sm">
              <button
                onClick={handleCloseModal}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 픽업장소 지도 핀 설정 모달 */}
      {editingPickupIndex !== null && formData.pickup_points && formData.pickup_points[editingPickupIndex] != null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                지도에서 픽업 장소 핀 설정
              </h3>
              <button
                type="button"
                onClick={() => setEditingPickupIndex(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <PickupPointSelector
                initialLocation={
                  (() => {
                    const p = formData.pickup_points![editingPickupIndex];
                    if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng, address: p.address };
                    return undefined;
                  })()
                }
                onLocationSelect={(location) => {
                  const updated = [...(formData.pickup_points || [])];
                  updated[editingPickupIndex] = {
                    ...updated[editingPickupIndex],
                    address: location.address,
                    lat: location.lat,
                    lng: location.lng,
                  };
                  setFormData({ ...formData, pickup_points: updated });
                  setEditingPickupIndex(null);
                }}
                height="360px"
              />
              <p className="mt-2 text-xs text-gray-500">
                지도를 클릭하거나 검색창에 주소를 입력한 뒤 선택하면 해당 위치에 핀이 설정됩니다.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingPickupIndex(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

