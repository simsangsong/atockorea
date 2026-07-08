'use client';

/**
 * Welcome-coupon conversion popup (§6 of the welcome-coupon master plan).
 *
 * Shows logged-out visitors a member-invite card ("10% off your first tour"),
 * captures an email, runs the SAME native Supabase email-OTP flow the signup
 * page uses (`signInWithOtp` shouldCreateUser → `verifyOtp type:'email'`), and
 * on confirmation the DB trigger issues the WELCOME10 grant automatically.
 *
 * Triggers (§6.3): first of 5s delay OR 30% scroll; desktop adds exit-intent.
 * Suppression: logged-in session / dismissed <7d / already claimed / once per
 * browser session. Desktop = centered dialog (image left), mobile = bottom
 * sheet (image band top) — never a full-screen interstitial.
 *
 * Parity guard (§8): copy is a member benefit frame only — no OTA price
 * comparison, and no price surface anywhere in this component.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, MailCheck, TicketPercent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth-session';
import { useTranslations } from '@/lib/i18n';
import { useMediaQuery } from '@/components/home/v2/use-media-query';
import { trackEvent } from '@/src/design/analytics';
import { isDisposableEmail } from '@/lib/coupons/disposable-domains';
import {
  WELCOME_POPUP_ENABLED,
  WELCOME_DISMISS_SNOOZE_DAYS,
  WELCOME_DISMISSED_AT_KEY,
  WELCOME_CLAIMED_KEY,
  WELCOME_SESSION_SHOWN_KEY,
  WELCOME_TRIGGER_DELAY_MS,
  WELCOME_TRIGGER_SCROLL_RATIO,
} from '@/lib/welcome-coupon/config';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

type Step = 'email' | 'code' | 'success';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function suppressedByStorage(): boolean {
  try {
    if (localStorage.getItem(WELCOME_CLAIMED_KEY)) return true;
    if (sessionStorage.getItem(WELCOME_SESSION_SHOWN_KEY)) return true;
    const dismissedAt = Number(localStorage.getItem(WELCOME_DISMISSED_AT_KEY));
    if (
      Number.isFinite(dismissedAt) &&
      dismissedAt > 0 &&
      Date.now() - dismissedAt < WELCOME_DISMISS_SNOOZE_DAYS * 86400000
    ) {
      return true;
    }
  } catch {
    /* storage unavailable (private mode) — fail open, popup may show */
  }
  return false;
}

