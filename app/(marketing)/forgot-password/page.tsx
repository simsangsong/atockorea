'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useTranslations } from '@/lib/i18n';
import Logo from '@/components/Logo';
import {
  AUTH_FIELD_LABEL,
  AUTH_FORM_CARD,
  AUTH_INPUT,
  AUTH_LEAD,
  AUTH_LINK,
  AUTH_PAGE_BACKDROP,
  AUTH_PAGE_TITLE,
  AUTH_SUBTLE_LINK,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (!supabase) {
        throw new Error(t('auth.forgotPasswordPage.errorGeneric'));
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      if (err) throw err;
      setIsSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.forgotPasswordPage.errorGeneric'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (!supabase) {
        throw new Error(t('auth.forgotPasswordPage.errorGeneric'));
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      if (err) throw err;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.forgotPasswordPage.errorGeneric'));
    } finally {
      setIsLoading(false);
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
              {!isSubmitted ? (
                <>
                  <h1 className={cn(AUTH_PAGE_TITLE, 'mt-7')}>{t('auth.forgotPasswordPage.title')}</h1>
                  <p className={AUTH_LEAD}>{t('auth.forgotPasswordPage.subtitle')}</p>
                </>
              ) : (
                <>
                  <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200/80">
                    <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h1 className={cn(AUTH_PAGE_TITLE, 'mt-6')}>{t('auth.forgotPasswordPage.successTitle')}</h1>
                  <p className={AUTH_LEAD}>
                    {t('auth.forgotPasswordPage.successBody', { email })}
                  </p>
                </>
              )}
            </div>

            <div className="mt-9 space-y-5">
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

              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className={AUTH_FIELD_LABEL}>
                      {t('auth.forgotPasswordPage.emailLabel')}
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className={AUTH_INPUT}
                      placeholder={t('auth.emailPlaceholder')}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading
                      ? t('auth.forgotPasswordPage.submitting')
                      : t('auth.forgotPasswordPage.submit')}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={isLoading}
                    className="home-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading
                      ? t('auth.forgotPasswordPage.submitting')
                      : t('auth.forgotPasswordPage.resend')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail('');
                    }}
                    className="home-btn-secondary w-full"
                  >
                    {t('auth.forgotPasswordPage.tryAnotherEmail')}
                  </button>
                  <Link
                    href="/signin"
                    className={cn(AUTH_SUBTLE_LINK, 'block w-full py-3 text-center text-[13px]')}
                  >
                    {t('auth.forgotPasswordPage.backToSignIn')}
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-200 pt-6 text-center">
              {!isSubmitted && (
                <Link href="/forgot-id" className={cn(AUTH_LINK, 'text-[13px]')}>
                  {t('auth.forgotPasswordPage.forgotIdLink')}
                </Link>
              )}
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
