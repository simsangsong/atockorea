import type { TourDetailViewModel } from '@/src/types/tours';
import { mapTourToRouteStopCards } from './mapTourToRouteStops';
import { applySmallGroupProductOverlay } from './applyProductContentOverlay';

/** Premium badge in the hero row (e.g. “Small group”, “Licensed guide”). */
export interface SmallGroupPremiumBadge {
  id: string;
  label: string;
}

/** Single fact line in the hero summary strip. */
export interface SmallGroupSummaryFact {
  id: string;
  label: string;
  value: string;
}

/** One row in the quick snapshot grid (B). */
export interface SmallGroupSnapshotRow {
  id: string;
  label: string;
  value: string;
}

/** Premium insight card (C). */
export interface SmallGroupInsightCard {
  id: string;
  title: string;
  body: string;
}

/** Expanded stop copy (card uses `cardSummary` + `cardFacts`; expanded uses this when set). */
export interface SmallGroupRouteStopPracticalDetails {
  officialHours?: string;
  lastTicketing?: string;
  holiday?: string;
  fee?: string;
  restroom?: string;
  parking?: string;
  officialAverageTime?: string;
}

export interface SmallGroupRouteStopDetailLayer {
  detailIntro?: string;
  highlights?: string[];
  experienceFlow?: string[];
  routeReason?: string;
  practicalDetails?: SmallGroupRouteStopPracticalDetails;
  photoDetails?: string;
  facilityDetails?: string;
  smartTip?: string;
  commonReaction?: string;
  skipNote?: string;
  weatherNote?: string;
  delayNote?: string;
}

/** Stop card for route timeline (D). */
export interface SmallGroupRouteStop {
  id: string;
  title: string;
  description: string;
  whyIncluded: string;
  stayDuration: string;
  walkingLevel: string;
  photoTip: string;
  restroom: string;
  weatherNote: string;
  delayNote: string;
  /** Collapsed card: short summary (preferred over `description` when set). */
  cardSummary?: string;
  /** Collapsed card: fact bullets (e.g. duration, walking); UI shows up to 3. */
  cardFacts?: string[];
  /** Expanded: rich narrative + practicals; when set, preferred over flat meta grid. */
  detailLayer?: SmallGroupRouteStopDetailLayer;
  /** Optional longer copy shown behind `<details>` (keeps default view light). */
  moreDetails?: string;
  /** Optional hero image for this stop (itinerary card). */
  imageUrl?: string;
  /** Detail-page style timeline chrome (optional). */
  displayTime?: string;
  sequenceLabel?: string;
  highlightLabel?: string;
  /** Short footer pills under the description (optional). */
  tags?: string[];
}

export type SmallGroupSeasonKey =
  | 'spring'
  | 'summer'
  | 'fall'
  | 'winter'
  | 'rainy'
  | 'windy'
  | 'peak';

/** Seasonal / weather behavior block (F). */
export interface SmallGroupSeasonalBlock {
  id: SmallGroupSeasonKey;
  label: string;
  body: string;
}

/** Editorial cluster for Practical Details accordions (Step 6). */
export type SmallGroupPracticalGroupKey = 'before' | 'day' | 'booking';

/** Practical info subsection (G). */
export interface SmallGroupPracticalBlock {
  id: string;
  title: string;
  body: string;
  /** Extra lines behind `<details>` so the default row stays short. */
  moreDetails?: string;
  /** Expandable group; when omitted, inferred from `id` for known CMS keys. */
  group?: SmallGroupPracticalGroupKey;
}

const PRACTICAL_GROUP_ORDER: SmallGroupPracticalGroupKey[] = ['before', 'day', 'booking'];

const PRACTICAL_GROUP_LABEL: Record<SmallGroupPracticalGroupKey, string> = {
  before: 'Before you go',
  day: 'On the day',
  booking: "Booking & what's included",
};

/** Maps default / East Jeju practical block ids to cluster. Unknown ids fall back to `before`. */
const PRACTICAL_ID_TO_GROUP: Record<string, SmallGroupPracticalGroupKey> = {
  pickupDrop: 'before',
  whatToWear: 'before',
  whatToBring: 'before',
  walkingStairs: 'before',
  kids: 'before',
  seniors: 'before',
  weather: 'before',
  meal: 'day',
  lunch: 'day',
  restrooms: 'day',
  included: 'booking',
  notIncluded: 'booking',
  delayPolicy: 'booking',
};

