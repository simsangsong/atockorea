'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Route } from 'lucide-react';
import SmallGroupRouteTimelineSection from './SmallGroupRouteTimelineSection';
import type { SmallGroupDetailContent, SmallGroupRouteStop } from '../smallGroupDetailContent';

const ITIN_EXPAND_EASE = [0.22, 1, 0.36, 1] as const;

export interface SmallGroupCollapsibleItinerarySectionProps {
  stops: SmallGroupDetailContent['routeStops'];
  metaLabels?: SmallGroupDetailContent['routeStopMetaLabels'];
  sectionTitle?: string;
  sectionSubtitle?: string;
  sectionCardHint?: string;
}

function isPlaceholder(value: string | undefined): boolean {
  const t = (value ?? '').trim();
  return t === '' || t === '—';
}

/** Match timeline: first numeric chunk + min label when possible */
function stayChipLabel(stay: string): string {
  const m = stay.trim().match(/(\d+)/);
  if (m) return `${m[1]} min`;
  const t = stay.trim();
  return t || '';
}

function condensedSequenceLabel(stop: SmallGroupRouteStop, index: number, total: number): string {
  const raw = stop.sequenceLabel?.trim();
  if (raw) return raw;
  return `Stop ${index + 1} of ${total}`;
}

function condensedSummaryLine(stop: SmallGroupRouteStop): string {
  const s = (stop.cardSummary ?? stop.description).trim();
  return s || '—';
}

/**
 * Sales-quality scan layer: number, place, one-line summary, stay when available.
 */
