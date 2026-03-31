'use client';

export const dynamic = 'force-dynamic';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DashboardIcon,
  CalendarIcon,
  HistoryIcon,
  StarIcon,
  HeartIcon,
  SettingsIcon,
  MapIcon,
  BookmarkIcon,
} from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';

const menuItems: { id: string; path: string; icon: typeof DashboardIcon; labelKey: string }[] = [
  { id: 'dashboard', path: '/mypage/dashboard', icon: DashboardIcon, labelKey: 'mypage.dashboard' },
  { id: 'mybookings', path: '/mypage/mybookings', icon: MapIcon, labelKey: 'mypage.myBookings' },
  { id: 'upcoming', path: '/mypage/upcoming', icon: CalendarIcon, labelKey: 'mypage.upcomingTours' },
  { id: 'history', path: '/mypage/history', icon: HistoryIcon, labelKey: 'mypage.bookingHistory' },
  { id: 'reviews', path: '/mypage/reviews', icon: StarIcon, labelKey: 'mypage.reviews' },
  { id: 'wishlist', path: '/mypage/wishlist', icon: HeartIcon, labelKey: 'mypage.wishlist' },
  { id: 'saved-itineraries', path: '/mypage/saved-itineraries', icon: BookmarkIcon, labelKey: 'mypage.savedItineraries' },
  { id: 'settings', path: '/mypage/settings', icon: SettingsIcon, labelKey: 'mypage.accountSettings' },
];

export default function MyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      router.replace('/mypage/dashboard');
    }
  }, [router]);

  const isPathActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <div className="w-full space-y-6 md:hidden">
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-6 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-lg font-semibold text-white shadow-[0_14px_32px_-10px_rgba(15,23,42,0.35)]">
            MP
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('mypage.title')}</h2>
            <p className="text-sm text-slate-600">{t('mypage.selectOptionBelow')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-3 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <nav className="space-y-0">
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = isPathActive(item.path);
            return (
              <div key={item.id}>
                <Link
                  href={item.path}
                  className={`flex w-full items-center gap-3.5 rounded-xl px-5 py-4 text-[15px] font-medium leading-snug transition-all duration-200 sm:text-base ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/55 active:bg-white/75'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all ${
                      isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="h-4 w-4">
                      <IconComponent className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                    </div>
                  </div>
                  <span className="tracking-wide">{t(item.labelKey)}</span>
                </Link>
                {index < menuItems.length - 1 && <div className="mx-2 border-b border-white/20" />}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