export function resolvePracticalBlockGroup(block: SmallGroupPracticalBlock): SmallGroupPracticalGroupKey {
  if (block.group) return block.group;
  return PRACTICAL_ID_TO_GROUP[block.id] ?? 'before';
}

/** Non-empty clusters in display order for the Practical Details UI. */
export function groupPracticalBlocksForUi(blocks: SmallGroupPracticalBlock[]): Array<{
  key: SmallGroupPracticalGroupKey;
  label: string;
  blocks: SmallGroupPracticalBlock[];
}> {
  const buckets: Record<SmallGroupPracticalGroupKey, SmallGroupPracticalBlock[]> = {
    before: [],
    day: [],
    booking: [],
  };
  for (const b of blocks) {
    buckets[resolvePracticalBlockGroup(b)].push(b);
  }
  return PRACTICAL_GROUP_ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
    key: k,
    label: PRACTICAL_GROUP_LABEL[k],
    blocks: buckets[k],
  }));
}

/** After-booking support line item (H). */
export interface SmallGroupSupportItem {
  id: string;
  title: string;
  description: string;
  timing?: string;
  detail?: string;
}

/** Related tour teaser (J). */
export interface SmallGroupRelatedTourCard {
  id: string;
  title: string;
  href: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
  duration?: string;
  /** Shown with map-pin in card footer (e.g. stops or places count). */
  stopCount?: number;
  /** e.g. Easy–Moderate — optional; shown as a meta pill on related tour cards when set. */
  difficulty?: string;
  /** From price in KRW (same unit as tour listing); formatted with page `formatPrice`. */
  priceFrom?: number;
}

export type SmallGroupFlowReasonIconKey =
  | 'sun'
  | 'mapPin'
  | 'utensils'
  | 'sunset'
  | 'wind'
  | 'users'
  | 'cloudRain';

/** Icons for the At a Glance 3×2 grid (Lucide mapping in `SmallGroupQuickSnapshotSection`). */
export type SmallGroupAtAGlanceIconKey =
  | 'camera'
  | 'compass'
  | 'footprints'
  | 'cloudSun'
  | 'users'
  | 'treePine'
  | 'activity';

export interface SmallGroupAtAGlanceCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  rating: number;
  icon?: SmallGroupAtAGlanceIconKey;
}

export interface SmallGroupBestForLine {
  text: string;
  detail: string;
}

export interface SmallGroupFlowReason {
  id: string;
  icon: SmallGroupFlowReasonIconKey;
  title: string;
  summary: string;
  description: string;
}

export interface SmallGroupFlowAdjustment {
  id: string;
  icon: SmallGroupFlowReasonIconKey;
  title: string;
  description: string;
}

export interface SmallGroupSeasonalTab {
  id: string;
  name: string;
  months: string;
  weather: string;
  highlights: string;
  tip: string;
}

export interface SmallGroupTrustPoint {
  id: string;
  title: string;
  description: string;
}

export interface SmallGroupTrustReview {
  id: string;
  name: string;
  location: string;
  text: string;
  date: string;
  avatarUrl: string;
  /** When true (and only then), show a compact “Verified booking” line on the card. */
  verifiedBooking?: boolean;
  /** e.g. “Guest on this route · Mar 2024” — shown only when set. */
  reviewSourceLabel?: string;
}

export interface SmallGroupAfterBookingStep {
  id: string;
  title: string;
  timing: string;
  description: string;
  detail: string;
}

/** Rich editorial layer matching the v0 Detailpage reference (East SKU fills this). */
export interface SmallGroupEditorialDetail {
  heroEyebrow?: string;
  routePreviewLine?: string;
  /** Shown next to stars, e.g. "4.9 (128)". Filled from tour in product merge when possible. */
  ratingLine?: string;
  atAGlance?: SmallGroupAtAGlanceCard[];
  bestForIdeal?: SmallGroupBestForLine[];
  bestForNotIdeal?: SmallGroupBestForLine[];
  flowReasons?: SmallGroupFlowReason[];
  flowAdjustments?: SmallGroupFlowAdjustment[];
  seasonalTabs?: SmallGroupSeasonalTab[];
  trustPoints?: SmallGroupTrustPoint[];
  trustReviews?: SmallGroupTrustReview[];
  afterBookingSteps?: SmallGroupAfterBookingStep[];
}

