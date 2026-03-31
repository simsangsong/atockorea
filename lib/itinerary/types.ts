import { z } from 'zod';
import { itineraryStopPhotoGallerySchema } from './photo-gallery-from-poi';
import { normalizeRoutePlanningContext } from '@/lib/itinerary/reco/planning-context';

export type { RouteEndpoint, RoutePlanningContext } from '@/lib/itinerary/reco/planning-context';

export type { ItineraryPhotoGalleryItem } from './photo-gallery-from-poi';
export {
  itineraryPhotoGalleryItemSchema,
  itineraryStopPhotoGallerySchema,
  extractItineraryPhotoGalleryItems,
  sanitizeItineraryPhotoGalleryFromUnknown,
} from './photo-gallery-from-poi';

const routeEndpointSchema = z.object({
  label: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  regionGroup: z.string().nullable().optional(),
  kind: z.enum(['hotel', 'airport', 'custom', 'unknown']).optional(),
});

/** Raw body (aliases supported); normalized by transform. */
const itineraryUserInputRawSchema = z.object({
  departureAt: z.string().optional(),
  startLocation: routeEndpointSchema.optional(),
  endLocation: routeEndpointSchema.optional(),
  includeReturnToEndLocation: z.boolean().optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  pickupRegion: z.string().optional(),
  pickupLabel: z.string().optional(),
  pickupKind: z.string().optional(),
  hotelLat: z.number().optional(),
  hotelLng: z.number().optional(),
  hotelRegion: z.string().optional(),
  hotelName: z.string().optional(),
  dropoffLat: z.number().optional(),
  dropoffLng: z.number().optional(),
  dropoffRegion: z.string().optional(),
  dropoffLabel: z.string().optional(),
  dropoffKind: z.string().optional(),
  destination: z.string().optional().default('Jeju'),
  pickupArea: z.string().optional(),
  travelStyle: z.string().optional(),
  groupType: z.string().optional(),
  seniors: z.boolean().optional(),
  family: z.boolean().optional(),
  couple: z.boolean().optional(),
  withSeniors: z.boolean().optional(),
  withChildren: z.boolean().optional(),
  isCouple: z.boolean().optional(),
  indoorOutdoor: z.enum(['indoor', 'outdoor', 'both', 'any']).optional().default('any'),
  indoorPreference: z.enum(['indoor', 'outdoor', 'mixed', 'both', 'any']).optional(),
  rainyDay: z.boolean().optional(),
  availableHours: z.number().min(1).max(24).optional().default(8),
  mustSee: z.string().optional(),
  mustSeeKeywords: z.array(z.string()).optional(),
  theme: z.string().optional(),
  durationDays: z.number().min(1).max(14).optional().default(1),
  locale: z.enum(['ko', 'en']).optional().default('ko'),
  language: z.enum(['ko', 'en']).optional(),
  /** Quick photo / light pacing — fewer stops, shorter dwell (deterministic assembly). */
  quickPhotoMode: z.boolean().optional(),
  /** 1–5 scale; threaded into route preference when parser merge omits long_drive_tolerance. */
  longDriveTolerance: z.number().min(1).max(5).optional(),
  firstVisit: z.boolean().optional(),
  iconicSpotPriority: z.number().min(0).max(10).optional(),
  hiddenGemPriority: z.number().min(0).max(10).optional(),
  naturePriority: z.number().min(0).max(10).optional(),
  culturePriority: z.number().min(0).max(10).optional(),
  foodPriority: z.number().min(0).max(10).optional(),
  cafePriority: z.number().min(0).max(10).optional(),
  shoppingPriority: z.number().min(0).max(10).optional(),
  photoPriority: z.number().min(0).max(10).optional(),
  needIndoorIfRain: z.boolean().optional(),
  regionPreference: z.string().optional(),
  subregionPreference: z.string().optional(),
  maxWalkingLevel: z.enum(['easy', 'moderate', 'hard']).optional(),
  ageBand: z.string().optional(),
  /**
   * Dev-only: when true, `/api/itinerary/generate` skips `findReusableItinerary` (NODE_ENV=development only).
   * Lets local scripts isolate endpoint-cache behavior from run/template reuse.
   */
  debugNoReuse: z.boolean().optional(),
});

