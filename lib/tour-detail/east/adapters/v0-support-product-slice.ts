import type { SmallGroupDetailContent, SmallGroupPracticalAccordionKey, SmallGroupPracticalBlock } from '@/components/tour/small-group/smallGroupDetailContent';
import {
  groupPracticalBlocksByAccordion,
  partitionFaqItems,
  resolveEditorialPresentation,
} from '@/components/tour/small-group/smallGroupDetailContent';

const PLACEHOLDER_PREVIEW = 'Information for this topic will be confirmed with your booking.';

function clipPreview(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
}

function accordionTriggerPreview(key: SmallGroupPracticalAccordionKey, blocks: SmallGroupPracticalBlock[]): string {
  const nonEmptyBodies = blocks.filter((b) => b.body.trim());
  const parts: string[] = [];
  let total = 0;
  for (const b of nonEmptyBodies) {
    const t = b.body.trim();
    const first = t.split(/(?<=[.!?])\s+/)[0]?.trim() ?? t;
    const piece = clipPreview(first, 88);
    if (!piece) continue;
    if (total + piece.length > 135 && parts.length >= 1) break;
    parts.push(piece);
    total += piece.length + 3;
    if (parts.length >= 2) break;
  }
  if (parts.length > 0) return parts.join(' · ');
  if (key === 'includedNotIncluded') {
    return 'What the rate covers and what to budget separately.';
  }
  return PLACEHOLDER_PREVIEW;
}

const POSITIVE_INCLUDED_IDS = new Set(['included', 'meal', 'lunch']);
const NEGATIVE_INCLUDED_IDS = new Set(['notIncluded', 'not_included', 'extras']);

function splitBodyToLines(block: SmallGroupPracticalBlock): string[] {
  const lines: string[] = [];
  const main = block.body.trim();
  if (main) {
    const chunks = main.split(/\s*·\s*|\n+/).map((s) => s.trim()).filter(Boolean);
    lines.push(...(chunks.length > 0 ? chunks : [main]));
  }
  const more = block.moreDetails?.trim();
  if (more) lines.push(more);
  return lines;
}

export type V0PracticalAccordionRenderMode = 'bullets' | 'includedSplit';

export type V0PracticalAccordionItem = {
  id: string;
  title: string;
  preview: string;
  renderMode: V0PracticalAccordionRenderMode;
  content?: string[];
  includedLines?: string[];
  excludedLines?: string[];
};

export type V0SeasonalVariationCard = {
  id: string;
  name: string;
  description: string;
  tag: string;
  bgClass: string;
  iconColor: string;
};

export type V0FaqQuestion = { id: string; question: string; answer: string };

export type V0BookingTrustCard = {
  title: string;
  description: string;
  /** 0 = licensed, 1 = route, 2 = group — maps to v0 Lucide icons */
  iconIndex: number;
};

export type V0SupportTimelineStep = { timing: string; title: string; detail: string };

export type V0EastSupportProductSlice = {
  practicalAccordionItems: V0PracticalAccordionItem[];
  practicalSectionSubtitle: string;
  seasonalVariations: V0SeasonalVariationCard[];
  /** Pre-partitioned (same order as small-group FAQ section). */
  faqMain: V0FaqQuestion[];
  faqMore: V0FaqQuestion[];
  faqSectionSubtitle: string;
  faqEmptyMessage: string;
  trustCards: V0BookingTrustCard[];
  supportTimelineSteps: V0SupportTimelineStep[];
  contactHref: string;
};

const SEASON_STYLE: Record<
  string,
  { bgClass: string; iconColor: string; defaultTag: string }
> = {
  spring: { bgClass: 'bg-spring', iconColor: 'text-pink-500', defaultTag: 'Season notes' },
  summer: { bgClass: 'bg-summer', iconColor: 'text-sky-500', defaultTag: 'Season notes' },
  fall: { bgClass: 'bg-autumn', iconColor: 'text-amber-600', defaultTag: 'Season notes' },
  autumn: { bgClass: 'bg-autumn', iconColor: 'text-amber-600', defaultTag: 'Season notes' },
  winter: { bgClass: 'bg-winter', iconColor: 'text-slate-500', defaultTag: 'Season notes' },
  rainy: { bgClass: 'bg-mist-blue/40', iconColor: 'text-sky-600', defaultTag: 'Rainy day' },
  windy: { bgClass: 'bg-cloud-gray/50', iconColor: 'text-slate-600', defaultTag: 'Windy day' },
  peak: { bgClass: 'bg-sand-blush/50', iconColor: 'text-amber-700', defaultTag: 'Peak season' },
};

