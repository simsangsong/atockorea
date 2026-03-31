'use client';

import { useState } from 'react';
import { CloudSun, Snowflake, Sun, Wind, type LucideIcon } from 'lucide-react';
import type { SmallGroupSeasonalTab } from '../smallGroupDetailContent';
import SmallGroupSectionHeader from '../SmallGroupSectionHeader';

export interface SmallGroupSeasonalSectionProps {
  tabs: SmallGroupSeasonalTab[];
  /** Subtitle under "Seasonal Variations"; default generic copy */
  sectionSubtitle?: string;
}

/** Muted tints for idle chips — selected state uses ink + white type */
function seasonAccent(id: string): { Icon: LucideIcon; accent: string } {
  switch (id) {
    case 'spring':
      return { Icon: Sun, accent: 'text-amber-900/45' };
    case 'summer':
      return { Icon: CloudSun, accent: 'text-sky-900/40' };
    case 'fall':
      return { Icon: Wind, accent: 'text-orange-900/45' };
    case 'winter':
      return { Icon: Snowflake, accent: 'text-cyan-900/40' };
    case 'rainy':
      return { Icon: CloudSun, accent: 'text-slate-600/50' };
    case 'windy':
      return { Icon: Wind, accent: 'text-slate-600/50' };
    case 'peak':
      return { Icon: Sun, accent: 'text-amber-900/45' };
    default:
      return { Icon: Sun, accent: 'text-stone-500' };
  }
}

/**
 * (F) Seasonal — editorial header + aligned chip rail + premium detail card.
 */
export default function SmallGroupSeasonalSection({
  tabs,
  sectionSubtitle = 'Each season brings its own magic to this route',
}: SmallGroupSeasonalSectionProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const active = tabs.find((s) => s.id === activeId) ?? tabs[0];

  if (tabs.length === 0) {
    return null;
  }

  const { Icon: ActiveIcon } = seasonAccent(active.id);

  return (
    <section className="sg-dp-conditions-supporting-chapter sg-dp-section-rule-soft sg-dp-section-band-secondary bg-transparent sg-dp-page-gutter font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1]">
      <div className="sg-dp-page-column">
        <SmallGroupSectionHeader
          eyebrow="Season"
          title="Seasonal Variations"
          description={sectionSubtitle}
          titleVariant="standard"
          descriptionVariant="quiet"
          spacing="compact"
          className="max-w-none"
        />

        <div
          className="sg-dp-seasonal-chip-track mb-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-x snap-x snap-proximity md:mb-4 [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Season"
        >
          <div className="flex w-max min-w-0 flex-nowrap items-stretch gap-2 md:gap-2.5 md:pr-6">
            {tabs.map((season: SmallGroupSeasonalTab) => {
              const { Icon, accent } = seasonAccent(season.id);
              const selected = activeId === season.id;
              return (
                <button
                  key={season.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveId(season.id)}
                  className={`snap-start inline-flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-[11px] border px-3.5 py-2 text-[11px] font-medium tracking-wide transition-[box-shadow,background-color,border-color,color,transform] duration-200 md:min-h-[2.875rem] md:rounded-xl md:px-4 md:py-2.5 md:text-xs ${
                    selected
                      ? 'border-stone-800/22 bg-gradient-to-b from-stone-900 to-stone-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_4px_16px_-6px_rgba(0,0,0,0.28)]'
                      : 'border-stone-200/95 bg-white text-[color-mix(in_oklab,var(--dp-fg)_88%,var(--dp-muted)_12%)] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_3px_rgba(15,23,42,0.05)] hover:border-stone-300/95 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_14px_-8px_rgba(15,23,42,0.08)] active:scale-[0.99]'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 md:h-4 md:w-4 ${selected ? 'text-white/90' : accent}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span
                    className={`whitespace-nowrap ${selected ? 'text-white' : 'text-[color-mix(in_oklab,var(--dp-fg)_88%,var(--dp-muted)_12%)]'}`}
                  >
                    {season.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {active ? (
          <div className="sg-dp-seasonal-detail-card sg-dp-surface-muted sg-dp-surface-muted--explanatory flex flex-col">
            <div className="sg-dp-seasonal-card-hero flex items-center justify-center" aria-hidden>
              <div className="rounded-2xl border border-white/50 bg-white/40 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_2px_8px_-4px_rgba(15,23,42,0.08)] backdrop-blur-[3px] md:p-3">
                <ActiveIcon className="h-6 w-6 text-stone-600/90 md:h-7 md:w-7" strokeWidth={1.75} />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
              <div className="mb-4 flex min-h-[3rem] flex-wrap items-start justify-between gap-3 border-b border-stone-200/80 pb-4 md:mb-5 md:min-h-0 md:items-baseline md:pb-5">
                <h3 className="sg-dp-type-subsection m-0 max-w-[min(100%,20rem)] leading-snug md:max-w-none">{active.name}</h3>
                {active.months ? (
                  <span className="sg-dp-type-meta shrink-0 rounded-full border border-stone-200/90 bg-white/80 px-2.5 py-1 font-semibold uppercase tracking-[0.1em] text-stone-600 shadow-[0_1px_0_rgba(255,255,255,1)_inset]">
                    {active.months}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-5 md:gap-6">
                {active.weather ? (
                  <div className="min-h-0">
                    <p className="sg-dp-type-label-caps mb-2 !text-stone-500">Weather</p>
                    <p className="sg-dp-type-body-strong m-0 max-w-prose text-[14px] leading-relaxed !text-stone-800 sm:text-[14.5px]">
                      {active.weather}
                    </p>
                  </div>
                ) : null}
                <div className="min-h-0 flex-1">
                  <p className="sg-dp-type-label-caps mb-2 !text-stone-500">
                    {active.weather ? 'Experience' : 'Notes'}
                  </p>
                  <p className="sg-dp-type-body-strong m-0 max-w-prose text-[14px] leading-relaxed !text-stone-700 sm:text-[14.5px] sm:leading-relaxed">
                    {active.highlights}
                  </p>
                </div>
              </div>

              {active.tip ? (
                <div className="mt-5 border-t border-stone-200/75 pt-4 md:mt-6 md:pt-5">
                  <p className="sg-dp-type-body-strong m-0 inline-flex max-w-full rounded-[10px] border border-[var(--dp-primary)]/22 bg-[var(--dp-primary)]/[0.07] px-3 py-2.5 text-[13px] font-medium leading-snug !text-[var(--dp-primary)] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] sm:text-[13.5px]">
                    {active.tip}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
