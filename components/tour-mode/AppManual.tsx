'use client';

/**
 * A5 — in-app usage manual (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * Two variants from one content source (lib/tour-room/appManual):
 *   auto   — first room entry only (localStorage-gated) → bottom sheet with
 *            the full manual and one CTA. Never re-opens after dismissal.
 *   inline — an always-available Settings card. A4 (plan §11.A): collapsed by
 *            default — the icon + title row stays visible, tapping it expands
 *            the accordion body.
 */

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Sheet from '@/components/tour-mode/Sheet';
import {
  MANUAL_CTA,
  MANUAL_SEEN_KEY,
  MANUAL_TITLE,
  manualSections,
  type ManualKind,
} from '@/lib/tour-room/appManual';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

function SectionList({ kind, locale }: { kind: ManualKind; locale: RoomLocale }) {
  return (
    <div className="flex flex-col gap-3">
      {manualSections(kind).map((section) => (
        <div key={section.key} className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-xl leading-none">
            {section.emoji}
          </span>
          <div className="min-w-0">
            <p className="tr-card-text font-semibold text-[var(--tr-ink)]">{section.title[locale]}</p>
            <p className="tr-meta mt-0.5 leading-relaxed text-[var(--tr-ink-2)]">{section.body[locale]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppManual({
  variant,
  kind,
  locale,
  theme = 'light',
}: {
  variant: 'auto' | 'inline';
  kind: ManualKind;
  locale: RoomLocale;
  /** auto variant only — the sheet renders OUTSIDE RoomShell's `.tr-root`
   *  wrapper, so it must re-scope the token layer itself (like
   *  PlanNudgeModal); without it every tr-* var is undefined and the sheet
   *  paints transparent on top of the room. */
  theme?: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  // A4 — inline accordion state: collapsed by default so the Settings tab
  // stays scannable; the icon + title header is always visible.
  const [expanded, setExpanded] = useState(false);

  // auto: first visit only — the flag is written on dismiss, not on show, so
  // an accidental reload before reading doesn't burn the one-time slot.
  useEffect(() => {
    if (variant !== 'auto') return;
    try {
      if (!window.localStorage.getItem(MANUAL_SEEN_KEY)) setOpen(true);
    } catch {
      /* storage unavailable → stay closed; the Settings card still exists */
    }
  }, [variant]);

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(MANUAL_SEEN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  if (variant === 'inline') {
    return (
      <section className="tr-card" data-testid="app-manual-inline">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-h-[52px] w-full items-center gap-2 px-4 py-3 text-left"
          data-testid="app-manual-toggle"
        >
          <h3 className="tr-card-text min-w-0 flex-1 font-semibold text-[var(--tr-ink)]">
            📖 {MANUAL_TITLE[locale]}
          </h3>
          <ChevronDown
            size={18}
            strokeWidth={2.25}
            aria-hidden
            className={`shrink-0 text-[var(--tr-ink-3)] transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expanded && (
          <div className="px-4 pb-4" data-testid="app-manual-body">
            <SectionList kind={kind} locale={locale} />
          </div>
        )}
      </section>
    );
  }

  if (!open) return null;
  return (
    // `.tr-root.dark` matches the same-element rule in tour-room-theme.css;
    // display:contents keeps the wrapper out of layout while the CSS vars
    // still cascade into the fixed-position sheet.
    <div className={`tr-root contents${theme === 'dark' ? ' dark' : ''}`}>
      <Sheet open onClose={dismiss} title={MANUAL_TITLE[locale]}>
        <div className="max-h-[60vh] overflow-y-auto pb-2" data-testid="app-manual-auto">
          <SectionList kind={kind} locale={locale} />
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full rounded-2xl bg-[var(--tr-accent)] py-3.5 text-base font-bold text-[var(--tr-bubble-me-ink)]"
          data-testid="app-manual-dismiss"
        >
          {MANUAL_CTA[locale]}
        </button>
      </Sheet>
    </div>
  );
}
