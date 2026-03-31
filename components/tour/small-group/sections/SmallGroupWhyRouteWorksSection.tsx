'use client';

import { useMemo } from 'react';
import {
  Clock,
  CloudRain,
  ChevronDown,
  MapPin,
  Route,
  Sun,
  Sunset,
  Utensils,
  Users,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type {
  SmallGroupBestForLine,
  SmallGroupFlowAdjustment,
  SmallGroupFlowReason,
  SmallGroupFlowReasonIconKey,
} from '../smallGroupDetailContent';
import SmallGroupSectionHeader from '../SmallGroupSectionHeader';

const ICONS: Record<SmallGroupFlowReasonIconKey, LucideIcon> = {
  sun: Sun,
  mapPin: MapPin,
  utensils: Utensils,
  sunset: Sunset,
  wind: Wind,
  users: Users,
  cloudRain: CloudRain,
};

const FALLBACK_ORDER_COPY =
  'We order the day so energy and light work in your favour — quieter stretches when you need them, and the right moments in the right light.';

type DayShapeBlock =
  | { id: string; title: string; kind: 'reasons'; reasons: SmallGroupFlowReason[] }
  | { id: string; title: string; kind: 'adjustments'; adjustments: SmallGroupFlowAdjustment[] }
  | { id: string; title: string; kind: 'text'; paragraphs: string[] };

function chunkTextForPrinciples(paragraphs: string[]): string[] {
  const p = paragraphs.map((x) => x.trim()).filter(Boolean);
  if (p.length === 0) return [];
  if (p.length === 1) {
    const blocks = p[0].split(/\n\s*\n+/).map((x) => x.trim()).filter(Boolean);
    if (blocks.length >= 3) return [blocks[0], blocks[1], blocks.slice(2).join('\n\n')];
    const sentences = p[0]
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length >= 4) {
      const n = Math.ceil(sentences.length / 3);
      return [
        sentences.slice(0, n).join(' '),
        sentences.slice(n, n * 2).join(' '),
        sentences.slice(n * 2).join(' '),
      ];
    }
    return [p[0], '', ''];
  }
  if (p.length === 2) return [p[0], p[1], ''];
  return [p[0], p[1], p.slice(2).join('\n\n')];
}

function buildDayShapeBlocks(
  hasFlow: boolean,
  reasons: SmallGroupFlowReason[],
  adjustments: SmallGroupFlowAdjustment[],
  orderIntroParagraphs: string[],
): DayShapeBlock[] {
  if (hasFlow && reasons.length > 0) {
    const pacing: SmallGroupFlowReason[] = [];
    if (reasons[0]) pacing.push(reasons[0]);
    if (reasons.length > 3 && reasons[3]) pacing.push(reasons[3]);
    if (reasons.length > 4 && reasons[4]) pacing.push(reasons[4]);

    const sequence: SmallGroupFlowReason[] = [];
    if (reasons.length > 1 && reasons[1]) sequence.push(reasons[1]);
    if (reasons.length > 2 && reasons[2]) sequence.push(reasons[2]);

    const out: DayShapeBlock[] = [
      { id: 'shape-pacing', title: 'Pacing & energy', kind: 'reasons', reasons: pacing },
      { id: 'shape-sequence', title: 'Route build', kind: 'reasons', reasons: sequence },
    ];

    if (adjustments.length > 0) {
      out.push({
        id: 'shape-flex',
        title: 'When conditions shift',
        kind: 'adjustments',
        adjustments,
      });
    } else {
      const tail = orderIntroParagraphs.map((x) => x.trim()).filter(Boolean).slice(-1)[0] ?? '';
      if (tail) {
        out.push({
          id: 'shape-flex',
          title: 'When conditions shift',
          kind: 'text',
          paragraphs: [tail],
        });
      }
    }
    return out.filter((b) => {
      if (b.kind === 'reasons') return b.reasons.length > 0;
      if (b.kind === 'adjustments') return b.adjustments.length > 0;
      return b.paragraphs.some((x) => x.trim());
    });
  }

  const chunks = chunkTextForPrinciples(orderIntroParagraphs);
  const titles = ['How the day opens', 'How the middle works', 'When the plan adapts'];
  const out: DayShapeBlock[] = [];

  if (chunks[0]?.trim()) {
    out.push({
      id: 'shape-txt-0',
      title: titles[0],
      kind: 'text',
      paragraphs: [chunks[0].trim()],
    });
  }
  if (chunks[1]?.trim()) {
    out.push({
      id: 'shape-txt-1',
      title: titles[1],
      kind: 'text',
      paragraphs: [chunks[1].trim()],
    });
  }
  if (adjustments.length > 0) {
    out.push({
      id: 'shape-flex',
      title: titles[2],
      kind: 'adjustments',
      adjustments,
    });
  } else if (chunks[2]?.trim()) {
    out.push({
      id: 'shape-txt-2',
      title: titles[2],
      kind: 'text',
      paragraphs: [chunks[2].trim()],
    });
  }

  return out.filter((b) => {
    if (b.kind === 'reasons') return b.reasons.length > 0;
    if (b.kind === 'adjustments') return b.adjustments.length > 0;
    return b.paragraphs.some((x) => x.trim());
  });
}

