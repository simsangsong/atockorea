'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export default function SignInPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGoogleChoice, setShowGoogleChoice] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);

  // 检查 URL 参数中的错误
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam) {
        setError(errorParam);
        // 清除 URL 参数
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // 检查是否需要创建用户资料
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!profile || profileError) {
          const meta = data.user.user_metadata || {};
          const displayName =
            meta.name ||
            meta.full_name ||
            [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() ||
            data.user.email?.split('@')[0] ||
            'User';
          const { error: insertError } = await supabase.from('user_profiles').insert({
            id: data.user.id,
            full_name: displayName,
            role: 'customer',
          });

          if (insertError) {
            console.error('Error creating user profile:', insertError);
            // 即使创建失败也允许登录，但记录错误
          }
        }

        // 登录成功，重定向到我的页面
        router.push('/mypage');
      }
    } catch (error: any) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  // 휴대폰/외부에서 접속 시 현재 origin으로 콜백 돌아오게 (null·localhost 방지)
  const getRedirectBase = (): string => {
    if (typeof window === 'undefined') return 'https://atockorea.com';
    const o = window.location.origin;
    if (o && (o.startsWith('http://') || o.startsWith('https://'))) return o.replace(/\/$/, '');
    const env = process.env.NEXT_PUBLIC_APP_URL;
    return (env && env.replace(/\/$/, '')) || 'https://atockorea.com';
  };

  const startGoogleOAuth = async (mode: 'default' | 'select_account') => {
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const baseUrl = getRedirectBase();
      const redirectTo = `${baseUrl}/auth/callback`;
      const options: { redirectTo: string; queryParams?: { prompt: string } } = { redirectTo };
      if (mode === 'select_account') {
        options.queryParams = { prompt: 'select_account' };
      }

      setIsSocialLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options,
      });

      if (error) {
        setError(error.message);
        setIsSocialLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setIsSocialLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setIsSocialLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    try {
      if (provider === 'google') {
        setShowGoogleChoice(true);
        return;
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-neutral-50 to-slate-100 relative">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)`
      }}></div>
      
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
        <div className="max-w-md mx-auto">
          {/* Sign In Card - Premium Style */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-8 md:p-10 transition-all">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Sign In
              </h1>
              <p className="text-gray-600 text-sm md:text-base">Welcome back to AtoCKorea</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 shadow-sm" role="alert">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white/80 text-gray-900 placeholder:text-gray-400 hover:bg-white"
                  placeholder="Enter your password"
                />
              </div>

              {/* Forgot Links */}
              <div className="flex items-center justify-between text-sm">
                <Link
                  href="/forgot-password"
                  className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  Forgot Password?
                </Link>
                <Link
                  href="/forgot-id"
                  className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  Forgot ID?
                </Link>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 md:my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-gray-400 font-medium">or</span>
              </div>
            </div>

            {/* Social Login Buttons - Premium Style */}
            <div className="space-y-2.5 md:space-y-3">
              <button
                onClick={() => handleSocialLogin('google')}
                className="w-full max-w-[360px] flex justify-center px-5 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all font-medium text-gray-700 shadow-sm hover:shadow-lg"
              >
                <span className="grid grid-cols-[24px_auto] items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-sm md:text-base">Google</span>
                </span>
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 md:mt-8 text-center">
              <p className="text-gray-600 text-sm">
                Don't have an account?{' '}
                <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />

      {/* Google 계정 선택 모달 */}
      {showGoogleChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/70 w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Google 계정 선택
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              이전에 로그인한 Google 계정으로 계속할지, 다른 계정으로 전환할지 선택하세요.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleChoice(false);
                  startGoogleOAuth('default');
                }}
                disabled={isSocialLoading}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSocialLoading ? '처리 중...' : '저장된 Google 계정으로 계속'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGoogleChoice(false);
                  startGoogleOAuth('select_account');
                }}
                disabled={isSocialLoading}
                className="w-full py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다른 Google 계정으로 로그인
              </button>
              <button
                type="button"
                onClick={() => setShowGoogleChoice(false)}
                disabled={isSocialLoading}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
