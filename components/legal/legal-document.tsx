import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';

/** Page background — aligned with checkout / reviews premium shell */
export const LEGAL_DOC_MAIN_CLASS =
  'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30 pt-20 pb-24';

/** Readable column width for long-form legal copy */
export function LegalDocContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('container mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}

export function LegalDocTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        'text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.65rem] sm:leading-tight',
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function LegalDocEffectiveDate({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'mt-2 text-[13px] leading-snug text-slate-600 sm:text-[14px]',
        '[&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-slate-300 [&_a]:underline-offset-[3px] [&_a]:transition-colors hover:[&_a]:decoration-slate-900',
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Body typography: compact body, clear hierarchy, subdued lists — closer to Stripe/Apple legal than blog cards.
 */
export const legalBodyTypography = cn(
  'space-y-3 text-pretty text-[13px] leading-relaxed text-slate-700 sm:text-[14px] sm:leading-[1.65]',
  '[&_strong]:font-semibold [&_strong]:text-slate-900',
  '[&_ul]:my-0 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-slate-400',
  '[&_li]:leading-snug',
  '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:scroll-mt-28 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-slate-950 sm:[&_h3]:text-[14px]',
  '[&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-slate-300 [&_a]:underline-offset-[3px] [&_a]:transition-colors hover:[&_a]:decoration-slate-900',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] sm:[&_table]:text-[14px]',
  '[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50/95 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-800',
  '[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-slate-700',
);

/** Single panel with stacked articles + hairline dividers */
export function LegalDocumentShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        MYPAGE_SURFACE_PAGE,
        'relative overflow-hidden px-5 py-4 sm:px-8 sm:py-6',
        'before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-300/35 before:to-transparent',
      )}
    >
      <div className="divide-y divide-slate-200/75">{children}</div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-28 py-5 sm:py-6">
      <h2 className="mb-3 text-[14px] font-semibold tracking-tight text-slate-950 sm:text-[15px]">{title}</h2>
      <div className={legalBodyTypography}>{children}</div>
    </section>
  );
}

export const legalDocFooterNavClass =
  'mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-200/75 pt-6 text-[13px] font-medium';

export const legalDocFooterLinkClass =
  'text-slate-900 underline decoration-slate-300 underline-offset-[3px] transition-colors hover:decoration-slate-900';
