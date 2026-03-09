'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
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
} from '@/components/Icons';

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
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-neutral-50/80 to-slate-50 relative">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(0,0,0,0.03) 20px, rgba(0,0,0,0.03) 40px)`
      }}></div>
      
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 relative z-10">
        {/* Desktop Layout: Sidebar + Main Content (Adaptive from Mobile) */}
        <div className="hidden md:flex md:flex-row gap-8">
          {/* Desktop Sidebar */}
          <aside className="w-72 flex-shrink-0">
            <div className="sticky top-24 space-y-5">
              {/* User Profile */}
              <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-6 transition-all">
                <div className="flex flex-col items-center">
                  {avatar ? (
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-indigo-500/10 flex items-center justify-center mb-3">
                      <Image
                        src={avatar}
                        alt="Profile"
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-600 text-lg font-medium mb-3">
                      {getInitials(userInfo.name)}
                    </div>
                  )}
                  <h2 className="text-base font-medium text-gray-900 mb-0.5">{userInfo.name}</h2>
                  <p className="text-sm text-gray-500">{userInfo.email}</p>
                </div>
              </div>

              {/* Navigation Menu - Unified Card */}
              <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-2">
                <nav className="space-y-0">
                  {menuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    const isActive = isPathActive(item.path);
                    return (
                      <div key={item.id}>
                        <Link
                          href={item.path}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? 'bg-indigo-500 text-white'
                              : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isActive
                              ? 'bg-white/20'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <div className="w-3.5 h-3.5">
                              <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                            </div>
                          </div>
                          <span>{item.label}</span>
                        </Link>
                        {index < menuItems.length - 1 && (
                          <div className="border-b border-gray-100 mx-2"></div>
                        )}
                      </div>
                    );
                  })}
                  <div className="border-b border-gray-100 mx-2 my-0.5"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200"
                  >
                    <div className="w-5 h-5 bg-gray-100 rounded-md flex items-center justify-center text-gray-500">
                      <div className="w-3.5 h-3.5">
                        <LogoutIcon className="w-3.5 h-3.5" />
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
              <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-5">
                <div className="flex items-center gap-3">
                  {avatar ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-indigo-500/10 flex items-center justify-center">
                      <Image
                        src={avatar}
                        alt="Profile"
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-600 text-base font-medium">
                      {getInitials(userInfo.name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-base font-medium text-gray-900">{userInfo.name}</h2>
                    <p className="text-sm text-gray-500">{userInfo.email}</p>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Menu */}
              <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-2">
                <nav className="space-y-0">
                  {menuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    const isActive = isPathActive(item.path);
                    return (
                      <div key={item.id}>
                        <Link
                          href={item.path}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? 'bg-indigo-500 text-white'
                              : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isActive
                              ? 'bg-white/20'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <div className="w-3.5 h-3.5">
                              <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                            </div>
                          </div>
                          <span>{item.label}</span>
                        </Link>
                        {index < menuItems.length - 1 && (
                          <div className="border-b border-gray-100 mx-2"></div>
                        )}
                      </div>
                    );
                  })}
                  <div className="border-b border-gray-100 mx-2 my-0.5"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200"
                  >
                    <div className="w-5 h-5 bg-gray-100 rounded-md flex items-center justify-center text-gray-500">
                      <div className="w-3.5 h-3.5">
                        <LogoutIcon className="w-3.5 h-3.5" />
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
                <span className="text-sm text-gray-500">My Page</span>
              </div>
              <div className="w-full">
                {children}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

