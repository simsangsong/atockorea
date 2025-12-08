'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Email {
  id: string;
  message_id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  text_content: string;
  html_content: string | null;
  is_read: boolean;
  is_archived: boolean;
  category: string | null;
  received_at: string;
  attachments: any[];
}

export default function AdminEmailsPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
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
    fetchEmails();
  }, [filters, pagination.page]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.is_read !== 'all' && { is_read: filters.is_read }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/emails?${params}`);
      const data = await response.json();

      if (response.ok) {
        setEmails(data.emails || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          total_pages: data.pagination?.total_pages || 0,
        }));
      } else {
        console.error('Failed to fetch emails:', data.error);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email);
    
    // 标记为已读
    if (!email.is_read) {
      try {
        await fetch(`/api/admin/emails`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_id: email.id,
            updates: { is_read: true },
          }),
        });
        // 更新本地状态
        setEmails(prev => prev.map(e => 
          e.id === email.id ? { ...e, is_read: true } : e
        ));
      } catch (error) {
        console.error('Error marking email as read:', error);
      }
    }
  };

  const handleArchive = async (emailId: string) => {
    try {
      await fetch(`/api/admin/emails`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_id: emailId,
          updates: { is_archived: true },
        }),
      });
      setEmails(prev => prev.filter(e => e.id !== emailId));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error('Error archiving email:', error);
    }
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replySubject.trim() || !replyContent.trim()) {
      alert('Please fill in both subject and content');
      return;
    }

    try {
      setSendingReply(true);
      const response = await fetch(`/api/admin/emails/${selectedEmail.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: replySubject,
          content: replyContent,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Reply sent successfully!');
        setShowReplyForm(false);
        setReplySubject('');
        setReplyContent('');
      } else {
        alert(`Failed to send reply: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleReplyClick = () => {
    if (selectedEmail) {
      setReplySubject(selectedEmail.subject?.startsWith('Re:') 
        ? selectedEmail.subject 
        : `Re: ${selectedEmail.subject || '(No Subject)'}`);
      setShowReplyForm(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-neutral-50 to-slate-100">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Received Emails</h1>
          <p className="text-gray-600">Manage emails sent to support@atockorea.com</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 邮件列表 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
              {/* 过滤器 */}
              <div className="mb-4 space-y-3">
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="support">Support</option>
                  <option value="inquiry">Inquiry</option>
                  <option value="complaint">Complaint</option>
                  <option value="booking">Booking</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={filters.is_read}
                  onChange={(e) => setFilters({ ...filters, is_read: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="all">All</option>
                  <option value="false">Unread</option>
                  <option value="true">Read</option>
                </select>
              </div>

              {/* 邮件列表 */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : emails.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No emails found</div>
                ) : (
                  emails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => handleEmailClick(email)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedEmail?.id === email.id
                          ? 'bg-indigo-50 border-2 border-indigo-500'
                          : email.is_read
                          ? 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                          : 'bg-white border-2 border-indigo-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            !email.is_read ? 'text-gray-900 font-semibold' : 'text-gray-700'
                          }`}>
                            {email.from_name || email.from_email}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{email.from_email}</p>
                        </div>
                        {!email.is_read && (
                          <div className="w-2 h-2 bg-indigo-500 rounded-full ml-2 flex-shrink-0 mt-1"></div>
                        )}
                      </div>
                      <p className={`text-sm truncate mb-1 ${
                        !email.is_read ? 'text-gray-900 font-medium' : 'text-gray-600'
                      }`}>
                        {email.subject || '(No Subject)'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(email.received_at)}</p>
                      {email.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                          {email.category}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* 分页 */}
              {pagination.total_pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.total_pages}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 邮件详情 */}
          <div className="lg:col-span-2">
            {selectedEmail ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {selectedEmail.subject || '(No Subject)'}
                    </h2>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">From:</span> {selectedEmail.from_name || ''} {' '}
                        <span className="text-gray-500">&lt;{selectedEmail.from_email}&gt;</span>
                      </p>
                      <p>
                        <span className="font-medium">To:</span> {selectedEmail.to_email}
                      </p>
                      <p>
                        <span className="font-medium">Date:</span> {formatDate(selectedEmail.received_at)}
                      </p>
                      {selectedEmail.category && (
                        <p>
                          <span className="font-medium">Category:</span>{' '}
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                            {selectedEmail.category}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReplyClick}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => handleArchive(selectedEmail.id)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Archive
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  {selectedEmail.html_content ? (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-gray-700">
                      {selectedEmail.text_content || 'No content'}
                    </div>
                  )}
                </div>

                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="font-medium text-gray-900 mb-2">Attachments:</h3>
                    <ul className="space-y-1">
                      {selectedEmail.attachments.map((att: any, idx: number) => (
                        <li key={idx} className="text-sm text-gray-600">
                          📎 {att.filename} ({att.size} bytes)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 回复表单 */}
                {showReplyForm && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Reply to {selectedEmail.from_email}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subject
                        </label>
                        <input
                          type="text"
                          value={replySubject}
                          onChange={(e) => setReplySubject(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          placeholder="Reply subject"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Message
                        </label>
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={8}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                          placeholder="Type your reply here..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSendReply}
                          disabled={sendingReply || !replySubject.trim() || !replyContent.trim()}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingReply ? 'Sending...' : 'Send Reply'}
                        </button>
                        <button
                          onClick={() => {
                            setShowReplyForm(false);
                            setReplySubject('');
                            setReplyContent('');
                          }}
                          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Select an email to view details</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

