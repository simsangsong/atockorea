import { cn } from '@/lib/utils';

export type SgDpAccordionContext = 'practical' | 'faq';

/** Unified tour-detail premium accordion trigger (Practical + FAQ + any future panels). */
export function sgDpAccordionTriggerClassName(extra?: string, context?: SgDpAccordionContext) {
  const faqRow =
    context === 'faq'
      ? [
          'min-h-[3.25rem] items-start gap-4 px-[1.125rem] py-[0.875rem] sm:min-h-[3.375rem] sm:px-6 sm:py-[0.9375rem]',
          '[&_[data-slot=accordion-trigger-icon]]:mt-[0.1875rem] [&_[data-slot=accordion-trigger-icon]]:size-[1.0625rem]',
          '[&_[data-slot=accordion-trigger-icon]]:shrink-0',
          '[&_[data-slot=accordion-trigger-icon]]:text-[color-mix(in_oklab,var(--sg-ota-label)_72%,var(--dp-fg)_28%)]',
        ]
      : [
          'min-h-[3rem] gap-3 px-4 py-3.5 sm:min-h-[3.125rem] sm:px-5 sm:py-4',
          '[&>svg]:shrink-0 [&>svg]:text-neutral-400',
        ];

  return cn(
    'sg-dp-accordion-item-trigger sg-dp-type-accordion',
    context === 'faq' && 'sg-dp-accordion-trigger--faq',
    context === 'practical' && 'sg-dp-accordion-trigger--practical',
    context === 'faq'
      ? 'flex flex-1 justify-between rounded-none border-0 shadow-none'
      : 'flex flex-1 items-center justify-between rounded-none border-0 shadow-none',
    faqRow,
    'text-left hover:no-underline focus-visible:outline-none focus-visible:ring-0',
    extra
  );
}

/** Unified content panel padding + open-state surface (paired with expand-shell). */
export function sgDpAccordionContentClassName(extra?: string, context?: SgDpAccordionContext) {
  const edgePad =
    context === 'faq'
      ? 'px-[1.125rem] sm:px-6'
      : context === 'practical'
        ? 'px-4 sm:px-5'
        : 'px-4 pb-4 pt-0 sm:px-5 sm:pb-5 lg:pb-6';

  return cn(
    'sg-dp-accordion-content-panel',
    context === 'faq' && 'sg-dp-accordion-content-panel--faq',
    context === 'practical' && 'sg-dp-accordion-content-panel--practical',
    edgePad,
    extra
  );
}
