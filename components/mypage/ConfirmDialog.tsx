'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Lightweight confirm modal for My Page flows (cancel booking, remove wishlist,
 * sign-out). Built on the shared shadcn Dialog so focus trapping, ESC, and
 * backdrop click-out come for free.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [internalBusy, setInternalBusy] = React.useState(false);
  const busy = loading || internalBusy;

  const handleConfirm = async () => {
    try {
      setInternalBusy(true);
      await onConfirm();
    } finally {
      setInternalBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-slate-900">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-[13px] leading-relaxed text-slate-600">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className={cn(
              'inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors',
              'hover:bg-slate-50',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className={cn(
              'inline-flex min-h-[40px] items-center justify-center rounded-xl px-4 text-[13px] font-semibold text-white transition-colors',
              destructive
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-400'
                : 'bg-slate-900 hover:bg-slate-800 focus-visible:ring-slate-400',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
