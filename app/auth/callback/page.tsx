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

        const code = searchParams?.get('code');
        const error = searchParams?.get('error');
        const errorDescription = searchParams?.get('error_description');
        const provider = searchParams?.get('provider');
        // Restrict redirect to same-origin path only (prevent open redirect)
        const rawNext = (searchParams?.get('next') || '/mypage').replace(/^null$/i, '') || '/mypage';
        let next =
          typeof rawNext === 'string' &&
          rawNext.startsWith('/') &&
          !rawNext.includes(':') &&
          rawNext.length <= 500
            ? rawNext
            : '/mypage';

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
          const response = await fetch('/api/auth/line', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'LINE authentication failed');
          }

          // API가 준 magic link( Supabase action_link )로 이동하면 세션이 설정됨. signInWithOtp 호출하면 안 됨.
          if (data.magicLink && typeof data.magicLink === 'string') {
            setStatus('success');
            setMessage('LINE 로그인 완료. 이동 중...');
            window.location.href = data.magicLink;
            return;
          }

          // magic link 없을 때: 세션 없이 user만 반환된 경우. localStorage만 저장하면 앱이 Supabase 세션을 보므로 로그아웃처럼 보일 수 있음.
          setStatus('success');
          setMessage('LINE 로그인 완료. 이동 중...');
          if (data.user) {
            try {
              localStorage.setItem('line_user', JSON.stringify(data.user));
            } catch (e) {
              if (typeof console !== 'undefined') console.warn('[auth/callback] localStorage set failed:', e);
            }
          }
          setTimeout(() => {
            router.push('/mypage');
          }, 800);
          return;
        }

        // 处理其他 OAuth 提供商（Google）
        // Supabase OAuth의 경우 code가 없을 수도 있음 (이미 세션이 있을 수 있음)
        if (code) {
          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          if (data.user) {
            const rawNextParam = (searchParams?.get('next') || '').replace(/^null$/i, '') || '';
            const signupFlag = searchParams?.get('signup') === '1';
            const isSignupEmailCallback =
              signupFlag ||
              rawNextParam === '/signup' ||
              rawNextParam.startsWith('/signup') ||
              (rawNextParam.length > 0 && rawNextParam.includes('signup'));

            if (isSignupEmailCallback) {
              const email = data.user.email ?? '';
              await supabase.auth.signOut();
              setStatus('success');
              setMessage('Redirecting to sign up...');
              setTimeout(() => {
                router.replace(`/signup?step=verify&email=${encodeURIComponent(email)}`);
              }, 400);
              return;
            }

            const meta = data.user.user_metadata || {};
            // 구글/소셜 이름: name > full_name > given_name + family_name > 이메일 앞부분
            const displayName =
              meta.name ||
              meta.full_name ||
              [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() ||
              data.user.email?.split('@')[0] ||
              'User';
            const avatarUrl = meta.avatar_url || meta.picture || null;
            const provider = data.user.app_metadata?.provider || meta.provider || 'email';

            const { data: existing } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('id', data.user.id)
              .single();

            if (existing) {
              const { error: updateErr } = await supabase
                .from('user_profiles')
                .update({
                  full_name: displayName,
                  avatar_url: avatarUrl,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', data.user.id);
              if (updateErr) console.error('Error updating user profile:', updateErr);
              // 저장된 가입자 내역용: email, auth_provider (마이그레이션 후 컬럼 있으면 저장)
              await supabase
                .from('user_profiles')
                .update({
                  email: data.user.email ?? null,
                  auth_provider: provider,
                } as Record<string, unknown>)
                .eq('id', data.user.id);
            } else {
              // 이메일 인증 후 진입 시 user_metadata(full_name, phone, birth_year, nationality)로 프로필 생성
              const session = data.session;
              const createRes = await fetch('/api/auth/create-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: data.user.id,
                  full_name: meta.full_name ?? displayName,
                  phone: meta.phone ?? undefined,
                  birth_year: meta.birth_year ?? undefined,
                  nationality: meta.nationality ?? undefined,
                  accessToken: session?.access_token ?? undefined,
                }),
              });
              if (!createRes.ok) {
                const { status } = createRes;
                // 409 = 이미 프로필 있음. 404/기타 시 클라이언트 insert 시도 (세션은 이미 있음)
                if (status !== 409) {
                  const insertPayload = {
                    id: data.user.id,
                    full_name: displayName,
                    avatar_url: avatarUrl,
                    role: 'customer',
                    ...(data.user.email != null && { email: data.user.email }),
                    ...(provider && { auth_provider: provider }),
                  } as Record<string, unknown>;
                  const { error: insertError } = await supabase.from('user_profiles').insert(insertPayload);
                  if (insertError) {
                    const { error: fallbackErr } = await supabase.from('user_profiles').insert({
                      id: data.user.id,
                      full_name: displayName,
                      avatar_url: avatarUrl,
                      role: 'customer',
                    });
                    if (fallbackErr) console.error('Error creating user profile:', fallbackErr);
                  }
                }
              } else {
                await supabase
                  .from('user_profiles')
                  .update({
                    email: data.user.email ?? null,
                    auth_provider: provider,
                    ...(avatarUrl && { avatar_url: avatarUrl }),
                  } as Record<string, unknown>)
                  .eq('id', data.user.id);
              }
            }

            setStatus('success');
            setMessage('Authentication successful! Redirecting...');

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
