'use client';

import { useTranslations } from '@/lib/i18n';
import type { HeroDecisionStripFact } from '../heroDecisionStripFacts';

export interface SmallGroupHeroDecisionStripProps {
  facts: HeroDecisionStripFact[];
}

/**
 * Slim scan row below the hero intro card — lighter than the card, same measure.
 */
export default function SmallGroupHeroDecisionStrip({ facts }: SmallGroupHeroDecisionStripProps) {
  const t = useTranslations('tour');

  if (facts.length === 0) {
    return null;
  }

  return (
    <div className="sg-dp-hero-decision-strip overflow-hidden rounded-b-[12px] border border-stone-200/55 border-t-stone-200/70 bg-[color-mix(in_oklab,var(--dp-secondary)_10%,#fafaf8)] sm:rounded-b-[14px]">
      <div className="sg-dp-page-gutter py-3 sm:py-3.5">
        <div className="sg-dp-page-column">
          <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4">
            {facts.map((fact: HeroDecisionStripFact) => (
              <div key={fact.key} className="min-w-0">
                <dt className="sg-dp-type-label-caps m-0 !text-[9px] !tracking-[0.14em] text-stone-500">
                  {t(`heroDecision.${fact.key}`)}
                </dt>
                <dd className="m-0 mt-0.5 truncate text-[12px] font-medium leading-snug tracking-[-0.012em] text-stone-800/95 sm:text-[12.5px]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
