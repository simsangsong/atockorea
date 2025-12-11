'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  DashboardIcon,
  RevenueIcon,
  ProductsIcon,
  OrdersIcon,
  CustomersIcon,
  AnalyticsIcon,
  SettingsIcon,
  HomeIcon,
} from '@/components/MerchantIcons';

const merchantMenuItems = [
  { path: '/merchant', label: '대시보드', icon: DashboardIcon },
  { path: '/merchant/revenue', label: '매출내역', icon: RevenueIcon },
  { path: '/merchant/products', label: '상품관리', icon: ProductsIcon },
  { path: '/merchant/orders', label: '주문관리', icon: OrdersIcon },
  { path: '/merchant/customers', label: '고객관리', icon: CustomersIcon },
  { path: '/merchant/analytics', label: '데이터분석', icon: AnalyticsIcon },
  { path: '/merchant/settings', label: '설정', icon: SettingsIcon },
];

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [merchantName, setMerchantName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication from localStorage
    const checkAuth = () => {
      try {
        const merchantUser = localStorage.getItem('merchant_user');
        const merchantSession = localStorage.getItem('merchant_session');
        
        if (merchantUser && merchantSession) {
          const user = JSON.parse(merchantUser);
          setIsAuthenticated(true);
          setMerchantName(user.companyName || '판매자');
        } else {
          // If no auth, redirect to login (but not if already on login page)
          if (pathname !== '/merchant/login') {
            router.push('/merchant/login');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (pathname !== '/merchant/login') {
          router.push('/merchant/login');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router, pathname]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Don't show auth check on login page
  if (pathname === '/merchant/login') {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">판매자 대시보드에 접근하려면 로그인이 필요합니다</p>
          <Link href="/merchant/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{merchantName}</h1>
            <p className="text-xs text-gray-500">판매자 관리 대시보드</p>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-200 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{merchantName}</h1>
              <p className="text-xs text-gray-500">판매자 관리 대시보드</p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-120px)]">
          {merchantMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0 ${
                  isActive ? 'ring-2 ring-indigo-300' : ''
                }`}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <button
            onClick={() => {
              router.push('/');
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
              <HomeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-sm font-medium">홈으로</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:left-0 md:top-0 md:h-full md:w-64 bg-white border-r border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">{merchantName}</h1>
          <p className="text-sm text-gray-500 mt-1">판매자 관리 대시보드</p>
        </div>
        <nav className="p-4 space-y-2">
          {merchantMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0 ${
                  isActive ? 'ring-2 ring-indigo-300' : ''
                }`}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
              <HomeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-sm font-medium">홈으로</span>
          </button>
        </div>
      </aside>

      {/* Main Content - Mobile First */}
      <main className="md:ml-64 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