/** Client → /api/itinerary/generate */
export const itineraryUserInputSchema = itineraryUserInputRawSchema.transform((raw) => {
  const seniors = raw.seniors ?? raw.withSeniors ?? false;
  const couple = raw.couple ?? raw.isCouple ?? false;
  const withChildren = raw.withChildren ?? false;
  let indoorOutdoor: 'indoor' | 'outdoor' | 'both' | 'any' = raw.indoorOutdoor ?? 'any';
  if (raw.indoorPreference != null) {
    indoorOutdoor = raw.indoorPreference === 'mixed' ? 'both' : raw.indoorPreference;
  }
  const locale = raw.language ?? raw.locale ?? 'ko';
  let mustSee = raw.mustSee?.trim();
  if (!mustSee && raw.mustSeeKeywords?.length) {
    mustSee = raw.mustSeeKeywords.join(', ');
  }
  const mustSeeKeywords = raw.mustSeeKeywords?.length
    ? raw.mustSeeKeywords
    : mustSee
      ? mustSee.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const routePlanning = normalizeRoutePlanningContext(raw);

  return {
    destination: raw.destination,
    pickupArea: raw.pickupArea,
    travelStyle: raw.travelStyle,
    groupType: raw.groupType,
    seniors,
    family: raw.family ?? false,
    couple,
    withChildren,
    indoorOutdoor,
    rainyDay: raw.rainyDay,
    availableHours: raw.availableHours,
    mustSee,
    mustSeeKeywords,
    theme: raw.theme,
    durationDays: raw.durationDays,
    locale,
    quickPhotoMode: raw.quickPhotoMode ?? false,
    departureAt: routePlanning.departureAt,
    startLocation: routePlanning.startLocation,
    endLocation: routePlanning.endLocation,
    includeReturnToEndLocation: routePlanning.includeReturnToEndLocation,
    longDriveTolerance: raw.longDriveTolerance,
    firstVisit: raw.firstVisit,
    iconicSpotPriority: raw.iconicSpotPriority,
    hiddenGemPriority: raw.hiddenGemPriority,
    naturePriority: raw.naturePriority,
    culturePriority: raw.culturePriority,
    foodPriority: raw.foodPriority,
    cafePriority: raw.cafePriority,
    shoppingPriority: raw.shoppingPriority,
    photoPriority: raw.photoPriority,
    needIndoorIfRain: raw.needIndoorIfRain,
    regionPreference: raw.regionPreference,
    subregionPreference: raw.subregionPreference,
    maxWalkingLevel: raw.maxWalkingLevel,
    ageBand: raw.ageBand,
    ...(raw.debugNoReuse === true ? { debugNoReuse: true as const } : {}),
  };
});

export type ItineraryUserInput = z.infer<typeof itineraryUserInputSchema>;

export const geminiStopDraftSchema = z.object({
  contentId: z.string(),
  contentTypeId: z.number().optional().default(12),
  reason: z.string(),
  plannedDurationMin: z.number().min(15).max(480),
  sortOrder: z.number().int().min(1),
});

export const geminiDraftSchema = z.object({
  tourTitle: z.string(),
  tourSummary: z.string(),
  stops: z.array(geminiStopDraftSchema),
  notes: z.array(z.string()).optional(),
  /** Model-generated caveats; merged with server-side validation warnings in the API response. */
  warnings: z.array(z.string()).optional(),
});

export type GeminiDraft = z.infer<typeof geminiDraftSchema>;

/** Claude 2차 검수 출력 — 초안 + 필수 reviewSummary */
export const itineraryReviewSummarySchema = z.object({
  changed: z.boolean(),
  majorIssuesFound: z.array(z.string()),
  fixesApplied: z.array(z.string()),
});

export type ItineraryReviewSummary = z.infer<typeof itineraryReviewSummarySchema>;

export const claudeReviewDraftSchema = geminiDraftSchema.extend({
  reviewSummary: itineraryReviewSummarySchema,
});

