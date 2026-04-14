'use client';

import { useMemo } from 'react';
import {
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

function clipLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
}

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

/** Extra CMS copy only when it is not identical to the primary route body. */
function supplementalDistinct(whyOrderBody: string, supplementalBody?: string): string {
  const w = whyOrderBody.trim();
  const s = (supplementalBody ?? '').trim();
  if (!s || s === w) return '';
  return s;
}

function buildFamilySeniorVisibleLine(family?: string | null, senior?: string | null): string | null {
  const f = family?.trim() ?? '';
  const s = senior?.trim() ?? '';
  if (!f && !s) return null;
  if (f && s) {
    return clipLine(`Families — ${f} Seniors — ${s}`, 200);
  }
  if (f) return clipLine(`Families — ${f}`, 160);
  return clipLine(`Seniors — ${s}`, 160);
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

/** Full route logic inside a single disclosure — no nested accordions. */
function RouteLogicExpansionContent({
  blocks,
  extraParagraphs,
}: {
  blocks: DayShapeBlock[];
  extraParagraphs: string[];
}) {
  return (
    <div className="space-y-6 sm:space-y-7">
      {blocks.map((block: DayShapeBlock) => (
        <div key={block.id} className="min-w-0">
          <h4 className="sg-dp-card-title m-0 text-[13.5px] leading-snug tracking-[-0.018em] sm:text-[14px]">{block.title}</h4>

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
      ))}

      {extraParagraphs.length > 0 ? (
        <div className="border-t border-[var(--sg-rule-whisper)] pt-5 sm:pt-6">
          <p className="sg-dp-type-label-caps m-0 !text-[10px] !tracking-[0.14em]">Editorial note</p>
          <div className="mt-2 space-y-2.5">
            {extraParagraphs.map((para: string, i: number) => (
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
      ) : null}
    </div>
  );
}

export interface SmallGroupWhyRouteWorksSectionProps {
  ideal: SmallGroupBestForLine[];
  notIdeal: SmallGroupBestForLine[];
  reasons: SmallGroupFlowReason[];
  adjustments: SmallGroupFlowAdjustment[];
  /** CMS / editorial body when there are no structured flow reasons */
  whyOrderBody: string;
  /** Long-form route logic; only shown when distinct from `whyOrderBody` */
  supplementalBody?: string;
  familyFitSummary?: string | null;
  seniorFitSummary?: string | null;
  /**
   * When true, renders as a guttered column fragment (no outer `<section>`, no primary header).
   * Parent supplies the merged “Why this tour works” landmark.
   */
  embedded?: boolean;
}

/**
 * Two-card editorial frame: fit and route logic each use a single disclosure (closed by default) — no duplicate preview copy outside the expander.
 */
export default function SmallGroupWhyRouteWorksSection({
  ideal,
  notIdeal,
  reasons,
  adjustments,
  whyOrderBody,
  supplementalBody,
  familyFitSummary,
  seniorFitSummary,
  embedded = false,
}: SmallGroupWhyRouteWorksSectionProps) {
  const hasFit = ideal.length > 0 || notIdeal.length > 0;
  const hasBothFitColumns = ideal.length > 0 && notIdeal.length > 0;
  const hasFlow = reasons.length > 0;
  const orderIntro = whyOrderBody.trim() ? whyOrderBody.trim() : FALLBACK_ORDER_COPY;
  const hasOrderContent = hasFlow || adjustments.length > 0 || Boolean(whyOrderBody.trim());
  const distinctSupplemental = supplementalDistinct(whyOrderBody, supplementalBody);

  const orderIntroParagraphs = useMemo(() => {
    const raw = orderIntro.trim();
    if (!raw) return [];
    const parts = raw.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [raw];
  }, [orderIntro]);

  const supplementalParagraphs = useMemo(() => {
    const raw = distinctSupplemental.trim();
    if (!raw) return [];
    const parts = raw.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [raw];
  }, [distinctSupplemental]);

  const dayShapeBlocks = useMemo(
    () => buildDayShapeBlocks(hasFlow, reasons, adjustments, orderIntroParagraphs),
    [hasFlow, reasons, adjustments, orderIntroParagraphs],
  );

  const familySeniorLine = useMemo(
    () => buildFamilySeniorVisibleLine(familyFitSummary, seniorFitSummary),
    [familyFitSummary, seniorFitSummary],
  );

  const expansionHasBody = dayShapeBlocks.length > 0 || supplementalParagraphs.length > 0;

  if (!hasFit && !hasOrderContent) {
    return null;
  }

  const columnBody = (
    <div className="flex flex-col gap-6 sm:gap-8 md:gap-9">
      {hasFit ? (
        <div className="sg-dp-route-curation-fit sg-dp-card-frame sg-dp-card-frame--tint-warm overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
          <details className="group sg-dp-expand-shell sg-dp-expand-shell--explanatory -mx-4 overflow-hidden sm:-mx-6 lg:-mx-7">
            <summary className="sg-dp-disclosure-summary sg-dp-accordion-trigger flex list-none items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-6 sm:py-4 lg:px-7">
              <div className="min-w-0">
                <p className="sg-dp-type-label-caps m-0 !text-[10px] !tracking-[0.16em]">Fit</p>
                <h3 className="sg-dp-type-subsection m-0 mt-1 leading-snug">Who it suits</h3>
              </div>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                aria-hidden
                strokeWidth={2}
              />
            </summary>
            <div className="border-t border-[var(--sg-card-stroke-soft)] px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4 lg:px-7">
              {hasBothFitColumns ? (
                <div className="flex flex-col gap-6 sm:grid sm:grid-cols-2 sm:gap-8 sm:divide-x sm:divide-[color:var(--sg-rule-soft)]">
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
                <div>
                  {ideal.length > 0 ? (
                    <FitColumn label="Suited" sublabel="Best for" items={ideal} markerClass="bg-neutral-900/30" />
                  ) : null}
                  {notIdeal.length > 0 ? (
                    <div
                      className={
                        ideal.length > 0
                          ? 'mt-6 border-t border-[color:var(--sg-rule-soft)] pt-6 sm:mt-8 sm:pt-8'
                          : ''
                      }
                    >
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
              {familySeniorLine ? (
                <p className="sg-dp-type-body m-0 mt-6 max-w-prose border-t border-[color:var(--sg-rule-soft)] pt-6 text-[13px] leading-relaxed text-neutral-700 sm:mt-8 sm:pt-8 sm:text-[14px]">
                  <span className="font-semibold text-neutral-900">Households &amp; seniors</span>
                  {' — '}
                  {familySeniorLine}
                </p>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}

      {hasOrderContent ? (
        <div className="sg-dp-card-frame overflow-hidden border-stone-200/80 bg-white/95 px-4 py-4 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
          <p className="sg-dp-type-label-caps m-0 !text-[10px] !tracking-[0.16em]">Design</p>
          <h3 className="sg-dp-type-subsection m-0 mt-1 leading-snug">Route logic</h3>

          {expansionHasBody ? (
            <details className="group sg-dp-expand-shell sg-dp-expand-shell--explanatory mt-3 overflow-hidden sm:mt-4">
              <summary className="sg-dp-disclosure-summary sg-dp-accordion-trigger flex list-none items-center justify-between gap-3 p-3.5 text-left sm:p-4">
                <div className="min-w-0">
                  <p className="sg-dp-type-label-caps m-0">Step inside the logic</p>
                  <p className="sg-dp-type-accordion mt-0.5 text-[13px] font-medium leading-snug text-neutral-800">
                    Pacing, sequence, and how we adapt on the day
                  </p>
                </div>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                  strokeWidth={2}
                />
              </summary>
              <div className="border-t border-[var(--sg-card-stroke-soft)] px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
                <RouteLogicExpansionContent blocks={dayShapeBlocks} extraParagraphs={supplementalParagraphs} />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="bg-transparent sg-dp-page-gutter font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1]">
        <div className="sg-dp-page-column">{columnBody}</div>
      </div>
    );
  }

  return (
    <section
      className="sg-dp-mid-slot-editorial sg-dp-section-rule sg-dp-section-band-primary bg-transparent sg-dp-page-gutter font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1]"
      aria-labelledby="why-route-works-heading"
    >
      <div className="sg-dp-page-column">
        <SmallGroupSectionHeader
          eyebrow="The route"
          title="Why this route works"
          description="Who this tour suits, and how we sequence the day—with one clear place for the full rationale."
          descriptionVariant="quiet"
          titleId="why-route-works-heading"
          titleVariant="feature"
        />
        {columnBody}
      </div>
    </section>
  );
}
