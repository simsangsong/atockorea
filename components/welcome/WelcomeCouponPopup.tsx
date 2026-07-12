'use client';

/**
 * Welcome-coupon conversion popup (§6 of the welcome-coupon master plan).
 *
 * Shows logged-out visitors a member-invite card ("10% off your first tour"),
 * captures an email, runs the SAME native Supabase email-OTP flow the signup
 * page uses (`signInWithOtp` shouldCreateUser → `verifyOtp type:'email'`), and
 * on confirmation the DB trigger issues the WELCOME10 grant automatically.
 *
 * Visual language (v4, sky-tone pass 2026-07-12 on user request — amber
 * accents dropped): pale sky canvas (#eef6fc) + sky accents, a white TICKET
 * object (notches + perforation + vermilion 낙관 "환영" stamp) carrying the
 * oversized serif offer figure ("10%" / "9折" for zh locales), script
 * "Welcome" wordmark, sparse sparkles, friction-killer chips ("no code —
 * auto-applied", "valid 30 days"). Zero photography — the previous photo band
 * clashed with page heroes. Both breakpoints render a CENTERED dialog (mobile
 * dropped the bottom sheet on user request, 2026-07-11) — desktop two-pane
 * 560px, mobile single-column ≤330px.
 *
 * Triggers (§6.3): first of 5s delay OR 30% scroll; desktop adds exit-intent.
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
import { ArrowRight, Check, Clock, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth-session';
import { useI18n, useTranslations } from '@/lib/i18n';
import { useMediaQuery } from '@/components/home/v2/use-media-query';
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
import { WelcomeTicket, WelcomeSparkles } from './WelcomeTicket';

type Step = 'email' | 'code' | 'success';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SERIF = "Georgia, 'Times New Roman', serif";

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

export default function WelcomeCouponPopup() {
  const { status, session } = useSession();
  const t = useTranslations('welcomeCoupon');
  const { locale } = useI18n();
  const isDesktop = useMediaQuery('(min-width: 640px)');

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
    if (suppressedByStorage()) return;
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

  /** Hide the floating AI-assistant FAB (z-65) while the popup is open — it
   *  was overlapping the email field on mobile (user report, 2026-07-08). */
  useEffect(() => {
    if (open) {
      document.body.setAttribute('data-welcome-popup', 'open');
    } else {
      document.body.removeAttribute('data-welcome-popup');
    }
    return () => document.body.removeAttribute('data-welcome-popup');
  }, [open]);

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
      className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-stone-900/[0.06] text-stone-500 transition hover:bg-stone-900/[0.12] hover:text-stone-800"
    >
      <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
    </button>
  );

  const wordmark = (size: number) => (
    <div className="text-center">
      <p
        className="italic leading-none text-[#1c1917]"
        style={{ fontFamily: SERIF, fontSize: size }}
      >
        Welcome
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-sky-700">
        AtoC Korea
      </p>
    </div>
  );

  const chips = (
    <div className="flex flex-wrap justify-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] text-stone-600 ring-1 ring-stone-200/80">
        <Check className="h-3 w-3 text-sky-600" strokeWidth={2.5} aria-hidden />
        {t('chipAutoApply')}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] text-stone-600 ring-1 ring-stone-200/80">
        <Clock className="h-3 w-3 text-sky-600" strokeWidth={2.5} aria-hidden />
        {t('chipValidity')}
      </span>
    </div>
  );

  const emailForm = (
    <div className="space-y-2.5">
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !busy && handleSendCode()}
        placeholder={t('emailPlaceholder')}
        aria-label={t('emailPlaceholder')}
        className="h-11 w-full rounded-xl border border-stone-200 sm:h-12 bg-white px-4 text-[14px] text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/40"
      />
      {alreadyMember ? (
        <p className="text-[12px] text-stone-500">
          {t('alreadyMember')}{' '}
          <a href="/signin" className="font-semibold text-sky-700 underline underline-offset-2">
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
        className="group flex h-11 w-full sm:h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 text-[14px] font-bold text-white transition hover:bg-sky-500 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {t('cta')}
        {!busy && (
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.5}
            aria-hidden
          />
        )}
      </button>
      <button
        type="button"
        onClick={dismissExplicitly}
        className="w-full py-1.5 text-center text-[12px] text-stone-500 underline-offset-3 transition hover:text-stone-700 hover:underline"
      >
        {t('dismiss')}
      </button>
      <label className="flex cursor-pointer select-none items-center justify-center gap-1.5 py-1.5 text-[12px] text-stone-600 transition hover:text-stone-800">
        <input
          type="checkbox"
          checked={hideToday}
          onChange={(e) => setHideToday(e.target.checked)}
          className="h-4 w-4 accent-sky-600"
        />
        {t('hideToday')}
      </label>
      <p className="text-center text-[10px] leading-relaxed text-stone-500">{t('finePrint')}</p>
    </div>
  );

  const codeForm = (
    <div className="space-y-2.5">
      <div className="space-y-1 text-center sm:text-left">
        <h3 className="text-[16px] font-bold text-[#1c1917]">{t('otpTitle')}</h3>
        <p className="text-[12px] leading-relaxed text-stone-500">
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
        className="h-11 w-full rounded-xl border border-stone-200 sm:h-12 bg-white px-4 text-center text-[20px] tracking-[0.4em] text-stone-900 outline-none transition placeholder:text-[13px] placeholder:tracking-normal placeholder:text-stone-400 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/40"
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
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 sm:h-12 text-[14px] font-bold text-white transition hover:bg-sky-500 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {t('verifyCta')}
      </button>
      <button
        type="button"
        onClick={() => countdown === 0 && !busy && handleSendCode()}
        disabled={countdown > 0 || busy}
        className="w-full py-0.5 text-center text-[12px] text-stone-500 underline-offset-3 transition hover:text-stone-700 hover:underline disabled:opacity-60 disabled:hover:no-underline"
      >
        {countdown > 0 ? t('resendCountdown', { s: countdown }) : t('resendCta')}
      </button>
    </div>
  );

  const successBody = (
    <div className="space-y-3 text-center">
      <h3 className="text-[18px] font-bold text-[#1c1917]">{t('successTitle')}</h3>
      <p className="text-[13px] leading-relaxed text-stone-500">{t('successSub')}</p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-sky-600 sm:h-12 text-[14px] font-bold text-white transition hover:bg-sky-500"
      >
        {t('successCta')}
      </button>
    </div>
  );

  const stepBody = step === 'email' ? emailForm : step === 'code' ? codeForm : successBody;

  /* ── layouts ───────────────────────────────────────────────────────────── */

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="z-[70] w-full max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-3xl border-0 bg-[#eef6fc] p-0 shadow-2xl sm:max-w-[560px]"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{t('headline')}</DialogTitle>
          {closeButton}
          <div className="grid sm:grid-cols-[264px_1fr]">
            <div className="relative flex flex-col justify-center gap-4 border-r border-stone-900/[0.07] px-5 py-7">
              <WelcomeSparkles className="pointer-events-none absolute left-0 top-2 w-full" />
              {wordmark(26)}
              <WelcomeTicket
                figure={figure}
                showOffSuffix={!isZh}
                stamped={step === 'success'}
              />
            </div>
            <div className="flex flex-col justify-center gap-3.5 px-6 py-7">
              {step === 'email' && (
                <div className="space-y-1.5">
                  <h3 className="break-keep text-[19px] font-bold leading-snug tracking-tight text-[#1c1917]">
                    {t('headline')}
                  </h3>
                  <p className="break-keep text-[13px] leading-relaxed text-stone-500">{t('sub')}</p>
                </div>
              )}
              {step === 'email' && chips}
              {stepBody}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[70] w-full max-w-[min(330px,calc(100vw-2.5rem))] gap-0 overflow-hidden rounded-3xl border-0 bg-[#eef6fc] p-0 shadow-2xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('headline')}</DialogTitle>
        {closeButton}
        <div className="relative px-5 pb-5 pt-7">
          {/* pr-14 keeps the right-side sparkle out from under the close button */}
          <WelcomeSparkles className="pointer-events-none absolute left-0 top-1.5 w-full pr-14" />
          <div className="space-y-4">
            {wordmark(24)}
            <div className="px-1">
              <WelcomeTicket
                figure={figure}
                showOffSuffix={!isZh}
                stamped={step === 'success'}
              />
            </div>
            {step === 'email' && (
              <p className="break-keep px-1 text-center text-[12px] leading-relaxed text-stone-500">
                {t('sub')}
              </p>
            )}
            {step === 'email' && chips}
            <div>{stepBody}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
