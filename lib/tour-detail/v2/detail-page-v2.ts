import type {
  SmallGroupDetailContent,
  SmallGroupEditorialDetail,
  SmallGroupFaqItem,
  SmallGroupInsightCard,
  SmallGroupPracticalBlock,
  SmallGroupPremiumBadge,
  SmallGroupRelatedTourCard,
  SmallGroupRouteStop,
  SmallGroupSeasonalBlock,
  SmallGroupSnapshotRow,
  SmallGroupSummaryFact,
  SmallGroupSupportItem,
  SmallGroupTemplateSectionChrome,
} from '@/components/tour/small-group/smallGroupDetailContent';

/** Route-shape strip (matches `route-shape.tsx` data shape). */
export type V2RouteShapeStop = { id: string; name: string; theme: string };

export type V2RouteShapePhase = {
  label: string;
  range: string;
  theme: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
};

export type V2RouteShapeShell = {
  title?: string;
  subtitle?: string;
  stops: V2RouteShapeStop[];
  phases: V2RouteShapePhase[];
};

export type V2ExperienceLogicItem = { label: string; detail: string };

export type V2ExperienceSectionGroup = {
  title: string;
  icon: 'Sun' | 'Mountain' | 'Wind';
  iconBg: string;
  iconColor: string;
  items: V2ExperienceLogicItem[];
};

export type V2ExperienceShell = {
  title?: string;
  subtitle?: string;
  bestFor?: string[];
  lessIdealFor?: string[];
  familyNote?: string;
  routeLogicLabel?: string;
  routeLogicHint?: string;
  routeLogicSections?: V2ExperienceSectionGroup[];
};

export type V2RecommendationCard = {
  id: number | string;
  title: string;
  description: string;
  image: string;
  rating: number;
  reviews: number;
  duration: string;
  price: string;
  tag: string;
  href?: string;
};

export type V2RecommendationsShell = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Omit to use built-in placeholder cards until CMS provides real related tours. */
  items?: V2RecommendationCard[];
};

export type V2TemplateShell = {
  routeShape?: V2RouteShapeShell | null;
  experience?: V2ExperienceShell | null;
  recommendations?: V2RecommendationsShell | null;
};

export type TourDetailPageV2Stored = {
  version?: number;
  /** Partial `SmallGroupDetailContent` — merged on top of API + product overlay. */
  content?: Record<string, unknown>;
  templateShell?: V2TemplateShell | null;
};

export type ParsedDetailPageV2 = {
  contentPatch?: Record<string, unknown>;
  templateShell?: V2TemplateShell | null;
};

export function parseDetailPageV2(raw: unknown): ParsedDetailPageV2 {
  if (raw == null || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const templateShell =
    o.templateShell != null && typeof o.templateShell === 'object'
      ? (o.templateShell as V2TemplateShell)
      : null;
  const content =
    o.content != null && typeof o.content === 'object' ? (o.content as Record<string, unknown>) : undefined;
  return {
    contentPatch: content,
    templateShell: templateShell ?? undefined,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Deep-enough merge: top-level keys of `SmallGroupDetailContent`; `hero` and `editorial` shallow-merge.
 */
export function mergeSmallGroupDetailFromV2Patch(
  base: SmallGroupDetailContent,
  patch: Record<string, unknown> | undefined
): SmallGroupDetailContent {
  if (!patch) return base;

  const out: SmallGroupDetailContent = { ...base };

  if (isObj(patch.hero)) {
    const h = patch.hero as Partial<SmallGroupDetailContent['hero']>;
    out.hero = {
      ...base.hero,
      ...h,
      badges: Array.isArray(h.badges) ? h.badges : base.hero.badges,
      galleryImageUrls: Array.isArray(h.galleryImageUrls) ? h.galleryImageUrls : base.hero.galleryImageUrls,
      summaryFacts: Array.isArray(h.summaryFacts) ? h.summaryFacts : base.hero.summaryFacts,
    };
  }

  if (Array.isArray(patch.quickSnapshot)) {
    out.quickSnapshot = patch.quickSnapshot as SmallGroupSnapshotRow[];
  }
  if (Array.isArray(patch.insightCards)) {
    out.insightCards = patch.insightCards as SmallGroupInsightCard[];
  }
  if (Array.isArray(patch.routeStops)) {
    out.routeStops = patch.routeStops as SmallGroupRouteStop[];
  }
  if (typeof patch.whyOrderWorks === 'string') {
    out.whyOrderWorks = patch.whyOrderWorks;
  }
  if (Array.isArray(patch.seasonalBlocks)) {
    out.seasonalBlocks = patch.seasonalBlocks as SmallGroupSeasonalBlock[];
  }
  if (Array.isArray(patch.practicalBlocks)) {
    out.practicalBlocks = patch.practicalBlocks as SmallGroupPracticalBlock[];
  }
  if (Array.isArray(patch.afterBookingItems)) {
    out.afterBookingItems = patch.afterBookingItems as SmallGroupSupportItem[];
  }
  if (Array.isArray(patch.faqs)) {
    out.faqs = patch.faqs as SmallGroupFaqItem[];
  }
  if (Array.isArray(patch.relatedTours)) {
    out.relatedTours = patch.relatedTours as SmallGroupRelatedTourCard[];
  }
  if (typeof patch.practicalIntro === 'string') {
    out.practicalIntro = patch.practicalIntro;
  }
  if (isObj(patch.routeStopMetaLabels)) {
    out.routeStopMetaLabels = { ...base.routeStopMetaLabels, ...(patch.routeStopMetaLabels as object) };
  }
  if (isObj(patch.editorial)) {
    out.editorial = { ...(base.editorial ?? {}), ...(patch.editorial as SmallGroupEditorialDetail) } as SmallGroupEditorialDetail;
  }
  if (isObj(patch.templateSectionChrome)) {
    out.templateSectionChrome = {
      ...(base.templateSectionChrome ?? {}),
      ...(patch.templateSectionChrome as SmallGroupTemplateSectionChrome),
    } as SmallGroupTemplateSectionChrome;
  }

  return out;
}

export function applyDetailPageV2ToContent(
  base: SmallGroupDetailContent,
  rawDetailPageV2: unknown
): SmallGroupDetailContent {
  const { contentPatch } = parseDetailPageV2(rawDetailPageV2);
  return mergeSmallGroupDetailFromV2Patch(base, contentPatch);
}
