'use client';

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SmallGroupPracticalBlock } from '../smallGroupDetailContent';
import { groupPracticalBlocksForUi } from '../smallGroupDetailContent';

export interface SmallGroupPracticalInfoSectionProps {
  blocks: SmallGroupPracticalBlock[];
  /** One-line editorial scan above clusters (Phase 6). */
  practicalIntro?: string | null;
  /** Subtitle under "Practical Details" */
  sectionSubtitle?: string;
}

/**
 * (G) Practical details — grouped clusters; primary copy always visible, optional depth in native <details>.
 */
export default function SmallGroupPracticalInfoSection({
  blocks,
  practicalIntro,
  sectionSubtitle = 'Everything you need to know before you go',
}: SmallGroupPracticalInfoSectionProps) {
  const clusters = useMemo(() => groupPracticalBlocksForUi(blocks), [blocks]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <section
      id="tour-detail-practical"
      className="sg-dp-mid-slot-practical sg-dp-section-rule-soft sg-dp-section-band-utility sg-dp-section-supporting-mid scroll-mt-[var(--sg-sticky-clear)] bg-transparent sg-dp-page-gutter font-sans antialiased"
    >
      <div className="sg-dp-page-column">
        <div className="sg-dp-supporting-section-head">
          <p className="sg-dp-type-utility-section-eyebrow mb-1 m-0">Planning</p>
          <h2 className="sg-dp-type-section-heading-support m-0">Practical Details</h2>
          <p className="sg-dp-supporting-section-subtitle sg-dp-type-meta mt-1.5 m-0 text-pretty">
            {sectionSubtitle}
          </p>
        </div>

        {practicalIntro?.trim() ? (
          <div className="sg-dp-practical-intro-well mb-4 md:mb-5">
            <p className="sg-dp-practical-intro-lead sg-dp-type-body-strong m-0 max-w-2xl">
              {practicalIntro.trim()}
            </p>
          </div>
        ) : null}

        <div className="sg-dp-accordion-stack sg-dp-accordion-stack--practical">
          {clusters.map((cluster) => (
            <div key={cluster.key} className="sg-dp-accordion-cluster">
              <div className="sg-dp-expand-shell sg-dp-expand-shell--practical-cluster">
                <p className="sg-dp-practical-cluster-head">{cluster.label}</p>
                <div className="divide-y divide-[color:var(--sg-rule-mid)]">
                  {cluster.blocks.map((block: SmallGroupPracticalBlock) => (
                    <div key={block.id} className="sg-dp-practical-block">
                      <p className="sg-dp-practical-block-title m-0">{block.title}</p>
                      {block.body.trim() ? (
                        <p className="sg-dp-practical-block-body sg-dp-type-body m-0">{block.body}</p>
                      ) : (
                        <p className="sg-dp-practical-block-body sg-dp-type-body m-0">
                          Information for this topic will be confirmed with your booking.
                        </p>
                      )}
                      {block.moreDetails?.trim() ? (
                        <details className="group sg-dp-practical-disclosure">
                          <summary className="sg-dp-disclosure-summary sg-dp-practical-disclosure-summary flex">
                            <ChevronDown
                              className="sg-dp-practical-disclosure-chevron h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                              strokeWidth={2}
                              aria-hidden
                            />
                            Additional notes
                          </summary>
                          <p className="sg-dp-practical-disclosure-body sg-dp-type-meta m-0">{block.moreDetails}</p>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
