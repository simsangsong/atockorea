'use client';

import * as React from 'react';
import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

export interface MyPageSectionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional decorative icon shown on the left of the title (circle-cropped). */
  icon?: React.ReactNode;
  /** Section heading. Rendered as `h2` by default. */
  title?: React.ReactNode;
  /** Optional tail content rendered on the right side of the heading row (e.g. "Saved" badge). */
  trailing?: React.ReactNode;
  /** Optional short description under the title. */
  description?: React.ReactNode;
  /** Override the inner padding. */
  padding?: string;
}

/**
 * Shared surface wrapper for My Page sections. Encapsulates `MYPAGE_SURFACE_PAGE`
 * plus consistent typography, so pages do not hand-roll `rounded-[30px] border ...`.
 */
export function MyPageSection({
  icon,
  title,
  trailing,
  description,
  padding = 'p-6',
  className,
  children,
  ...rest
}: MyPageSectionProps) {
  return (
    <section className={cn(MYPAGE_SURFACE_PAGE, padding, className)} {...rest}>
      {(title || trailing) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                // A1.7 — long unbreakable tokens (German compounds like
                // "Benachrichtigungseinstellungen", 30 chars) must wrap rather
                // than overflow the card on a 375px screen. `break-words` only
                // affects tokens wider than the container, so every other
                // locale is untouched. The parent already has `min-w-0`.
                <h2 className="text-[16px] font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere] md:text-[17px]">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-[13px] leading-snug text-slate-600">{description}</p>
              ) : null}
            </div>
          </div>
          {trailing ? <div className="flex-shrink-0">{trailing}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