/** Optional headings / subtitles for small-group template sections (product-specific editorial). */
export interface SmallGroupTemplateSectionChrome {
  routeTimelineTitle?: string;
  routeTimelineSubtitle?: string;
  /** Under subtitle: e.g. “Short card summary first…” */
  routeTimelineCardHint?: string;
  seasonalSubtitle?: string;
  practicalSubtitle?: string;
  trustSubtitle?: string;
  afterBookSubtitle?: string;
  faqSubtitle?: string;
  faqEmptyState?: string;
}

/**
 * CMS-ready content for the small-group detail template.
 * Populated from TourDetailViewModel where possible; optional fields default to empty
 * until backed by API/translations.
 */
export interface SmallGroupDetailContent {
  hero: {
    title: string;
    subtitle: string;
    positioningLine: string;
    badges: SmallGroupPremiumBadge[];
    galleryImageUrls: string[];
    summaryFacts: SmallGroupSummaryFact[];
  };
  quickSnapshot: SmallGroupSnapshotRow[];
  insightCards: SmallGroupInsightCard[];
  routeStops: SmallGroupRouteStop[];
  whyOrderWorks: string;
  seasonalBlocks: SmallGroupSeasonalBlock[];
  practicalBlocks: SmallGroupPracticalBlock[];
  afterBookingItems: SmallGroupSupportItem[];
  faqs: Array<{ question: string; answer: string }>;
  relatedTours: SmallGroupRelatedTourCard[];
  /** One editorial sentence under Practical Details H2; omit when empty. */
  practicalIntro?: string;
  /** Optional KO (or other) labels for timeline meta rows; defaults to English in the section. */
  routeStopMetaLabels?: Partial<
    Record<
      'description' | 'whyIncluded' | 'stayDuration' | 'walkingLevel' | 'photoTip' | 'restroom' | 'weatherNote' | 'delayNote',
      string
    >
  >;
  editorial?: SmallGroupEditorialDetail;
  /** Section headings copy overrides (e.g. East Signature JSON). */
  templateSectionChrome?: SmallGroupTemplateSectionChrome;
}

export interface SmallGroupResolvedEditorial {
  heroEyebrow?: string;
  routePreviewLine?: string;
  ratingLine?: string;
  atAGlance: SmallGroupAtAGlanceCard[];
  bestForIdeal: SmallGroupBestForLine[];
  bestForNotIdeal: SmallGroupBestForLine[];
  flowReasons: SmallGroupFlowReason[];
  flowAdjustments: SmallGroupFlowAdjustment[];
  seasonalTabs: SmallGroupSeasonalTab[];
  trustPoints: SmallGroupTrustPoint[];
  trustReviews: SmallGroupTrustReview[];
  afterSteps: SmallGroupAfterBookingStep[];
}

function inferAtAGlanceIcon(id: string, label: string): SmallGroupAtAGlanceIconKey {
  const s = `${id} ${label}`.toLowerCase();
  if (/photo|camera|shot/.test(s)) return 'camera';
  if (/scenic|compass|view|landscape/.test(s)) return 'compass';
  if (/walk|step|foot|hik/.test(s)) return 'footprints';
  if (/rain|weather|cloud|sun|wet/.test(s)) return 'cloudSun';
  if (/family|kid|group|people|guest/.test(s)) return 'users';
  if (/outdoor|tree|nature|green|park/.test(s)) return 'treePine';
  return 'activity';
}

function deriveGlanceFromRows(rows: SmallGroupSnapshotRow[]): SmallGroupAtAGlanceCard[] {
  const skip = new Set(['bestFor', 'notIdealFor']);
  return rows
    .filter((r) => r.value.trim() && !skip.has(r.id))
    .slice(0, 8)
    .map((r) => {
      const full = r.value.trim();
      const short = full.length > 40 ? `${full.slice(0, 37)}…` : full;
      return {
        id: r.id,
        label: r.label,
        value: short,
        detail: full,
        rating: 3,
        icon: inferAtAGlanceIcon(r.id, r.label),
      };
    });
}