export const validationRepairCategorySchema = z.enum([
  'removed_hidden_poi',
  'removed_missing_poi',
  'removed_duplicate_poi',
  'over_duration_trimmed',
  'region_backtracking_fixed',
  'region_pingpong_warned',
  'duration_compressed',
  'region_jumps_warned',
  'route_reordered',
  'route_feasibility_trimmed',
  'route_feasibility_warned',
]);

export type ValidationRepairCategory = z.infer<typeof validationRepairCategorySchema>;

export const validationRepairSchema = z.object({
  category: validationRepairCategorySchema,
  message: z.string(),
  contentId: z.string().optional(),
});

export type ValidationRepair = z.infer<typeof validationRepairSchema>;

export const routeMetricsSchema = z.object({
  estimatedTotalTravelMinutes: z.number(),
  estimatedTotalVisitMinutes: z.number(),
  estimatedTotalDayMinutes: z.number(),
  coordinateLegCount: z.number(),
  totalLegCount: z.number(),
  totalTravelDistanceKm: z.number().nullable(),
});

export type RouteMetrics = z.infer<typeof routeMetricsSchema>;

export const travelTimeResolutionSchema = z.object({
  timeBucket: z.enum(['am_peak', 'midday', 'pm_peak', 'weekend']),
  kakaoLiveUsed: z.boolean(),
  freshCacheHits: z.number(),
  staleCacheHits: z.number(),
  liveRefreshCount: z.number(),
  estimateFallbackCount: z.number(),
});

export type TravelTimeResolution = z.infer<typeof travelTimeResolutionSchema>;

export const validationMetaSchema = z.object({
  totalEstimatedMin: z.number(),
  budgetMin: z.number(),
  estimatedTotalTravelMinutes: z.number(),
  estimatedTotalVisitMinutes: z.number(),
  estimatedTotalDayMinutes: z.number(),
  coordinateLegCount: z.number(),
  totalLegCount: z.number(),
  totalTravelDistanceKm: z.number().nullable(),
  travelTimeResolution: travelTimeResolutionSchema.optional(),
  /** Deterministic assembly phase — travel resolver usage (optional, backward-compatible). */
  assemblyFreshCacheHits: z.number().optional(),
  assemblyLiveRefreshes: z.number().optional(),
  assemblyStaleFallbacks: z.number().optional(),
  assemblyEstimateFallbacks: z.number().optional(),
  assemblyRegionFallbacks: z.number().optional(),
  assemblyLegacyAssumedFallbacks: z.number().optional(),
  /** Persistent endpoint↔POI cache (`endpoint_travel_cache`), additive observability. */
  assemblyEndpointCacheFreshHits: z.number().optional(),
  assemblyEndpointCacheStaleHits: z.number().optional(),
  assemblyEndpointLiveRefreshes: z.number().optional(),
  assemblyEndpointEstimatedFallbacks: z.number().optional(),
  assemblyEndpointCacheWrites: z.number().optional(),
  usedRequestedDepartureAt: z.boolean().optional(),
  firstLegResolutionSource: z
    .enum(['legacy_assumed', 'region_fallback', 'live', 'cache_fresh', 'cache_stale', 'estimate'])
    .optional(),
  returnLegResolutionSource: z
    .enum(['legacy_assumed', 'region_fallback', 'live', 'cache_fresh', 'cache_stale', 'estimate'])
    .optional(),
  includesReturnToEndLocation: z.boolean().optional(),
  routePreferenceProfileUsed: z.boolean().optional(),
  drivePenaltyProfile: z.enum(['compact', 'balanced', 'detour_ok']).optional(),
  endpointAwareReorderUsed: z.boolean().optional(),
  longestLegMinutes: z.number().optional(),
  totalDriveMinutes: z.number().optional(),
  crossRegionJumpCount: z.number().optional(),
  returnLegMinutes: z.number().optional(),
  /** True when assembly resolver stats reflect the final route only (Step 10). */
  finalTravelStatsIsolated: z.boolean().optional(),
  endpointAwarePolishUsed: z.boolean().optional(),
});

export type ValidationMeta = z.infer<typeof validationMetaSchema>;

