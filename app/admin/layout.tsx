'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  ImageUp,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  Package,
  RadioTower,
  Search,
  Settings,
  Sparkles,
  Star,
  Toilet,
  UsersRound,
  X,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { AdminCommandPalette, type CmdkDataResult } from '@/components/admin/AdminCommandPalette';
import { supabase } from '@/lib/supabase';
import { decideAdminGuard } from '@/lib/admin/admin-auth-guard';

const ADMIN_SUPPORTED_LOCALES = ['en', 'ko', 'zh-CN', 'zh-TW', 'ja', 'es', 'fr', 'de', 'it', 'ru'];

type AdminMenuItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const adminMenuItems: AdminMenuItem[] = [
  { path: '/admin', label: '대시보드', icon: LayoutDashboard },
  { path: '/admin/merchants', label: '업체 관리', icon: Building2 },
  { path: '/admin/products', label: '상품 관리', icon: Package },
  { path: '/admin/external-reviews', label: '외부 리뷰', icon: Star, badge: 'NEW' },
  { path: '/admin/orders', label: '주문 관리', icon: ClipboardList },
  { path: '/admin/ops-finance', label: '파이낸스 원장', icon: Landmark, badge: 'NEW' },
  { path: '/admin/tour-ops', label: '투어 관제센터', icon: RadioTower, badge: 'LIVE' },
  { path: '/admin/guides', label: '가이드 관리', icon: UsersRound, badge: 'NEW' },
  { path: '/admin/inbox', label: '수신함', icon: Inbox, badge: 'NEW' },
  { path: '/admin/contacts', label: '문의 관리', icon: MessageSquareText },
  { path: '/admin/emails', label: '받은 메일', icon: Mail },
  { path: '/admin/upload', label: '이미지 업로드', icon: ImageUp },
  { path: '/admin/cms', label: '콘텐츠 CMS', icon: Sparkles },
  { path: '/admin/match-pois', label: '매칭 POI 관리', icon: MapPin, badge: 'NEW' },
  { path: '/admin/facility-pins', label: '편의시설 핀', icon: Toilet, badge: 'NEW' },
  { path: '/admin/analytics', label: '데이터 분석', icon: BarChart3 },
  { path: '/admin/chatbot-analytics', label: '챗봇 분석', icon: Bot, badge: 'NEW' },
  { path: '/admin/settings', label: '시스템 설정', icon: Settings },
];

/**
 * The four high-frequency destinations surfaced in the mobile bottom tab bar
 * so the most common admin flows stay within one-thumb reach. The 5th slot
 * ("더보기") opens the full drawer. Paths are a subset of adminMenuItems so
 * the menu stays a single source of truth.
 */
const mobileTabPaths = ['/admin', '/admin/orders', '/admin/inbox', '/admin/merchants'] as const;
const mobileTabItems = mobileTabPaths.map(
  (path) => adminMenuItems.find((item) => item.path === path)!,
);
const mobileTabLabels: Record<string, string> = {
  '/admin': '대시보드',
  '/admin/orders': '주문',
  '/admin/inbox': '수신함',
  '/admin/merchants': '업체',
};

const pathToBreadcrumb: Record<string, string> = {
  '/admin': '대시보드',
  '/admin/merchants': '업체 관리',
  '/admin/merchants/create': '업체 추가',
  '/admin/products': '상품 관리',
  '/admin/external-reviews': '외부 리뷰',
  '/admin/orders': '주문 관리',
  '/admin/ops-finance': '파이낸스 원장',
  '/admin/guides': '가이드 관리',
  '/admin/inbox': '수신함',
  '/admin/contacts': '문의 관리',
  '/admin/emails': '받은 메일',
  '/admin/upload': '이미지 업로드',
  '/admin/cms': '콘텐츠 CMS',
  '/admin/match-pois': '매칭 POI 관리',
  '/admin/analytics': '데이터 분석',
  '/admin/chatbot-analytics': '챗봇 분석',
  '/admin/settings': '시스템 설정',
};

function normalizeAdminPathname(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const adminIndex = parts.indexOf('admin');
  if (adminIndex === -1) {
    return '/admin';
  }

  const rest = parts.slice(adminIndex + 1);
  while (rest.length >= 2 && ADMIN_SUPPORTED_LOCALES.includes(rest[0]!) && rest[1] === 'admin') {
    rest.splice(0, 2);
  }

  return `/${['admin', ...rest].join('/')}`;
}

