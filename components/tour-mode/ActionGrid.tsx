'use client';

/**
 * KakaoTalk-grade attachment panel for the operator surfaces.
 *
 * The cockpit used to keep 12+ identical grey buttons permanently open above
 * the composer, which is a wall to scan and steals the chat's vertical space in
 * a moving vehicle. This is the messenger convention instead: a single "+"
 * beside the input, folded by default, opening a 4-column grid of round tiles —
 * one colour per action, label underneath.
 *
 * Colour is the point. A driver glancing down for half a second finds "주차핀"
 * by its blue pin, not by reading six Korean labels in a grey grid.
 *
 * Tones live in tour-room-theme.css (`.tr-tone-*`) so the class-scoped dark
 * theme can swap tile/glyph pairs; see the block at the end of that file.
 */

import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ActionTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'cyan'
  | 'slate'
  | 'orange';

export interface ActionGridItem {
  key: string;
  label: string;
  Icon: LucideIcon;
  tone: ActionTone;
  onClick: () => void;
  /** Rendered small under the label — e.g. the live sharing state. */
  hint?: string | null;
  /** Dims the tile and blocks the tap (kept visible so the layout is stable). */
  disabled?: boolean;
  /** A soft dot on the tile, for "this is currently working". */
  active?: boolean;
  /**
   * Toggle semantics. Distinct from `active`: a share button can be pressed
   * (the operator turned it on) while not yet active (no position accepted).
   */
  pressed?: boolean;
  /**
   * Toggles keep the tray open so the operator sees the state flip; one-shot
   * actions close it like a messenger attachment panel does.
   */
  keepOpen?: boolean;
}

export default function ActionGrid({
  items,
  open,
  onClose,
  columns = 4,
  labelledBy,
}: {
  items: ActionGridItem[];
  open: boolean;
  onClose: () => void;
  columns?: 3 | 4;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape closes, matching Sheet. The panel is inline (not modal) so it does
  // NOT trap focus or lock the body — the composer stays reachable, which is
  // the whole point of an attachment tray.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="group"
      aria-labelledby={labelledBy}
      data-testid="action-grid"
      // max-h + scroll: a private tour carries 15 tiles (4 rows), and the home
      // indicator would otherwise clip the last row's labels.
      className="tr-anim-panel-in max-h-[46dvh] overflow-y-auto border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 pt-3.5"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className={`grid gap-x-1 gap-y-3 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            aria-pressed={item.pressed}
            onClick={() => {
              item.onClick();
              if (!item.keepOpen) onClose();
            }}
            data-testid={`action-grid-${item.key}`}
            className="group flex min-h-[76px] flex-col items-center gap-1.5 rounded-2xl py-1 disabled:opacity-40"
          >
            <span
              className={`tr-tone tr-tone-${item.tone} relative flex h-[52px] w-[52px] items-center justify-center rounded-full transition-transform group-active:scale-90`}
            >
              <item.Icon size={23} strokeWidth={2} aria-hidden />
              {item.active ? (
                <span
                  aria-hidden
                  data-testid={`action-grid-active-${item.key}`}
                  className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-[var(--tr-surface)] bg-[var(--tr-safe)]"
                />
              ) : null}
            </span>
            <span className="text-cjk-safe max-w-full px-0.5 text-[12px] font-semibold leading-tight text-[var(--tr-ink)]">
              {item.label}
            </span>
            {item.hint ? (
              <span className="text-cjk-safe max-w-full px-0.5 text-[10px] font-medium leading-none text-[var(--tr-ink-3)]">
                {item.hint}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
