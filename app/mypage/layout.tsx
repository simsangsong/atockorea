'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';
import {
  DashboardIcon,
  CalendarIcon,
  HistoryIcon,
  StarIcon,
  HeartIcon,
  SettingsIcon,
  LogoutIcon,
  MapIcon,
  BookmarkIcon,
} from '@/components/Icons';
import { MyPageAuthGate } from '@/components/mypage/MyPageAuthGate';

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const [avatar, setAvatar] = useState<string | null>(null);
  
  const menuItems = [
    { id: 'dashboard', label: t('mypage.dashboard'), icon: DashboardIcon, path: '/mypage/dashboard' },
    { id: 'mybookings', label: t('mypage.myBookings'), icon: MapIcon, path: '/mypage/mybookings' },
    { id: 'upcoming', label: t('mypage.upcomingTours'), icon: CalendarIcon, path: '/mypage/upcoming' },
    { id: 'history', label: t('mypage.history'), icon: HistoryIcon, path: '/mypage/history' },
    { id: 'reviews', label: t('mypage.reviews'), icon: StarIcon, path: '/mypage/reviews' },
    { id: 'wishlist', label: t('mypage.wishlist'), icon: HeartIcon, path: '/mypage/wishlist' },
    { id: 'saved-itineraries', label: t('mypage.savedItineraries'), icon: BookmarkIcon, path: '/mypage/saved-itineraries' },
    { id: 'settings', label: t('mypage.settings'), icon: SettingsIcon, path: '/mypage/settings' },
  ];
  const [userInfo, setUserInfo] = useState({
    name: 'Guest',
    email: '',
  });

  // Load user data from Supabase and localStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Try to get from Supabase first
        const { supabase } = await import('@/lib/supabase');
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            // Get user profile from database
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('full_name, avatar_url, phone, birth_year, nationality')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              setUserInfo({
                name: profile.full_name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
              });
              if (profile.avatar_url) setAvatar(profile.avatar_url);

              // 프로필에 비어 있는 항목을 user_metadata(가입 시 입력)로 보충
              const meta = session.user.user_metadata || {};
              const supplement: Record<string, string | number | null> = {};
              if (!profile.full_name?.trim() && (meta.full_name != null && String(meta.full_name).trim()))
                supplement.full_name = String(meta.full_name).trim();
              if (!profile.phone?.trim() && (meta.phone != null && String(meta.phone).trim()))
                supplement.phone = String(meta.phone).trim();
              if (profile.birth_year == null && meta.birth_year != null) {
                const y = Number(meta.birth_year);
                if (!Number.isNaN(y)) supplement.birth_year = y;
              }
              if (!profile.nationality?.trim() && (meta.nationality != null && String(meta.nationality).trim()))
                supplement.nationality = String(meta.nationality).trim();
              if (Object.keys(supplement).length > 0 && session.access_token) {
                try {
                  await fetch('/api/auth/update-profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify(supplement),
                  });
                } catch (e) {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('[mypage/layout] Failed to supplement profile:', e);
                  }
                }
              }
            } else {
              // Fallback to session data
              setUserInfo({
                name: session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
              });
            }
          } else {
            // No session, try localStorage as fallback
            const savedAvatar = localStorage.getItem('userAvatar');
            const savedName = localStorage.getItem('userName');
            const savedEmail = localStorage.getItem('userEmail');
            
            if (savedAvatar) setAvatar(savedAvatar);
            if (savedName) setUserInfo(prev => ({ ...prev, name: savedName }));
            if (savedEmail) setUserInfo(prev => ({ ...prev, email: savedEmail }));
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        // Fallback to localStorage
        const savedAvatar = localStorage.getItem('userAvatar');
        const savedName = localStorage.getItem('userName');
        const savedEmail = localStorage.getItem('userEmail');
        
        if (savedAvatar) setAvatar(savedAvatar);
        if (savedName) setUserInfo(prev => ({ ...prev, name: savedName }));
        if (savedEmail) setUserInfo(prev => ({ ...prev, email: savedEmail }));
      }
    };

    loadUserData();

    // Listen for custom event from settings page
    const handleUserDataUpdate = () => {
      loadUserData();
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate);
    return () => window.removeEventListener('userDataUpdated', handleUserDataUpdate);
  }, []);

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    if (confirm(t('mypage.signOut') + '?')) {
      try {
        const { supabase } = await import('@/lib/supabase');
        if (supabase) {
          await supabase.auth.signOut();
        }
        // Clear localStorage
        localStorage.removeItem('userAvatar');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        router.push('/');
      } catch (error) {
        console.error('Error logging out:', error);
        router.push('/');
      }
    }
  };

  const isMyPageRoot = pathname === '/mypage';
  const isPathActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <SitePageShell>
      <MyPageAuthGate>
      <main className="relative z-10 container mx-auto px-4 py-6 sm:px-6 md:py-12 lg:px-8">
        {/* Desktop Layout: Sidebar + Main Content (Adaptive from Mobile) */}
        <div className="hidden md:flex md:flex-row gap-8">
          {/* Desktop Sidebar */}
          <aside className="w-72 flex-shrink-0">
            <div className="sticky top-24 space-y-5">
              {/* User Profile */}
              <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-6 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.14)] backdrop-blur-xl transition-all">
                <div className="flex flex-col items-center">
                  {avatar ? (
                    <div className="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-blue-500/10">
                      <Image
                        src={avatar}
                        alt="Profile"
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-xl bg-blue-500/15 text-lg font-medium text-blue-700">
                      {getInitials(userInfo.name)}
                    </div>
                  )}
                  <h2 className="mb-0.5 text-base font-medium text-slate-900">{userInfo.name}</h2>
                  <p className="text-sm text-slate-600">{userInfo.email}</p>
                </div>
              </div>

              {/* Navigation Menu - Unified Card */}
              <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-2 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <nav className="space-y-0">
                  {menuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    const isActive = isPathActive(item.path);
                    return (
                      <div key={item.id}>
                        <Link
                          href={item.path}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white/50 active:bg-white/70'
                          }`}
                        >
                          <div className={`flex h-5 w-5 items-center justify-center rounded-md transition-all ${
                            isActive
                              ? 'bg-white/20'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            <div className="h-3.5 w-3.5">
                              <IconComponent className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                            </div>
                          </div>
                          <span>{item.label}</span>
                        </Link>
                        {index < menuItems.length - 1 && (
                          <div className="mx-2 border-b border-white/20" />
                        )}
                      </div>
                    );
                  })}
                  <div className="mx-2 my-0.5 border-b border-white/20" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-white/50 active:bg-white/70"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <div className="h-3.5 w-3.5">
                        <LogoutIcon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <span>{t('mypage.signOut')}</span>
                  </button>
                </nav>
              </div>
            </div>
          </aside>

          {/* Desktop Main Content */}
          <div className="flex-1">{children}</div>
        </div>

        {/* Mobile Layout: Navigation Menu + Main Content (Mobile First) */}
        <div className="md:hidden w-full space-y-6">
          {isMyPageRoot ? (
            <>
              {/* Mobile User Profile */}
              <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-5 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  {avatar ? (
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-blue-500/10">
                      <Image
                        src={avatar}
                        alt="Profile"
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/15 text-base font-medium text-blue-700">
                      {getInitials(userInfo.name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-base font-medium text-slate-900">{userInfo.name}</h2>
                    <p className="text-sm text-slate-600">{userInfo.email}</p>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Menu */}
              <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-2 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <nav className="space-y-0">
                  {menuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    const isActive = isPathActive(item.path);
                    return (
                      <div key={item.id}>
                        <Link
                          href={item.path}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white/50 active:bg-white/70'
                          }`}
                        >
                          <div className={`flex h-5 w-5 items-center justify-center rounded-md transition-all ${
                            isActive
                              ? 'bg-white/20'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            <div className="h-3.5 w-3.5">
                              <IconComponent className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                            </div>
                          </div>
                          <span>{item.label}</span>
                        </Link>
                        {index < menuItems.length - 1 && (
                          <div className="mx-2 border-b border-white/20" />
                        )}
                      </div>
                    );
                  })}
                  <div className="mx-2 my-0.5 border-b border-white/20" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-white/50 active:bg-white/70"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <div className="h-3.5 w-3.5">
                        <LogoutIcon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <span>{t('mypage.signOut')}</span>
                  </button>
                </nav>
              </div>
            </>
          ) : (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between px-1">
                <Link href="/mypage" className="text-sm text-blue-600 font-medium flex items-center gap-2">
                  <span className="text-lg">←</span>
                  {t('mypage.backToMyPage')}
                </Link>
                <span className="text-sm text-slate-500">My Page</span>
              </div>
              <div className="w-full">
                {children}
              </div>
            </div>
          )}
        </div>
      </main>
      </MyPageAuthGate>
    </SitePageShell>
  );
}

