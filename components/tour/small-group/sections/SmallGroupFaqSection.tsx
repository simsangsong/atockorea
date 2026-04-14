'use client';

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sgDpAccordionContentClassName, sgDpAccordionTriggerClassName } from '../sg-dp-accordion-shared';
import { partitionFaqItems, type SmallGroupFaqItem } from '../smallGroupDetailContent';

export { partitionFaqItems };

function FaqAccordionBlock({
  items,
  valuePrefix,
}: {
  items: SmallGroupFaqItem[];
  valuePrefix: 'faq-p' | 'faq-m';
}) {
  if (items.length === 0) return null;

  return (
    <Accordion
      data-accordion-context="faq"
      className="sg-dp-faq-accordion sg-dp-faq-accordion--conversion flex w-full flex-col"
    >
      {items.map((faq: SmallGroupFaqItem, index: number) => (
        <AccordionItem
          key={`${valuePrefix}-${index}-${faq.question.slice(0, 24)}`}
          value={`${valuePrefix}-${index}`}
          className="sg-dp-accordion-item border-0 border-b border-solid border-stone-200/50 !border-l-0 !border-r-0 !border-t-0 last:border-b-0"
        >
          <AccordionTrigger
            className={sgDpAccordionTriggerClassName('items-start py-3.5 sm:py-4 hover:no-underline', 'faq')}
          >
            <span className="sg-dp-faq-question-text text-left text-[15px] font-semibold leading-snug tracking-[-0.02em] text-stone-900 sm:text-[15.5px]">
              {faq.question}
            </span>
          </AccordionTrigger>
          <AccordionContent className={sgDpAccordionContentClassName('pb-4', 'faq')}>
            <p className="sg-dp-type-body sg-dp-faq-answer m-0 max-w-prose text-[13.5px] leading-relaxed text-neutral-700 sm:text-[14px]">
              {faq.answer}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export interface SmallGroupFaqSectionProps {
  items: SmallGroupFaqItem[];
  sectionSubtitle?: string;
  emptyStateMessage?: string;
}

/**
 * Conversion-focused FAQ: five decision questions first, single-open accordions; rest in “More questions”.
 */
export default function SmallGroupFaqSection({
  items,
  sectionSubtitle = 'Short answers before you book—open only what you need.',
  emptyStateMessage = 'Frequently asked questions for this experience will appear here.',
}: SmallGroupFaqSectionProps) {
  const { top, more } = useMemo(() => partitionFaqItems(items), [items]);

  return (
    <section
      id="sg-faq"
      className="sg-dp-mid-slot-faq sg-dp-narrative-faq-placed sg-dp-section-rule-soft sg-dp-section-band-utility sg-dp-section-supporting-mid scroll-mt-[var(--sg-sticky-clear)] bg-transparent sg-dp-page-gutter"
      aria-labelledby="sg-faq-heading"
    >
      <div className="sg-dp-page-column max-w-2xl lg:max-w-none">
        <div className="sg-dp-faq-intro-block sg-dp-faq-intro-block--page-end">
          <p className="sg-dp-type-utility-section-eyebrow m-0 mb-0.5">Before you book</p>
          <h2 id="sg-faq-heading" className="sg-dp-type-section-heading-support m-0">
            Questions
          </h2>
          <p className="sg-dp-supporting-section-subtitle sg-dp-type-meta m-0 mt-1.5 max-w-prose leading-snug sm:mt-2 sm:leading-normal">
            {sectionSubtitle}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="sg-dp-type-body m-0" role="status">
            {emptyStateMessage}
          </p>
        ) : (
          <div className="mt-4 sm:mt-5">
            <div className="sg-dp-expand-shell sg-dp-expand-shell--faq overflow-hidden rounded-[calc(var(--sg-card-r-panel)-2px)] border border-[color:color-mix(in_oklab,var(--sg-card-stroke)_78%,transparent)] bg-white/[0.92] px-1 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_1px_2px_rgba(15,23,42,0.04)] sm:px-1.5">
              <FaqAccordionBlock items={top} valuePrefix="faq-p" />
            </div>

            {more.length > 0 ? (
              <details className="group sg-dp-faq-more-disclosure mt-4 overflow-hidden rounded-[calc(var(--sg-card-r-nested)+2px)] border border-stone-200/70 bg-white/75 shadow-[0_1px_0_rgba(255,255,255,1)_inset] sm:mt-5">
                <summary className="sg-dp-disclosure-summary flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3.5 text-left sm:px-4 sm:py-4">
                  <span className="min-w-0 flex-1">
                    <span className="sg-dp-type-accordion block text-[14px] font-medium leading-snug text-stone-900">
                      More questions
                    </span>
                    <span className="sg-dp-type-meta mt-0.5 block text-[12px] leading-snug text-neutral-600">
                      {more.length} more question{more.length === 1 ? '' : 's'} — timing, closures, and stop detail
                    </span>
                  </span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                    strokeWidth={2}
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-stone-200/55 px-1 pb-1 pt-0 sm:px-1.5 sm:pb-1.5">
                  <FaqAccordionBlock items={more} valuePrefix="faq-m" />
                </div>
              </details>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
