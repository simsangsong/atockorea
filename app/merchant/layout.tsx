'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const merchantMenuItems = [
  { path: '/merchant', label: '仪表板', icon: '📊' },
  { path: '/merchant/products', label: '产品管理', icon: '🎫' },
  { path: '/merchant/orders', label: '订单管理', icon: '📦' },
  { path: '/merchant/customers', label: '客户管理', icon: '👥' },
  { path: '/merchant/analytics', label: '数据分析', icon: '📈' },
  { path: '/merchant/settings', label: '设置', icon: '⚙️' },
];

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [merchantName, setMerchantName] = useState('');

  useEffect(() => {
    // TODO: Check authentication and fetch merchant info
    // For now, allow access
    setIsAuthenticated(true);
    setMerchantName('我的旅行社');
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to access merchant dashboard</p>
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
          <h1 className="text-xl font-bold text-gray-900">{merchantName}</h1>
          <p className="text-sm text-gray-500 mt-1">商家管理后台</p>
        </div>
        <nav className="p-4 space-y-2">
          {merchantMenuItems.map((item) => (
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