function seasonalTabsToV0Cards(content: SmallGroupDetailContent): V0SeasonalVariationCard[] {
  const ed = resolveEditorialPresentation(content);
  const tabs = ed.seasonalTabs;
  if (!tabs.length) return [];

  return tabs.slice(0, 8).map((tab) => {
    const id = tab.id.toLowerCase();
    const style = SEASON_STYLE[id] ?? {
      bgClass: 'bg-soft-pearl',
      iconColor: 'text-muted-foreground',
      defaultTag: 'Notes',
    };
    const description =
      [tab.highlights, tab.weather].find((s) => typeof s === 'string' && s.trim())?.trim() ||
      tab.tip?.trim() ||
      '';
    const tag = tab.months?.trim() || tab.tip?.trim() || style.defaultTag;
    return {
      id: tab.id,
      name: tab.name.trim() || tab.id,
      description: description || 'Notes for this season will appear before your date.',
      tag: tag.slice(0, 32),
      bgClass: style.bgClass,
      iconColor: style.iconColor,
    };
  });
}

function practicalPanelToV0Item(
  panel: { key: SmallGroupPracticalAccordionKey; label: string; blocks: SmallGroupPracticalBlock[] }
): V0PracticalAccordionItem | null {
  if (panel.blocks.length === 0) return null;

  const preview = accordionTriggerPreview(panel.key, panel.blocks);

  if (panel.key === 'includedNotIncluded') {
    const posBlocks = panel.blocks.filter((b) => POSITIVE_INCLUDED_IDS.has(b.id));
    const negBlocks = panel.blocks.filter((b) => NEGATIVE_INCLUDED_IDS.has(b.id));
    const midBlocks = panel.blocks.filter(
      (b) => !POSITIVE_INCLUDED_IDS.has(b.id) && !NEGATIVE_INCLUDED_IDS.has(b.id)
    );
    const includedLines = posBlocks.flatMap(splitBodyToLines);
    const excludedLines = negBlocks.flatMap(splitBodyToLines);
    const orphanLines = midBlocks.flatMap(splitBodyToLines);
    const mergedIncluded = [...includedLines, ...orphanLines];
    if (mergedIncluded.length === 0 && excludedLines.length === 0) {
      return {
        id: panel.key,
        title: panel.label,
        preview,
        renderMode: 'bullets',
        content: panel.blocks.flatMap(splitBodyToLines),
      };
    }
    return {
      id: panel.key,
      title: panel.label,
      preview,
      renderMode: 'includedSplit',
      includedLines: mergedIncluded,
      excludedLines,
    };
  }

  const content = panel.blocks.flatMap(splitBodyToLines);
  return {
    id: panel.key,
    title: panel.label,
    preview,
    renderMode: 'bullets',
    content,
  };
}

/**
 * Maps `SmallGroupDetailContent` into v0 East support sections (practical accordions, FAQ, trust, timeline).
 * Same source data as `SmallGroupTourDetailTemplate` / `resolveEditorialPresentation`.
 */
export function buildV0EastSupportProductSlice(content: SmallGroupDetailContent): V0EastSupportProductSlice {
  const chrome = content.templateSectionChrome;
  const ed = resolveEditorialPresentation(content);

  const buckets = groupPracticalBlocksByAccordion(content.practicalBlocks);
  const practicalAccordionItems: V0PracticalAccordionItem[] = [];
  for (const panel of buckets) {
    const item = practicalPanelToV0Item(panel);
    if (item) practicalAccordionItems.push(item);
  }

  const practicalSectionSubtitle =
    [content.practicalIntro?.trim(), chrome?.practicalSubtitle?.trim()].filter(Boolean).join(' ') ||
    'Pickup, walking, weather, packing, and inclusions.';

  const seasonalVariations = seasonalTabsToV0Cards(content);

  const faqSource = content.faqs ?? [];
  const { top, more } = partitionFaqItems(faqSource);
  const toVq = (f: (typeof faqSource)[number], i: number, prefix: string): V0FaqQuestion => ({
    id: f.id?.trim() || `${prefix}-${i}-${f.question.slice(0, 12)}`,
    question: f.question,
    answer: f.answer,
  });
  const faqMain: V0FaqQuestion[] = top.map((f, i) => toVq(f, i, 'faq'));
  const faqMore: V0FaqQuestion[] = more.map((f, i) => toVq(f, i, 'faq-more'));

  const faqSectionSubtitle =
    chrome?.faqSubtitle?.trim() || 'The few questions that usually decide it.';
  const faqEmptyMessage = chrome?.faqEmptyState?.trim() || 'Frequently asked questions for this experience will appear here.';

  const trustCards: V0BookingTrustCard[] = (ed.trustPoints ?? []).map((p, i) => ({
    title: p.title,
    description: p.description,
    iconIndex: i % 3,
  }));

  const supportTimelineSteps: V0SupportTimelineStep[] = (ed.afterSteps ?? []).map((s) => ({
    timing: s.timing?.trim() || '—',
    title: s.title,
    detail: (s.detail?.trim() || s.description?.trim() || '').trim(),
  }));

  return {
    practicalAccordionItems,
    practicalSectionSubtitle,
    seasonalVariations,
    faqMain,
    faqMore,
    faqSectionSubtitle,
    faqEmptyMessage,
    trustCards,
    supportTimelineSteps,
    contactHref: '/contact',
  };
}
