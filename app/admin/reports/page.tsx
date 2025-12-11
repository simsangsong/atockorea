'use client';

import { useState, useEffect } from 'react';
import { requireAdmin } from '@/lib/auth';

interface Report {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  review: {
    id: string;
    rating: number;
    title: string | null;
    comment: string | null;
    is_visible: boolean;
    user_profiles: {
      id: string;
      full_name: string | null;
    } | null;
    tours: {
      id: string;
      title: string;
    } | null;
  } | null;
  reporter: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  handler: {
    id: string;
    full_name: string | null;
  } | null;
  handled_at: string | null;
  handling_notes: string | null;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [handlingNotes, setHandlingNotes] = useState('');

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? '/api/reviews/reports'
        : `/api/reviews/reports?status=${statusFilter}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      const data = await response.json();
      setReports(data.reports || []);
      setSummary(data.summary || {});
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/reviews/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          handlingNotes: handlingNotes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update report');
      }

      await fetchReports();
      setSelectedReport(null);
      setHandlingNotes('');
      alert('举报状态已更新');
    } catch (error) {
      console.error('Error updating report:', error);
      alert('更新失败，请重试');
    }
  };

  const reasonLabels: { [key: string]: string } = {
    spam: '垃圾信息',
    inappropriate: '不当内容',
    fake: '虚假评价',
    harassment: '骚扰',
    other: '其他',
  };

  const statusLabels: { [key: string]: string } = {
    pending: '待处理',
    reviewing: '审核中',
    resolved: '已处理',
    dismissed: '已驳回',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">评价举报管理</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">待处理</p>
            <p className="text-3xl font-bold text-yellow-600">{summary.pending_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">审核中</p>
            <p className="text-3xl font-bold text-blue-600">{summary.reviewing_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">已处理</p>
            <p className="text-3xl font-bold text-green-600">{summary.resolved_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">总计</p>
            <p className="text-3xl font-bold text-gray-900">{summary.total_count || 0}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">全部</option>
            <option value="pending">待处理</option>
            <option value="reviewing">审核中</option>
            <option value="resolved">已处理</option>
            <option value="dismissed">已驳回</option>
          </select>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600">暂无举报</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        report.status === 'reviewing' ? 'bg-blue-100 text-blue-800' :
                        report.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {statusLabels[report.status] || report.status}
                      </span>
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                        {reasonLabels[report.reason] || report.reason}
                      </span>
                    </div>
                    
                    {report.review && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-3">
                        <p className="text-sm text-gray-600 mb-1">
                          评价内容：{report.review.tours?.title || '未知旅游产品'}
                        </p>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {report.review.title || '无标题'}
                        </p>
                        <p className="text-sm text-gray-700">
                          {report.review.comment || '无内容'}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          评价人：{report.review.user_profiles?.full_name || '匿名'}
                        </p>
                      </div>
                    )}

                    {report.description && (
                      <div className="bg-blue-50 rounded-lg p-4 mb-3">
                        <p className="text-sm font-medium text-gray-900 mb-1">举报说明</p>
                        <p className="text-sm text-gray-700">{report.description}</p>
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      举报人：{report.reporter?.full_name || report.reporter?.email || '未知'} · 
                      举报时间：{new Date(report.created_at).toLocaleString('zh-CN')}
                    </div>

                    {report.handled_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        处理人：{report.handler?.full_name || '未知'} · 
                        处理时间：{new Date(report.handled_at).toLocaleString('zh-CN')}
                      </div>
                    )}

                    {report.handling_notes && (
                      <div className="bg-green-50 rounded-lg p-3 mt-3">
                        <p className="text-xs font-medium text-gray-900 mb-1">处理备注</p>
                        <p className="text-xs text-gray-700">{report.handling_notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {report.status === 'pending' && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setSelectedReport(report);
                        setHandlingNotes('');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      开始审核
                    </button>
                    <button
                      onClick={() => handleStatusChange(report.id, 'dismissed')}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      驳回
                    </button>
                  </div>
                )}

                {report.status === 'reviewing' && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setSelectedReport(report);
                        setHandlingNotes('');
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      处理完成
                    </button>
                    <button
                      onClick={() => handleStatusChange(report.id, 'pending')}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      返回待处理
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Handling Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {selectedReport.status === 'pending' ? '开始审核' : '处理举报'}
              </h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  处理备注（可选）
                </label>
                <textarea
                  value={handlingNotes}
                  onChange={(e) => setHandlingNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="请输入处理备注..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const newStatus = selectedReport.status === 'pending' ? 'reviewing' : 'resolved';
                    handleStatusChange(selectedReport.id, newStatus);
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {selectedReport.status === 'pending' ? '开始审核' : '完成处理'}
                </button>
                <button
                  onClick={() => {
                    setSelectedReport(null);
                    setHandlingNotes('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