function SmallGroupItineraryCondensedList({ stops }: { stops: SmallGroupRouteStop[] }) {
  const total = stops.length;
  return (
    <div className="sg-dp-itin-condensed relative px-1 pb-0.5 pt-1 sm:px-1.5">
      <div
        className="pointer-events-none absolute bottom-2 left-[0.875rem] top-2 w-px bg-gradient-to-b from-neutral-200 via-neutral-200/70 to-neutral-100/40 sm:left-[0.9375rem]"
        aria-hidden
      />
      <ul className="m-0 list-none divide-y divide-neutral-100/90 p-0" role="list">
        {stops.map((stop: SmallGroupRouteStop, index: number) => {
          const stayRaw = stop.stayDuration;
          const stayShow = !isPlaceholder(stayRaw) ? stayChipLabel(stayRaw) : '';
          const summary = condensedSummaryLine(stop);
          const seq = condensedSequenceLabel(stop, index, total);
          return (
            <li key={stop.id} className="relative m-0">
              <div className="flex min-w-0 gap-2.5 sm:gap-3">
                <div className="relative z-[1] flex w-7 shrink-0 justify-center pt-2.5 sm:w-8 sm:pt-3">
                  <span
                    className="sg-dp-itin-condensed-marker flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200/90 bg-gradient-to-b from-white to-stone-50 text-[10px] font-semibold tabular-nums shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_1px_2px_rgba(15,23,42,0.05)] sm:h-7 sm:w-7 sm:text-[11px]"
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="min-w-0 flex-1 py-2.5 sm:py-3">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="sg-dp-type-label-caps m-0 !text-[0.5625rem] !tracking-[0.12em]">{seq}</p>
                      <p className="sg-dp-card-title--feature m-0 mt-0.5 text-[15px] sm:text-[15.5px]">
                        {stop.title}
                      </p>
                      <p className="sg-dp-type-body m-0 mt-1 line-clamp-1 text-[13px] leading-snug sm:line-clamp-2 sm:text-[13.5px] sm:leading-relaxed">
                        {summary}
                      </p>
                      {stop.highlightLabel?.trim() ? (
                        <span className="sg-dp-highlight-chip mt-1.5 inline-flex max-w-full rounded-full border border-stone-200/85 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-[0_1px_0_rgba(255,255,255,0.95)_inset]">
                          {stop.highlightLabel.trim()}
                        </span>
                      ) : null}
                    </div>
                    {stayShow ? (
                      <span className="sg-dp-duration-pill mt-5 shrink-0 rounded-full border border-neutral-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums tracking-[-0.02em] shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_1px_2px_rgba(15,23,42,0.04)] sm:mt-6">
                        {stayShow}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Itinerary: collapsed = premium condensed timeline (scan). Expanded = full stop-by-stop depth.
 */
export default function SmallGroupCollapsibleItinerarySection({
  stops,
  metaLabels,
  sectionTitle = 'Your Day, Stop by Stop',
  sectionSubtitle = 'A carefully paced journey through East Jeju',
  sectionCardHint,
}: SmallGroupCollapsibleItinerarySectionProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();

  if (stops.length === 0) {
    return null;
  }

  return (
    <div className="sg-dp-intro-itinerary-wrap sg-dp-page-gutter pb-2 pt-1">
      <div className="sg-dp-page-column">
        <div className="sg-itin-cta-orbit rounded-2xl sm:rounded-[1.35rem]">
          <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-white/[0.98] shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_12px_40px_-18px_rgba(15,23,42,0.08)] sm:rounded-[calc(1.35rem-1px)]">
            <button
              type="button"
              id={headingId}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
              className="sg-dp-itin-cta-inner group/sgit relative w-full overflow-hidden px-4 py-3.5 text-left sm:px-5 sm:py-4"
            >
              <div className="relative flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                  <span className="sg-dp-icon-well sg-dp-icon-well--lg sg-dp-itin-cta-icon shrink-0">
                    <Route className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="sg-dp-type-label-caps !text-neutral-950/80">Itinerary</p>
                    <p className="sg-dp-type-itin-cta mt-0.5">{sectionTitle}</p>
                    <p className="sg-dp-type-itin-sub mt-0.5">
                      {open
                        ? 'Full route below · tap to collapse'
                        : `${stops.length} stops in view · open for photos, pacing notes & practicals`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                  <span className="sg-dp-type-meta hidden tabular-nums sm:inline">{stops.length} stops</span>
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.45, ease: ITIN_EXPAND_EASE }}
                    className="sg-dp-icon-well text-[color-mix(in_oklab,var(--sg-ota-label)_70%,var(--dp-fg)_30%)] transition-[border-color,background-color,color] duration-200 group-hover/sgit:border-[var(--sg-ota-border-hover)] group-hover/sgit:bg-white group-hover/sgit:text-[color-mix(in_oklab,var(--dp-fg)_78%,var(--sg-ota-label)_22%)]"
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </motion.span>
                </div>
              </div>
            </button>

            {!open ? (
              <div className="border-t border-neutral-200/60 bg-gradient-to-b from-stone-50/35 to-white px-3 pb-3.5 pt-1 sm:px-4 sm:pb-4">
                <SmallGroupItineraryCondensedList stops={stops} />
              </div>
            ) : null}
          </div>
        </div>

        <motion.div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          initial={false}
          animate={open ? 'open' : 'closed'}
          variants={{
            open: {
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.72, ease: ITIN_EXPAND_EASE },
                opacity: { duration: 0.48, delay: 0.1, ease: ITIN_EXPAND_EASE },
              },
            },
            closed: {
              height: 0,
              opacity: 0,
              transition: {
                opacity: { duration: 0.22, ease: ITIN_EXPAND_EASE },
                height: { duration: 0.56, delay: 0.05, ease: ITIN_EXPAND_EASE },
              },
            },
          }}
          style={{ overflow: 'hidden' }}
          className="will-change-[height,opacity]"
        >
          <div className="border-t border-neutral-200/70 pt-4 sm:pt-5">
            <SmallGroupRouteTimelineSection
              embedded
              compactEmbeddedHeader
              stops={stops}
              metaLabels={metaLabels}
              sectionTitle={sectionTitle}
              sectionSubtitle={sectionSubtitle}
              sectionCardHint={sectionCardHint}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
