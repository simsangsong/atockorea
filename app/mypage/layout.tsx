'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import {
  DashboardIcon,
  CalendarIcon,
  HistoryIcon,
  StarIcon,
  HeartIcon,
  SettingsIcon,
  LogoutIcon,
  MapIcon,
} from '@/components/Icons';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, path: '/mypage/dashboard' },
  { id: 'mybookings', label: 'My Bookings', icon: MapIcon, path: '/mypage/mybookings' },
  { id: 'upcoming', label: 'Upcoming Tours', icon: CalendarIcon, path: '/mypage/upcoming' },
  { id: 'history', label: 'Booking History', icon: HistoryIcon, path: '/mypage/history' },
  { id: 'reviews', label: 'Reviews', icon: StarIcon, path: '/mypage/reviews' },
  { id: 'wishlist', label: 'Wishlist', icon: HeartIcon, path: '/mypage/wishlist' },
  { id: 'settings', label: 'Account Settings', icon: SettingsIcon, path: '/mypage/settings' },
];

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <div className="sticky top-20 space-y-4">
              {/* User Profile */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg">
                    JD
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">John Doe</h2>
                  <p className="text-sm text-gray-500">john.doe@example.com</p>
                </div>
              </div>

              {/* Navigation Menu - Unified Card */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-2">
                <nav className="space-y-0">
                  {menuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <div key={item.id}>
                        <Link
                          href={item.path}
                          className={`w-full flex items-center gap-3 px-4 py-4 rounded-lg text-base font-medium transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                          <span>{item.label}</span>
                        </Link>
                        {index < menuItems.length - 1 && (
                          <div className="border-b border-gray-200/50 mx-2"></div>
                        )}
                      </div>
                    );
                  })}
                  <div className="border-b border-gray-200/50 mx-2 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-4 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 transition-all"
                  >
                    <LogoutIcon className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">{children}</div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

