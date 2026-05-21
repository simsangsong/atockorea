'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  ImageUp,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Settings,
  Sparkles,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';

const ADMIN_SUPPORTED_LOCALES = ['en', 'ko', 'zh-CN', 'zh-TW', 'ja', 'es'];

type AdminMenuItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const adminMenuItems: AdminMenuItem[] = [
  { path: '/admin', label: '대시보드', icon: LayoutDashboard },
  { path: '/admin/merchants', label: '업체 관리', icon: Building2 },
  { path: '/admin/products/v2', label: '상품 관리', icon: Package, badge: 'NEW' },
  { path: '/admin/orders', label: '주문 관리', icon: ClipboardList },
  { path: '/admin/contacts', label: '문의 관리', icon: MessageSquareText },
  { path: '/admin/emails', label: '받은 메일', icon: Mail },
  { path: '/admin/upload', label: '이미지 업로드', icon: ImageUp },
  { path: '/admin/cms', label: '콘텐츠 CMS', icon: Sparkles },
  { path: '/admin/match-pois', label: '매칭 POI 관리', icon: MapPin, badge: 'NEW' },
  { path: '/admin/analytics', label: '데이터 분석', icon: BarChart3 },
  { path: '/admin/settings', label: '시스템 설정', icon: Settings },
];

const pathToBreadcrumb: Record<string, string> = {
  '/admin': '대시보드',
  '/admin/merchants': '업체 관리',
  '/admin/merchants/create': '업체 추가',
  '/admin/products': '상품 관리 (구버전)',
  '/admin/products/v2': '상품 관리',
  '/admin/orders': '주문 관리',
  '/admin/contacts': '문의 관리',
  '/admin/emails': '받은 메일',
  '/admin/upload': '이미지 업로드',
  '/admin/cms': '콘텐츠 CMS',
  '/admin/match-pois': '매칭 POI 관리',
  '/admin/analytics': '데이터 분석',
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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const normalized = normalizeAdminPathname(pathname);
    if (pathname !== normalized) {
      router.replace(normalized);
    }
  }, [pathname, router]);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      if (!supabase) {
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        const isJwtExpired = (profileError.message || '').toLowerCase().includes('jwt expired');
        if (isJwtExpired) {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          alert('로그인이 만료되었습니다. 다시 로그인해 주세요.');
          router.push('/signin?redirect=/admin');
          return;
        }

        if (profileError.code === 'PGRST116') {
          const meta = session.user.user_metadata || {};
          const displayName =
            meta.name ||
            meta.full_name ||
            [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() ||
            session.user.email?.split('@')[0] ||
            'User';
          await supabase
            .from('user_profiles')
            .insert({ id: session.user.id, full_name: displayName, role: 'customer' })
            .select()
            .single();
          alert('프로필은 생성했지만 admin 권한이 없습니다.');
          setIsAuthenticated(false);
          router.push('/');
          return;
        }

        alert(`프로필 조회 실패: ${profileError.message}`);
        setIsAuthenticated(false);
        router.push('/');
        return;
      }

      if (!profile || profile.role !== 'admin') {
        setIsAuthenticated(false);
        alert(profile ? `관리자 권한이 필요합니다.\n\n현재 권한: ${profile.role}` : '프로필을 찾을 수 없습니다.');
        router.push('/');
        return;
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
            href="/signin?redirect=/admin"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const adminPathname = normalizeAdminPathname(pathname);
  const breadcrumbs = getBreadcrumbs(adminPathname);
  const bestMatch = adminMenuItems
    .filter((m) => adminPathname === m.path || (m.path !== '/admin' && adminPathname.startsWith(`${m.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  return (
    <div className="min-h-screen bg-[#eef2f7] flex text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[216px] flex-col bg-[#111827] text-white shadow-xl">
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-3">
          <Logo className="h-9 min-w-0 flex-1" variant="onDark" compact />
          <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
            Admin
          </span>
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
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold leading-none ${
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

      <div className="flex min-h-screen flex-1 flex-col pl-[216px]">
        <header className="sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-slate-200/90 bg-white/95 px-5 shadow-sm backdrop-blur">
          <nav className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
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

          <div className="flex items-center gap-2.5">
            <a
              href="mailto:support@atockorea.com"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition-colors"
            >
              <CircleHelp className="size-4" />
              Help
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span className="max-w-[180px] truncate font-medium">{user?.email || 'Admin'}</span>
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

        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
