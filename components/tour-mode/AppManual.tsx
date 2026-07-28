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
import { IconChevronRight, IconManual, IconScrollDown, TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';
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
          <span aria-hidden className="tr-display mt-0.5 leading-none">
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
  /**
   * 'inline' — the Settings accordion.
   * 'button' — a physical button that OPENS the sheet on demand. The home
   *            dashboard's door, and now the only thing that shows the manual
   *            without the guest asking for it… by them asking for it.
   */
  variant: 'inline' | 'button';
  kind: ManualKind;
  locale: RoomLocale;
  /** button variant only — the sheet renders OUTSIDE RoomShell's `.tr-root`
   *  wrapper, so it must re-scope the token layer itself (like
   *  PlanNudgeModal); without it every tr-* var is undefined and the sheet
   *  paints transparent on top of the room. */
  theme?: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  // A4 — inline accordion state: collapsed by default so the Settings tab
  // stays scannable; the icon + title header is always visible.
  const [expanded, setExpanded] = useState(false);

  /**
   * 🔴 The auto-open is gone (owner's call, 2026-07-28).
   *
   * It was the FIRST thing a guest met: 2,302 characters of prose in a modal,
   * six sections, 216px still below the fold, and one way out at the bottom.
   * Measured on the UX walk. That screen lands while someone is standing at a
   * pickup point with a suitcase — nobody reads it, and the app's first
   * impression is a wall of text with a dismiss button.
   *
   * The content did not get worse; it got a door instead of an ambush. The
   * home dashboard carries a physical button to it, Settings keeps the
   * accordion, and both open the SAME source (lib/tour-room/appManual).
   *
   * `MANUAL_SEEN_KEY` still exists and is still written on dismiss — nothing
   * reads it to decide whether to show the sheet any more, but a returning
   * guest's flag is not something to throw away silently in case a future
   * "first time?" hint wants it.
   */

  const openSheet = () => setOpen(true);

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(MANUAL_SEEN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  if (variant === 'inline') {
    // R4 — this is the first-run onboarding door, but it used to be a grey
    // card that read like a divider. It is now a physical button in the
    // accent material (tr-btn-physical): pressable depth, gloss chip, and
    // the app's signature color, so it is unmistakably a thing to tap.
    return (
      <section data-testid="app-manual-inline">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="tr-btn-physical flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
          style={{ background: 'var(--tr-chip-grad-accent)' }}
          data-testid="app-manual-toggle"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/15"
            aria-hidden
          >
            <IconManual size={TR_ICON.action} strokeWidth={TR_STROKE.default} />
          </span>
          <h3 className="tr-card-text text-cjk-safe min-w-0 flex-1 font-bold">
            {MANUAL_TITLE[locale]}
          </h3>
          <IconScrollDown
            size={TR_ICON.action}
            strokeWidth={TR_STROKE.default}
            aria-hidden
            className={`shrink-0 opacity-80 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expanded && (
          <div className="tr-card mt-1.5 px-4 py-4" data-testid="app-manual-body">
            <SectionList kind={kind} locale={locale} />
          </div>
        )}
      </section>
    );
  }

  if (variant === 'button') {
    return (
      <>
        <button
          type="button"
          onClick={openSheet}
          className="tr-btn-physical flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
          style={{ background: 'var(--tr-chip-grad-accent)' }}
          data-testid="app-manual-open"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/15"
            aria-hidden
          >
            <IconManual size={TR_ICON.action} strokeWidth={TR_STROKE.default} />
          </span>
          <h3 className="tr-card-text text-cjk-safe min-w-0 flex-1 font-bold">{MANUAL_TITLE[locale]}</h3>
          <IconChevronRight size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden className="shrink-0 opacity-80" />
        </button>
        {open && (
          <div className={`tr-root contents${theme === 'dark' ? ' dark' : ''}`}>
            <Sheet open onClose={dismiss} title={MANUAL_TITLE[locale]}>
              <div className="max-h-[70vh] overflow-y-auto pb-2" data-testid="app-manual-auto">
                <SectionList kind={kind} locale={locale} />
              </div>
            </Sheet>
          </div>
        )}
      </>
    );
  }

  // (the old `auto` branch lived here — deleted with the behaviour)
  return null;
}
