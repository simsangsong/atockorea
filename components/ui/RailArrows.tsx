'use client';

/**
 * Prev / next buttons for a horizontal rail.
 *
 * 🔴 Why this exists: a vertical mouse wheel over a container that can only
 * scroll horizontally scrolls the **page**, not the container (measured in
 * Chromium, headless and headed). `.rail-scrollbar` gave those rails a bar to
 * drag; these buttons give them a target to click, which is what desktop
 * visitors actually reach for on a card shelf.
 *
 * Contract
 *  - Desktop only. `.rail-arrow` is `display: none` outside
 *    `(hover: hover) and (pointer: fine)`, so touch users get no stray tap
 *    targets and no phantom tab stops (`display:none` leaves the tab order).
 *  - A direction with nothing left to scroll renders **nothing** — a dead
 *    button that looks alive is worse than no button.
 *  - The parent must be positioned (`relative`); the buttons are absolute.
 *
 * Usage
 *   const railRef = useRef<HTMLDivElement>(null);
 *   <div className="relative">
 *     <div ref={railRef} className="rail-scrollbar flex overflow-x-auto …">…</div>
 *     <RailArrows scrollerRef={railRef} />
 *   </div>
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
/*
 * 🔴 Locale comes from the URL, NOT from `useI18n`. `lib/i18n` statically
 * imports every `messages/*.json` (169 KB of marketing copy), and this
 * component is reachable from `app/(app)/tour-mode` through the stop drawer —
 * `__tests__/audit/routeGroupIsolation.test.ts` fails the moment that edge
 * exists. `lib/locale` is the payload-free half.
 *
 * Safe against hydration: the buttons render `null` until the first client-side
 * measurement, so a label is never produced during the server pass (where the
 * middleware rewrite makes `usePathname()` disagree with the browser URL).
 */
import { appLocaleFromPathSegment } from '@/lib/locale';
import { cn } from '@/lib/utils';

/** Sub-pixel slack — `scrollLeft` is fractional on zoomed / hi-dpi displays. */
const EDGE_SLACK = 2;

/**
 * 🔴 Don't arm the buttons for a rail that barely overflows. Measured on
 * `/tours/list`: three shelves hide exactly **12px** (the trailing spacer), and
 * arrows there were pure noise — a full-size button promising a page of cards
 * that do not exist. The slim bar already covers those. 32px ≈ "you cannot see
 * a whole thing".
 */
const MIN_ARROW_OVERFLOW = 32;

const LABELS: Record<string, { prev: string; next: string }> = {
  en: { prev: 'Previous', next: 'Next' },
  ko: { prev: '이전', next: '다음' },
  ja: { prev: '前へ', next: '次へ' },
  zh: { prev: '上一个', next: '下一个' },
  'zh-TW': { prev: '上一個', next: '下一個' },
  es: { prev: 'Anterior', next: 'Siguiente' },
  de: { prev: 'Zurück', next: 'Weiter' },
  fr: { prev: 'Précédent', next: 'Suivant' },
  it: { prev: 'Precedente', next: 'Successivo' },
  ru: { prev: 'Назад', next: 'Вперёд' },
};

export type RailArrowsProps = {
  scrollerRef: React.RefObject<HTMLElement | null>;
  /** How much of the visible width one click travels. */
  step?: number;
  /** Extra classes on both buttons (use for vertical placement). */
  className?: string;
  /** Override the button diameter. Defaults to a 36px circle. */
  size?: 'sm' | 'md';
  /** Override the accessible names (admin surfaces are Korean-only). */
  labels?: { prev: string; next: string };
};

export function RailArrows({
  scrollerRef,
  step = 0.8,
  className,
  size = 'md',
  labels,
}: RailArrowsProps) {
  const pathname = usePathname();
  const [reach, setReach] = useState({ prev: false, next: false });
  // Keep the latest measurement out of the effect deps so the observers are
  // wired exactly once per scroller.
  const reachRef = useRef(reach);
  reachRef.current = reach;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const armed = max >= MIN_ARROW_OVERFLOW;
      const next = {
        prev: armed && el.scrollLeft > EDGE_SLACK,
        next: armed && el.scrollLeft < max - EDGE_SLACK,
      };
      const now = reachRef.current;
      if (now.prev !== next.prev || now.next !== next.next) setReach(next);
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });

    // Content width changes without a scroll event: images finish loading,
    // a filter drops cards, the viewport resizes. Watch the rail *and* its
    // content box — observing only the rail misses a child growing.
    // ⚠ Guarded: jsdom has no ResizeObserver, and an unguarded `new` here threw
    // inside three unrelated component suites the moment this shipped.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      el.removeEventListener('scroll', measure);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', measure);
    };
  }, [scrollerRef]);

  const nudge = useCallback(
    (dir: 1 | -1) => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollBy({ left: dir * el.clientWidth * step, behavior: 'smooth' });
    },
    [scrollerRef, step],
  );

  if (!reach.prev && !reach.next) return null;

  const locale = appLocaleFromPathSegment((pathname || '/').split('/')[1] ?? '');
  const text = labels ?? (locale ? LABELS[locale] : undefined) ?? LABELS.en;
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const base = cn(
    'rail-arrow absolute top-1/2 z-10 -translate-y-1/2 items-center justify-center rounded-full',
    'border border-stone-900/10 bg-white/95 text-stone-700 shadow-[0_8px_22px_-10px_rgba(28,25,23,0.55)]',
    'backdrop-blur-[2px] transition hover:bg-white hover:text-stone-900',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30',
    box,
    className,
  );

  return (
    <>
      {reach.prev ? (
        <button type="button" aria-label={text.prev} onClick={() => nudge(-1)} className={cn(base, 'left-1.5')}>
          <ChevronLeft className={icon} aria-hidden />
        </button>
      ) : null}
      {reach.next ? (
        <button type="button" aria-label={text.next} onClick={() => nudge(1)} className={cn(base, 'right-1.5')}>
          <ChevronRight className={icon} aria-hidden />
        </button>
      ) : null}
    </>
  );
}

/**
 * Rail + arrows in one node, for callers that have no ref to spare — including
 * **server** components, since `children` is rendered on the server and passed
 * through as a slot.
 *
 * Adds one wrapper `<div class="relative">`; pass `wrapperClassName` when the
 * rail was a flex/grid child and that box needs to inherit the layout classes.
 */
export function ScrollRail({
  children,
  className,
  wrapperClassName,
  arrowSize,
  arrowClassName,
  step,
  labels,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  wrapperClassName?: string;
  arrowSize?: RailArrowsProps['size'];
  arrowClassName?: string;
  step?: number;
  labels?: RailArrowsProps['labels'];
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={cn('relative', wrapperClassName)}>
      <div ref={ref} className={cn('rail-scrollbar', className)} {...rest}>
        {children}
      </div>
      <RailArrows scrollerRef={ref} size={arrowSize} className={arrowClassName} step={step} labels={labels} />
    </div>
  );
}

export default RailArrows;
