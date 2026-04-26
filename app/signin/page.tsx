'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';
import {
  AUTH_FIELD_LABEL,
  AUTH_FORM_CARD,
  AUTH_GOOGLE_PANEL,
  AUTH_INPUT,
  AUTH_INPUT_WITH_TOGGLE,
  AUTH_LEAD,
  AUTH_LINK,
  AUTH_OTP_INPUT,
  AUTH_PAGE_BACKDROP,
  AUTH_PAGE_TITLE,
  AUTH_REVEAL_ALT_SIGNIN_BUTTON,
  AUTH_SEGMENTED,
  AUTH_SUBTLE_LINK,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { PasswordToggle } from '@/components/auth/PasswordToggle';
import { GoogleLogo } from '@/components/auth/GoogleLogo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
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

  const resetOtpState = useCallback(() => {
    setOtpSent(false);
    setOtpCode('');
    setOtpCountdown(0);
    setOtpSending(false);
    setOtpVerifying(false);
  }, []);

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
    if (typeof window === 'undefined') return '/mypage';
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (
      redirect &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//') &&
      !redirect.includes(':')
    ) {
      return redirect;
    }
    return '/mypage';
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
      const next = getRedirectAfterAuth();
      const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`;
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

  const handleSocialLogin = (provider: 'google') => {
    if (provider === 'google') {
      setError(null);
      setShowGoogleChoice(true);
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
                <Link
                  href="/"
                  className="inline-flex !min-h-0 !min-w-0 items-center justify-center rounded-2xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label={t('nav.home')}
                >
                  <Logo markOnly className="justify-center" variant="default" />
                </Link>
              </div>
              <h1 className={cn(AUTH_PAGE_TITLE, 'mt-7')}>{t('auth.signIn')}</h1>
              <p className={AUTH_LEAD}>{t('auth.welcomeBackSubtitle')}</p>
            </div>

            <div className="mt-9 space-y-6">
              {passwordUpdated && (
                <div
                  className="rounded-2xl border border-emerald-200/70 bg-emerald-50/90 px-4 py-3.5 text-emerald-900 shadow-[0_8px_28px_-20px_rgba(5,150,105,0.35)]"
                  role="alert"
                >
                  <p className="text-[14px] font-medium leading-snug">{t('auth.passwordUpdatedBanner')}</p>
                </div>
              )}

              {error && (
                <div
                  className="flex items-center gap-2.5 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3.5 text-red-800 shadow-[0_8px_28px_-18px_rgba(220,38,38,0.2)]"
                  role="alert"
                  aria-live="polite"
                >
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-[13px] font-medium">{error}</span>
                </div>
              )}

              <div className={AUTH_GOOGLE_PANEL}>
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('auth.signInWith')}
                </p>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  disabled={isSocialLoading}
                  className="home-btn-secondary home-btn-secondary--auth-google w-full gap-3 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleLogo className="h-5 w-5 shrink-0" />
                  <span>{t('auth.continueWithGoogle')}</span>
                </button>
                <p className="mt-3 text-center text-[12px] leading-relaxed text-slate-500">
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
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-5"
                  >
                    <div className="relative py-0.5">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="rounded-full bg-white px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200">
                          {t('auth.or')}
                        </span>
                      </div>
                    </div>

                    <div className={AUTH_SEGMENTED} role="tablist" aria-label={t('auth.signIn')}>
                      <button
                        type="button"
                        role="tab"
                        id="signin-tab-password"
                        aria-selected={signInMode === 'password'}
                        aria-controls="signin-panel-password"
                        onClick={() => {
                          setSignInMode('password');
                          setError(null);
                          resetOtpState();
                        }}
                        className={cn(
                          'flex-1 rounded-xl py-2.5 transition-all duration-200',
                          signInMode === 'password'
                            ? 'bg-white text-slate-900 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900',
                        )}
                      >
                        {t('auth.password')}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        id="signin-tab-otp"
                        aria-selected={signInMode === 'otp'}
                        aria-controls="signin-panel-otp"
                        onClick={() => {
                          setSignInMode('otp');
                          setError(null);
                        }}
                        className={cn(
                          'flex-1 rounded-xl py-2.5 transition-all duration-200',
                          signInMode === 'otp'
                            ? 'bg-white text-slate-900 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900',
                        )}
                      >
                        {t('auth.signInWithEmailCode')}
                      </button>
                    </div>

                    {signInMode === 'password' ? (
                      <form
                        onSubmit={handleSubmit}
                        className="space-y-5"
                        role="tabpanel"
                        id="signin-panel-password"
                        aria-labelledby="signin-tab-password"
                      >
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
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              id="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              required
                              autoComplete="current-password"
                              className={AUTH_INPUT_WITH_TOGGLE}
                              placeholder={t('auth.passwordPlaceholder')}
                            />
                            <PasswordToggle
                              show={showPassword}
                              onToggle={() => setShowPassword((v) => !v)}
                              showLabel={t('auth.showPassword')}
                              hideLabel={t('auth.hidePassword')}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end text-[13px]">
                          <Link href="/forgot-password" className={AUTH_SUBTLE_LINK}>
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
                      <div
                        className="space-y-5"
                        role="tabpanel"
                        id="signin-panel-otp"
                        aria-labelledby="signin-tab-otp"
                      >
                        <p className="text-[14px] leading-relaxed text-slate-600">{t('auth.emailCodeHelp')}</p>
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
                            className={cn(AUTH_INPUT, 'disabled:bg-slate-50 disabled:text-slate-500')}
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
                            <p className="text-[12px] text-slate-500">{t('auth.signInCodeSentHint')}</p>
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
                                className={AUTH_OTP_INPUT}
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
                              <div className="flex items-center justify-center gap-2 text-[12px] text-slate-500">
                                <span>{t('auth.otpResendIn')}</span>
                                <span className="min-w-[3ch] text-base font-bold tabular-nums text-slate-900">
                                  {otpCountdown}s
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={handleSendSignInOtp}
                                disabled={otpSending}
                                className={cn(AUTH_SUBTLE_LINK, 'w-full text-[12px]')}
                              >
                                {t('auth.resendSignInCode')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSignInMode('password');
                                resetOtpState();
                                setError(null);
                              }}
                              className="w-full text-[12px] text-slate-500 hover:text-slate-700"
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
                      className={AUTH_REVEAL_ALT_SIGNIN_BUTTON}
                    >
                      {t('auth.loginWithAnotherMethod')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-10 border-t border-slate-200 pt-8 text-center">
              <p className="text-[14px] text-slate-600">
                {t('auth.dontHaveAccount')}{' '}
                <Link href="/signup" className={AUTH_LINK}>
                  {t('auth.signUp')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showGoogleChoice} onOpenChange={setShowGoogleChoice}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[1.125rem] font-semibold tracking-tight text-slate-900">
              {t('auth.googleChooseTitle')}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed text-slate-600">
              {t('auth.googleChooseBody')}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-1 space-y-3">
            <button
              type="button"
              onClick={() => {
                setShowGoogleChoice(false);
                void startGoogleOAuth('default');
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
                void startGoogleOAuth('select_account');
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
              className="w-full py-2 text-xs text-slate-500 hover:text-slate-700"
            >
              {t('common.cancel')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SitePageShell>
  );
}
