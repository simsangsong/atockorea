'use client';

import type {
  SmallGroupBestForLine,
  SmallGroupFlowAdjustment,
  SmallGroupFlowReason,
} from '../smallGroupDetailContent';
import SmallGroupSectionHeader from '../SmallGroupSectionHeader';
import SmallGroupWhyRouteWorksSection from './SmallGroupWhyRouteWorksSection';

export interface SmallGroupWhyTourWorksMergedSectionProps {
  ideal: SmallGroupBestForLine[];
  notIdeal: SmallGroupBestForLine[];
  reasons: SmallGroupFlowReason[];
  adjustments: SmallGroupFlowAdjustment[];
  whyOrderBody: string;
  supplementalBody?: string;
  /** Snapshot lines for Card A (who it suits) — optional */
  familyFitSummary?: string | null;
  seniorFitSummary?: string | null;
  /** Lead under the merged H2 */
  mergedDescription?: string;
}

const DEFAULT_MERGED_DESC =
  'Who this cadence suits, and how we sequence the day for energy and clarity—without re-stating forecast, closures, or packing here.';

/**
 * Route rationale + fit (weather forecast and seasonal chapter live in Conditions support before Practical).
 */
export default function SmallGroupWhyTourWorksMergedSection({
  ideal,
  notIdeal,
  reasons,
  adjustments,
  whyOrderBody,
  supplementalBody,
  mergedDescription = DEFAULT_MERGED_DESC,
  familyFitSummary,
  seniorFitSummary,
}: SmallGroupWhyTourWorksMergedSectionProps) {
  return (
    <section
      id="sg-why-tour-works"
      className="sg-dp-mid-slot-editorial sg-dp-section-rule sg-dp-section-band-primary scroll-mt-[var(--sg-sticky-clear)] bg-transparent font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1]"
      aria-labelledby="why-tour-works-heading"
    >
      <div className="sg-dp-page-gutter">
        <div className="sg-dp-page-column">
          <SmallGroupSectionHeader
            eyebrow="The experience"
            title="Why this tour works"
            description={mergedDescription}
            descriptionVariant="quiet"
            titleId="why-tour-works-heading"
            titleVariant="feature"
            spacing="compact"
          />
        </div>
      </div>

      <SmallGroupWhyRouteWorksSection
        embedded
        ideal={ideal}
        notIdeal={notIdeal}
        reasons={reasons}
        adjustments={adjustments}
        whyOrderBody={whyOrderBody}
        supplementalBody={supplementalBody}
        familyFitSummary={familyFitSummary ?? undefined}
        seniorFitSummary={seniorFitSummary ?? undefined}
      />
    </section>
  );
}
