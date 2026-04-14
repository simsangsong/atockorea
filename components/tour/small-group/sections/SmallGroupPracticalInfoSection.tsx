'use client';

import { useMemo } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sgDpAccordionContentClassName, sgDpAccordionTriggerClassName } from '../sg-dp-accordion-shared';
import type { SmallGroupPracticalAccordionKey, SmallGroupPracticalBlock } from '../smallGroupDetailContent';
import { groupPracticalBlocksByAccordion } from '../smallGroupDetailContent';

const PLACEHOLDER = 'Information for this topic will be confirmed with your booking.';

function clipPreview(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
}

/** One-line scan for the closed accordion trigger — no long paragraphs. */
function accordionTriggerPreview(key: SmallGroupPracticalAccordionKey, blocks: SmallGroupPracticalBlock[]): string {
  const nonEmptyBodies = blocks.filter((b) => b.body.trim());
  const parts: string[] = [];
  let total = 0;
  for (const b of nonEmptyBodies) {
    const t = b.body.trim();
    const first = t.split(/(?<=[.!?])\s+/)[0]?.trim() ?? t;
    const piece = clipPreview(first, 88);
    if (!piece) continue;
    if (total + piece.length > 135 && parts.length >= 1) break;
    parts.push(piece);
    total += piece.length + 3;
    if (parts.length >= 2) break;
  }
  if (parts.length > 0) return parts.join(' · ');
  if (key === 'includedNotIncluded') {
    return 'What the rate covers and what to budget separately.';
  }
  return PLACEHOLDER;
}

function shouldRenderPanel(blocks: SmallGroupPracticalBlock[]): boolean {
  return blocks.length > 0;
}

function PanelBodyStack({ blocks }: { blocks: SmallGroupPracticalBlock[] }) {
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      {blocks.map((block: SmallGroupPracticalBlock) => {
        const bodyTrim = block.body.trim();
        const moreTrim = block.moreDetails?.trim() ?? '';
        return (
          <div key={block.id} className="min-w-0">
            <h3 className="sg-dp-card-title m-0 text-[14px] leading-snug sm:text-[14.5px]">{block.title}</h3>
            {bodyTrim ? (
              <p className="sg-dp-type-body m-0 mt-2 text-[13px] leading-relaxed sm:mt-2.5 sm:text-[14px]">{bodyTrim}</p>
            ) : (
              <p className="sg-dp-type-meta m-0 mt-2">{PLACEHOLDER}</p>
            )}
            {moreTrim ? (
              <p className="sg-dp-type-meta m-0 mt-3 border-t border-[color:var(--sg-rule-whisper)] pt-3 text-[12.5px] leading-relaxed text-neutral-600 sm:text-[13px]">
                {moreTrim}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export interface SmallGroupPracticalInfoSectionProps {
  blocks: SmallGroupPracticalBlock[];
  practicalIntro?: string | null;
  sectionSubtitle?: string;
}

/**
 * Practical details — five accordions; post-booking flow lives under Booking & support.
 */
export default function SmallGroupPracticalInfoSection({
  blocks,
  practicalIntro,
  sectionSubtitle = 'Pickup, walking, weather, packing, and inclusions — one place for day-of and booking answers.',
}: SmallGroupPracticalInfoSectionProps) {
  const buckets = useMemo(() => groupPracticalBlocksByAccordion(blocks), [blocks]);

  const visiblePanels = useMemo(
    () => buckets.filter((p) => shouldRenderPanel(p.blocks)),
    [buckets],
  );

  if (visiblePanels.length === 0) {
    return null;
  }

  return (
    <section
      id="sg-details"
      className="sg-dp-mid-slot-practical sg-dp-section-rule-soft sg-dp-section-band-utility sg-dp-section-supporting-mid scroll-mt-[var(--sg-sticky-clear)] bg-transparent sg-dp-page-gutter font-sans antialiased"
      aria-labelledby="practical-details-heading"
    >
      <div className="sg-dp-page-column">
        <div className="sg-dp-supporting-section-head">
          <p className="sg-dp-type-utility-section-eyebrow mb-1 m-0">Planning</p>
          <h2 id="practical-details-heading" className="sg-dp-type-section-heading-support m-0">
            Practical details
          </h2>
          <p className="sg-dp-supporting-section-subtitle sg-dp-type-meta mt-1.5 m-0 text-pretty">{sectionSubtitle}</p>
        </div>

        {practicalIntro?.trim() ? (
          <div className="sg-dp-practical-intro-well mb-4 md:mb-5">
            <p className="sg-dp-practical-intro-lead sg-dp-type-body-strong m-0 max-w-2xl">{practicalIntro.trim()}</p>
          </div>
        ) : null}

        <div className="sg-dp-expand-shell sg-dp-expand-shell--faq">
          <Accordion
            data-accordion-context="practical"
            className="sg-dp-practical-unified-accordion flex w-full flex-col"
          >
            {visiblePanels.map((panel) => {
              const preview = accordionTriggerPreview(panel.key, panel.blocks);
              const value = `practical-${panel.key}`;
              return (
                <AccordionItem key={panel.key} value={value} className="sg-dp-accordion-item border-0 !border-b-0">
                  <AccordionTrigger className={sgDpAccordionTriggerClassName('items-start', 'practical')}>
                    <span className="flex min-w-0 flex-col items-start gap-1 text-left sm:gap-1.5">
                      <span className="sg-dp-type-accordion text-[14px] leading-snug sm:text-[14.5px]">{panel.label}</span>
                      <span className="sg-dp-type-meta line-clamp-2 max-w-prose text-[12px] font-normal leading-snug text-neutral-600 sm:text-[12.5px]">
                        {preview}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={sgDpAccordionContentClassName('pb-4 pt-0 sm:pb-5', 'practical')}>
                    {panel.blocks.length > 0 ? <PanelBodyStack blocks={panel.blocks} /> : null}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