function FitColumn({
  label,
  sublabel,
  items,
  markerClass,
}: {
  label: string;
  sublabel: string;
  items: SmallGroupBestForLine[];
  markerClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="sg-dp-type-label-caps m-0 !text-[11px] !tracking-[0.14em]">{label}</p>
      <h3 className="sg-dp-type-subsection mt-1">{sublabel}</h3>
      <ul className="m-0 mt-3 list-none space-y-2.5 p-0 sm:mt-4">
        {items.map((item: SmallGroupBestForLine, i: number) => (
          <li key={`${item.text}-${i}`} className="flex gap-3">
            <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${markerClass}`} aria-hidden />
            <span className="sg-dp-type-body-strong text-[14px] leading-snug" title={item.detail ? item.detail : undefined}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PillarIcon({ name }: { name: 'pacing' | 'sequence' | 'flex' }) {
  const Icon = name === 'pacing' ? Clock : name === 'sequence' ? Route : CloudRain;
  return (
    <div className="sg-dp-day-principle-card__icon" aria-hidden>
      <Icon className="h-[17px] w-[17px] text-neutral-600 sm:h-[18px] sm:w-[18px]" strokeWidth={1.75} />
    </div>
  );
}

function DayShapePrincipleCard({ block, index }: { block: DayShapeBlock; index: number }) {
  const pillar: 'pacing' | 'sequence' | 'flex' =
    block.id === 'shape-pacing'
      ? 'pacing'
      : block.id === 'shape-sequence'
        ? 'sequence'
        : block.id === 'shape-flex'
          ? 'flex'
          : index === 0
            ? 'pacing'
            : index === 1
              ? 'sequence'
              : 'flex';

  return (
    <article className="sg-dp-day-principle-card">
      <div className="flex gap-3 sm:gap-3.5">
        <PillarIcon name={pillar} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h4 className="sg-dp-card-title m-0 text-[14px] leading-snug tracking-[-0.018em] sm:text-[14.5px]">{block.title}</h4>

          {block.kind === 'reasons' ? (
            <ul className="sg-dp-day-principle-list mt-2.5 sm:mt-3">
              {block.reasons.map((reason: SmallGroupFlowReason) => {
                const Icon = ICONS[reason.icon] ?? Sun;
                const line = reason.summary?.trim() || reason.description?.trim() || '';
                return (
                  <li key={reason.id} className="m-0">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" strokeWidth={1.75} aria-hidden />
                      <div className="min-w-0">
                        <p className="m-0 text-[12.5px] font-semibold leading-snug tracking-[-0.012em] text-neutral-800 sm:text-[13px]">
                          {reason.title}
                        </p>
                        {line ? (
                          <p className="sg-dp-type-body m-0 mt-1 text-[12.5px] leading-relaxed sm:text-[13px]">{line}</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {block.kind === 'adjustments' ? (
            <ul className="sg-dp-day-principle-list m-0 mt-2.5 list-none p-0 sm:mt-3">
              {block.adjustments.map((adj: SmallGroupFlowAdjustment) => {
                const Icon = ICONS[adj.icon] ?? CloudRain;
                return (
                  <li key={adj.id} className="m-0">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" strokeWidth={1.75} aria-hidden />
                      <div className="min-w-0">
                        <p className="m-0 text-[12.5px] font-semibold leading-snug text-neutral-800 sm:text-[13px]">{adj.title}</p>
                        <p className="sg-dp-type-body m-0 mt-0.5 text-[12.5px] leading-relaxed sm:text-[13px]">
                          {adj.description}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {block.kind === 'text' ? (
            <div className="mt-2.5 space-y-2 sm:mt-3">
              {block.paragraphs.map((para: string, i: number) => (
                <p key={i} className="sg-dp-type-body m-0 text-[12.5px] leading-relaxed sm:text-[13px]">
                  {para.split('\n').map((line: string, j: number) => (
                    <span key={j}>
                      {j > 0 ? <br /> : null}
                      {line.trim()}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export interface SmallGroupWhyRouteWorksSectionProps {
  ideal: SmallGroupBestForLine[];
  notIdeal: SmallGroupBestForLine[];
  reasons: SmallGroupFlowReason[];
  adjustments: SmallGroupFlowAdjustment[];
  /** CMS / editorial body when there are no structured flow reasons */
  whyOrderBody: string;
  /** Long-form route logic (e.g. East Signature); shown when `reasons` non-empty */
  supplementalBody?: string;
}

/**
 * Route curation: editorial fit frame + composed “how we shape the day” pillars.
 */
export default function SmallGroupWhyRouteWorksSection({
  ideal,
  notIdeal,
  reasons,
  adjustments,
  whyOrderBody,
  supplementalBody,
}: SmallGroupWhyRouteWorksSectionProps) {
  const hasFit = ideal.length > 0 || notIdeal.length > 0;
  const hasBothFitColumns = ideal.length > 0 && notIdeal.length > 0;
  const hasFlow = reasons.length > 0;
  const orderIntro = whyOrderBody.trim() ? whyOrderBody.trim() : FALLBACK_ORDER_COPY;
  const hasOrderContent = hasFlow || adjustments.length > 0 || Boolean(whyOrderBody.trim());
  const showSupplemental = hasFlow && Boolean(supplementalBody?.trim());

  const orderIntroParagraphs = useMemo(() => {
    const raw = orderIntro.trim();
    if (!raw) return [];
    const parts = raw.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [raw];
  }, [orderIntro]);

  const supplementalParagraphs = useMemo(() => {
    const raw = (supplementalBody ?? '').trim();
    if (!raw) return [];
    const parts = raw.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [raw];
  }, [supplementalBody]);

  const dayShapeBlocks = useMemo(
    () => buildDayShapeBlocks(hasFlow, reasons, adjustments, orderIntroParagraphs),
    [hasFlow, reasons, adjustments, orderIntroParagraphs],
  );

  const dayShapeLead = useMemo(() => {
    if (hasFlow && reasons.length > 0) {
      return 'Context before the coast, energy matched to the decision-heavy stop, and measured flex when sites or weather require it.';
    }
    const first = orderIntroParagraphs[0]?.trim() ?? '';
    if (!first) return '';
    if (first.length <= 200) return first;
    return `${first.slice(0, 197).trim()}…`;
  }, [hasFlow, reasons.length, orderIntroParagraphs]);

  if (!hasFit && !hasOrderContent) {
    return null;
  }

  const shapeCount = dayShapeBlocks.length;

  return (
    <section
      className="sg-dp-mid-slot-editorial sg-dp-section-rule sg-dp-section-band-primary bg-transparent sg-dp-page-gutter font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1]"
      aria-labelledby="why-route-works-heading"
    >
      <div className="sg-dp-page-column">
        <SmallGroupSectionHeader
          eyebrow="The route"
          title="Why this route works"
          description="Balanced pacing, landmark-led sequencing, and coastal flow—framed for comfort and clarity on the day."
          descriptionVariant="quiet"
          titleId="why-route-works-heading"
          titleVariant="feature"
        />

        <div className="flex flex-col gap-5 sm:gap-6 md:gap-7">
          {hasFit ? (
            <div className="sg-dp-route-curation-fit sg-dp-card-frame sg-dp-card-frame--tint-warm overflow-hidden px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
              <p className="sg-dp-type-label-caps m-0 !text-[10px] !tracking-[0.16em]">Who it suits</p>
              {hasBothFitColumns ? (
                <div className="mt-4 flex flex-col gap-6 sm:mt-5 sm:grid sm:grid-cols-2 sm:gap-8 sm:divide-x sm:divide-[color:var(--sg-rule-soft)]">
                  <div className="min-w-0 sm:pr-6">
                    <FitColumn
                      label="Suited"
                      sublabel="Best for"
                      items={ideal}
                      markerClass="bg-neutral-900/30"
                    />
                  </div>
                  <div className="min-w-0 sm:pl-6">
                    <FitColumn
                      label="Heads-up"
                      sublabel="Less ideal for"
                      items={notIdeal}
                      markerClass="bg-stone-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 sm:mt-5">
                  {ideal.length > 0 ? (
                    <FitColumn
                      label="Suited"
                      sublabel="Best for"
                      items={ideal}
                      markerClass="bg-neutral-900/30"
                    />
                  ) : null}
                  {notIdeal.length > 0 ? (
                    <div className={ideal.length > 0 ? 'mt-6 border-t border-[color:var(--sg-rule-soft)] pt-6 sm:mt-8 sm:pt-8' : ''}>
                      <FitColumn
                        label="Heads-up"
                        sublabel="Less ideal for"
                        items={notIdeal}
                        markerClass="bg-stone-400"
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {hasOrderContent ? (
            <div
              className={
                hasFit ? 'border-t border-neutral-200/45 pt-4 sm:border-[color:var(--sg-rule-soft)] sm:pt-5' : ''
              }
            >
              <div className="mb-4 sm:mb-5">
                <p className="sg-dp-type-utility-section-eyebrow m-0 mb-0.5 sm:mb-1">Day design</p>
                <h3 className="sg-dp-type-subsection m-0 leading-snug" id="how-we-shape-day-heading">
                  How we shape the day
                </h3>
                {dayShapeLead ? (
                  <p className="sg-dp-type-body m-0 mt-2 max-w-prose text-[13px] leading-relaxed sm:mt-2.5 sm:text-[14px]">
                    {dayShapeLead}
                  </p>
                ) : null}
              </div>

              {shapeCount > 0 ? (
                <div className="sg-dp-day-shape-module">
                  <div className="sg-dp-day-shape-grid" data-shape-count={String(shapeCount)}>
                    {dayShapeBlocks.map((block: DayShapeBlock, index: number) => (
                      <DayShapePrincipleCard key={block.id} block={block} index={index} />
                    ))}
                  </div>
                </div>
              ) : null}

              {showSupplemental ? (
                <details className="group sg-dp-expand-shell sg-dp-expand-shell--explanatory mt-4 overflow-hidden p-0 sm:mt-5">
                  <summary className="sg-dp-disclosure-summary sg-dp-accordion-trigger flex list-none items-center justify-between gap-3 p-4 text-left md:px-5 md:py-4">
                    <div className="min-w-0">
                      <p className="sg-dp-type-label-caps">Full route logic</p>
                      <h4 className="sg-dp-type-accordion mt-1">Stop order in detail</h4>
                    </div>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                      aria-hidden
                      strokeWidth={2}
                    />
                  </summary>
                  <div className="border-t border-[var(--sg-card-stroke-soft)] px-4 pb-4 pt-3 md:px-5 md:pb-5">
                    <div className="space-y-2.5">
                      {supplementalParagraphs.map((para: string, i: number) => (
                        <p key={i} className="sg-dp-type-body m-0 text-[13px] leading-relaxed sm:text-[14px]">
                          {para.split('\n').map((line: string, j: number) => (
                            <span key={j}>
                              {j > 0 ? <br /> : null}
                              {line.trim()}
                            </span>
                          ))}
                        </p>
                      ))}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
