'use client';

import { SMALL_GROUP_ADVANTAGES } from '../smallGroupDifferentiationCopy';
import SmallGroupSectionHeader from '../SmallGroupSectionHeader';

/**
 * Near-top differentiation: why small-group ≠ large bus tour.
 * Editorial list — always visible (no section-level collapse).
 */
export default function SmallGroupAdvantagesSection() {
  return (
    <section
      className="sg-dp-section-rule-soft sg-dp-section-band-secondary bg-transparent px-5 font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1] md:px-8 lg:px-10"
      aria-labelledby="sg-advantages-heading"
    >
      <div className="mx-auto max-w-3xl">
        <SmallGroupSectionHeader
          eyebrow="Small-group experience"
          title="What a curated small-group day feels like"
          description="Built for guests who care about quality, pacing, and how the day actually feels — not just how many sights are ticked off."
          titleId="sg-advantages-heading"
          titleVariant="standard"
          descriptionVariant="quiet"
          spacing="compact"
          className="mb-6 max-w-none sm:mb-7"
        />
        <ul className="m-0 flex list-none flex-col divide-y divide-stone-100 border-t border-stone-100 p-0">
          {SMALL_GROUP_ADVANTAGES.map((item) => (
            <li key={item.id} className="py-5 sm:py-6">
              <h3 className="m-0 text-[0.9375rem] font-semibold tracking-tight text-stone-900 sm:text-base">
                {item.title}
              </h3>
              <p className="m-0 mt-2 max-w-prose text-[0.875rem] font-normal leading-[1.6] text-stone-600 sm:text-[0.9375rem] sm:leading-[1.65]">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
