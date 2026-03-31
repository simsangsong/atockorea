'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Bath,
  Camera,
  ChevronDown,
  Clock,
  CloudSun,
  Footprints,
  Info,
  MessageCircle,
  Sparkles,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { SmallGroupRouteStop, SmallGroupRouteStopPracticalDetails } from '../smallGroupDetailContent';

const CARD_FACT_LIMIT = 3;

function stopSequenceHeading(stop: SmallGroupRouteStop, index: number, total: number): string {
  const raw = stop.sequenceLabel?.trim();
  if (raw) return raw;
  return `Stop ${index + 1} of ${total}`;
}

function practicalDetailLabel(key: string): string {
  const map: Record<string, string> = {
    officialHours: 'Official hours',
    lastTicketing: 'Last ticketing',
    holiday: 'Holidays / closures',
    fee: 'Admission',
    restroom: 'Restroom',
    parking: 'Parking',
    officialAverageTime: 'Typical visit',
  };
  return map[key] ?? key;
}

function practicalDetailEntries(d: SmallGroupRouteStopPracticalDetails): Array<[string, string]> {
  return (Object.entries(d) as Array<[keyof SmallGroupRouteStopPracticalDetails, string | undefined]>)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .map(([k, v]) => [practicalDetailLabel(String(k)), String(v).trim()]);
}

export interface SmallGroupRouteTimelineSectionProps {
  stops: SmallGroupRouteStop[];
  /** Defaults: "Your Day, Stop by Stop" */
  sectionTitle?: string;
  /** Defaults: generic East Jeju line */
  sectionSubtitle?: string;
  /** Optional hint under subtitle (card vs detail behavior). */
  sectionCardHint?: string;
  metaLabels?: Partial<
    Record<
      | 'description'
      | 'whyIncluded'
      | 'stayDuration'
      | 'walkingLevel'
      | 'photoTip'
      | 'restroom'
      | 'weatherNote'
      | 'delayNote',
      string
    >
  >;
  /** Inside collapsible: no outer horizontal padding (parent provides it). */
  embedded?: boolean;
  /** With `embedded`: slim intro (CTA card already carries the main title). */
  compactEmbeddedHeader?: boolean;
}

const DEFAULT_LABELS: Record<string, string> = {
  whyIncluded: 'Why This Stop',
  stayDuration: 'Duration',
  walkingLevel: 'Walking Effort',
  photoTip: 'Photo Tip',
  restroom: 'Restroom',
  weatherNote: 'Weather Note',
  delayNote: 'Flexibility',
};

function isPlaceholder(value: string): boolean {
  const t = value.trim();
  return t === '' || t === '—';
}

/** Subtle card tone from real fields + position — varies rhythm without new CMS keys. */
function deriveStopCardTone(
  stop: SmallGroupRouteStop,
  index: number,
  total: number
): 'highlight' | 'opener' | 'finale' | 'photo' | 'pace' | 'standard' {
  if (stop.highlightLabel?.trim()) return 'highlight';
  if (index === 0) return 'opener';
  if (index === total - 1) return 'finale';
  const photoCue =
    !isPlaceholder(stop.photoTip) || Boolean(stop.detailLayer?.photoDetails?.trim());
  if (photoCue) return 'photo';
  const walkHaystack = [stop.walkingLevel, ...(stop.cardFacts ?? [])].join(' ');
  if (/\b(moderate|hard|strenuous|steep|stairs|uneven|summit|crater)\b/i.test(walkHaystack)) {
    return 'pace';
  }
  return 'standard';
}

type StopCardTone = ReturnType<typeof deriveStopCardTone>;

/** Image badge: first numeric chunk + " min" (e.g. 45–60 min → 45 min). */
function durationBadgeLabel(stay: string): string {
  const m = stay.trim().match(/(\d+)/);
  if (m) return `${m[1]} min`;
  return stay.trim() || '—';
}

function StopDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="sg-dp-card-nested flex items-start gap-2.5 px-2.5 py-2 md:px-3 md:py-2.5">
      <Icon
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color-mix(in_oklab,var(--sg-ota-label)_62%,var(--dp-fg)_38%)]"
        aria-hidden
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1">
        <p className="sg-dp-type-label-caps mb-1 text-[0.625rem] tracking-[0.1em]">{label}</p>
        <p className="text-[0.8125rem] font-medium leading-snug tracking-[-0.012em] text-[color-mix(in_oklab,var(--dp-fg)_84%,var(--dp-muted)_16%)] [font-feature-settings:'kern'_1,'liga'_1] md:text-[0.84375rem] md:leading-[1.45]">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * (D) Stop-by-stop timeline — Detailpage reference: neutral rail, black index dots, white cards, dark duration chip.
 */
export default function SmallGroupRouteTimelineSection({
  stops,
  sectionTitle = 'Your Day, Stop by Stop',
  sectionSubtitle = 'A carefully paced journey through East Jeju',
  sectionCardHint,
  metaLabels,
  embedded = false,
  compactEmbeddedHeader = false,
}: SmallGroupRouteTimelineSectionProps) {
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const labelFor = (key: string) => metaLabels?.[key as keyof typeof metaLabels] || DEFAULT_LABELS[key] || key;

  if (stops.length === 0) {
    if (embedded) return null;
    return (
      <section className="bg-transparent sg-dp-page-gutter py-8 font-sans md:py-10">
        <div className="sg-dp-page-column">
          <p className="sg-dp-type-body sg-dp-type-body-quiet" role="status">
            Day flow will appear here once the route is published.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        embedded
          ? "bg-transparent px-0 py-0 font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1]"
          : "bg-transparent sg-dp-page-gutter py-8 font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1] md:py-10"
      }
    >
      <div className="sg-dp-page-column">
        {embedded && compactEmbeddedHeader ? (
          <div className="mb-3 border-b border-neutral-200/50 pb-3 sm:mb-4 md:border-[color:var(--sg-rule-soft)] md:pb-4">
            <p className="sg-dp-type-utility-section-eyebrow m-0 mb-0.5 md:mb-1">Stop-by-stop</p>
            <p className="sg-dp-type-body m-0 max-w-prose text-[13px] leading-snug md:text-[14px] md:leading-relaxed">
              {sectionSubtitle}
            </p>
            {sectionCardHint?.trim() ? (
              <p className="sg-dp-type-meta mt-2 m-0">{sectionCardHint.trim()}</p>
            ) : null}
          </div>
        ) : (
          <>
            <h2 className="sg-dp-section-h2 mb-2">{sectionTitle}</h2>
            <div className="mb-5 md:mb-6">
              <p className="sg-dp-type-section-lead m-0 max-w-prose text-pretty">{sectionSubtitle}</p>
              {sectionCardHint?.trim() ? (
                <p className="sg-dp-type-meta mt-2 m-0">{sectionCardHint.trim()}</p>
              ) : null}
            </div>
          </>
        )}

        <div className="relative">
          <div
            className="sg-dp-timeline-rail-line pointer-events-none absolute bottom-0 left-4 top-3 w-px md:left-[18px] md:top-2"
            aria-hidden
          />

          <div className="flex flex-col gap-5 md:gap-7">
            {stops.map((stop: SmallGroupRouteStop, index: number) => {
              const isExpanded = expandedStop === stop.id;
              const dl = stop.detailLayer;
              const showDelayFlat = !isPlaceholder(stop.delayNote);
              const showDelayDetail = dl?.delayNote && !isPlaceholder(dl.delayNote);
              const cardSummaryText = (stop.cardSummary ?? stop.description).trim();
              const cardFacts = (stop.cardFacts ?? [])
                .filter((f: string) => f.trim())
                .slice(0, CARD_FACT_LIMIT);
              const tone = deriveStopCardTone(stop, index, stops.length);
              const sequenceLine = stopSequenceHeading(stop, index, stops.length);
              const toneClass: Record<StopCardTone, string> = {
                highlight: 'sg-dp-stop-card--tone-highlight',
                opener: 'sg-dp-stop-card--tone-opener',
                finale: 'sg-dp-stop-card--tone-finale',
                photo: 'sg-dp-stop-card--tone-photo',
                pace: 'sg-dp-stop-card--tone-pace',
                standard: 'sg-dp-stop-card--tone-standard',
              };
              const mediaWide = index % 2 === 0;
              const indexRingClass =
                index === 0
                  ? 'ring-[3px] ring-white shadow-[0_2px_8px_rgba(15,23,42,0.12)]'
                  : index === stops.length - 1
                    ? 'ring-[2px] ring-stone-200/90'
                    : 'ring-[2px] ring-neutral-50';
              return (
                <div
                  key={stop.id}
                  className={`flex min-w-0 gap-2.5 sm:gap-3 md:gap-4 ${index % 2 === 1 ? 'md:pt-1' : ''}`}
                >
                  <div
                    className="relative z-[1] flex w-8 shrink-0 justify-center self-start md:w-9"
                    aria-hidden
                  >
                    <div
                      className={`sg-dp-stop-index-marker mt-8 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums md:mt-9 md:h-9 md:w-9 md:text-[12px] ${indexRingClass}`}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </div>
                  </div>

                  <article className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
                      aria-expanded={isExpanded}
                      aria-label={`${stop.title}. View details`}
                      className={`sg-dp-surface-step sg-dp-surface-step--interactive sg-dp-stop-card w-full cursor-pointer overflow-hidden text-left ${toneClass[tone]}`}
                    >
                      {stop.imageUrl ? (
                        <div
                          className={`relative w-full overflow-hidden ${
                            mediaWide
                              ? 'aspect-[16/10] sm:aspect-[5/3]'
                              : 'aspect-[5/4] sm:aspect-[4/3]'
                          }`}
                        >
                          <Image
                            src={stop.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 48rem"
                            loading="lazy"
                          />
                          <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10"
                            aria-hidden
                          />
                          {!isPlaceholder(stop.displayTime ?? '') ? (
                            <div className="sg-dp-media-duration-pill absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold tabular-nums tracking-[-0.02em] shadow-sm ring-1 ring-black/5 backdrop-blur-[2px] md:left-3.5 md:top-3.5 md:px-3 md:py-1.5 md:text-[12px]">
                              <Clock
                                className="h-3 w-3 shrink-0 text-[color-mix(in_oklab,var(--sg-ota-label)_65%,var(--dp-fg)_35%)]"
                                aria-hidden
                                strokeWidth={2}
                              />
                              {stop.displayTime}
                            </div>
                          ) : null}
                          {!isPlaceholder(stop.stayDuration) ? (
                            <div className="sg-dp-media-stay-pill absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium tabular-nums text-white backdrop-blur-md md:bottom-3.5 md:right-3.5">
                              <Clock className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden strokeWidth={2} />
                              {durationBadgeLabel(stop.stayDuration)}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="px-4 pb-4 pt-4 [font-feature-settings:'kern'_1,'liga'_1] md:px-5 md:pb-5 md:pt-[1.125rem]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="sg-dp-stop-sequence">{sequenceLine}</p>
                            {!stop.imageUrl && !isPlaceholder(stop.displayTime ?? '') ? (
                              <p className="sg-dp-type-meta mt-1 m-0 tabular-nums">
                                {stop.displayTime}
                              </p>
                            ) : null}
                            {stop.highlightLabel ? (
                              <p className="sg-dp-highlight-chip mb-2 mt-1 inline-flex max-w-full items-center rounded-full border border-stone-200/90 bg-white px-2.5 py-1 text-[10px] font-semibold leading-none tracking-wide shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04)] md:text-[11px] md:px-3">
                                {stop.highlightLabel}
                              </p>
                            ) : null}
                            <h3
                              className={`sg-dp-card-title--feature text-balance ${stop.highlightLabel ? '' : 'mt-1'}`}
                            >
                              {stop.title}
                            </h3>
                          </div>
                          <ChevronDown
                            className={`mt-1 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 ease-out ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            aria-hidden
                            strokeWidth={2}
                          />
                        </div>

                        <p
                          className={`sg-dp-type-body mt-2.5 text-pretty md:mt-3 md:leading-[1.52] ${
                            stop.cardSummary?.trim() ? 'line-clamp-2' : ''
                          }`}
                        >
                          {cardSummaryText || '—'}
                        </p>

                        {cardFacts.length > 0 ? (
                          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                            {cardFacts.map((fact: string, fi: number) => (
                              <li
                                key={`${stop.id}-fact-${fi}`}
                                className="sg-dp-type-meta flex gap-2 font-medium leading-snug"
                              >
                                <span
                                  className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-neutral-400/90"
                                  aria-hidden
                                />
                                <span>{fact}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {stop.tags && stop.tags.length > 0 ? (
                          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-neutral-200/60 pt-3 md:mt-4 md:pt-3.5">
                            {stop.tags.map((tag: string, ti: number) => (
                              <span
                                key={`${stop.id}-tag-${ti}`}
                                className="inline-flex rounded-md border border-neutral-200/80 bg-gradient-to-b from-white to-stone-50/90 px-2 py-1 text-[10px] font-semibold tracking-[-0.01em] text-neutral-600 md:text-[11px]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {isExpanded ? (
                          <div className="mt-4 border-t border-[var(--sg-card-stroke-soft)] pt-4 md:mt-5 md:pt-5">
                            {dl ? (
                              <>
                                {(dl.detailIntro?.trim() ||
                                  (dl.highlights && dl.highlights.length > 0) ||
                                  (dl.experienceFlow && dl.experienceFlow.length > 0)) && (
                                  <div className="sg-dp-stop-narrative-well mb-5 px-3 py-3.5 md:px-4 md:py-4">
                                    <p className="sg-dp-type-label-caps mb-2.5">On this stop</p>
                                    {dl.detailIntro?.trim() ? (
                                      <p className="sg-dp-type-body-strong sg-dp-stop-detail-lead m-0">{dl.detailIntro.trim()}</p>
                                    ) : null}
                                    {dl.highlights && dl.highlights.length > 0 ? (
                                      <div className={dl.detailIntro?.trim() ? 'mt-3' : ''}>
                                        <p className="sg-dp-type-label-caps mb-2">Highlights</p>
                                        <ul className="sg-dp-type-body-strong sg-dp-stop-highlight-list m-0 list-none space-y-1.5 pl-0">
                                          {dl.highlights.map((h: string, hi: number) => (
                                            <li key={`${stop.id}-hl-${hi}`} className="flex gap-2">
                                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden />
                                              <span>{h}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                    {dl.experienceFlow && dl.experienceFlow.length > 0 ? (
                                      <div
                                        className={
                                          dl.detailIntro?.trim() || (dl.highlights && dl.highlights.length > 0)
                                            ? 'mt-4'
                                            : ''
                                        }
                                      >
                                        <p className="sg-dp-type-label-caps mb-2">How the time is used</p>
                                        <ol className="sg-dp-type-body-strong m-0 list-decimal space-y-1.5 pl-4 text-neutral-700 marker:text-neutral-400">
                                          {dl.experienceFlow.map((line: string, li: number) => (
                                            <li key={`${stop.id}-flow-${li}`} className="pl-1">
                                              {line}
                                            </li>
                                          ))}
                                        </ol>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                                {dl.routeReason?.trim() ? (
                                  <div className="mb-5">
                                    <p className="sg-dp-type-label-caps mb-2.5">Why it’s on this route</p>
                                    <StopDetail
                                      icon={Sparkles}
                                      label={labelFor('whyIncluded')}
                                      value={dl.routeReason.trim()}
                                    />
                                  </div>
                                ) : null}
                                <p className="sg-dp-type-label-caps mb-3">Logistics &amp; tips</p>
                                <div className="grid gap-3 sm:grid-cols-2 sm:gap-3.5">
                                  {!isPlaceholder(stop.displayTime ?? '') ? (
                                    <StopDetail icon={Clock} label="Time" value={stop.displayTime ?? ''} />
                                  ) : null}
                                  {!isPlaceholder(stop.stayDuration) ? (
                                    <StopDetail
                                      icon={Timer}
                                      label={labelFor('stayDuration')}
                                      value={stop.stayDuration}
                                    />
                                  ) : null}
                                  {!isPlaceholder(stop.walkingLevel) ? (
                                    <StopDetail
                                      icon={Footprints}
                                      label={labelFor('walkingLevel')}
                                      value={stop.walkingLevel}
                                    />
                                  ) : null}
                                </div>
                                {dl.practicalDetails ? (
                                  <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-3.5">
                                    {practicalDetailEntries(dl.practicalDetails).map(([lbl, val]) => (
                                      <StopDetail key={`${stop.id}-pr-${lbl}`} icon={Info} label={lbl} value={val} />
                                    ))}
                                  </div>
                                ) : null}
                                {dl.photoDetails?.trim() ? (
                                  <div className="mt-4">
                                    <StopDetail
                                      icon={Camera}
                                      label={labelFor('photoTip')}
                                      value={dl.photoDetails.trim()}
                                    />
                                  </div>
                                ) : null}
                                {dl.facilityDetails?.trim() ? (
                                  <div className="mt-4">
                                    <StopDetail icon={Bath} label="Facilities" value={dl.facilityDetails.trim()} />
                                  </div>
                                ) : null}
                                {dl.smartTip?.trim() ? (
                                  <div className="mt-4">
                                    <StopDetail icon={Sparkles} label="Smart tip" value={dl.smartTip.trim()} />
                                  </div>
                                ) : null}
                                {dl.commonReaction?.trim() ? (
                                  <div className="mt-4">
                                    <StopDetail
                                      icon={MessageCircle}
                                      label="Guest note"
                                      value={dl.commonReaction.trim()}
                                    />
                                  </div>
                                ) : null}
                                {dl.skipNote?.trim() ? (
                                  <div className="mt-4">
                                    <StopDetail icon={Info} label="If you want to keep it light" value={dl.skipNote.trim()} />
                                  </div>
                                ) : null}
                                {dl.weatherNote?.trim() ? (
                                  <div className="mt-4">
                                    <StopDetail
                                      icon={CloudSun}
                                      label={labelFor('weatherNote')}
                                      value={dl.weatherNote.trim()}
                                    />
                                  </div>
                                ) : null}
                                {showDelayDetail ? (
                                  <div className="mt-4">
                                    <StopDetail
                                      icon={Timer}
                                      label={labelFor('delayNote')}
                                      value={dl.delayNote!.trim()}
                                    />
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <p className="sg-dp-type-label-caps mb-3">Practical details</p>
                                <div className="grid gap-3 sm:grid-cols-2 sm:gap-3.5">
                                  {!isPlaceholder(stop.whyIncluded) ? (
                                    <StopDetail
                                      icon={Sparkles}
                                      label={labelFor('whyIncluded')}
                                      value={stop.whyIncluded}
                                    />
                                  ) : null}
                                  {!isPlaceholder(stop.displayTime ?? '') ? (
                                    <StopDetail icon={Clock} label="Time" value={stop.displayTime ?? ''} />
                                  ) : null}
                                  {!isPlaceholder(stop.stayDuration) ? (
                                    <StopDetail
                                      icon={Timer}
                                      label={labelFor('stayDuration')}
                                      value={stop.stayDuration}
                                    />
                                  ) : null}
                                  {!isPlaceholder(stop.walkingLevel) ? (
                                    <StopDetail
                                      icon={Footprints}
                                      label={labelFor('walkingLevel')}
                                      value={stop.walkingLevel}
                                    />
                                  ) : null}
                                  {!isPlaceholder(stop.restroom) ? (
                                    <StopDetail icon={Bath} label={labelFor('restroom')} value={stop.restroom} />
                                  ) : null}
                                  {!isPlaceholder(stop.photoTip) ? (
                                    <StopDetail
                                      icon={Camera}
                                      label={labelFor('photoTip')}
                                      value={stop.photoTip}
                                    />
                                  ) : null}
                                  {!isPlaceholder(stop.weatherNote) ? (
                                    <StopDetail
                                      icon={CloudSun}
                                      label={labelFor('weatherNote')}
                                      value={stop.weatherNote}
                                    />
                                  ) : null}
                                  {showDelayFlat ? (
                                    <StopDetail icon={Timer} label={labelFor('delayNote')} value={stop.delayNote} />
                                  ) : null}
                                </div>
                              </>
                            )}
                            {stop.moreDetails?.trim() ? (
                              <details className="group mt-5 border-t border-[var(--sg-card-stroke-soft)] pt-4 md:mt-6 md:pt-5">
                                <summary className="sg-dp-disclosure-summary flex items-center gap-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:text-neutral-700">
                                  <ChevronDown
                                    className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                  More on this stop
                                </summary>
                                <p className="sg-dp-type-body m-0 mt-2.5 max-w-prose whitespace-pre-line leading-relaxed">
                                  {stop.moreDetails.trim()}
                                </p>
                              </details>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
