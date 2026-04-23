'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';
import {
  AUTH_BRAND_PILL,
  AUTH_FIELD_LABEL,
  AUTH_FORM_CARD,
  AUTH_GOOGLE_CTA_BUTTON,
  AUTH_GOOGLE_PANEL,
  AUTH_INPUT,
  AUTH_LEAD,
  AUTH_PAGE_BACKDROP,
  AUTH_PAGE_TITLE,
  AUTH_SEGMENTED,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGoogleChoice, setShowGoogleChoice] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [signInMode, setSignInMode] = useState<'password' | 'otp'>('password');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  /** Google 아래 이메일·비밀번호 / 인증번호 구역 접기 */
  const [emailMethodsRevealed, setEmailMethodsRevealed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam) {
        setError(errorParam);
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (params.get('password_updated') === '1') {
        setPasswordUpdated(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (params.get('mode') === 'otp') {
        setEmailMethodsRevealed(true);
        setSignInMode('otp');
        const em = params.get('email');
        if (em) {
          setOtpEmail(decodeURIComponent(em));
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const getRedirectAfterAuth = (): string => {
    if (typeof window === 'undefined') return '/mypage/dashboard';
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect && redirect.startsWith('/')) return redirect;
    return '/mypage/dashboard';
  };

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
        return;
      }

      if (data.user) {
        await ensureProfileAfterAuth(data.user.id);
        router.push(getRedirectAfterAuth());
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const ensureProfileAfterAuth = async (userId: string) => {
    if (!supabase) return;
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile || profileError) {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user;
      if (!u) return;
      const meta = u.user_metadata || {};
      const displayName =
        meta.name ||
        meta.full_name ||
        [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim() ||
        u.email?.split('@')[0] ||
        'User';
      const { error: insertError } = await supabase.from('user_profiles').insert({
        id: userId,
        full_name: displayName,
        role: 'customer',
      });
      if (insertError) {
        console.error('Error creating user profile:', insertError);
      }
    }
  };

  const handleSendSignInOtp = async () => {
    const email = otpEmail.trim();
    if (!email) {
      setError(t('signup.errorEmailRequired'));
      return;
    }
    if (!supabase) {
      setError(t('signup.errorServiceUnavailable'));
      return;
    }
    setOtpSending(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      setOtpSent(true);
      setOtpCountdown(60);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('signup.errorSendCodeFailed'));
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifySignInOtp = async () => {
    const email = otpEmail.trim();
    const code = otpCode.trim();
    if (!code) {
      setError(t('signup.errorVerificationRequired'));
      return;
    }
    if (!supabase) {
      setError(t('signup.errorServiceUnavailable'));
      return;
    }
    setOtpVerifying(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (verifyError || !data.user) {
        setError(verifyError?.message || t('signup.errorInvalidVerificationCode'));
        return;
      }
      await ensureProfileAfterAuth(data.user.id);
      router.push(getRedirectAfterAuth());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('signup.errorVerifyFailed'));
    } finally {
      setOtpVerifying(false);
    }
  };

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSocialLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    try {
      if (provider === 'google') {
        setShowGoogleChoice(true);
        return;
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SitePageShell>
      <main
        className={cn(
          'relative z-10 container mx-auto px-4 py-12 sm:px-6 md:py-20 lg:px-8',
          AUTH_PAGE_BACKDROP,
        )}
      >
        <div className="mx-auto max-w-[420px]">
          <div className={cn(AUTH_FORM_CARD, 'px-6 py-8 sm:px-9 sm:py-10')}>
              <div className="text-center">
                <div className="flex justify-center">
                  <span className={AUTH_BRAND_PILL}>AtoC Korea</span>
                </div>
                <h1 className={cn(AUTH_PAGE_TITLE, 'mt-7')}>{t('auth.signIn')}</h1>
                <p className={AUTH_LEAD}>{t('auth.welcomeBackSubtitle')}</p>
              </div>

              <div className="mt-9 space-y-7">
              {passwordUpdated && (
                <div
                  className="rounded-2xl border border-emerald-200/70 bg-emerald-50/90 px-4 py-3.5 text-emerald-900 shadow-[0_8px_28px_-20px_rgba(5,150,105,0.35)]"
                  role="alert"
                >
                  <p className="text-[14px] font-medium leading-snug">{t('auth.passwordUpdatedBanner')}</p>
                </div>
              )}

              <div className={AUTH_GOOGLE_PANEL}>
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  {t('auth.signInWith')}
                </p>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="home-btn-secondary w-full gap-3"
                >
                  <GoogleLogo className="h-5 w-5 shrink-0" />
                  <span>{t('auth.continueWithGoogle')}</span>
                </button>
                <p className="mt-3 text-center text-[12px] leading-relaxed text-neutral-500">
                  {t('auth.googleSignInRecommended')}
                </p>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {emailMethodsRevealed ? (
                  <motion.div
                    key="email-methods"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-5"
                  >
                    <div className="relative py-0.5">
                      <div className="absolute inset-0 flex items-center" aria-hidden>
                        <div className="w-full border-t border-neutral-400/40" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="rounded-full bg-gradient-to-b from-white to-neutral-100/95 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 ring-1 ring-neutral-400/45">
                          {t('auth.or')}
                        </span>
                      </div>
                    </div>

                    <div className={AUTH_SEGMENTED}>
                      <button
                        type="button"
                        onClick={() => {
                          setSignInMode('password');
                          setError(null);
                        }}
                        className={`flex-1 rounded-xl py-2.5 transition-all duration-200 ${
                          signInMode === 'password'
                            ? 'bg-white text-neutral-900 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)]'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {t('auth.password')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSignInMode('otp');
                          setError(null);
                        }}
                        className={`flex-1 rounded-xl py-2.5 transition-all duration-200 ${
                          signInMode === 'otp'
                            ? 'bg-white text-neutral-900 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)]'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {t('auth.signInWithEmailCode')}
                      </button>
                    </div>

                    {error && (
                      <div
                        className="flex items-center gap-2.5 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3.5 text-red-800 shadow-[0_8px_28px_-18px_rgba(220,38,38,0.2)]"
                        role="alert"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-[13px] font-medium">{error}</span>
                      </div>
                    )}

                    {signInMode === 'password' ? (
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                          <label htmlFor="email" className={AUTH_FIELD_LABEL}>
                            {t('auth.email')}
                          </label>
                          <input
                            type="email"
                            id="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            autoComplete="email"
                            className={AUTH_INPUT}
                            placeholder={t('auth.emailPlaceholder')}
                          />
                        </div>

                        <div>
                          <label htmlFor="password" className={AUTH_FIELD_LABEL}>
                            {t('auth.password')}
                          </label>
                          <input
                            type="password"
                            id="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            autoComplete="current-password"
                            className={AUTH_INPUT}
                            placeholder={t('auth.passwordPlaceholder')}
                          />
                        </div>

                        <div className="flex justify-end text-[13px]">
                          <Link
                            href="/forgot-password"
                            className="font-medium text-neutral-600 underline-offset-4 transition-colors hover:text-neutral-900 hover:underline"
                          >
                            {t('auth.forgotPassword')}
                          </Link>
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLoading ? t('auth.signingIn') : t('auth.signIn')}
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-5">
                        <p className="text-[14px] leading-relaxed text-neutral-600">{t('auth.emailCodeHelp')}</p>
                        <div>
                          <label htmlFor="otp-email" className={AUTH_FIELD_LABEL}>
                            {t('auth.email')}
                          </label>
                          <input
                            type="email"
                            id="otp-email"
                            value={otpEmail}
                            onChange={(e) => setOtpEmail(e.target.value)}
                            disabled={otpSent}
                            className={cn(AUTH_INPUT, 'disabled:bg-neutral-50 disabled:text-neutral-500')}
                            placeholder={t('auth.emailPlaceholder')}
                            autoComplete="email"
                          />
                        </div>
                        {!otpSent ? (
                          <button
                            type="button"
                            onClick={handleSendSignInOtp}
                            disabled={otpSending || !otpEmail.trim()}
                            className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {otpSending ? t('signup.sending') : t('auth.sendSignInCode')}
                          </button>
                        ) : (
                          <>
                            <p className="text-[12px] text-neutral-500">{t('auth.signInCodeSentHint')}</p>
                            <div>
                              <label htmlFor="otp-code" className={AUTH_FIELD_LABEL}>
                                {t('auth.signInCodeLabel')}
                              </label>
                              <input
                                type="text"
                                id="otp-code"
                                inputMode="numeric"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                className={cn(
                                  AUTH_INPUT,
                                  'text-center text-2xl font-semibold tracking-[0.45em]',
                                )}
                                placeholder={t('auth.signInCodePlaceholder')}
                                autoComplete="one-time-code"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleVerifySignInOtp}
                              disabled={otpVerifying || otpCode.trim().length < 6}
                              className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {otpVerifying ? t('signup.verifying') : t('auth.signIn')}
                            </button>
                            {otpCountdown > 0 ? (
                              <div className="flex items-center justify-center gap-2 text-[12px] text-neutral-500">
                                <span>{t('auth.otpResendIn')}</span>
                                <span className="min-w-[3ch] text-base font-bold tabular-nums text-neutral-900">
                                  {otpCountdown}s
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={handleSendSignInOtp}
                                disabled={otpSending}
                                className="w-full text-[12px] font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
                              >
                                {t('auth.resendSignInCode')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSignInMode('password');
                                setOtpSent(false);
                                setOtpCode('');
                                setOtpCountdown(0);
                                setError(null);
                              }}
                              className="w-full text-[12px] text-neutral-500 hover:text-neutral-700"
                            >
                              {t('auth.signInWithPasswordInstead')}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="reveal-cta"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMethodsRevealed(true);
                        setError(null);
                      }}
                      className={AUTH_GOOGLE_CTA_BUTTON}
                    >
                      {t('auth.loginWithAnotherMethod')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>

            <div className="mt-10 border-t border-neutral-400/45 pt-8 text-center">
              <p className="text-[14px] text-neutral-600">
                {t('auth.dontHaveAccount')}{' '}
                <Link
                  href="/signup"
                  className="font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900"
                >
                  {t('auth.signUp')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {showGoogleChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/45 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-[1.75rem] border border-neutral-200/85 bg-white p-7 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_24px_48px_-20px_rgba(0,0,0,0.14)]">
            <h2 className={cn(AUTH_PAGE_TITLE, 'mb-2 !text-left text-[1.25rem] sm:text-[1.35rem]')}>
              {t('auth.googleChooseTitle')}
            </h2>
            <p className="mb-5 text-[14px] leading-relaxed text-neutral-600">{t('auth.googleChooseBody')}</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleChoice(false);
                  startGoogleOAuth('default');
                }}
                disabled={isSocialLoading}
                className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSocialLoading ? t('auth.processing') : t('auth.googleContinueSaved')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGoogleChoice(false);
                  startGoogleOAuth('select_account');
                }}
                disabled={isSocialLoading}
                className="home-btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('auth.googleUseDifferent')}
              </button>
              <button
                type="button"
                onClick={() => setShowGoogleChoice(false)}
                disabled={isSocialLoading}
                className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-700"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </SitePageShell>
  );
}
