'use client';

import { TourWeatherSection } from '@/components/tour-detail-template';
import type { SmallGroupSeasonalTab } from '../smallGroupDetailContent';
import SmallGroupSeasonalSection from './SmallGroupSeasonalSection';

export interface SmallGroupTourConditionsSupportProps {
  weatherAreaLabel: string;
  weatherLatitude: number;
  weatherLongitude: number;
  seasonalTabs: SmallGroupSeasonalTab[];
  seasonalSubtitle?: string;
}

/**
 * Compact forecast + seasonal context, placed before Practical details.
 * Copy stays minimal so route logic and operational handling live elsewhere.
 */
export default function SmallGroupTourConditionsSupport({
  weatherAreaLabel,
  weatherLatitude,
  weatherLongitude,
  seasonalTabs,
  seasonalSubtitle,
}: SmallGroupTourConditionsSupportProps) {
  return (
    <section
      id="sg-conditions"
      className="sg-dp-tour-conditions-support sg-dp-page-gutter scroll-mt-[var(--sg-sticky-clear)] bg-transparent pb-1 pt-2 font-sans antialiased md:pb-2 md:pt-3"
      aria-label="Conditions and forecast"
    >
      <div className="sg-dp-page-column">
        <p className="sg-dp-type-meta m-0 mb-2 max-w-prose text-[11.5px] leading-snug text-neutral-600 sm:mb-2.5 sm:text-[12px]">
          Live conditions for the area you walk—use Practical details for closures, flex, and what to bring.
        </p>

        <div className="max-w-md">
          <TourWeatherSection
            className="px-0 pb-0"
            appearance="premium"
            collapseAuxiliaryByDefault
            areaLabel={weatherAreaLabel}
            latitude={weatherLatitude}
            longitude={weatherLongitude}
          />
        </div>

        {seasonalTabs.length > 0 ? (
          <div className="mt-4 border-t border-stone-200/40 pt-4 md:mt-5 md:pt-5">
            <SmallGroupSeasonalSection
              tabs={seasonalTabs}
              sectionSubtitle={seasonalSubtitle}
              compactMobileDisclosure
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
