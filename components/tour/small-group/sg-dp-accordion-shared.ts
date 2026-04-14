import { cn } from '@/lib/utils';

export type SgDpAccordionContext = 'practical' | 'faq';

/** Unified tour-detail premium accordion trigger (Practical + FAQ + any future panels). */
export function sgDpAccordionTriggerClassName(extra?: string, context?: SgDpAccordionContext) {
  const faqRow =
    context === 'faq'
      ? [
          'min-h-[2.875rem] items-start gap-3 px-4 py-2.5 sm:min-h-[3.125rem] sm:gap-3.5 sm:px-[1.125rem] sm:py-3',
          '[&_[data-slot=accordion-trigger-icon]]:mt-[0.125rem] [&_[data-slot=accordion-trigger-icon]]:size-[1rem] sm:[&_[data-slot=accordion-trigger-icon]]:mt-[0.1875rem] sm:[&_[data-slot=accordion-trigger-icon]]:size-[1.0625rem]',
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
      ? 'px-4 pb-3.5 pt-0 sm:px-[1.125rem] sm:pb-4 sm:pt-0 md:px-6'
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
