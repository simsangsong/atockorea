import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';
import { tourListPricesToUsdSync } from '@/lib/tour-list-price-usd.server';
import { withErrorHandler, AppError } from '@/lib/error-handler';
import { createServerLogger } from '@/lib/logger';
import { ACTIVE_BOOKING_STATUSES } from '@/lib/constants/booking-status';
import { isTourRowHiddenFromPublicTourApi } from '@/lib/tour-consumer-visibility';

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

function isKnownJoinTourSlug(slug: string | undefined | null): boolean {
  const s = (slug ?? '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'east-signature-nature-core') return true;
  if (s.startsWith('east-signature-nature-core-')) return true;
  if (s === 'east-jeju-signature-small-group') return true;
  if (s.startsWith('east-jeju-signature-small-group-')) return true;
  if (s === 'jeju-east-small-group-template-preview') return true;
  return false;
}

function tagIndicatesSmallGroupJoin(tag: string | undefined | null): boolean {
  const t = (tag ?? '').trim().toLowerCase();
  if (!t) return false;
  return /small\s*group|소그룹|拼团|少人数|grupo\s*pequeño|small-group/i.test(t);
}

function inferTourType(item: { title?: string; badges?: string[]; slug?: string; tag?: string | null }): TourTypeFilter {
  if (isKnownJoinTourSlug(item.slug)) return 'join';
  if (tagIndicatesSmallGroupJoin(item.tag)) return 'join';
  const title = (item.title ?? '').toLowerCase();
  const badges = (item.badges ?? []).map((b) => String(b).toLowerCase());
  if (
    /private|프라이빗|私人|プライベート|privado/i.test(title) ||
    badges.some((b) => b.includes('private'))
  ) {
    return 'private';
  }
  if (
    /join|small.?group|소그룹|拼团|少人数|grupo pequeño/i.test(title) ||
    /east\s*signature\s*nature\s*core/i.test(title) ||
    /동부\s*시그니처|시그니처\s*네이처|네이처\s*코어/.test(item.title ?? '') ||
    badges.some((b) => b.includes('join') || b.includes('small group'))
  ) {
    return 'join';
  }
  return 'bus';
}

/**
 * GET /api/tours
 * Get all tours with optional filtering (server-side).
 * Optional ?locale= en|ko|zh|zh-TW|es|ja returns translated title/description from tours.translations when available.
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
    const isActive = searchParams.get('isActive') !== 'false'; // Default to true
    
    // New filter parameters
    const destinations = searchParams.get('destinations'); // Comma-separated cities
    const durations = searchParams.get('durations'); // Comma-separated duration keywords
    const features = searchParams.get('features'); // Comma-separated feature keywords
    const sortBy = searchParams.get('sortBy') || 'created_at'; // created_at, price, rating, bookings
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    const useScoreSort = searchParams.get('useScoreSort') !== 'false'; // when false, keep requested sortBy/sortOrder
    const typeParam = searchParams.get('tourType');
    const tourTypeFilter: TourTypeFilter | null =
      typeParam === 'private' || typeParam === 'join' || typeParam === 'bus' ? typeParam : null;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('tours')
      .select(`
        *,
        pickup_points (
          id,
          name,
          address,
          lat,
          lng,
          pickup_time
        )
      `)
      .eq('is_active', isActive);

    // Apply filters
    if (city) {
      query = query.eq('city', city);
    }

    // Multiple destinations filter
    if (destinations) {
      const destinationList = destinations.split(',').map(d => d.trim()).filter(Boolean);
      if (destinationList.length > 0) {
        query = query.in('city', destinationList);
      }
    }

    // Price range filter
    if (minPrice) {
      query = query.gte('price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('price', parseFloat(maxPrice));
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

    // Features filter - sanitize to prevent injection in JSONB path
    if (features) {
      const featureList = features.split(',').map(f => sanitizeKeyword(f.trim().toLowerCase())).filter(Boolean);
      if (featureList.length > 0) {
        const featureConditions = featureList.map(feature => `badges.cs.["${feature}"]`).join(',');
        query = query.or(featureConditions);
      }
    }

    // Sorting
    const ascending = sortOrder === 'asc';
    if (sortBy === 'price') {
      query = query.order('price', { ascending });
    } else if (sortBy === 'rating') {
      query = query.order('rating', { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: tours, error } = await query;

    if (error) {
      logger.error('Error fetching tours', undefined, { error: error.message });
      throw new AppError('Failed to fetch tours', 500, 'TOURS_FETCH_ERROR', error.message);
    }

    const krwPerUsd = await getKrwPerUsd();

    // Transform data to match frontend expectations; use translations[locale] when available
    let transformedTours = tours?.map((tour: any) => {
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
      return {
        id: tour.id,
        slug: tour.slug,
        tag: typeof tour.tag === 'string' && tour.tag.trim() !== '' ? tour.tag.trim() : null,
        title,
        location: tour.city,
        city: tour.city,
        price: priceUsd,
        originalPrice: originalPriceUsd,
        priceType: tour.price_type,
        image: tour.image_url || (tour.gallery_images && Array.isArray(tour.gallery_images) && tour.gallery_images.length > 0 ? tour.gallery_images[0] : '') || '',
        images: tour.gallery_images || [],
        rating: tour.rating ? parseFloat(tour.rating.toString()) : 0,
        reviewCount: tour.review_count || 0,
        duration: durationStr,
        difficulty: tour.difficulty || '',
        groupSize: tour.group_size || '',
        highlight: (tr?.highlight ?? tour.highlight ?? '') as string,
        badges,
        description,
        location_detail: tour.location || '',
        pickupPoints: tour.pickup_points || [],
        pickupPointsCount: (tour.pickup_points && Array.isArray(tour.pickup_points) ? tour.pickup_points.length : 0) || tour.pickup_points_count || 0,
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

    // Compute recommendation score for each tour and sort by score (higher first), unless useScoreSort=false
    if (transformedTours.length > 0 && (useScoreSort || sortBy === 'bookings')) {
      try {
        const tourIds = transformedTours.map((tour) => tour.id).filter(Boolean);
        const bookingCounts: Record<string, number> = {};

        if (tourIds.length > 0) {
          const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, tour_id, status')
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

    if (tourTypeFilter) {
      transformedTours = transformedTours.filter((tour) =>
        inferTourType({
          title: tour.title,
          badges: Array.isArray(tour.badges) ? tour.badges.map(String) : [],
          slug: typeof tour.slug === 'string' ? tour.slug : undefined,
          tag: typeof tour.tag === 'string' ? tour.tag : null,
        }) === tourTypeFilter
      );
    }

    logger.info('Tours fetched successfully', { count: transformedTours.length });

    return NextResponse.json({ 
      tours: transformedTours,
      total: transformedTours.length,
      limit,
      offset,
    });
  });
