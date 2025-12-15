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
    name: 'John Doe',
    email: 'john.doe@example.com',
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
              .select('full_name, avatar_url')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              setUserInfo({
                name: profile.full_name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
              });
              
              if (profile.avatar_url) {
                setAvatar(profile.avatar_url);
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
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
                <div className="flex flex-col items-center">
                  {avatar ? (
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-indigo-600 flex items-center justify-center mb-4 shadow-lg">
                      <Image
                        src={avatar}
                        alt="Profile"
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg">
                      {getInitials(userInfo.name)}
                    </div>
                  )}
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">{userInfo.name}</h2>
                  <p className="text-sm text-gray-500 font-medium">{userInfo.email}</p>
                </div>
              </div>

              {/* Navigation Menu - Unified Card */}
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
                  <div className="border-b border-gray-200/50 mx-2 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3.5 px-5 py-4 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200"
                  >
                    <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                      <div className="w-4 h-4">
                        <LogoutIcon className="w-4 h-4" />
                      </div>
                    </div>
                    <span className="tracking-wide">{t('mypage.signOut')}</span>
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
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-6">
                <div className="flex items-center gap-4">
                  {avatar ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-indigo-600 flex items-center justify-center shadow-lg">
                      <Image
                        src={avatar}
                        alt="Profile"
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                      {getInitials(userInfo.name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900">{userInfo.name}</h2>
                    <p className="text-sm text-gray-500">{userInfo.email}</p>
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
                  <div className="border-b border-gray-200/50 mx-2 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3.5 px-5 py-4 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200"
                  >
                    <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                      <div className="w-4 h-4">
                        <LogoutIcon className="w-4 h-4" />
                      </div>
                    </div>
                    <span className="tracking-wide">{t('mypage.signOut')}</span>
                  </button>
                </nav>
              </div>
            </>
          ) : (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between px-1">
                <Link href="/mypage" className="text-sm text-blue-600 font-semibold flex items-center gap-2">
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

