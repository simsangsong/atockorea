'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  DashboardIcon,
  CalendarIcon,
  HistoryIcon,
  StarIcon,
  HeartIcon,
  SettingsIcon,
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

export default function MyPage() {
  const router = useRouter();
  const pathname = usePathname();

  // For desktop, redirect to dashboard
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      router.replace('/mypage/dashboard');
    }
  }, [router]);

  const isPathActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <div className="md:hidden w-full space-y-6">
      {/* Mobile User Profile */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-orange-500 flex items-center justify-center text-white text-xl font-bold shadow-[0_8px_20px_rgba(59,130,246,0.3)]">
            MP
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">My Page</h2>
            <p className="text-sm text-gray-500">Select an option below</p>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-3">
        <nav className="space-y-0">
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = isPathActive(item.path);
            return (
              <div key={item.id}>
                        <Link
                          href={item.path}
                          className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-xl text-base font-medium transition-all duration-200 ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                            isActive
                              ? 'bg-white/20'
                              : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            <div className="w-4 h-4">
                              <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                            </div>
                          </div>
                          <span className="tracking-wide">{item.label}</span>
                        </Link>
                {index < menuItems.length - 1 && (
                  <div className="border-b border-gray-200/50 mx-2"></div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
