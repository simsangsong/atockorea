'use client';

/**
 * Welcome-coupon conversion popup (§6 of the welcome-coupon master plan).
 *
 * Shows logged-out visitors a member-invite card ("10% off your first tour"),
 * captures an email, runs the SAME native Supabase email-OTP flow the signup
 * page uses (`signInWithOtp` shouldCreateUser → `verifyOtp type:'email'`), and
 * on confirmation the DB trigger issues the WELCOME10 grant automatically.
 *
 * Visual language (v5, compact-editorial pass 2026-07-16 on user request —
 * "high-end, ~30% of a phone screen, no startling pop"): one warm-ivory
 * invitation card (#fbf9f4) led by typography — caps eyebrow, oversized
 * serif italic offer figure ("10%" / "9折" for zh locales), a single
 * headline line — with an ink CTA and ONE tiny vermilion 낙관 "환영" seal
 * as the Korean-identity detail. The v4 ticket object, sparkles, chips and
 * the desktop two-pane grid are gone; both breakpoints share one centered
 * single-column card (mobile ≤312px, desktop ≤352px). Entrance/exit is the
 * slow wc-pop-in/out pair in globals.css (650ms settle / 300ms exit) — the
 * shared dialog's 100ms zoom read as an abrupt "tick".
 *
 * Triggers (§6.3, retuned 2026-07-12): first of 3s delay OR 10% scroll;
 * desktop adds exit-intent.
 * Suppression (user decision 2026-07-12): logged-in session / already claimed
 * / "don't show again today" opt-in checkbox. Nothing else — with the box
 * unchecked the popup re-arms on EVERY full page load (the once-per-session
 * key and the 7-day dismissal snooze were dropped on user request). The
 * checkbox applies to every close path (X, "No thanks", backdrop, Escape)
 * and stores today's LOCAL date, so the popup stays quiet until midnight.
 * QA override: `?welcome=1` opens immediately and bypasses every suppression
 * (incl. login) without emitting funnel events.
 * Non-explicit dismissals are ignored for the first 800ms after opening: the
 * scroll trigger fires MID-GESTURE on touch devices, and the tap already in
 * flight would otherwise land on the backdrop and close the dialog before it
 * ever paints (mobile "popup never opens" report, 2026-07-12).
 *
 * Parity guard (§8): member-benefit framing only — no OTA price comparison,
 * no public-price surface anywhere in this component.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth-session';
import { useI18n, useTranslations } from '@/lib/i18n';
import { trackEvent } from '@/src/design/analytics';
import { isDisposableEmail } from '@/lib/coupons/disposable-domains';
import {
  WELCOME_POPUP_ENABLED,
  WELCOME_CLAIMED_KEY,
  WELCOME_HIDE_TODAY_KEY,
  WELCOME_TRIGGER_DELAY_MS,
  WELCOME_TRIGGER_SCROLL_RATIO,
} from '@/lib/welcome-coupon/config';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type Step = 'email' | 'code' | 'success';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SERIF = "Georgia, 'Times New Roman', serif";
/** Antique brass — the site's single premium accent (tour-detail tone). */
const BRASS = '#9C7A3C';
const INK = '#1c1917';
const VERMILION = '#c2410c';

/** Local calendar day — "hide today" means the visitor's today, not UTC's. */
function localDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function suppressedByStorage(): boolean {
  try {
    if (localStorage.getItem(WELCOME_CLAIMED_KEY)) return true;
    if (localStorage.getItem(WELCOME_HIDE_TODAY_KEY) === localDayKey()) return true;
  } catch {
    /* storage unavailable (private mode) — fail open, popup may show */
  }
  return false;
}

/**
 * Operational surfaces where marketing chrome must never appear — a traveller
 * inside a live tour room (§O-1 ② standalone shell) is not a conversion
 * target. Checked at fire time too: a timer armed on a marketing page can
 * outlive a client-side navigation into one of these routes.
 */
