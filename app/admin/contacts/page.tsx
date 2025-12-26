'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ContactInquiry {
  id: string;
  full_name: string;
  email: string;
  subject: string;
  message: string;
  booking_reference: string | null;
  tour_date: string | null;
  phone_whatsapp: string | null;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  is_read: boolean;
  admin_notes: string | null;
  created_at: string;
}

export default function AdminContactsPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiry | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    is_read: 'all',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });

  useEffect(() => {
    fetchInquiries();
  }, [filters, pagination.page]);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin?redirect=/admin/contacts');
        return;
      }

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.is_read !== 'all' && { is_read: filters.is_read }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/contacts?${params}`, {
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
        throw new Error('Failed to fetch contact inquiries');
      }

      const data = await response.json();
      setInquiries(data.inquiries || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        total_pages: data.pagination?.total_pages || 0,
      }));
    } catch (error) {
      console.error('Error fetching contact inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInquiryClick = async (inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry);
    setAdminNotes(inquiry.admin_notes || '');
    
    // Mark as read
    if (!inquiry.is_read) {
      try {
        const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
        await fetch(`/api/admin/contacts`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            inquiry_id: inquiry.id,
            updates: { is_read: true },
          }),
        });
        setInquiries(prev => prev.map(i => 
          i.id === inquiry.id ? { ...i, is_read: true } : i
        ));
      } catch (error) {
        console.error('Error marking inquiry as read:', error);
      }
    }
  };

  const handleUpdateStatus = async (inquiryId: string, newStatus: string) => {
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      const response = await fetch(`/api/admin/contacts`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          inquiry_id: inquiryId,
          updates: { status: newStatus },
        }),
      });

      if (response.ok) {
        setInquiries(prev => prev.map(i => 
          i.id === inquiryId ? { ...i, status: newStatus as any } : i
        ));
        if (selectedInquiry?.id === inquiryId) {
          setSelectedInquiry(prev => prev ? { ...prev, status: newStatus as any } : null);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedInquiry) return;

    setUpdatingNotes(true);
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      const response = await fetch(`/api/admin/contacts`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          inquiry_id: selectedInquiry.id,
          updates: { admin_notes: adminNotes },
        }),
      });

      if (response.ok) {
        setInquiries(prev => prev.map(i => 
          i.id === selectedInquiry.id ? { ...i, admin_notes: adminNotes } : i
        ));
        setSelectedInquiry(prev => prev ? { ...prev, admin_notes: adminNotes } : null);
        alert('Notes saved successfully');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    } finally {
      setUpdatingNotes(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading contact inquiries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contact Inquiries</h1>
        <p className="text-sm text-gray-600 mt-1">Manage customer contact form submissions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Inquiry List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Read Status</label>
                <select
                  value={filters.is_read}
                  onChange={(e) => setFilters(prev => ({ ...prev, is_read: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All</option>
                  <option value="false">Unread</option>
                  <option value="true">Read</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Search</label>
                <input
                  type="text"
                  placeholder="Search by name, email..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Inquiry List */}
          <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm">
            <div className="divide-y divide-gray-200">
              {inquiries.length > 0 ? (
                inquiries.map((inquiry) => (
                  <button
                    key={inquiry.id}
                    onClick={() => handleInquiryClick(inquiry)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedInquiry?.id === inquiry.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                    } ${!inquiry.is_read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {inquiry.full_name}
                          </p>
                          {!inquiry.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate mb-1">{inquiry.email}</p>
                        <p className="text-sm text-gray-800 font-medium truncate">{inquiry.subject}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(inquiry.created_at)}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-md flex-shrink-0 ml-2 ${getStatusColor(inquiry.status)}`}>
                        {inquiry.status}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-gray-500">
                  No contact inquiries found
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.total_pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.total_pages}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inquiry Details */}
        <div className="lg:col-span-1">
          {selectedInquiry ? (
            <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-5 sticky top-5">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Inquiry Details</h2>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-md ${getStatusColor(selectedInquiry.status)}`}>
                      {selectedInquiry.status}
                    </span>
                    <select
                      value={selectedInquiry.status}
                      onChange={(e) => handleUpdateStatus(selectedInquiry.id, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Name</p>
                  <p className="text-sm text-gray-900">{selectedInquiry.full_name}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Email</p>
                  <a href={`mailto:${selectedInquiry.email}`} className="text-sm text-blue-600 hover:underline">
                    {selectedInquiry.email}
                  </a>
                </div>

                {selectedInquiry.phone_whatsapp && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Phone/WhatsApp</p>
                    <p className="text-sm text-gray-900">{selectedInquiry.phone_whatsapp}</p>
                  </div>
                )}

                {selectedInquiry.booking_reference && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Booking Reference</p>
                    <p className="text-sm text-gray-900 font-mono">{selectedInquiry.booking_reference}</p>
                  </div>
                )}

                {selectedInquiry.tour_date && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Tour Date</p>
                    <p className="text-sm text-gray-900">{new Date(selectedInquiry.tour_date).toLocaleDateString()}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Subject</p>
                  <p className="text-sm text-gray-900">{selectedInquiry.subject}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Message</p>
                  <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {selectedInquiry.message}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Submitted</p>
                  <p className="text-xs text-gray-600">{formatDate(selectedInquiry.created_at)}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Admin Notes</p>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    placeholder="Add notes about this inquiry..."
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={updatingNotes}
                    className="mt-2 w-full px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {updatingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-8 text-center">
              <p className="text-sm text-gray-500">Select an inquiry to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



