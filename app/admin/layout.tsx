'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';

const adminMenuItems = [
  { path: '/admin', label: '대시보드', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/admin/merchants', label: '업체 관리', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { path: '/admin/products', label: '상품 관리', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
  { path: '/admin/orders', label: '주문 관리', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { path: '/admin/contacts', label: '문의 관리', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/admin/emails', label: '받은 메일', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/admin/upload', label: '이미지 업로드', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
  { path: '/admin/analytics', label: '데이터 분석', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/admin/settings', label: '시스템 설정', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

const pathToBreadcrumb: Record<string, string> = {
  '/admin': '대시보드',
  '/admin/merchants': '업체 관리',
  '/admin/products': '상품 관리',
  '/admin/orders': '주문 관리',
  '/admin/contacts': '문의 관리',
  '/admin/emails': '받은 메일',
  '/admin/upload': '이미지 업로드',
  '/admin/analytics': '데이터 분석',
  '/admin/settings': '시스템 설정',
};

function getBreadcrumbs(pathname: string): { path: string; label: string }[] {
  if (pathname === '/admin') return [{ path: '/admin', label: '대시보드' }];
  const segments = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  const crumbs: { path: string; label: string }[] = [{ path: '/admin', label: '대시보드' }];
  let acc = '/admin';
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ path: acc, label: pathToBreadcrumb[acc] || seg });
  }
  return crumbs;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

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
          const displayName = meta.name || meta.full_name || [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() || session.user.email?.split('@')[0] || 'User';
          await supabase.from('user_profiles').insert({ id: session.user.id, full_name: displayName, role: 'customer' }).select().single();
          alert('프로필이 생성되었지만 admin 권한이 없습니다.');
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
        alert(profile ? `${t('admin.accessDenied')}\n\n${t('admin.currentRole')}: ${profile.role}` : t('admin.profileNotFound'));
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
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Admin access</h2>
          <p className="text-slate-500 text-sm mb-6">Sign in to access the admin panel.</p>
          <Link href="/signin?redirect=/admin" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar - Klook-style dark navy */}
      <aside className="fixed inset-y-0 left-0 w-60 flex flex-col bg-slate-800 text-white z-40">
        <div className="flex items-center gap-2 h-16 px-4 border-b border-slate-700/80">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <span className="font-bold text-white">AtoC Korea</span>
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-600 text-slate-200 rounded">Admin</span>
        </div>
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {adminMenuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon.startsWith('M') ? item.icon : 'M9 12l2 2 4-4m6 2a9 5 0 11-10 0 5 5 0 0110 0z'} /></svg>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700/80">
          <p className="text-xs text-slate-400 truncate px-2" title={user?.email}>{user?.email || 'Admin'}</p>
        </div>
      </aside>

      {/* Main: top bar + content */}
      <div className="flex-1 flex flex-col pl-60 min-h-screen">
        {/* Top header bar - Klook style */}
        <header className="flex-shrink-0 h-14 px-6 flex items-center justify-between bg-white border-b border-slate-200/80 shadow-sm">
          <nav className="flex items-center gap-2 text-sm text-slate-600">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-2">
                {i > 0 && <span className="text-slate-400">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-slate-900">{crumb.label}</span>
                ) : (
                  <Link href={crumb.path} className="hover:text-blue-600 transition-colors">{crumb.label}</Link>
                )}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <a href="mailto:support@atockorea.com" className="text-sm text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Get help
            </a>
            <span className="text-sm text-slate-500">English</span>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-700"
              >
                <span className="font-medium truncate max-w-[160px]">{user?.email || 'Admin'}</span>
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-20">
                    <button
                      onClick={async () => { await supabase?.auth.signOut(); setUserMenuOpen(false); router.push('/'); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                      로그아웃
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
