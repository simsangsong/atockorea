'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Common admin page chrome (W1.3 / spec §3.2). Gives every page the same 4-layer
 * structure so the 12 non-responsive pages reach mobile parity in one line:
 *   ① sticky header (optional back, title/description, actions)
 *   ② optional horizontally-scrolling filter-chip bar
 *   ③ scrolling content
 *   ④ optional sticky action footer (safe-area aware)
 *
 * Rendered inside the admin layout's <main> (which provides p-4/md:p-5 and the
 * bottom-nav safe-area padding); the header/footer use negative margins to span
 * edge-to-edge and stick to the scroll area. List roots omit `backHref` (the home
 * tab is the anchor); detail pages pass it. Filter state should live in the URL
 * (see useUrlFilters).
 */
export function AdminPageShell({
  title,
  description,
  backHref,
  actions,
  filterBar,
  footer,
  children,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  actions?: ReactNode;
  filterBar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-admin-border bg-admin-surface/95 backdrop-blur md:-mx-5 md:-mt-5">
        <div className="flex min-h-[52px] items-center gap-2 px-4 md:px-5">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="뒤로"
              className="-ml-1 flex size-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="size-5" />
            </Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
            {description ? <p className="truncate text-xs text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        {filterBar ? (
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 md:px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterBar}
          </div>
        ) : null}
      </header>

      <div className={cn('flex-1 pt-4 md:pt-5', footer ? 'pb-24' : null, contentClassName)}>
        {children}
      </div>

      {footer ? (
        <footer className="sticky bottom-0 z-20 -mx-4 border-t border-admin-border bg-admin-surface/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:-mx-5 md:px-5">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
