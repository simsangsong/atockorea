'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const adminMenuItems = [
  { path: '/admin', label: 'Dashboard', icon: '📊' },
  { path: '/admin/merchants', label: '商家管理', icon: '🏢' },
  { path: '/admin/products', label: '产品管理', icon: '🎫' },
  { path: '/admin/orders', label: '订单管理', icon: '📦' },
  { path: '/admin/upload', label: '이미지 업로드', icon: '📷' },
  { path: '/admin/analytics', label: '数据分析', icon: '📈' },
  { path: '/admin/settings', label: '系统设置', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }
      
      if (!session) {
        console.log('No session found');
        setIsAuthenticated(false);
        router.push('/signin?redirect=/admin');
        return;
      }

      console.log('Session found, user ID:', session.user.id);

      // Check if user is admin
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('id', session.user.id)
        .single();

      console.log('Profile query result:', { profile, profileError });

      if (profileError) {
        console.error('Profile query error:', profileError);
        // If profile doesn't exist, try to create it
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found, creating default profile...');
          const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              role: 'customer',
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('Failed to create profile:', insertError);
            alert(`프로필 조회 실패: ${insertError.message}\n\nSupabase RLS 정책을 확인하세요.`);
            setIsAuthenticated(false);
            router.push('/');
            return;
          }
          
          alert('프로필이 생성되었지만 admin 권한이 없습니다.\n\nSupabase에서 role을 admin으로 설정해주세요.');
          setIsAuthenticated(false);
          router.push('/');
          return;
        }
        
        alert(`프로필 조회 실패: ${profileError.message}\n\n콘솔을 확인하세요.`);
        setIsAuthenticated(false);
        router.push('/');
        return;
      }

      if (!profile) {
        console.error('Profile is null');
        setIsAuthenticated(false);
        alert('프로필을 찾을 수 없습니다.');
        router.push('/');
        return;
      }

      console.log('Profile role:', profile.role);

      if (profile.role !== 'admin') {
        console.warn('User is not admin. Role:', profile.role);
        setIsAuthenticated(false);
        alert(`Access denied. Admin privileges required.\n\n현재 역할: ${profile.role || '없음'}\n\nSupabase에서 user_profiles 테이블의 role을 'admin'으로 설정해주세요.`);
        router.push('/');
        return;
      }

      console.log('Admin access granted');
      setUser(session.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error('Auth check error:', err);
      setIsAuthenticated(false);
      alert(`인증 오류: ${err.message}\n\n콘솔을 확인하세요.`);
      router.push('/signin?redirect=/admin');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to access admin panel</p>
          <Link href="/signin?redirect=/admin" className="text-indigo-600 hover:text-indigo-700">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {adminMenuItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-semibold">
                  {user?.email?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || 'Admin'}
                </p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await supabase?.auth.signOut();
                router.push('/');
              }}
              className="w-full mt-3 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
