'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';
import {
  AUTH_FORM_CARD,
  AUTH_LEAD,
  AUTH_PAGE_BACKDROP,
  AUTH_PAGE_TITLE,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

type CallbackStatus = 'loading' | 'success' | 'error';

function CallbackCard({
  status,
  title,
  message,
  subMessage,
}: {
  status: CallbackStatus;
  title: string;
  message: string;
  subMessage?: string;
}) {
  return (
    <main
      className={cn(
        'relative z-10 container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12 sm:px-6 md:py-20 lg:px-8',
        AUTH_PAGE_BACKDROP,
      )}
    >
      <div className="mx-auto w-full max-w-[420px]">
        <div className={cn(AUTH_FORM_CARD, 'px-6 py-10 text-center sm:px-9 sm:py-12')}>
          {status === 'loading' && (
            <div
              className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900"
              aria-hidden="true"
            />
          )}
          {status === 'success' && (
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200/80">
              <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {status === 'error' && (
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200/80">
              <svg className="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          <h1 className={AUTH_PAGE_TITLE}>{title}</h1>
          <p className={cn(AUTH_LEAD, 'min-h-[1.4em]')} aria-live="polite">
            {message}
          </p>
          {subMessage && (
            <p className="mt-3 text-[12px] text-slate-500">{subMessage}</p>
          )}
        </div>
      </div>
    </main>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState(t('auth.callbackPage.processingBody'));

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
        const rawNext = (searchParams?.get('next') || '/mypage').replace(/^null$/i, '') || '/mypage';
        const next =
          typeof rawNext === 'string' &&
          rawNext.startsWith('/') &&
          !rawNext.includes(':') &&
          rawNext.length <= 500
            ? rawNext
            : '/mypage';

        if (error) {
          throw new Error(errorDescription || error || t('auth.callbackPage.defaultErrorMessage'));
        }

        if (provider === 'line') {
          if (!code) {
            throw new Error(t('auth.callbackPage.defaultErrorMessage'));
          }

          const response = await fetch('/api/auth/line', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || t('auth.callbackPage.defaultErrorMessage'));
          }

          if (data.magicLink && typeof data.magicLink === 'string') {
            setStatus('success');
            setMessage(t('auth.callbackPage.lineSuccessBody'));
            window.location.href = data.magicLink;
            return;
          }

          setStatus('success');
          setMessage(t('auth.callbackPage.lineSuccessBody'));
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

        if (code) {
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
              setMessage(t('auth.callbackPage.redirectingToSignUp'));
              setTimeout(() => {
                router.replace(`/signup?step=verify&email=${encodeURIComponent(email)}`);
              }, 400);
              return;
            }

            const meta = data.user.user_metadata || {};
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
              await supabase
                .from('user_profiles')
                .update({
                  email: data.user.email ?? null,
                  auth_provider: provider,
                } as Record<string, unknown>)
                .eq('id', data.user.id);
            } else {
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
            setMessage(t('auth.callbackPage.successBody'));

            setTimeout(() => {
              router.push(next);
            }, 1000);
            return;
          }
        } else {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError || !session) {
            throw new Error(t('auth.callbackPage.defaultErrorMessage'));
          }

          setStatus('success');
          setMessage(t('auth.callbackPage.successBody'));

          setTimeout(() => {
            router.push(next);
          }, 1000);
          return;
        }
      } catch (error: any) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error?.message || t('auth.callbackPage.defaultErrorMessage'));

        setTimeout(() => {
          router.push('/signin');
        }, 3000);
      }
    };

    void handleCallback();
  }, [searchParams, router, t]);

  const title =
    status === 'success'
      ? t('auth.callbackPage.successTitle')
      : status === 'error'
        ? t('auth.callbackPage.errorTitle')
        : t('auth.callbackPage.processingTitle');

  const subMessage =
    status === 'error' ? t('auth.callbackPage.errorRedirectingToSignIn') : undefined;

  return <CallbackCard status={status} title={title} message={message} subMessage={subMessage} />;
}

function CallbackSuspenseFallback() {
  const t = useTranslations();
  return (
    <CallbackCard
      status="loading"
      title={t('auth.callbackPage.processingTitle')}
      message={t('auth.callbackPage.processingBody')}
    />
  );
}

export default function AuthCallbackPage() {
  return (
    <SitePageShell>
      <Suspense fallback={<CallbackSuspenseFallback />}>
        <AuthCallbackContent />
      </Suspense>
    </SitePageShell>
  );
}