function onOperationalRoute(): boolean {
  try {
    const pathname = window.location.pathname;
    // Live tour rooms (§O-1 ② standalone shell) …
    if (/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?tour-mode(?:\/|$)/.test(pathname)) return true;
    // … and every admin surface (incl. the standalone ops console) — a staff
    // console is never a conversion target.
    if (/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?admin(?:\/|$)/.test(pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

export default function WelcomeCouponPopup() {
  const { status, session } = useSession();
  const t = useTranslations('welcomeCoupon');
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [hideToday, setHideToday] = useState(false);
  const firedRef = useRef(false);
  const openedAtRef = useRef(0);
  /** True when the open came from ?welcome=1 — QA sessions stay out of the funnel. */
  const qaOpenedRef = useRef(false);

  /** zh idiom: 10% off = 9折 (§6.5 localization note). */
  const isZh = locale === 'zh' || locale === 'zh-TW';
  const figure = isZh ? '9折' : '10%';

  /* ── triggers (armed only while eligible) ──────────────────────────────── */
  const fire = useCallback(() => {
    if (firedRef.current) return;
    // Re-check at fire time: an armed timer/listener in ANOTHER tab (or a
    // suspended one) can execute after the visitor opted out or claimed
    // there — localStorage is shared, the armed closure is not.
    if (suppressedByStorage() || onOperationalRoute()) return;
    firedRef.current = true;
    openedAtRef.current = Date.now();
    setOpen(true);
    trackEvent('welcome_popup_shown', {});
  }, []);

  useEffect(() => {
    if (!WELCOME_POPUP_ENABLED) return;
    // QA override — see header comment. Checked before the auth/suppression
    // gates so it works on a logged-in or previously-claimed device.
    if (!firedRef.current) {
      try {
        if (new URLSearchParams(window.location.search).get('welcome') === '1') {
          firedRef.current = true;
          qaOpenedRef.current = true;
          openedAtRef.current = Date.now();
          setOpen(true);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    if (status !== 'ready' || session) return; // wait for auth; never for members
    if (firedRef.current || suppressedByStorage() || onOperationalRoute()) return;

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

  /** Hide the floating AI-assistant FAB (z-65) while the popup is open — it
   *  was overlapping the email field on mobile (user report, 2026-07-08).
   *  Removal is delayed past the 300ms exit animation so the deepened veil
   *  (globals.css keys off this attribute) doesn't snap thin mid-exit. */
  useEffect(() => {
    if (open) {
      document.body.setAttribute('data-welcome-popup', 'open');
      return;
    }
    const timer = window.setTimeout(() => document.body.removeAttribute('data-welcome-popup'), 400);
    return () => window.clearTimeout(timer);
  }, [open]);
  useEffect(() => () => document.body.removeAttribute('data-welcome-popup'), []);

  /* ── open/close ────────────────────────────────────────────────────────── */

  /** Every close path honors the "don't show again today" checkbox. */
  const persistHideToday = () => {
    if (!hideToday) return;
    try {
      localStorage.setItem(WELCOME_HIDE_TODAY_KEY, localDayKey());
    } catch {
      /* ignore */
    }
  };

  /** Backdrop / Escape. Without the checkbox, no suppression — re-arms next load. */
  const handleOpenChange = (next: boolean) => {
    // In-flight touch guard — see header comment (mobile instant-dismiss).
    if (!next && Date.now() - openedAtRef.current < 800) return;
    setOpen(next);
    if (!next && step !== 'success') {
      persistHideToday();
      if (!qaOpenedRef.current) {
        trackEvent('welcome_popup_dismissed', { step, explicit: false, hideToday });
      }
    }
  };

  /** Explicit X / "No thanks". */
  const dismissExplicitly = () => {
    setOpen(false);
    if (step !== 'success') {
      persistHideToday();
      if (!qaOpenedRef.current) {
        trackEvent('welcome_popup_dismissed', { step, explicit: true, hideToday });
      }
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
        disposable?: boolean;
      };
      if (checkData.disposable === true) {
        setError(t('errorEmailInvalid'));
        return;
      }
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

  /* ── shared pieces ─────────────────────────────────────────────────────── */

  const closeButton = (
    <button
      type="button"
      onClick={dismissExplicitly}
      aria-label={t('dismiss')}
      className="absolute right-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-stone-700"
    >
      <X className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
    </button>
  );

  /** The one Korean-identity detail — a small 낙관 seal; lands big on success. */
  const seal = (size: number, landed = false) => (
    <span
      className={`${landed ? 'wc-stamp-in' : '-rotate-6'} flex items-center justify-center rounded-full`}
      style={{ width: size, height: size, backgroundColor: VERMILION }}
      aria-hidden
    >
      <span className="font-semibold text-white" style={{ fontSize: size * 0.34, letterSpacing: '-0.02em' }}>
        환영
      </span>
    </span>
  );

  // The serif figure IS the headline — the old h3 repeated "10% off" in
  // words and cost a line; the sr-only DialogTitle keeps the a11y name.
  const masthead = (
    <div className="space-y-1.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.34em]" style={{ color: BRASS }}>
        AtoC Korea
      </p>
      <p className="flex items-baseline justify-center leading-none" style={{ color: INK }}>
        <span className="italic" style={{ fontFamily: SERIF, fontSize: 44, letterSpacing: '-0.02em' }}>
          {figure}
        </span>
        {!isZh && (
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: BRASS }}>
            off
          </span>
        )}
      </p>
    </div>
  );

  const finePrintLine = (
    <p className="break-keep text-center text-[9.5px] leading-relaxed text-stone-400">
      {t('finePrint')}
    </p>
  );

  const inputClass =
    'h-10 w-full rounded-full border border-stone-200/90 bg-white px-5 text-[13.5px] text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#9C7A3C]/50 focus:ring-2 focus:ring-[#9C7A3C]/25';
  const ctaClass =
    'group flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold tracking-wide text-white transition hover:opacity-90 disabled:opacity-60';

  const emailForm = (
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
        className={inputClass}
      />
      {alreadyMember ? (
        <p className="text-center text-[11px] text-stone-500">
          {t('alreadyMember')}{' '}
          <Link href="/signin" className="font-semibold underline underline-offset-2" style={{ color: BRASS }}>
            {t('signInCta')}
          </Link>
        </p>
      ) : error ? (
        <p role="alert" className="text-center text-[11px] text-rose-600">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleSendCode}
        disabled={busy}
        className={ctaClass}
        style={{ backgroundColor: INK }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {t('cta')}
        {!busy && (
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden
          />
        )}
      </button>
      <div className="flex items-center justify-center gap-2.5 pt-0.5 text-[11px] text-stone-400">
        <button
          type="button"
          onClick={dismissExplicitly}
          className="underline-offset-2 transition hover:text-stone-600 hover:underline"
        >
          {t('dismiss')}
        </button>
        <span aria-hidden>·</span>
        <label className="flex cursor-pointer select-none items-center gap-1.5 transition hover:text-stone-600">
          <input
            type="checkbox"
            checked={hideToday}
            onChange={(e) => setHideToday(e.target.checked)}
            className="h-3.5 w-3.5 accent-stone-600"
          />
          {t('hideToday')}
        </label>
      </div>
      {finePrintLine}
    </div>
  );

  const codeForm = (
    <div className="space-y-2">
      <div className="space-y-1 text-center">
        <h3 className="text-[14.5px] font-semibold" style={{ color: INK }}>
          {t('otpTitle')}
        </h3>
        <p className="break-all text-[11px] leading-relaxed text-stone-500">
          {t('otpSub', { email: email.trim() })}
        </p>
      </div>
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
        className="h-10 w-full rounded-full border border-stone-200/90 bg-white px-4 text-center text-[19px] tracking-[0.4em] text-stone-900 outline-none transition placeholder:text-[12px] placeholder:tracking-normal placeholder:text-stone-400 focus:border-[#9C7A3C]/50 focus:ring-2 focus:ring-[#9C7A3C]/25"
      />
      {error && (
        <p role="alert" className="text-center text-[11px] text-rose-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleVerify}
        disabled={busy || code.length < 6}
        className={ctaClass}
        style={{ backgroundColor: INK }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {t('verifyCta')}
      </button>
      <button
        type="button"
        onClick={() => countdown === 0 && !busy && handleSendCode()}
        disabled={countdown > 0 || busy}
        className="w-full py-0.5 text-center text-[11px] text-stone-400 underline-offset-2 transition hover:text-stone-600 hover:underline disabled:opacity-60 disabled:hover:no-underline"
      >
        {countdown > 0 ? t('resendCountdown', { s: countdown }) : t('resendCta')}
      </button>
    </div>
  );

  const successBody = (
    <div className="space-y-3 text-center">
      <div className="flex justify-center pt-1">{seal(52, true)}</div>
      <div className="space-y-1">
        <h3 className="text-[16px] font-semibold" style={{ color: INK }}>
          {t('successTitle')}
        </h3>
        <p className="break-keep text-[11.5px] leading-relaxed text-stone-500">{t('successSub')}</p>
      </div>
      <button type="button" onClick={() => setOpen(false)} className={ctaClass} style={{ backgroundColor: INK }}>
        {t('successCta')}
      </button>
    </div>
  );

  /* ── layout — one compact invitation card for both breakpoints ─────────── */

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="wc-dialog z-[70] w-full max-w-[min(312px,calc(100vw-3rem))] gap-0 overflow-hidden rounded-[24px] border-0 bg-[#fbf9f4] p-0 ring-1 ring-stone-900/[0.05] sm:max-w-[352px]"
        style={{ boxShadow: '0 32px 80px -24px rgba(28, 25, 23, 0.45)' }}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('headline')}</DialogTitle>
        {closeButton}
        <div className="relative px-6 pb-4 pt-5 sm:px-8 sm:pb-5 sm:pt-6">
          {step !== 'success' && (
            <span className="absolute left-4 top-4 opacity-90 sm:left-5 sm:top-5">{seal(26)}</span>
          )}
          <div className="space-y-3">
            {step !== 'success' && masthead}
            {step === 'email' ? emailForm : step === 'code' ? codeForm : successBody}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
