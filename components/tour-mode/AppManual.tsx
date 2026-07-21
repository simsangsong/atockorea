'use client';

/**
 * A5 — in-app usage manual (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * Two variants from one content source (lib/tour-room/appManual):
 *   auto   — first room entry only (localStorage-gated) → bottom sheet with
 *            the full manual and one CTA. Never re-opens after dismissal.
 *   inline — an always-available Settings card (details/summary accordion).
 */

import { useEffect, useState } from 'react';
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
}: {
  variant: 'auto' | 'inline';
  kind: ManualKind;
  locale: RoomLocale;
}) {
  const [open, setOpen] = useState(false);

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
      <section className="tr-card p-4" data-testid="app-manual-inline">
        <h3 className="tr-card-text font-semibold text-[var(--tr-ink)]">📖 {MANUAL_TITLE[locale]}</h3>
        <div className="mt-3">
          <SectionList kind={kind} locale={locale} />
        </div>
      </section>
    );
  }

  if (!open) return null;
  return (
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
  );
}
