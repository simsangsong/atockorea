'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (!supabase) {
          throw new Error('Supabase client not initialized');
        }

        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        const provider = searchParams.get('provider');
        const next = searchParams.get('next') || '/mypage';

        // OAuth 에러 체크 (구글, 페이스북 등)
        if (error) {
          throw new Error(errorDescription || error || 'OAuth authentication failed');
        }

        // 处理 LINE OAuth（自定义实现）
        if (provider === 'line') {
          if (!code) {
            throw new Error('No authorization code received');
          }

          // 调用自定义 LINE OAuth API
          const response = await fetch('/api/auth/line/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'LINE authentication failed');
          }

          // 如果返回了 magic link，使用它自动登录
          if (data.magicLink) {
            // 使用 magic link 登录
            const { error: signInError } = await supabase.auth.signInWithOtp({
              email: data.user.email,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback?provider=line&auto=true`,
              },
            });

            if (signInError) {
              // 如果 magic link 失败，尝试使用 email 查找用户
              // 由于 LINE 用户没有密码，我们需要使用其他方式
              setStatus('success');
              setMessage('LINE login successful! Redirecting...');
              
              // 存储用户信息到 localStorage，让应用知道用户已登录
              if (data.user) {
                localStorage.setItem('line_user', JSON.stringify(data.user));
              }
              
              setTimeout(() => {
                router.push('/mypage');
              }, 1000);
            } else {
              setStatus('success');
              setMessage('Authentication successful! Redirecting...');
              setTimeout(() => {
                router.push('/mypage');
              }, 1000);
            }
          } else {
            // 没有 magic link，手动处理
            setStatus('success');
            setMessage('LINE login successful! Redirecting...');
            
            // 存储用户信息
            if (data.user) {
              localStorage.setItem('line_user', JSON.stringify(data.user));
            }
            
            setTimeout(() => {
              router.push('/mypage');
            }, 1000);
          }
          return;
        }

        // 处理其他 OAuth 提供商（Google, Facebook, Kakao）
        // Supabase OAuth의 경우 code가 없을 수도 있음 (이미 세션이 있을 수 있음)
        if (code) {
          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          if (data.user) {
            // 检查是否需要创建用户资料
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (!profile || profileError) {
              // 创建用户资料
              const { error: insertError } = await supabase.from('user_profiles').insert({
                id: data.user.id,
                full_name: data.user.user_metadata?.full_name || 
                           data.user.user_metadata?.name ||
                           data.user.email?.split('@')[0] || 
                           'User',
                avatar_url: data.user.user_metadata?.avatar_url || 
                           data.user.user_metadata?.picture ||
                           null,
                role: 'customer', // 默认角色
              });

              if (insertError) {
                console.error('Error creating user profile:', insertError);
                // 即使创建失败也允许登录，但记录错误
              }
            }

            setStatus('success');
            setMessage('Authentication successful! Redirecting...');
            
            // 重定向到目标页面
            setTimeout(() => {
              router.push(next);
            }, 1000);
            return;
          }
        } else {
          // code가 없으면 현재 세션 확인 (이미 로그인되어 있을 수 있음)
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            throw new Error('No authorization code received. Please try signing in again.');
          }

          // 세션이 있으면 성공 처리
          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          
          setTimeout(() => {
            router.push(next);
          }, 1000);
          return;
        }
      } catch (error: any) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication failed');
        
        // 3秒后重定向到登录页
        setTimeout(() => {
          router.push('/signin');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing...</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-4">Redirecting to sign in page...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Processing authentication...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