export const generatedItineraryResponseSchema = z.object({
  tourTitle: z.string(),
  tourSummary: z.string(),
  /** Coordinate-based route estimates (Haversine + Jeju driving speed assumptions). */
  routeMetrics: routeMetricsSchema.optional(),
  stops: z.array(
    z.object({
      contentId: z.string(),
      contentTypeId: z.number(),
      title: z.string(),
      image: z.string().nullable(),
      shortDescription: z.string().nullable(),
      overview: z.string().nullable(),
      reason: z.string().nullable(),
      plannedDurationMin: z.number().nullable(),
      sortOrder: z.number(),
      addr1: z.string().nullable(),
      addr2: z.string().nullable(),
      useTimeText: z.string().nullable(),
      feeText: z.string().nullable(),
      parkingInfo: z.string().nullable(),
      reservationInfo: z.string().nullable(),
      restDate: z.string().nullable(),
      tel: z.string().nullable(),
      homepage: z.string().nullable(),
      mapx: z.number().nullable(),
      mapy: z.number().nullable(),
      adminNoteKo: z.string().nullable(),
      adminNoteEn: z.string().nullable(),
      tags: z.array(z.string()).nullable(),
      isIndoor: z.boolean().nullable(),
      isOutdoor: z.boolean().nullable(),
      isFree: z.boolean().nullable(),
      isPaid: z.boolean().nullable(),
      regionGroup: z.string().nullable(),
      photoGallery: itineraryStopPhotoGallerySchema,
    }),
  ),
  warnings: z.array(z.string()),
  generationMeta: z.object({
    candidateCount: z.number(),
    geminiModel: z.string(),
    claudeModel: z.string(),
    usedFallback: z.boolean().optional().default(false),
    claudeReviewSummary: itineraryReviewSummarySchema.optional(),
    validationRepairs: z.array(validationRepairSchema).optional(),
    validationMeta: validationMetaSchema.optional(),
    reusedItinerary: z.boolean().optional(),
    reuseSource: z.enum(['run', 'template', 'fresh']).optional(),
    reusedRunId: z.string().optional(),
    reusedTemplateId: z.string().optional(),
    reuseSimilarityScore: z.number().optional(),
  }),
});

export type GeneratedItineraryResponse = z.infer<typeof generatedItineraryResponseSchema>;

/** Row shape from `public.jeju_kor_tourapi_places` (see Supabase migrations). */
export type JejuPoiRow = Record<string, unknown> & {
  id: number;
  content_id: string;
  content_type_id: number;
  title: string | null;
  first_image: string | null;
  first_image2: string | null;
  overview: string | null;
  addr1: string | null;
  addr2: string | null;
  use_time_text: string | null;
  fee_text: string | null;
  parking_info: string | null;
  reservation_info: string | null;
  rest_date: string | null;
  tel: string | null;
  homepage: string | null;
  /** KorTourAPI / DB: longitude (WGS84 °E). Not a generic “lng” alias column. */
  mapx: string | number | null;
  /** KorTourAPI / DB: latitude (WGS84 °N). Not a generic “lat” alias column. */
  mapy: string | number | null;
  manual_hidden: boolean | null;
  region_group: string | null;
  is_indoor: boolean | null;
  is_outdoor: boolean | null;
  is_free: boolean | null;
  is_paid: boolean | null;
  base_score: number | string | null;
  /** Operator ordering / primary tie semantics in admin & batch scoring (do not replace with boost). */
  manual_priority: number | string | null;
  /** Additive admin push for itinerary **candidate** ordering only (default 0). */
  manual_boost_score: number | string | null;
  recommended_duration_min: number | null;
  admin_short_desc_ko: string | null;
  admin_short_desc_en: string | null;
  admin_note_ko: string | null;
  admin_note_en: string | null;
  admin_tags: string[] | null;
  data_quality_score: number | string | null;
  senior_score: number | string | null;
  family_score: number | string | null;
  couple_score: number | string | null;
  rainy_day_score: number | string | null;
  travel_value_score?: number | string | null;
  photo_score?: number | string | null;
  route_efficiency_score?: number | string | null;
  /** Tour API PhotoGalleryService1 — 상세 관광사진 목록 (import 스크립트가 채움). */
  photo_gallery_detail_json?: unknown;
  photo_gallery_fetched_at?: string | null;
};
