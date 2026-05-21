'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
} from '@/components/Icons';
import { MyPageAuthGate } from '@/components/mypage/MyPageAuthGate';
import { ConfirmDialog } from '@/components/mypage/ConfirmDialog';
import {
  MYPAGE_SHELL,
  MYPAGE_SIDEBAR_PROFILE_CARD,
  MYPAGE_SIDEBAR_NAV,
  MYPAGE_SIDEBAR_PRIMARY_TEXT,
  MYPAGE_SIDEBAR_SECONDARY_TEXT,
  MYPAGE_SIDEBAR_ICON,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { MyPageSessionProvider, useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function UserProfileCard({
  avatar,
  name,
  email,
  compact,
}: {
  avatar: string | null;
  name: string;
  email: string;
  compact?: boolean;
}) {
  const size = compact ? 'h-[72px] w-[72px] text-[16px]' : 'h-24 w-24 text-[17px]';
  return (
    <div className={cn(MYPAGE_SIDEBAR_PROFILE_CARD, compact ? 'p-4' : 'p-6')}>
      <div className={cn('flex', compact ? 'items-center gap-3.5' : 'flex-col items-center')}>
        {avatar ? (
          <div
            className={cn(
              'flex items-center justify-center overflow-hidden rounded-[14px] bg-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-slate-200/80',
              size,
              !compact && 'mb-3',
            )}
          >
            <Image src={avatar} alt="Profile" width={80} height={80} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center justify-center rounded-[14px] bg-gradient-to-br from-slate-200 to-slate-100 font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ring-1 ring-slate-300/70',
              size,
              !compact && 'mb-3',
            )}
          >
            {getInitials(name)}
          </div>
        )}
        <div className={cn(compact ? 'flex-1 min-w-0' : 'text-center')}>
          <h2 className={cn(MYPAGE_SIDEBAR_PRIMARY_TEXT)}>{name}</h2>
          <p className={cn('mt-1 truncate', MYPAGE_SIDEBAR_SECONDARY_TEXT)}>{email}</p>
        </div>
      </div>
    </div>
  );
}

function MyPageLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, refreshProfile } = useMyPageSession();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const avatar = profile?.avatar_url ?? null;
  const userInfo = {
    name: profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Guest',
    email: user?.email || '',
  };

  const menuItems = [
    { id: 'dashboard', label: t('mypage.dashboard'), icon: DashboardIcon, path: '/mypage/dashboard' },
    { id: 'mybookings', label: t('mypage.myBookings'), icon: MapIcon, path: '/mypage/mybookings' },
    { id: 'upcoming', label: t('mypage.upcomingTours'), icon: CalendarIcon, path: '/mypage/upcoming' },
    { id: 'history', label: t('mypage.history'), icon: HistoryIcon, path: '/mypage/history' },
    { id: 'reviews', label: t('mypage.reviews'), icon: StarIcon, path: '/mypage/reviews' },
    { id: 'wishlist', label: t('mypage.wishlist'), icon: HeartIcon, path: '/mypage/wishlist' },
    { id: 'settings', label: t('mypage.settings'), icon: SettingsIcon, path: '/mypage/settings' },
  ];

  useEffect(() => {
    const handleUpdate = () => void refreshProfile();
    window.addEventListener('userDataUpdated', handleUpdate);
    return () => window.removeEventListener('userDataUpdated', handleUpdate);
  }, [refreshProfile]);

  const handleLogout = () => {
    setSignOutOpen(true);
  };

  const confirmLogout = async () => {
    setSignOutLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      if (supabase) await supabase.auth.signOut();
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      setSignOutOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
      setSignOutOpen(false);
      router.push('/');
    } finally {
      setSignOutLoading(false);
    }
  };

  const isMyPageRoot = pathname === '/mypage';
  const isPathActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  const renderNav = () => (
    <nav className={cn(MYPAGE_SIDEBAR_NAV, 'p-4')}>
      <div className="space-y-0.5">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = isPathActive(item.path);
          return (
            <Link
              key={item.id}
              href={item.path}
              className={cn(
                'flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 transition-all duration-200',
                MYPAGE_SIDEBAR_PRIMARY_TEXT,
                isActive
                  ? 'bg-slate-900 !text-white shadow-[0_12px_32px_-10px_rgba(15,23,42,0.45)]'
                  : 'text-slate-950 hover:bg-slate-100',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1',
                  isActive
                    ? 'bg-white/12 ring-white/25'
                    : 'bg-slate-100 ring-slate-200/90',
                )}
              >
                <IconComponent
                  className={cn(MYPAGE_SIDEBAR_ICON, isActive ? 'text-white' : 'text-slate-700')}
                />
              </div>
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
        <div className="mx-2 my-1.5 border-t border-slate-200/70" />
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left transition-all duration-200 hover:bg-slate-100',
            MYPAGE_SIDEBAR_PRIMARY_TEXT,
            'text-slate-950',
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/90',
            )}
          >
            <LogoutIcon className={cn(MYPAGE_SIDEBAR_ICON, 'text-slate-700')} />
          </div>
          <span className="min-w-0 truncate">{t('mypage.signOut')}</span>
        </button>
      </div>
    </nav>
  );

  return (
    <SitePageShell>
      <MyPageAuthGate>
        <main className="relative z-10 container mx-auto px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          {/* Desktop */}
          <div className="hidden md:block">
            <div className={MYPAGE_SHELL}>
              <div className="flex gap-4">
                <aside className="w-72 flex-shrink-0 space-y-3">
                  <div className="sticky top-24 space-y-3">
                    <UserProfileCard avatar={avatar} name={userInfo.name} email={userInfo.email} />
                    {renderNav()}
                  </div>
                </aside>
                <div className="min-w-0 flex-1">{children}</div>
              </div>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden">
            <div className="w-full space-y-4">
              {!isMyPageRoot && (
                <div className="flex items-center justify-between px-1">
                  <Link href="/mypage" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 hover:text-slate-900">
                    <span className="text-base">←</span>
                    {t('mypage.backToMyPage')}
                  </Link>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {t('mypage.title')}
                  </span>
                </div>
              )}
              <div className={MYPAGE_SHELL}>{children}</div>
            </div>
          </div>
        </main>
        <ConfirmDialog
          open={signOutOpen}
          onOpenChange={setSignOutOpen}
          title={t('mypage.common.confirm.signOutTitle')}
          description={t('mypage.common.confirm.signOutDescription')}
          confirmLabel={t('mypage.common.confirm.signOutConfirm')}
          cancelLabel={t('mypage.common.confirm.cancel')}
          loading={signOutLoading}
          onConfirm={confirmLogout}
        />
      </MyPageAuthGate>
    </SitePageShell>
  );
}

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <MyPageSessionProvider>
      <MyPageLayoutContent>{children}</MyPageLayoutContent>
    </MyPageSessionProvider>
  );
}
