'use client';

/**
 * Room-entry planner nudge.
 *
 * Most guests tap the invite email's primary "Open my tour room" button and
 * never notice the secondary plan link — so the day plan never gets set and the
 * driver has to sort the route out in person the next day. This modal fires on
 * room entry (pre-tour, lead guest, plan not yet finalized) and points straight
 * at the /plan editor. Shown on every entry until the plan is finalized
 * (submitted / guide-confirmed / delegated) — no localStorage suppression, by
 * product decision.
 *
 * Look: light-grey card + black CTA (the room's neutral ink palette), centered
 * dialog with backdrop fade + spring pop, Escape / backdrop / "later" to close.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconClose, IconPlanEdit } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

interface NudgeCopy {
  title: string;
  body: string;
  cta: string;
  later: string;
  close: string;
}

const COPY: Record<RoomLocale, NudgeCopy> = {
  en: {
    title: 'Plan tomorrow’s route',
    body: 'Set your stops now so your driver and guide know exactly where to go — less back-and-forth on the day, more time enjoying it.',
    cta: 'Plan my day',
    later: 'Maybe later',
    close: 'Close',
  },
  ko: {
    title: '내일 일정을 미리 정해요',
    body: '가고 싶은 곳을 미리 정해두면 기사·가이드가 동선을 정확히 알 수 있어요. 당일 소통이 줄고 여행에 더 집중할 수 있어요.',
    cta: '일정 짜기',
    later: '나중에 하기',
    close: '닫기',
  },
  ja: {
    title: '明日のルートを決めましょう',
    body: '行きたい場所を今決めておくと、ドライバーとガイドがルートを正確に把握できます。当日のやり取りが減り、旅を存分に楽しめます。',
    cta: 'プランを作る',
    later: 'あとで',
    close: '閉じる',
  },
  zh: {
    title: '先规划明天的行程',
    body: '现在定好想去的地点，司机和导游就能准确掌握路线——当天沟通更少，玩得更尽兴。',
    cta: '规划行程',
    later: '稍后再说',
    close: '关闭',
  },
  es: {
    title: 'Planea la ruta de mañana',
    body: 'Define tus paradas ahora para que tu conductor y guía sepan adónde ir: menos coordinación el día del tour y más tiempo para disfrutarlo.',
    cta: 'Planear mi día',
    later: 'Quizás después',
    close: 'Cerrar',
  },
};

interface PlanStatusResponse {
  day_plan: { status?: string } | null;
  viewer: { can_edit?: boolean; is_lead?: boolean };
  tour: { guide_curated?: boolean };
}

/** Finalized = submitted, guide-confirmed/live/done, or delegated to the guide. */
function isPlanFinalized(data: PlanStatusResponse): boolean {
  const status = data.day_plan?.status;
  if (data.tour?.guide_curated) return true;
  return status === 'guest_submitted' || status === 'guide_confirmed' || status === 'live' || status === 'done';
}

export default function PlanNudgeModal({
  bookingId,
  roomSession,
  locale,
  theme,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
  /** Room theme — the modal is a sibling of RoomShell, so it carries its own
   *  `.dark` class for the `.dark .tr-root` token cascade. */
  theme: 'light' | 'dark';
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const copy = COPY[locale] ?? COPY.en;
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dismissedRef = useRef(false);

  // Decide visibility from the day-plan status (only the lead guest, only while
  // the plan is still open). Runs once per room entry.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/plan`, {
          headers: { 'x-tour-room-auth': roomSession },
        });
        if (!res.ok) return;
        const data = (await res.json()) as PlanStatusResponse;
        if (cancelled || dismissedRef.current) return;
        const canPlan = Boolean(data.viewer?.can_edit || data.viewer?.is_lead);
        if (canPlan && !isPlanFinalized(data)) setOpen(true);
      } catch {
        /* fail silent — the Home tab still carries the plan tile */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, roomSession]);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissedRef.current = true;
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const dismiss = () => {
    dismissedRef.current = true;
    setOpen(false);
  };

  const openPlanner = () => {
    dismissedRef.current = true;
    setOpen(false);
    router.push(`/tour-mode/plan/${encodeURIComponent(bookingId)}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center px-5 ${theme === 'dark' ? 'dark' : ''}`}
          data-testid="plan-nudge"
        >
          <motion.button
            type="button"
            aria-label={copy.close}
            className="absolute inset-0 bg-black/45"
            onClick={dismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-nudge-title"
            tabIndex={-1}
            className="tr-root relative w-full max-w-sm rounded-[22px] bg-[var(--tr-surface-2)] p-5 text-center outline-none"
            style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label={copy.close}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-black/5"
            >
              <IconClose size={18} aria-hidden />
            </button>

            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]">
              <IconPlanEdit size={22} aria-hidden />
            </span>
            <h2 id="plan-nudge-title" className="mt-3 text-[19px] font-bold leading-snug text-[var(--tr-ink)]">
              {copy.title}
            </h2>
            <p className="tr-card-text mt-2 leading-relaxed text-[var(--tr-ink-2)]">{copy.body}</p>

            <button
              type="button"
              onClick={openPlanner}
              className="tr-body mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99]"
            >
              <IconPlanEdit size={17} aria-hidden />
              {copy.cta}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="tr-label mt-2 min-h-[40px] w-full font-semibold text-[var(--tr-ink-3)]"
            >
              {copy.later}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
