import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';
import { tourListPricesToUsdSync } from '@/lib/tour-list-price-usd.server';
import { withErrorHandler, AppError } from '@/lib/error-handler';
import { createServerLogger } from '@/lib/logger';
import { ACTIVE_BOOKING_STATUSES } from '@/lib/constants/booking-status';
import { isTourRowHiddenFromPublicTourApi } from '@/lib/tour-consumer-visibility';
import {
  expandDestinationCsvForCityInFilter,
  inferTourCatalogType,
  tagsForCatalogType,
  titleForCatalogType,
} from '@/lib/tour-catalog-type-infer';
import { getStaticTourProductBySlug } from '@/components/product-tour-static/catalog/staticTourProductRegistry';
import type { TourProductPageLocale } from '@/lib/tour-product/resolveTourProductDbLocale';

const SUPPORTED_LOCALES = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];
type TourTypeFilter = 'private' | 'join' | 'bus';

function parseLocale(value: string | null): SupportedLocale | null {
  if (!value) return null;
  const normalized = value.trim();
  if (SUPPORTED_LOCALES.includes(normalized as SupportedLocale)) return normalized as SupportedLocale;
  return null;
}

/** Escape ILIKE special characters (%, _) to avoid injection or unintended wildcards */
function escapeIlike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/** Sanitize feature/duration keyword for use in filters (max length, no quotes) */
function sanitizeKeyword(value: string, maxLen = 80): string {
  const s = value.slice(0, maxLen).replace(/["\\]/g, '');
  return s;
}

/**
 * GET /api/tours
 * Get all tours with optional filtering (server-side).
 * Optional ?locale= en|ko|zh|zh-TW|es|ja returns translated title/description from tours.translations when available.
 * Optional ?compact=1 omits nested pickup_points joins (lighter payloads for card/list UIs).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const logger = createServerLogger(req);
  const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const localeParam = parseLocale(searchParams.get('locale'));

    // Query parameters
    const city = searchParams.get('city');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minPriceUsd = searchParams.get('minPriceUsd');
    const maxPriceUsd = searchParams.get('maxPriceUsd');
    const isActive = searchParams.get('isActive') !== 'false'; // Default to true
    
    // New filter parameters
    const destinations =
      searchParams.get('destinations') ?? searchParams.get('destination'); // Comma-separated cities
    const destinationCityVariants = destinations?.trim()
      ? expandDestinationCsvForCityInFilter(destinations)
      : [];
    const durations = searchParams.get('durations'); // Comma-separated duration keywords
    const features = searchParams.get('features'); // Comma-separated feature keywords
    const sortAlias = searchParams.get('sort');
    const explicitSortRequested = searchParams.has('sort') || searchParams.has('sortBy');
    let sortBy = searchParams.get('sortBy') || 'created_at'; // created_at, price, rating, bookings
    let sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    if (!searchParams.has('sortBy')) {
      if (sortAlias === 'rating') {
        sortBy = 'rating';
        sortOrder = 'desc';
      } else if (sortAlias === 'sales') {
        sortBy = 'bookings';
        sortOrder = 'desc';
      } else if (sortAlias === 'priceAsc') {
        sortBy = 'price';
        sortOrder = 'asc';
      } else if (sortAlias === 'priceDesc') {
        sortBy = 'price';
        sortOrder = 'desc';
      } else if (sortAlias === 'newest') {
        sortBy = 'created_at';
        sortOrder = 'desc';
      }
    }
    if (sortBy === 'popular') {
      sortBy = 'created_at';
      sortOrder = 'desc';
    }
    const useScoreSort = searchParams.has('useScoreSort')
      ? searchParams.get('useScoreSort') !== 'false'
      : !explicitSortRequested || sortAlias === 'popular' || searchParams.get('sortBy') === 'popular';
    const typeParam = searchParams.get('tourType') ?? searchParams.get('type');
    const tourTypeFilter: TourTypeFilter | null =
      typeParam === 'private' || typeParam === 'join' || typeParam === 'bus' ? typeParam : null;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    /**
     * Compact response is the default — list/card UIs (tours/list page,
     * TourSectionRow, featured-products-showcase, TourList, mypage saved tours)
     * never read pickup_points, and shipping the nested join meant ~5KB of dead
     * payload per tour × N tours per request. Detail surfaces that genuinely need
     * the pickup roster opt in with `?compact=0`. The dedicated `/api/tours/[id]`
     * route is unaffected — it always returns full data.
     */
    const compactList = searchParams.get('compact') !== '0';

    // Build query
    const pickupJoin = `
        pickup_points (
          id,
          name,
          address,
          lat,
          lng,
          pickup_time
        )`;
    let query = supabase
      .from('tours')
      .select(compactList ? '*' : `*,${pickupJoin}`)
      .eq('is_active', isActive);

    // Apply filters
    if (city) {
      query = query.eq('city', city);
    }

    if (destinationCityVariants.length > 0) {
      query = query.in('city', destinationCityVariants);
    }

    // Price range filter.
    // DB `tours.price` is stored in KRW for most rows (some marked `price_currency=USD`).
    // Client sends `minPriceUsd`/`maxPriceUsd` so the API can convert with the live FX
    // rate; raw `minPrice`/`maxPrice` is kept for back-compat (assumed KRW).
    const krwPerUsdForFilter = await getKrwPerUsd();
    const parsePositive = (raw: string | null): number | null => {
      if (!raw) return null;
      const n = parseFloat(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const minUsd = parsePositive(minPriceUsd);
    const maxUsd = parsePositive(maxPriceUsd);
    const minKrwLegacy = parsePositive(minPrice);
    const maxKrwLegacy = parsePositive(maxPrice);
    const minKrw = minUsd != null ? minUsd * krwPerUsdForFilter : minKrwLegacy;
    const maxKrw = maxUsd != null ? maxUsd * krwPerUsdForFilter : maxKrwLegacy;

    if (minKrw != null) {
      query = query.gte('price', minKrw);
    }

    if (maxKrw != null) {
      query = query.lte('price', maxKrw);
    }

    // Search filter (title, description, city) - escape ILIKE special chars
    if (search && search.trim()) {
      const escaped = escapeIlike(search.trim());
      query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,city.ilike.%${escaped}%`);
    }

    // Duration filter (search in duration field) - escape ILIKE special chars
    if (durations) {
      const durationList = durations.split(',').map(d => sanitizeKeyword(d.trim().toLowerCase())).filter(Boolean);
      if (durationList.length > 0) {
        const durationConditions = durationList.map(duration => {
          const escaped = escapeIlike(duration);
          return `duration.ilike.%${escaped}%`;
        }).join(',');
        query = query.or(durationConditions);
      }
    }

    // Features are filtered after transformation below. Keeping this out of the
    // SQL JSONB exact-match path lets links like `features=UNESCO` or
    // `features=Cruise excursion` match partial/cased badge text reliably.

    // Sorting
    const ascending = sortOrder === 'asc';
    if (sortBy === 'price') {
      query = query.order('price', { ascending });
    } else if (sortBy === 'rating') {
      query = query.order('rating', { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    const widenForCatalogHeuristic =
      tourTypeFilter != null || destinationCityVariants.length > 0 || Boolean(features?.trim());
    const fetchSpan = widenForCatalogHeuristic
      ? Math.min(Math.max(limit, 900), 2200)
      : limit;
    query = query.range(offset, offset + fetchSpan - 1);

    const { data: tours, error } = await query;

    if (error) {
      logger.error('Error fetching tours', undefined, { error: error.message });
      throw new AppError('Failed to fetch tours', 500, 'TOURS_FETCH_ERROR', error.message);
    }

    // `krwPerUsdForFilter` is already resolved above for price range conversion.
    const krwPerUsd = krwPerUsdForFilter;

    // Transform data to match frontend expectations; use translations[locale] when available
    let transformedTours = tours?.map((tour: any) => {
      const pickupPoints = compactList
        ? []
        : Array.isArray(tour.pickup_points)
          ? tour.pickup_points
          : [];
      const tr = (localeParam && tour.translations && typeof tour.translations === 'object' && tour.translations[localeParam]) || null;
      const title = (tr?.title ?? tour.title) as string;
      const description = (tr?.description ?? tour.description ?? '') as string;
      const badgesRaw = tour.badges;
      const trBadges = tr && Array.isArray((tr as { badges?: unknown }).badges) ? (tr as { badges: string[] }).badges : null;
      const badges =
        localeParam && trBadges && trBadges.length > 0
          ? trBadges
          : Array.isArray(badgesRaw)
            ? badgesRaw
            : [];
      const trDur = tr && typeof (tr as { duration?: unknown }).duration === 'string' ? String((tr as { duration: string }).duration).trim() : '';
      const durationStr =
        localeParam && trDur ? trDur : (tour.duration || '');
      const { priceUsd, originalPriceUsd } = tourListPricesToUsdSync(
        {
          price: tour.price,
          original_price: tour.original_price,
          price_currency: tour.price_currency,
        },
        krwPerUsd
      );

      const slugStr = typeof tour.slug === 'string' ? tour.slug.trim() : '';
      const localeForCard = (localeParam ?? 'en') as TourProductPageLocale;
      const staticCard = slugStr ? getStaticTourProductBySlug(slugStr, localeForCard) : undefined;

      let listImage =
        tour.image_url ||
        (tour.gallery_images && Array.isArray(tour.gallery_images) && tour.gallery_images.length > 0
          ? tour.gallery_images[0]
          : '') ||
        '';
      let galleryOut = Array.isArray(tour.gallery_images) ? [...tour.gallery_images] : [];
      if (staticCard?.thumbnail?.trim()) {
        const thumb = staticCard.thumbnail.trim();
        listImage = thumb;
        if (galleryOut.length === 0) galleryOut = [thumb];
        else if (galleryOut[0] !== thumb) {
          galleryOut = [thumb, ...galleryOut.filter((u: string) => u !== thumb)];
        }
      }

      let priceOut = priceUsd;
      let originalOut = originalPriceUsd;
      if (staticCard) {
        if (staticCard.listPriceUsd > 0 && (!Number.isFinite(priceOut) || priceOut <= 0)) {
          priceOut = staticCard.listPriceUsd;
        }
        const cap = staticCard.compareAtPriceUsd;
        if (typeof cap === 'number' && cap > priceOut && (originalOut == null || cap > originalOut)) {
          originalOut = cap;
        }
      }

      const tag = typeof tour.tag === 'string' && tour.tag.trim() !== '' ? tour.tag.trim() : null;
      const catalogType = inferTourCatalogType({
        title,
        badges,
        slug: tour.slug,
        tag,
        priceType: typeof tour.price_type === 'string' ? tour.price_type : null,
        groupSize: typeof tour.group_size === 'string' ? tour.group_size : null,
      });

      return {
        id: tour.id,
        slug: tour.slug,
        tag,
        title: titleForCatalogType(title, catalogType),
        catalogType,
        location: tour.city,
        city: tour.city,
        price: priceOut,
        originalPrice: originalOut,
        priceType: tour.price_type,
        image: listImage,
        images: galleryOut,
        rating: tour.rating ? parseFloat(tour.rating.toString()) : 0,
        reviewCount: tour.review_count || 0,
        duration: durationStr,
        difficulty: tour.difficulty || '',
        groupSize: tour.group_size || '',
        highlight: (tr?.highlight ?? tour.highlight ?? '') as string,
        badges: tagsForCatalogType(badges, catalogType),
        description,
        location_detail: tour.location || '',
        pickupPoints,
        pickupPointsCount:
          pickupPoints.length > 0
            ? pickupPoints.length
            : Number(tour.pickup_points_count) || 0,
        dropoffPointsCount: tour.dropoff_points_count || 0,
        lunchIncluded: tour.lunch_included || false,
        ticketIncluded: tour.ticket_included || false,
        includes: (Array.isArray(tr?.includes) ? tr.includes : tour.includes) || [],
        excludes: (Array.isArray(tr?.excludes) ? tr.excludes : tour.excludes) || [],
        schedule: (Array.isArray(tr?.schedule) ? tr.schedule : tour.schedule) || [],
        highlights: (Array.isArray(tr?.highlights) ? tr.highlights : tour.highlights) || [],
        pickupInfo: (tr?.pickup_info ?? tour.pickup_info ?? '') as string,
        notes: (tr?.notes ?? tour.notes ?? '') as string,
        isActive: tour.is_active,
        createdAt: tour.created_at,
        updatedAt: tour.updated_at,
      };
    }) || [];

    transformedTours = transformedTours.filter(
      (tour) => !isTourRowHiddenFromPublicTourApi({ id: String(tour.id ?? ''), slug: tour.slug })
    );

    // Tour-type filter happens in memory via `inferTourType` heuristics.
    // Long-term: add a `tour_type` column on `tours` and push this into the SQL WHERE
    // clause so pagination/ordering stay consistent at DB level. For now we apply it
    // here — BEFORE features filter / score computation — so downstream `total`,
    // score ordering, and any eventual server pagination see the final filtered set.
    if (tourTypeFilter) {
      transformedTours = transformedTours.filter((tour) =>
        inferTourCatalogType({
          title: tour.title,
          badges: Array.isArray(tour.badges) ? tour.badges.map(String) : [],
          slug: typeof tour.slug === 'string' ? tour.slug : undefined,
          tag: typeof tour.tag === 'string' ? tour.tag : null,
          priceType: typeof tour.priceType === 'string' ? tour.priceType : null,
          groupSize: typeof tour.groupSize === 'string' ? tour.groupSize : null,
        }) === tourTypeFilter
      );
    }

    // Apply features filter in JavaScript (since JSONB queries are complex)
    if (features) {
      const featureList = features.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
      if (featureList.length > 0) {
        transformedTours = transformedTours.filter((tour) => {
          // Check if any feature matches in badges or description
          const tourBadges = (tour.badges || []).map((b: string) => b.toLowerCase());
          const tourDescription = (tour.description || '').toLowerCase();
          
          return featureList.some(feature => {
            // Check in badges
            if (tourBadges.some((badge: string) => badge.includes(feature))) {
              return true;
            }
            // Check in description (for features like "Tickets Included", "Meals Included")
            if (tourDescription.includes(feature)) {
              return true;
            }
            return false;
          });
        });
      }
    }

    // Deterministic ordering after filters (subset no longer guaranteed to reflect DB ORDER BY slice).
    const ascLex = sortOrder === "asc";
    if (
      !useScoreSort &&
      sortBy !== "bookings" &&
      transformedTours.length > 1
    ) {
      transformedTours.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "price") {
          cmp = (Number(a.price) || 0) - (Number(b.price) || 0);
        } else if (sortBy === "rating") {
          cmp = (Number(a.rating) || 0) - (Number(b.rating) || 0);
        } else {
          cmp = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        }
        return ascLex ? cmp : -cmp;
      });
    }

    // Compute recommendation score for each tour and sort by score (higher first), unless useScoreSort=false
    if (transformedTours.length > 0 && (useScoreSort || sortBy === 'bookings')) {
      try {
        const tourIds = transformedTours.map((tour) => tour.id).filter(Boolean);
        const bookingCounts: Record<string, number> = {};

        if (tourIds.length > 0) {
          const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('tour_id')
            .in('tour_id', tourIds)
            .in('status', [...ACTIVE_BOOKING_STATUSES]);

          if (!bookingsError && bookings) {
            for (const b of bookings) {
              const tid = String((b as any).tour_id);
              bookingCounts[tid] = (bookingCounts[tid] || 0) + 1;
            }
          } else if (bookingsError) {
            logger.warn?.('Failed to load booking counts for recommendation score', { error: bookingsError.message });
          }
        }

        const now = Date.now();

        transformedTours = transformedTours
          .map((tour) => {
            const bookingCount = bookingCounts[String(tour.id)] || 0;
            const rating = typeof tour.rating === 'number' ? tour.rating : Number(tour.rating ?? 0) || 0;

            const price = typeof tour.price === 'number' ? tour.price : Number(tour.price ?? 0) || 0;
            const originalPrice = tour.originalPrice != null ? Number(tour.originalPrice) : null;
            const discountPercent =
              originalPrice != null && originalPrice > price && price > 0
                ? Math.round(((originalPrice - price) / originalPrice) * 100)
                : 0;

            let newness = 0;
            if (tour.createdAt) {
              const createdTime = new Date(tour.createdAt as string).getTime();
              if (!Number.isNaN(createdTime)) {
                const daysSince = (now - createdTime) / (1000 * 60 * 60 * 24);
                // New tours (recent days) get higher newness; older tours decay towards 0
                newness = Math.max(0, 90 - daysSince);
              }
            }

            const score =
              bookingCount * 0.4 +
              rating * 0.3 +
              discountPercent * 0.2 +
              newness * 0.1;

            return {
              ...tour,
              bookingCount,
              discountPercent,
              score,
            };
          })
          .sort((a, b) => {
            if (sortBy === 'bookings') {
              if (sortOrder === 'asc') {
                return (a.bookingCount || 0) - (b.bookingCount || 0);
              }
              return (b.bookingCount || 0) - (a.bookingCount || 0);
            }
            if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
            if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          });
      } catch (scoreError) {
        logger.warn?.('Failed to compute recommendation scores for tours', { error: (scoreError as Error).message });
      }
    }

    logger.info('Tours fetched successfully', { count: transformedTours.length });

    return NextResponse.json({ 
      tours: transformedTours,
      total: transformedTours.length,
      limit,
      offset,
    });
  });
