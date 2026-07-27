'use client';

/**
 * O4 / U-D5 — the one chat-list row.
 *
 * The guide console's 대화 tab and the ops center's room monitoring had grown
 * the same row twice: hue avatar, name + party size, inline badges, a
 * one-line preview, a right column with the time and an unread indicator.
 * They already looked alike, which is exactly the trap — two implementations
 * that agree today and drift on the next change, and every fix has to be made
 * in both or it is only half made.
 *
 * The differences that remain are real, so they are props rather than
 * branches inside the component:
 *   · the guide shows an unread DOT ("answer needed"), ops shows a COUNT
 *   · the guide has a trailing ⋯ that opens the room's action sheet
 *   · ops can attach an SOS strip under the row
 *   · one navigates (href), the other opens a drawer (onClick)
 *
 * Layout notes worth keeping: `min-w-0` on the middle column is what stops a
 * long Korean name from pushing the time off-screen (CLAUDE.md P1-5), and the
 * row keeps a 64px min height so the whole thing stays a comfortable target.
 */

import type { ReactNode } from 'react';
import { TR_ICON } from '@/components/tour-mode/icons';

export interface ChatListRowProps {
  /** Stable hue (lib/tour-room/hue) so a room keeps its colour everywhere. */
  hue: number;
  /** Avatar glyph — the initial, or something like 🆘 when a room is shouting. */
  avatar: ReactNode;
  title: string;
  /** Muted text next to the title: party size, language. */
  meta?: ReactNode;
  /** Inline chips after the meta (LIVE, plan status, boarding tick). */
  badges?: ReactNode;
  /** One-line preview of the last message. */
  preview: ReactNode;
  /** Preview reads as unanswered — the guide's "손님이 마지막" case. */
  previewEmphasised?: boolean;
  time?: string | null;
  /** Right column under the time: a dot, a count badge, nothing. */
  indicator?: ReactNode;
  /** Trailing control outside the tap target (the ⋯ sheet opener). */
  action?: ReactNode;
  /** Full-width strip under the row (SOS detail). */
  footer?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Danger framing for the whole row (an active SOS). */
  alarm?: boolean;
  testId?: string;
  linkTestId?: string;
}

export default function ChatListRow({
  hue,
  avatar,
  title,
  meta,
  badges,
  preview,
  previewEmphasised,
  time,
  indicator,
  action,
  footer,
  href,
  onClick,
  alarm,
  testId,
  linkTestId,
}: ChatListRowProps) {
  const body = (
    <>
      <span
        className="tr-body flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-white"
        style={{ backgroundColor: `hsl(${hue} 55% 52%)` }}
        aria-hidden
      >
        {avatar}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="tr-card-text truncate font-bold text-[var(--tr-ink)]">{title}</span>
          {meta && <span className="tr-meta tr-num shrink-0 text-[var(--tr-ink-3)]">{meta}</span>}
          {badges}
        </span>
        <span
          className={`tr-meta mt-0.5 line-clamp-1 ${
            previewEmphasised ? 'font-semibold text-[var(--tr-ink)]' : 'text-[var(--tr-ink-3)]'
          }`}
        >
          {preview}
        </span>
      </span>
      {(time || indicator) && (
        <span className="ml-1 flex shrink-0 flex-col items-end gap-1.5 self-start pt-1.5">
          {time && <span className="tr-meta tr-num text-[var(--tr-ink-3)]">{time}</span>}
          {indicator}
        </span>
      )}
    </>
  );

  const tapClass =
    'flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2 pl-3.5 text-left active:bg-[var(--tr-surface-2)]';

  return (
    <div
      className={alarm ? 'bg-[var(--tr-danger-soft)]' : undefined}
      data-testid={testId}
      style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${TR_ICON.tile + 44}px` }}
    >
      <div className="flex items-center">
        {href ? (
          <a href={href} className={tapClass} data-testid={linkTestId}>
            {body}
          </a>
        ) : (
          <button type="button" onClick={onClick} className={tapClass} data-testid={linkTestId}>
            {body}
          </button>
        )}
        {action}
      </div>
      {footer}
    </div>
  );
}
