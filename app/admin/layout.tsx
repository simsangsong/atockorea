'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const adminMenuItems = [
  { path: '/admin', label: 'Dashboard', icon: '📊' },
  { path: '/admin/revenue', label: '매출내역', icon: '💰' },
  { path: '/admin/merchants', label: '商家管理', icon: '🏢' },
  { path: '/admin/products', label: '产品管理', icon: '🎫' },
  { path: '/admin/orders', label: '订单管理', icon: '📦' },
  { path: '/admin/reports', label: '评价举报', icon: '🚨' },
  { path: '/admin/analytics', label: '数据分析', icon: '📈' },
  { path: '/admin/settings', label: '系统设置', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // TODO: Check authentication
    // For now, allow access
    setIsAuthenticated(true);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to access admin panel</p>
          <Link href="/signin" className="text-indigo-600 hover:text-indigo-700">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">AtoC Korea</h1>
          <p className="text-sm text-gray-500 mt-1">总台管理后台</p>
        </div>
        <nav className="p-4 space-y-2">
          {adminMenuItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === item.path
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>🏠</span>
            <span>返回首页</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}

