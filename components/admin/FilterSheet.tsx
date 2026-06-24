'use client';

import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * Bottom-sheet filter container (W1.8 / spec §4.1). Holds the full filter
 * controls on mobile (where a sticky chip bar isn't enough), with a drag handle
 * and a sticky footer slot for apply/reset.
 */
export function FilterSheet({
  open,
  onOpenChange,
  title = '필터',
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'max-h-[90dvh] gap-3 overflow-y-auto rounded-t-2xl bg-admin-surface-raised px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2',
          className,
        )}
      >
        <div className="mx-auto h-1 w-9 flex-shrink-0 rounded-full bg-slate-200" />
        <SheetTitle className="px-1 text-base font-semibold text-slate-900">{title}</SheetTitle>
        <div className="space-y-4 px-1">{children}</div>
        {footer ? <div className="sticky bottom-0 px-1 pt-2">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
