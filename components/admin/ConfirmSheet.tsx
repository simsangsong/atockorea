'use client';

import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Bottom-sheet confirmation for money actions (W1.8 / spec §6.2). Replaces
 * window.confirm() — which iOS WebView silently returns true for, firing money
 * actions with no dialog. Shows the amount prominently and an outcome note; the
 * confirm button disables itself on first tap (idempotent).
 *
 * For non-money confirmations prefer the centered ConfirmDialog.
 */
const NOTE_TONE: Record<'neutral' | 'warning' | 'danger', string> = {
  neutral: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
};

export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  amount,
  note,
  noteTone = 'neutral',
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  confirming = false,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  amount?: ReactNode;
  note?: ReactNode;
  noteTone?: 'neutral' | 'warning' | 'danger';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirming?: boolean;
  destructive?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto rounded-t-2xl bg-admin-surface-raised px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2"
      >
        <div className="mx-auto h-1 w-9 flex-shrink-0 rounded-full bg-slate-200" />
        <SheetTitle className="px-1 text-base font-semibold text-slate-900">{title}</SheetTitle>
        {subtitle ? <p className="px-1 text-sm text-slate-500">{subtitle}</p> : null}
        {amount != null ? (
          <div className="px-1 text-[28px] font-extrabold leading-tight tabular-nums text-slate-900">
            {amount}
          </div>
        ) : null}
        {note ? (
          <div className={cn('rounded-design-sm px-3 py-2 text-sm', NOTE_TONE[noteTone])}>{note}</div>
        ) : null}
        <div className="flex gap-2 px-1 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={cn('flex-1', destructive && 'bg-red-600 text-white hover:bg-red-700')}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirmLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