function splitSnapshotBullets(row: SmallGroupSnapshotRow | undefined): SmallGroupBestForLine[] {
  if (!row?.value.trim()) return [];
  return row.value
    .split(/·|\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((text) => ({ text, detail: '' }));
}

function deriveSeasonalFromBlocks(blocks: SmallGroupSeasonalBlock[]): SmallGroupSeasonalTab[] {
  return blocks.map((b) => ({
    id: b.id,
    name: b.label,
    months: '',
    weather: '',
    highlights: b.body.trim() ? b.body.trim() : 'Notes for this season will appear before your date.',
    tip: '',
  }));
}

function deriveAfterFromItems(items: SmallGroupSupportItem[]): SmallGroupAfterBookingStep[] {
  return items.map((it) => ({
    id: it.id,
    title: it.title,
    timing: it.timing ?? '',
    description: it.description,
    detail: it.detail ?? '',
  }));
}

/**
 * Merges `content.editorial` with safe fallbacks from generic snapshot/seasonal/support fields
 * so the Detailpage-style skin always has data to render.
 */
export function resolveEditorialPresentation(content: SmallGroupDetailContent): SmallGroupResolvedEditorial {
  const e = content.editorial;
  const bestRow = content.quickSnapshot.find((r) => r.id === 'bestFor');
  const notRow = content.quickSnapshot.find((r) => r.id === 'notIdealFor');

  return {
    heroEyebrow: e?.heroEyebrow,
    routePreviewLine: e?.routePreviewLine,
    ratingLine: e?.ratingLine,
    atAGlance:
      e?.atAGlance && e.atAGlance.length > 0 ? e.atAGlance : deriveGlanceFromRows(content.quickSnapshot),
    bestForIdeal:
      e?.bestForIdeal && e.bestForIdeal.length > 0 ? e.bestForIdeal : splitSnapshotBullets(bestRow),
    bestForNotIdeal:
      e?.bestForNotIdeal && e.bestForNotIdeal.length > 0
        ? e.bestForNotIdeal
        : splitSnapshotBullets(notRow),
    flowReasons: e?.flowReasons ?? [],
    flowAdjustments: e?.flowAdjustments ?? [],
    seasonalTabs:
      e?.seasonalTabs && e.seasonalTabs.length > 0
        ? e.seasonalTabs
        : deriveSeasonalFromBlocks(content.seasonalBlocks),
    trustPoints: e?.trustPoints ?? [],
    trustReviews: e?.trustReviews ?? [],
    afterSteps:
      e?.afterBookingSteps && e.afterBookingSteps.length > 0
        ? e.afterBookingSteps
        : deriveAfterFromItems(content.afterBookingItems),
  };
}

const SNAPSHOT_LABELS: SmallGroupSnapshotRow[] = [
  { id: 'bestFor', label: 'Best for', value: '' },
  { id: 'notIdealFor', label: 'Not ideal for', value: '' },
  { id: 'walkingLevel', label: 'Walking level', value: '' },
  { id: 'rainSafety', label: 'Rain safety', value: '' },
  { id: 'familyFit', label: 'Family fit', value: '' },
  { id: 'seniorFit', label: 'Senior fit', value: '' },
  { id: 'scenicIntensity', label: 'Scenic intensity', value: '' },
  { id: 'photoValue', label: 'Photo value', value: '' },
  { id: 'relaxationLevel', label: 'Relaxation level', value: '' },
  { id: 'outdoorIndoorBalance', label: 'Outdoor / indoor balance', value: '' },
];

const SEASONAL_KEYS: Array<{ id: SmallGroupSeasonKey; label: string }> = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'fall', label: 'Fall' },
  { id: 'winter', label: 'Winter' },
  { id: 'rainy', label: 'Rainy day' },
  { id: 'windy', label: 'Windy day' },
  { id: 'peak', label: 'Peak season' },
];

