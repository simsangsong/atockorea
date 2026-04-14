'use client';

import { useMemo } from 'react';
import { useTranslations } from '@/lib/i18n';
import type { SmallGroupRouteStop } from '../smallGroupDetailContent';

export interface SmallGroupRouteFlowStripSectionProps {
  stops: SmallGroupRouteStop[];
  eyebrow?: string;
  title?: string;
  lead?: string;
}

const TITLE_MAX = 26;

function truncateStopTitle(title: string, max: number): string {
  const t = title.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Split stop list into three contiguous arcs (data-driven day rhythm). */
function splitStopsIntoThree<T>(items: T[]): [T[], T[], T[]] {
  const n = items.length;
  if (n === 0) return [[], [], []];
  const firstLen = Math.ceil(n / 3);
  const rest = n - firstLen;
  const secondLen = Math.ceil(rest / 2);
  const thirdLen = n - firstLen - secondLen;
  return [
    items.slice(0, firstLen),
    items.slice(firstLen, firstLen + secondLen),
    items.slice(firstLen + secondLen),
  ];
}

function phaseRange(
  fromIndex: number,
  toIndex: number,
  tr: (key: string, values?: Record<string, number | string>) => string,
): string {
  const a = fromIndex + 1;
  const b = toIndex + 1;
  if (a === b) return tr('routeFlow.stopSingle', { n: a });
  return tr('routeFlow.stopRange', { from: a, to: b });
}

/**
 * Lightweight route-order module between itinerary and narrative—data from `stops`, no heavy media.
 */
export default function SmallGroupRouteFlowStripSection({
  stops,
  eyebrow: eyebrowProp,
  title: titleProp,
  lead: leadProp,
}: SmallGroupRouteFlowStripSectionProps) {
  const t = useTranslations('tour');

  const moodBlocks = useMemo(() => {
    const [a, b, c] = splitStopsIntoThree(stops);
    let idx = 0;
    const block = (slice: SmallGroupRouteStop[]) => {
      const from = idx;
      idx += slice.length;
      return {
        slice,
        fromIndex: slice.length > 0 ? from : null,
        toIndex: slice.length > 0 ? idx - 1 : null,
      };
    };
    return [block(a), block(b), block(c)] as const;
  }, [stops]);

  const eyebrow = eyebrowProp?.trim() || t('routeFlow.eyebrow');
  const title = titleProp?.trim() || t('routeFlow.title');
  const lead = leadProp?.trim() || t('routeFlow.lead', { count: stops.length });

  const showMoodStrip = stops.length >= 3;

  if (stops.length === 0) {
    return null;
  }

  return (
    <section
      id="sg-visual-break"
      className="sg-dp-route-flow-strip sg-dp-page-gutter scroll-mt-[var(--sg-sticky-clear)]"
      aria-labelledby="route-flow-strip-heading"
    >
      <div className="sg-dp-page-column">
        <header className="mb-3 max-w-xl sm:mb-3.5">
          <p className="sg-dp-type-utility-section-eyebrow m-0 mb-0.5 text-[10px] tracking-[0.14em] text-stone-500">
            {eyebrow}
          </p>
          <h2 id="route-flow-strip-heading" className="sg-dp-type-section-heading-support m-0 text-[1.05rem] tracking-[-0.02em] text-stone-900 sm:text-[1.125rem]">
            {title}
          </h2>
          <p className="sg-dp-type-meta m-0 mt-1 max-w-prose text-[12.5px] leading-snug text-[color-mix(in_oklab,var(--dp-muted)_52%,var(--dp-fg)_48%)] sm:text-[13px] sm:leading-normal">
            {lead}
          </p>
        </header>

        <div className="rounded-[14px] border border-stone-200/70 bg-[color-mix(in_oklab,var(--dp-secondary)_6%,#fafaf9)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:rounded-2xl sm:px-4 sm:py-3">
          <p className="sr-only">{t('routeFlow.flowListLabel')}</p>
          <ol className="m-0 flex list-none flex-wrap items-center gap-x-0 gap-y-2 p-0 [font-feature-settings:'kern'_1,'liga'_1]">
            {stops.map((stop: SmallGroupRouteStop, index: number) => {
              const shortTitle = truncateStopTitle(stop.title, TITLE_MAX);
              const num = String(index + 1).padStart(2, '0');
              return (
                <li key={stop.id} className="flex min-w-0 max-w-full items-center">
                  {index > 0 ? (
                    <span
                      className="mx-1.5 shrink-0 select-none text-[11px] font-medium tabular-nums tracking-[0.2em] text-stone-300 sm:mx-2 sm:text-xs"
                      aria-hidden
                    >
                      →
                    </span>
                  ) : null}
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-stone-200/85 bg-white/90 px-2 py-1 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_1px_2px_rgba(15,23,42,0.04)] sm:gap-2 sm:px-2.5 sm:py-1">
                    <span
                      className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-stone-400 sm:text-[11px]"
                      aria-hidden
                    >
                      {num}
                    </span>
                    <span className="min-w-0 truncate text-[11.5px] font-medium leading-tight tracking-[-0.015em] text-stone-800 sm:text-[12.5px]">
                      {shortTitle || t('routeFlow.unnamedStop')}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {showMoodStrip ? (
          <div
            className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-stone-200/65 bg-stone-200/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:mt-3.5 sm:rounded-[1rem]"
            aria-label={t('routeFlow.moodStripLabel')}
          >
            {(
              [
                { key: 'morning', label: t('routeFlow.morning'), block: moodBlocks[0] },
                { key: 'midday', label: t('routeFlow.midday'), block: moodBlocks[1] },
                { key: 'coast', label: t('routeFlow.coast'), block: moodBlocks[2] },
              ] as const
            ).map(
              (phase: {
                key: string;
                label: string;
                block: { slice: SmallGroupRouteStop[]; fromIndex: number | null; toIndex: number | null };
              }) => {
                const { slice, fromIndex, toIndex } = phase.block;
                if (slice.length === 0 || fromIndex == null || toIndex == null) {
                  return (
                    <div
                      key={phase.key}
                      className="bg-[color-mix(in_oklab,var(--dp-secondary)_4%,#fafaf8)] px-2 py-2 text-center sm:px-2.5 sm:py-2.5"
                    >
                      <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                        {phase.label}
                      </p>
                      <p className="sg-dp-type-meta m-0 mt-0.5 text-[10.5px] text-stone-400">—</p>
                    </div>
                  );
                }
                return (
                  <div
                    key={phase.key}
                    className="bg-[color-mix(in_oklab,var(--dp-secondary)_4%,#fafaf8)] px-2 py-2 text-center sm:px-2.5 sm:py-2.5"
                  >
                    <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                      {phase.label}
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] font-medium tabular-nums leading-snug text-stone-800 sm:text-[11.5px]">
                      {phaseRange(fromIndex, toIndex, t)}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