function getBreadcrumbs(pathname: string): { path: string; label: string }[] {
  const normalized = normalizeAdminPathname(pathname);
  if (normalized === '/admin') return [{ path: '/admin', label: '대시보드' }];

  const segments = normalized.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  const crumbs: { path: string; label: string }[] = [{ path: '/admin', label: '대시보드' }];
  let acc = '/admin';

  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ path: acc, label: pathToBreadcrumb[acc] || decodeURIComponent(seg) });
  }

  return crumbs;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // B-2: react to session changes live. checkAuth() only ran once on mount, so a
  // session that expired (failed token refresh → SIGNED_OUT) used to surface
  // only when an admin action failed. Subscribe so expiry bounces to signin
  // immediately. (The initial INITIAL_SESSION event is handled by checkAuth.)
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  // Close the mobile drawer whenever the route changes so tapping a menu item
  // navigates and dismisses the overlay in one gesture.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open so the backdrop doesn't scroll.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const normalized = normalizeAdminPathname(pathname);
    if (pathname !== normalized) {
      router.replace(normalized);
    }
  }, [pathname, router]);

  /**
   * Race a promise against a timeout so we never sit on the loading splash
   * forever when supabase-js hangs (stale persisted token, auth worker not
   * yet booted). Resolves to `null` on timeout so the caller can fall
   * through to the not-authenticated state instead of the spinner.
   */
  const withAuthTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T | null> =>
    Promise.race<T | null>([
      Promise.resolve(p),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn(`[AdminLayout] ${label} timed out after ${ms}ms — redirecting to signin`);
          resolve(null);
        }, ms);
      }),
    ]);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      if (!supabase) {
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }

      const sessionResult = await withAuthTimeout(
        supabase.auth.getSession(),
        6000,
        'auth.getSession',
      );
      if (!sessionResult) {
        // Timeout — bounce to signin so the user has a way out.
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }
      const { data: { session } = { session: null }, error: sessionError } = sessionResult;
      if (sessionError || !session) {
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }

      const profileResult = await withAuthTimeout(
        supabase
          .from('user_profiles')
          .select('id, full_name, role')
          .eq('id', session.user.id)
          .single(),
        5000,
        'user_profiles.select',
      );
      if (!profileResult) {
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }
      const { data: profile, error: profileError } = profileResult;

      // M-8: the auth guard is read-only — it no longer auto-creates a profile
      // on PGRST116 (that mutation re-created deliberately-deleted profiles and
      // was pointless since a non-admin is redirected away regardless).
      const decision = decideAdminGuard(profile, profileError);
      switch (decision.kind) {
        case 'jwt_expired':
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          alert('로그인이 만료되었습니다. 다시 로그인해 주세요.');
          router.push('/signin?redirect=/admin');
          return;
        case 'no_profile':
          setIsAuthenticated(false);
          alert('프로필을 찾을 수 없거나 admin 권한이 없습니다.');
          router.push('/');
          return;
        case 'query_failed':
          alert(`프로필 조회 실패: ${decision.message}`);
          setIsAuthenticated(false);
          router.push('/');
          return;
        case 'not_admin':
          setIsAuthenticated(false);
          alert(
            decision.role
              ? `관리자 권한이 필요합니다.\n\n현재 권한: ${decision.role}`
              : '프로필을 찾을 수 없습니다.',
          );
          router.push('/');
          return;
        case 'ok':
          break;
      }

      setUser(session.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error('Auth check error:', err);
      setIsAuthenticated(false);
      router.push('/signin?redirect=/admin');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * W4.4: authed data search for the ⌘K palette. Stable identity (useCallback,
   * no deps) so the palette's debounce effect doesn't refire each layout render.
   * Read-only lookup; failures degrade to no data results (nav search still works).
   */
  const searchAdminData = useCallback(async (q: string): Promise<CmdkDataResult[]> => {
    if (!supabase) return [];
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];

    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    type OrderHit = {
      id: string;
      booking_reference?: string | null;
      contact_name?: string | null;
      tour_date?: string | null;
    };
    type MerchantHit = {
      id: string;
      company_name?: string | null;
      contact_person?: string | null;
      status?: string | null;
    };
    const json = (await res.json().catch(() => null)) as
      | { orders?: OrderHit[]; merchants?: MerchantHit[] }
      | null;
    if (!json) return [];

    const orders: CmdkDataResult[] = (json.orders ?? []).map((o) => ({
      group: 'order' as const,
      path: `/admin/orders/${o.id}`,
      label: o.booking_reference || o.contact_name || '주문',
      sublabel: [o.contact_name, o.tour_date].filter(Boolean).join(' · ') || undefined,
    }));
    const merchants: CmdkDataResult[] = (json.merchants ?? []).map((m) => ({
      group: 'merchant' as const,
      path: `/admin/merchants/${m.id}`,
      label: m.company_name || '업체',
      sublabel: [m.contact_person, m.status].filter(Boolean).join(' · ') || undefined,
    }));
    return [...orders, ...merchants];
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-11 w-11 border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-slate-600">관리자 화면을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 shadow-xl p-8 text-center">
          <Logo className="mx-auto mb-5 h-12 justify-center" markOnly />
          <h2 className="text-lg font-semibold text-slate-950 mb-1">Admin access</h2>
          <p className="text-sm text-slate-500 mb-6">관리자 계정으로 로그인해 주세요.</p>
          <Link
            /* W1.4 (§3-D): return to the exact admin page after sign-in so the
               installed ops app lands back on /admin/tour-ops, not the dashboard. */
            href={`/signin?redirect=${encodeURIComponent(normalizeAdminPathname(pathname))}`}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const adminPathname = normalizeAdminPathname(pathname);

  // W1.4/W3.1: the ops center owns its chrome — no admin sidebar/header/tab
  // bar in either display mode (its fixed bottom tab bar would collide with
  // the admin mobile tab bar). Auth above still gates it; the ops settings
  // tab links back to the admin dashboard.
  if (adminPathname.startsWith('/admin/tour-ops')) {
    return (
      <div className="admin-root min-h-screen">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </div>
    );
  }

  const breadcrumbs = getBreadcrumbs(adminPathname);
  const bestMatch = adminMenuItems
    .filter((m) => adminPathname === m.path || (m.path !== '/admin' && adminPathname.startsWith(`${m.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  return (
    <div className="admin-root min-h-screen bg-admin-bg flex text-slate-900">
      {/* Mobile drawer backdrop. Tapping it dismisses the nav. */}
      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[82vw] flex-col bg-[#111827] text-white shadow-admin-float transition-transform duration-300 ease-out md:z-40 md:w-[216px] md:max-w-none md:translate-x-0 md:shadow-xl md:transition-none ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-3">
          <Logo className="h-9 min-w-0 flex-1" variant="onDark" compact />
          <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
            Admin
          </span>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="-mr-1 flex size-11 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="메뉴 닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {adminMenuItems.map((item) => {
            const isActive = item.path === bestMatch;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <Icon className={`size-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-bold leading-none ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/90 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="truncate text-[11px] text-slate-400" title={user?.email}>
            {user?.email || 'Admin'}
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pl-0 md:pl-[216px]">
        <header className="sticky top-0 z-30 flex min-h-[52px] items-center justify-between gap-2 border-b border-slate-200/90 bg-white/95 px-4 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="-ml-1 flex size-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950 md:hidden"
              aria-label="메뉴 열기"
            >
              <Menu className="size-5" />
            </button>

            {/* Full breadcrumb trail on desktop; just the current page on mobile
                so the header never overflows on a narrow screen. */}
            <nav className="hidden min-w-0 items-center gap-2 text-sm text-slate-500 md:flex">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex min-w-0 items-center gap-2">
                  {i > 0 ? <span className="text-slate-300">/</span> : null}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="truncate font-semibold text-slate-950">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.path} className="truncate hover:text-blue-600 transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
            <span className="truncate text-sm font-semibold text-slate-950 md:hidden">
              {breadcrumbs[breadcrumbs.length - 1]?.label}
            </span>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5 md:gap-2.5">
            {/* ⌘K global search (spec §3.1) */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('admin-cmdk-open'))}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 md:px-2.5"
              aria-label="검색 (Ctrl+K)"
            >
              <Search className="size-4" />
              <span className="hidden md:inline">검색</span>
              <kbd className="hidden rounded bg-slate-100 px-1 text-xs text-slate-400 md:inline">⌘K</kbd>
            </button>
            <a
              href="mailto:support@atockorea.com"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition-colors md:px-2.5"
              aria-label="Help"
            >
              <CircleHelp className="size-4" />
              <span className="hidden md:inline">Help</span>
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-slate-700 hover:bg-slate-100 transition-colors md:px-2.5"
              >
                <span className="hidden max-w-[180px] truncate font-medium md:inline">{user?.email || 'Admin'}</span>
                <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold uppercase text-white md:hidden">
                  {(user?.email || 'A').charAt(0)}
                </span>
                <ChevronDown className={`size-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen ? (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase?.auth.signOut();
                        setUserMenuOpen(false);
                        router.push('/');
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <LogOut className="size-4 text-slate-400" />
                      로그아웃
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:p-5 md:pb-5">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar — one-thumb access to the four highest-traffic
          flows; the 5th slot opens the full drawer. Hidden from md: up where the
          persistent sidebar already covers navigation. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(15,23,42,0.06)] backdrop-blur md:hidden">
        {mobileTabItems.map((item) => {
          const isActive = item.path === bestMatch;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Icon className={`size-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              {mobileTabLabels[item.path] ?? item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-500"
          aria-label="더보기"
        >
          <Menu className="size-5 text-slate-400" />
          더보기
        </button>
      </nav>

      {/* W1.2: admin toast host. top-center clears the bottom nav; richColors gives
          success/error styling. Admin actions use sonner toasts going forward. */}
      <Toaster position="top-center" richColors closeButton />

      {/* ⌘K command palette (spec §3.1) — nav routes + W4.4 data search (orders/업체). */}
      <AdminCommandPalette
        items={adminMenuItems.map((m) => ({ path: m.path, label: m.label }))}
        onSearch={searchAdminData}
      />
    </div>
  );
}
