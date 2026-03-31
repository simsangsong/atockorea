'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';

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
        await ensureProfileAfterAuth(data.user.id);
        router.push('/mypage');
      }
    } catch (error: any) {
      setError(error.message);
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
        setOtpSending(false);
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
        setOtpVerifying(false);
        return;
      }
      await ensureProfileAfterAuth(data.user.id);
      router.push('/mypage');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('signup.errorVerifyFailed'));
    } finally {
      setOtpVerifying(false);
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
    <SitePageShell>
      <main className="relative z-10 container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-md">
          <div className="rounded-[1.75rem] border border-white/25 bg-white/55 p-8 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all md:p-10">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">
                {t('auth.signIn')}
              </h1>
              <p className="text-sm text-slate-600 md:text-base">{t('auth.welcomeBackSubtitle')}</p>
            </div>

            {passwordUpdated && (
              <div className="mb-6 rounded-lg border-l-4 border-green-500 bg-green-50 px-4 py-3 text-green-800 shadow-sm" role="alert">
                <p className="text-sm font-medium">{t('auth.passwordUpdatedBanner')}</p>
              </div>
            )}

            <div className="mb-6 flex rounded-xl border border-slate-200/80 bg-white/50 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setSignInMode('password');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 transition-colors ${
                  signInMode === 'password' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white/80'
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
                className={`flex-1 rounded-lg py-2 transition-colors ${
                  signInMode === 'otp' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white/80'
                }`}
              >
                {t('auth.signInWithEmailCode')}
              </button>
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

            {signInMode === 'password' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('auth.email')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder={t('auth.emailPlaceholder')}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('auth.password')}
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder={t('auth.passwordPlaceholder')}
                  />
                </div>

                <div className="text-right text-sm">
                  <Link
                    href="/forgot-password"
                    className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full transform rounded-xl bg-gray-900 py-3.5 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-gray-800 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? t('auth.signingIn') : t('auth.signIn')}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-slate-600">{t('auth.emailCodeHelp')}</p>
                <div>
                  <label htmlFor="otp-email" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('auth.email')}
                  </label>
                  <input
                    type="email"
                    id="otp-email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    disabled={otpSent}
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-70"
                    placeholder={t('auth.emailPlaceholder')}
                    autoComplete="email"
                  />
                </div>
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendSignInOtp}
                    disabled={otpSending || !otpEmail.trim()}
                    className="w-full rounded-xl bg-gray-900 py-3.5 font-semibold text-white shadow-lg transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {otpSending ? t('signup.sending') : t('auth.sendSignInCode')}
                  </button>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">{t('auth.signInCodeSentHint')}</p>
                    <div>
                      <label htmlFor="otp-code" className="mb-2 block text-sm font-semibold text-slate-700">
                        {t('auth.signInCodeLabel')}
                      </label>
                      <input
                        type="text"
                        id="otp-code"
                        inputMode="numeric"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-center text-2xl tracking-widest text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        placeholder={t('auth.signInCodePlaceholder')}
                        autoComplete="one-time-code"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifySignInOtp}
                      disabled={otpVerifying || otpCode.trim().length < 6}
                      className="w-full rounded-xl bg-gray-900 py-3.5 font-semibold text-white shadow-lg transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {otpVerifying ? t('signup.verifying') : t('auth.signIn')}
                    </button>
                    {otpCountdown > 0 ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                        <span>{t('auth.otpResendIn')}</span>
                        <span className="min-w-[3ch] text-lg font-bold tabular-nums text-blue-600">{otpCountdown}s</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendSignInOtp}
                        disabled={otpSending}
                        className="w-full text-sm font-medium text-blue-600 hover:text-blue-700"
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
                      className="w-full text-sm text-slate-500 hover:text-slate-700"
                    >
                      {t('auth.signInWithPasswordInstead')}
                    </button>
                  </>
                )}
              </div>
            )}

            {signInMode === 'password' && (
              <>
                {/* Divider + Google: only for password flow — OTP tab stays code-only */}
                <div className="relative my-6 md:my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/25" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-transparent px-4 font-medium text-slate-400">{t('auth.or')}</span>
                  </div>
                </div>

                <div className="space-y-2.5 md:space-y-3">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    className="flex w-full max-w-[360px] justify-center rounded-xl border border-white/25 bg-white/70 px-5 py-3 font-medium text-slate-700 shadow-sm transition-all hover:border-slate-200/80 hover:shadow-md hover:shadow-lg"
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
                      <span className="text-sm md:text-base">{t('auth.google')}</span>
                    </span>
                  </button>
                </div>
              </>
            )}

            <div className={`space-y-2 text-center ${signInMode === 'password' ? 'mt-6 md:mt-8' : 'mt-8'}`}>
              <p className="text-sm text-slate-600">
                {t('auth.dontHaveAccount')}{' '}
                <Link href="/signup" className="font-semibold text-blue-600 transition-colors hover:text-blue-700">
                  {t('auth.signUp')}
                </Link>
              </p>
              {signInMode === 'password' && (
                <p className="text-sm text-slate-600">
                  <Link href="/forgot-password" className="font-medium text-blue-600 transition-colors hover:text-blue-700">
                    {t('auth.forgotPasswordLower')}
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {showGoogleChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-[1.75rem] border border-white/25 bg-white/90 p-6 shadow-2xl backdrop-blur-xl">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              {t('auth.googleChooseTitle')}
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              {t('auth.googleChooseBody')}
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleChoice(false);
                  startGoogleOAuth('default');
                }}
                disabled={isSocialLoading}
                className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="w-full rounded-xl border border-slate-200/80 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('auth.googleUseDifferent')}
              </button>
              <button
                type="button"
                onClick={() => setShowGoogleChoice(false)}
                disabled={isSocialLoading}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-700"
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