const PRACTICAL_DEFAULTS: SmallGroupPracticalBlock[] = [
  { id: 'pickupDrop', title: 'Pickup & drop-off', body: '' },
  { id: 'whatToWear', title: 'What to wear', body: '' },
  { id: 'whatToBring', title: 'What to bring', body: '' },
  { id: 'walkingStairs', title: 'Walking & stairs', body: '' },
  { id: 'kids', title: 'Kids', body: '' },
  { id: 'seniors', title: 'Seniors', body: '' },
  { id: 'restrooms', title: 'Restrooms', body: '' },
  { id: 'lunch', title: 'Lunch', body: '' },
  { id: 'delayPolicy', title: 'Delay policy', body: '' },
];

function galleryUrlsFromTour(tour: TourDetailViewModel): string[] {
  const imgs = tour.images || [];
  return imgs
    .map((img) => (typeof img === 'string' ? img : img?.url))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
}

function badgesFromTour(tour: TourDetailViewModel): SmallGroupPremiumBadge[] {
  const raw = tour.badges || [];
  return raw.map((label, i) => ({
    id: `badge-${i}`,
    label: String(label),
  }));
}

function summaryFactsFromTour(tour: TourDetailViewModel): SmallGroupSummaryFact[] {
  const facts: SmallGroupSummaryFact[] = [
    { id: 'duration', label: 'Duration', value: tour.duration || '' },
    { id: 'groupSize', label: 'Group size', value: tour.groupSize || '' },
    { id: 'city', label: 'Area', value: tour.city || '' },
  ];
  if (tour.rating != null) {
    facts.push({
      id: 'rating',
      label: 'Rating',
      value: `${Number(tour.rating).toFixed(1)} (${tour.reviewCount ?? 0} reviews)`,
    });
  }
  return facts.filter((f) => f.value.trim() !== '');
}

/** Turn whyThisFitsYou lines into up to 4 cards (headings are placeholders until CMS splits title/body). */
function insightCardsFromTour(tour: TourDetailViewModel): SmallGroupInsightCard[] {
  const lines = tour.whyThisFitsYou || [];
  return lines.slice(0, 4).map((line, i) => ({
    id: `insight-${i}`,
    title: `Insight ${i + 1}`,
    body: line.trim(),
  }));
}

function bestForFromTour(tour: TourDetailViewModel): string {
  const who = tour.whoThisIsBestFor || [];
  return who.length ? who.join(' · ') : '';
}

/** First sentence or short prefix of overview for Practical scan line (Phase 6). */
function practicalIntroFromTourOverview(tour: TourDetailViewModel): string | undefined {
  const o = tour.overview?.trim();
  if (!o) return undefined;
  const cut = o.split(/(?<=[.!?])\s+/);
  const first = cut[0]?.trim();
  if (first && first.length <= 240) return first;
  if (o.length <= 220) return o;
  return `${o.slice(0, 217).trim()}…`;
}

/**
 * Builds small-group detail content from the shared tour view model.
 * Extended editorial fields (snapshot rows, seasonal copy, practical blurbs, etc.)
 * are left empty until CMS/API provides them.
 */
export function buildSmallGroupDetailContent(tour: TourDetailViewModel): SmallGroupDetailContent {
  const galleryImageUrls = galleryUrlsFromTour(tour);
  const quickSnapshot = SNAPSHOT_LABELS.map((row) => {
    if (row.id === 'bestFor') {
      return { ...row, value: bestForFromTour(tour) };
    }
    return { ...row, value: row.value };
  });

  const base: SmallGroupDetailContent = {
    hero: {
      title: tour.title,
      subtitle: tour.tagline || '',
      positioningLine: tour.highlight || (tour.badges?.[0] ? String(tour.badges[0]) : ''),
      badges: badgesFromTour(tour),
      galleryImageUrls,
      summaryFacts: summaryFactsFromTour(tour),
    },
    quickSnapshot,
    insightCards: insightCardsFromTour(tour),
    routeStops: mapTourToRouteStopCards(tour),
    whyOrderWorks: '',
    seasonalBlocks: SEASONAL_KEYS.map((s) => ({
      id: s.id,
      label: s.label,
      body: '',
    })),
    practicalBlocks: PRACTICAL_DEFAULTS.map((b) => ({ ...b })),
    afterBookingItems: [],
    faqs: tour.faqs || [],
    relatedTours: [],
    practicalIntro: practicalIntroFromTourOverview(tour),
  };

  return applySmallGroupProductOverlay(tour, base);
}