export default function WelcomeCouponPopup() {
  const { status, session } = useSession();
  const t = useTranslations('welcomeCoupon');
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const firedRef = useRef(false);

  /* ── triggers (armed only while eligible) ──────────────────────────────── */
  const fire = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    try {
      sessionStorage.setItem(WELCOME_SESSION_SHOWN_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(true);
    trackEvent('welcome_popup_shown', {});
  }, []);

  useEffect(() => {
    if (!WELCOME_POPUP_ENABLED) return;
    if (status !== 'ready' || session) return; // wait for auth; never for members
    if (firedRef.current || suppressedByStorage()) return;

    const timer = window.setTimeout(fire, WELCOME_TRIGGER_DELAY_MS);

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable > 0 && window.scrollY / scrollable >= WELCOME_TRIGGER_SCROLL_RATIO) {
        fire();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Exit-intent — pointer devices only (§6.3: unsupported on touch).
    const pointerFine = window.matchMedia('(pointer: fine)').matches;
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) fire();
    };
    if (pointerFine) document.addEventListener('mouseout', onMouseOut);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      if (pointerFine) document.removeEventListener('mouseout', onMouseOut);
    };
  }, [status, session, fire]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  /* ── open/close ────────────────────────────────────────────────────────── */
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    setOpen(false);
    if (step !== 'success') {
      try {
        localStorage.setItem(WELCOME_DISMISSED_AT_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      trackEvent('welcome_popup_dismissed', { step });
    }
  };

  /* ── step 1: email → OTP send (same flow as /signup) ───────────────────── */
  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    setError(null);
    setAlreadyMember(false);
    if (!EMAIL_RE.test(trimmed) || isDisposableEmail(trimmed)) {
      setError(t('errorEmailInvalid'));
      return;
    }
    if (!supabase) {
      setError(t('errorSendFailed'));
      return;
    }
    setBusy(true);
    try {
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, blockDisposable: true }),
      });
      const checkData = (await checkRes.json().catch(() => ({}))) as {
        exists?: boolean;
        checkFailed?: boolean;
      };
      if (!checkRes.ok || checkData.checkFailed === true) {
        setError(t('errorSendFailed'));
        return;
      }
      if (checkData.exists === true) {
        // Existing member — the welcome coupon is new-customer only (§9).
        setAlreadyMember(true);
        return;
      }

      const origin = window.location.origin;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (otpError) {
        setError(otpError.message || t('errorSendFailed'));
        return;
      }
      setCountdown(60);
      setStep('code');
      trackEvent('welcome_popup_email_submitted', {});
    } catch {
      setError(t('errorSendFailed'));
    } finally {
      setBusy(false);
    }
  };

  /* ── step 2: verify OTP → session + email_confirmed → DB grant ─────────── */
  const handleVerify = async () => {
    const token = code.trim();
    setError(null);
    if (token.length < 6 || !supabase) {
      setError(t('errorInvalidCode'));
      return;
    }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email',
      });
      if (verifyError) {
        setError(t('errorInvalidCode'));
        return;
      }
      try {
        localStorage.setItem(WELCOME_CLAIMED_KEY, '1');
      } catch {
        /* ignore */
      }
      setStep('success');
      trackEvent('welcome_popup_verified', {});
    } catch {
      setError(t('errorInvalidCode'));
    } finally {
      setBusy(false);
    }
  };

  if (!WELCOME_POPUP_ENABLED) return null;

  /* ── shared form body (dialog + sheet render the same steps) ───────────── */
  const formSection = (
    <div className="flex flex-1 flex-col justify-center gap-4 bg-stone-50 p-6 sm:p-8">
      {step === 'email' && (
        <>
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              <TicketPercent className="h-3.5 w-3.5" aria-hidden />
              AtoC Korea
            </p>
            <h2 className="font-serif text-[22px] leading-snug text-stone-900">{t('headline')}</h2>
            <p className="text-[13px] leading-relaxed text-stone-600">{t('sub')}</p>
          </div>
          <div className="space-y-2">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && handleSendCode()}
              placeholder={t('emailPlaceholder')}
              aria-label={t('emailPlaceholder')}
              className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-[14px] text-stone-900 outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-300/60"
            />
            {alreadyMember ? (
              <p className="text-[12px] text-stone-600">
                {t('alreadyMember')}{' '}
                <a href="/signin" className="font-semibold text-stone-900 underline underline-offset-2">
                  {t('signInCta')}
                </a>
              </p>
            ) : error ? (
              <p role="alert" className="text-[12px] text-rose-600">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleSendCode}
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 text-[14px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {t('cta')}
            </button>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="w-full py-1 text-center text-[12px] text-stone-500 underline-offset-2 hover:underline"
            >
              {t('dismiss')}
            </button>
          </div>
        </>
      )}

      {step === 'code' && (
        <>
          <div className="space-y-2">
            <h2 className="font-serif text-[20px] leading-snug text-stone-900">{t('otpTitle')}</h2>
            <p className="text-[13px] leading-relaxed text-stone-600">
              {t('otpSub', { email: email.trim() })}
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && !busy && handleVerify()}
              placeholder={t('codePlaceholder')}
              aria-label={t('codePlaceholder')}
              className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-center text-[18px] tracking-[0.4em] text-stone-900 outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-300/60"
            />
            {error && (
              <p role="alert" className="text-[12px] text-rose-600">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy || code.length < 6}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 text-[14px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {t('verifyCta')}
            </button>
            <button
              type="button"
              onClick={() => countdown === 0 && !busy && handleSendCode()}
              disabled={countdown > 0 || busy}
              className="w-full py-1 text-center text-[12px] text-stone-500 underline-offset-2 hover:underline disabled:opacity-60 disabled:hover:no-underline"
            >
              {countdown > 0 ? t('resendCountdown', { s: countdown }) : t('resendCta')}
            </button>
          </div>
        </>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <MailCheck className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="font-serif text-[20px] leading-snug text-stone-900">{t('successTitle')}</h2>
          <p className="text-[13px] leading-relaxed text-stone-600">{t('successSub')}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 h-11 w-full rounded-xl bg-stone-900 text-[14px] font-semibold text-white transition hover:bg-stone-800"
          >
            {t('successCta')}
          </button>
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-stone-200 p-0"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{t('headline')}</DialogTitle>
          <div className="grid sm:grid-cols-[220px_1fr]">
            {step !== 'success' && (
              <div className="relative hidden sm:block">
                <Image
                  src="/images/home/hero/01-gyeongbokgung-sunset.webp"
                  alt=""
                  fill
                  sizes="220px"
                  className="object-cover"
                />
              </div>
            )}
            {formSection}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-0 overflow-hidden rounded-t-2xl border-stone-200 p-0"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">{t('headline')}</SheetTitle>
        {step !== 'success' && (
          <div className="relative h-28 w-full">
            <Image
              src="/images/home/hero/01-gyeongbokgung-sunset.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
        )}
        {formSection}
      </SheetContent>
    </Sheet>
  );
}
