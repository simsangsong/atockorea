'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getPasswordStrengthTier, validateAppPassword } from '@/lib/password-policy';
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar';
import { PasswordToggle } from '@/components/auth/PasswordToggle';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';
import Logo from '@/components/Logo';
import {
  AUTH_FIELD_LABEL,
  AUTH_FORM_CARD,
  AUTH_INPUT_WITH_TOGGLE,
  AUTH_LEAD,
  AUTH_LINK,
  AUTH_PAGE_BACKDROP,
  AUTH_PAGE_TITLE,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setHasSession(false);
      return;
    }
    const client = supabase;
    let cancelled = false;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) setHasSession(true);
    });

    client.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) setHasSession(true);
    });

    const timer = setTimeout(() => {
      if (cancelled) return;
      client.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        setHasSession(Boolean(session));
      });
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwdCheck = validateAppPassword(password);
    if (!pwdCheck.valid) {
      setError(pwdCheck.message ?? t('auth.resetPasswordPage.errorPasswordInvalid'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.resetPasswordPage.errorPasswordMismatch'));
      return;
    }
    setIsLoading(true);
    try {
      if (!supabase) throw new Error(t('auth.resetPasswordPage.errorServiceUnavailable'));
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      await supabase.auth.signOut();
      router.push('/signin?password_updated=1');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.resetPasswordPage.errorUpdateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (hasSession === null) {
    return (
      <SitePageShell>
        <main
          className={cn(
            'relative z-10 container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-12 sm:px-6 md:py-20 lg:px-8',
            AUTH_PAGE_BACKDROP,
          )}
        >
          <div className="mx-auto flex w-full max-w-[420px] items-center justify-center">
            <div className={cn(AUTH_FORM_CARD, 'flex h-40 items-center justify-center px-6 py-8 sm:px-9 sm:py-10')}>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" aria-label={t('auth.callbackPage.processingTitle')} />
            </div>
          </div>
        </main>
      </SitePageShell>
    );
  }

  if (!hasSession) {
    return (
      <SitePageShell>
        <main
          className={cn(
            'relative z-10 container mx-auto px-4 py-12 sm:px-6 md:py-20 lg:px-8',
            AUTH_PAGE_BACKDROP,
          )}
        >
          <div className="mx-auto max-w-[420px]">
            <div className={cn(AUTH_FORM_CARD, 'px-6 py-8 sm:px-9 sm:py-10 text-center')}>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200/80">
                <svg className="h-7 w-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 0 0-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3Z" />
                </svg>
              </div>
              <h1 className={cn(AUTH_PAGE_TITLE, 'mt-6')}>
                {t('auth.resetPasswordPage.sessionRequiredTitle')}
              </h1>
              <p className={AUTH_LEAD}>{t('auth.resetPasswordPage.sessionRequiredBody')}</p>
              <div className="mt-8 space-y-3">
                <Link
                  href="/forgot-password"
                  className="home-btn-primary block w-full"
                >
                  {t('auth.resetPasswordPage.requestNewLink')}
                </Link>
                <Link
                  href="/signin?next=/reset-password"
                  className="home-btn-secondary block w-full"
                >
                  {t('auth.resetPasswordPage.goToSignIn')}
                </Link>
              </div>
            </div>
          </div>
        </main>
      </SitePageShell>
    );
  }

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
              <h1 className={cn(AUTH_PAGE_TITLE, 'mt-7')}>{t('auth.resetPasswordPage.title')}</h1>
              <p className={AUTH_LEAD}>{t('auth.resetPasswordPage.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
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

              <div>
                <label htmlFor="password" className={AUTH_FIELD_LABEL}>
                  {t('auth.resetPasswordPage.newPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={AUTH_INPUT_WITH_TOGGLE}
                    placeholder={t('auth.resetPasswordPage.newPasswordPlaceholder')}
                  />
                  <PasswordToggle
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    showLabel={t('auth.showPassword')}
                    hideLabel={t('auth.hidePassword')}
                  />
                </div>
                <PasswordStrengthBar
                  tier={getPasswordStrengthTier(password)}
                  weakLabel={t('signup.passwordStrengthWeak')}
                  strongLabel={t('signup.passwordStrengthStrong')}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className={AUTH_FIELD_LABEL}>
                  {t('auth.resetPasswordPage.confirmPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className={AUTH_INPUT_WITH_TOGGLE}
                    placeholder={t('auth.resetPasswordPage.confirmPasswordPlaceholder')}
                  />
                  <PasswordToggle
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((v) => !v)}
                    showLabel={t('auth.showPassword')}
                    hideLabel={t('auth.hidePassword')}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading
                  ? t('auth.resetPasswordPage.submitting')
                  : t('auth.resetPasswordPage.submit')}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6 text-center">
              <p className="text-[14px] text-slate-600">
                <Link href="/signin" className={AUTH_LINK}>
                  {t('auth.forgotPasswordPage.backToSignIn')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </SitePageShell>
  );
}
