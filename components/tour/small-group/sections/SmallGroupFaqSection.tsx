'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sgDpAccordionContentClassName, sgDpAccordionTriggerClassName } from '../sg-dp-accordion-shared';

export interface SmallGroupFaqSectionProps {
  items: Array<{ question: string; answer: string }>;
  sectionSubtitle?: string;
  emptyStateMessage?: string;
}

/**
 * (I) Questions — support-layer accordion; shell + triggers differ from Practical (Step 5).
 */
export default function SmallGroupFaqSection({
  items,
  sectionSubtitle = 'Common questions from our guests',
  emptyStateMessage = 'Frequently asked questions for this experience will appear here.',
}: SmallGroupFaqSectionProps) {
  return (
    <section
      id="tour-detail-faq"
      className="sg-dp-mid-slot-faq sg-dp-narrative-faq-placed sg-dp-section-rule-soft sg-dp-section-band-utility sg-dp-section-supporting-mid scroll-mt-[var(--sg-sticky-clear)] bg-transparent sg-dp-page-gutter"
    >
      <div className="sg-dp-page-column">
        <div className="sg-dp-faq-intro-block">
          <p className="sg-dp-type-utility-section-eyebrow m-0 mb-1">Support</p>
          <h2 className="sg-dp-type-section-heading-support m-0">Questions</h2>
          <p className="sg-dp-supporting-section-subtitle sg-dp-type-meta m-0 mt-1.5">{sectionSubtitle}</p>
        </div>

        {items.length === 0 ? (
          <p className="sg-dp-type-body m-0" role="status">
            {emptyStateMessage}
          </p>
        ) : (
          <div className="sg-dp-expand-shell sg-dp-expand-shell--faq">
            <Accordion
              data-accordion-context="faq"
              className="sg-dp-faq-accordion flex w-full flex-col"
              defaultValue={items.length > 0 ? ['faq-0'] : undefined}
            >
              {items.map((faq, index: number) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="sg-dp-accordion-item border-0 !border-b-0"
                >
                  <AccordionTrigger className={sgDpAccordionTriggerClassName(undefined, 'faq')}>
                    <span className="sg-dp-faq-question-text">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className={sgDpAccordionContentClassName(undefined, 'faq')}>
                    <p className="sg-dp-type-body sg-dp-faq-answer m-0 max-w-prose">{faq.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>
    </section>
  );
}
