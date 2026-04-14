'use client';

import { useState } from 'react';
import { ChevronDown, CloudSun, Snowflake, Sun, Wind, type LucideIcon } from 'lucide-react';
import type { SmallGroupSeasonalTab } from '../smallGroupDetailContent';
import SmallGroupSectionHeader from '../SmallGroupSectionHeader';

export interface SmallGroupSeasonalSectionProps {
  tabs: SmallGroupSeasonalTab[];
  /** Subtitle under "Seasonal Variations"; default generic copy */
  sectionSubtitle?: string;
  /** When true, outer wrapper is a `<div>` (nested under a parent `<section>`). */
  embedded?: boolean;
  /**
   * Mobile: chapter sits behind a disclosure (collapsed by default).
   * Desktop: unchanged full chapter. Use inside Conditions support slot before Practical.
   */
  compactMobileDisclosure?: boolean;
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

function SeasonalColumn({
  tabs,
  activeId,
  setActiveId,
  sectionSubtitle,
  showSurfaceHeader,
  columnClassName,
}: {
  tabs: SmallGroupSeasonalTab[];
  activeId: string;
  setActiveId: (id: string) => void;
  sectionSubtitle: string;
  showSurfaceHeader: boolean;
  columnClassName: string;
}) {
  const active = tabs.find((s) => s.id === activeId) ?? tabs[0];
  const { Icon: ActiveIcon } = seasonAccent(active.id);
  const highlightsLong = (active.highlights ?? '').trim().length > 140;
  const highlightsPreview =
    active.highlights && active.highlights.length > 130
      ? `${active.highlights.slice(0, 127).trim()}…`
      : (active.highlights ?? '');

  return (
    <div className={columnClassName}>
      {showSurfaceHeader ? (
        <SmallGroupSectionHeader
          eyebrow="Season"
          title="Seasonal Variations"
          description={sectionSubtitle}
          titleVariant="standard"
          descriptionVariant="quiet"
          spacing="compact"
          className="max-w-none"
        />
      ) : null}

      <div
        className="sg-dp-seasonal-chip-track mb-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-x snap-x snap-proximity md:mb-3.5 md:pb-1 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Season"
      >
        <div className="flex w-max min-w-0 flex-nowrap items-stretch gap-1.5 md:gap-2.5 md:pr-6">
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
                className={`snap-start inline-flex min-h-[2.5rem] shrink-0 items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[11px] font-medium tracking-wide transition-[box-shadow,background-color,border-color,color,transform] duration-200 md:min-h-[2.875rem] md:gap-2 md:rounded-xl md:px-4 md:py-2.5 md:text-xs ${
                  selected
                    ? 'border-stone-800/22 bg-gradient-to-b from-stone-900 to-stone-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_4px_16px_-6px_rgba(0,0,0,0.28)]'
                    : 'border-stone-200/95 bg-white text-[color:color-mix(in_oklab,var(--dp-fg)_88%,var(--dp-muted)_12%)] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_3px_rgba(15,23,42,0.05)] hover:border-stone-300/95 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_14px_-8px_rgba(15,23,42,0.08)] active:scale-[0.99]'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 md:h-4 md:w-4 ${selected ? 'text-white/90' : accent}`}
                  strokeWidth={2}
                  aria-hidden
                />
                <span
                  className={`whitespace-nowrap ${selected ? 'text-white' : 'text-[color:color-mix(in_oklab,var(--dp-fg)_88%,var(--dp-muted)_12%)]'}`}
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
          <div className="sg-dp-seasonal-card-hero flex items-center justify-center py-2 md:py-0" aria-hidden>
            <div className="rounded-xl border border-white/50 bg-white/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_2px_8px_-4px_rgba(15,23,42,0.08)] backdrop-blur-[3px] md:rounded-2xl md:p-3">
              <ActiveIcon className="h-5 w-5 text-stone-600/90 md:h-7 md:w-7" strokeWidth={1.75} />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-5">
            <div className="mb-3 flex min-h-0 flex-wrap items-start justify-between gap-2 border-b border-stone-200/70 pb-3 md:mb-5 md:gap-3 md:pb-5">
              <h3 className="sg-dp-type-subsection m-0 max-w-[min(100%,20rem)] text-[15px] leading-snug md:max-w-none md:text-[inherit]">
                {active.name}
              </h3>
              {active.months ? (
                <span className="sg-dp-type-meta shrink-0 rounded-full border border-stone-200/90 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-600 shadow-[0_1px_0_rgba(255,255,255,1)_inset] md:px-2.5 md:py-1 md:text-[inherit]">
                  {active.months}
                </span>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col gap-3 md:gap-6">
              {active.weather ? (
                <div className="min-w-0">
                  <p className="sg-dp-type-label-caps mb-1 !text-stone-500 md:mb-2">On this route</p>
                  <p className="sg-dp-type-body-strong m-0 max-w-prose text-[13px] leading-snug !text-stone-800 md:text-[14px] md:leading-relaxed md:!text-[inherit] lg:text-[14.5px]">
                    {active.weather}
                  </p>
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="sg-dp-type-label-caps mb-1 !text-stone-500 md:mb-2">
                  {active.weather ? 'Experience' : 'Notes'}
                </p>
                {highlightsLong ? (
                  <details className="group sg-dp-expand-shell sg-dp-expand-shell--explanatory overflow-hidden">
                    <summary className="sg-dp-disclosure-summary sg-dp-accordion-trigger flex list-none items-start justify-between gap-2 rounded-[calc(var(--sg-card-r-panel)-2px)] p-2.5 text-left transition-colors duration-200 hover:bg-white/55 md:p-3">
                      <p className="sg-dp-type-body-strong m-0 max-w-prose flex-1 text-[13px] font-medium leading-snug !text-stone-700 md:text-[14px] md:leading-relaxed">
                        {highlightsPreview}
                      </p>
                      <ChevronDown
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden
                        strokeWidth={2}
                      />
                    </summary>
                    <div className="border-t border-[var(--sg-rule-whisper)] px-2.5 pb-2.5 pt-2 md:px-3 md:pb-3 md:pt-2.5">
                      <p className="sg-dp-type-body-strong m-0 max-w-prose text-[13px] leading-relaxed !text-stone-700 md:text-[14px] md:leading-relaxed lg:text-[14.5px]">
                        {active.highlights}
                      </p>
                    </div>
                  </details>
                ) : (
                  <p className="sg-dp-type-body-strong m-0 max-w-prose text-[13px] leading-snug !text-stone-700 md:text-[14px] md:leading-relaxed lg:text-[14.5px]">
                    {active.highlights}
                  </p>
                )}
              </div>
            </div>

            {active.tip ? (
              <div className="mt-4 border-t border-stone-200/70 pt-3 md:mt-6 md:pt-5">
                <p className="sg-dp-type-body-strong m-0 inline-flex max-w-full rounded-[10px] border border-[var(--dp-primary)]/22 bg-[var(--dp-primary)]/[0.07] px-2.5 py-2 text-[12.5px] font-medium leading-snug !text-[var(--dp-primary)] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] md:px-3 md:py-2.5 md:text-[13px] lg:text-[13.5px]">
                  {active.tip}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * (F) Seasonal — editorial header + aligned chip rail + premium detail card.
 */
export default function SmallGroupSeasonalSection({
  tabs,
  sectionSubtitle = 'Each season brings its own magic to this route',
  embedded = false,
  compactMobileDisclosure = false,
}: SmallGroupSeasonalSectionProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');

  if (tabs.length === 0) {
    return null;
  }

  const subtitle = sectionSubtitle.trim() || 'Each season brings its own magic to this route';
  const summaryLine =
    subtitle.length > 96 ? `${subtitle.slice(0, 93).trim()}…` : subtitle;

  const shellClass = compactMobileDisclosure
    ? 'bg-transparent font-sans antialiased [font-feature-settings:"kern"_1,"liga"_1]'
    : 'sg-dp-conditions-supporting-chapter sg-dp-section-rule-soft sg-dp-section-band-secondary bg-transparent sg-dp-page-gutter font-sans antialiased [font-feature-settings:"kern"_1,"liga"_1]';

  const columnDefault = 'sg-dp-page-column';
  const columnInSupportSlot = 'min-w-0 w-full';

  if (compactMobileDisclosure) {
    const sharedProps = {
      tabs,
      activeId,
      setActiveId,
      sectionSubtitle: subtitle,
    };

    const inner = (
      <>
        <div className="hidden md:block">
          <SeasonalColumn {...sharedProps} showSurfaceHeader columnClassName={columnInSupportSlot} />
        </div>

        <details className="group sg-dp-seasonal-mobile-disclosure md:hidden">
          <summary className="sg-dp-disclosure-summary flex cursor-pointer list-none items-center justify-between gap-3 rounded-[calc(var(--sg-card-r-nested)+2px)] border border-stone-200/85 bg-white/90 px-3 py-2.5 text-left shadow-[0_1px_0_rgba(255,255,255,1)_inset] sm:px-3.5 sm:py-3">
            <span className="min-w-0 flex-1">
              <span className="sg-dp-type-accordion m-0 block text-[13.5px] leading-snug text-neutral-900">
                Seasonal variations
              </span>
              <span className="sg-dp-type-meta mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-neutral-600">
                {summaryLine}
              </span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
              aria-hidden
              strokeWidth={2}
            />
          </summary>
          <div className="mt-3 border-t border-stone-200/35 pt-3">
            <SeasonalColumn {...sharedProps} showSurfaceHeader={false} columnClassName={columnInSupportSlot} />
          </div>
        </details>
      </>
    );

    return <div className={shellClass}>{inner}</div>;
  }

  const inner = (
    <SeasonalColumn
      tabs={tabs}
      activeId={activeId}
      setActiveId={setActiveId}
      sectionSubtitle={subtitle}
      showSurfaceHeader
      columnClassName={columnDefault}
    />
  );

  if (embedded) {
    return <div className={shellClass}>{inner}</div>;
  }

  return <section className={shellClass}>{inner}</section>;
}
