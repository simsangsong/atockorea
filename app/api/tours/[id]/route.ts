import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withErrorHandler, AppError, ErrorResponses } from '@/lib/error-handler';
import { createServerLogger } from '@/lib/logger';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPPORTED_LOCALES = ['en', 'ko', 'zh', 'zh-CN', 'zh-TW', 'es', 'ja'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

function parseLocale(value: string | null): SupportedLocale | null {
  if (!value) return null;
  const normalized = value.trim();
  const lower = normalized.toLowerCase();

  // Normalize common variants (e.g. zh-cn → zh-CN)
  if (lower === 'zh-cn') return 'zh-CN';
  if (lower === 'zh-tw') return 'zh-TW';
  if (lower === 'zh') return 'zh';

  if (SUPPORTED_LOCALES.includes(normalized as SupportedLocale)) {
    return normalized as SupportedLocale;
  }
  if (SUPPORTED_LOCALES.includes(lower as SupportedLocale)) {
    return lower as SupportedLocale;
  }

  return null;
}

const LOCALE_SUFFIX_MAP: Record<SupportedLocale, string> = {
  en: 'en',
  ko: 'ko',
  zh: 'zh_cn',
  'zh-CN': 'zh_cn',
  'zh-TW': 'zh_tw',
  es: 'es',
  ja: 'ja',
};

function getLocalizedString(
  baseValue: string,
  tour: Record<string, any>,
  field: string,
  locale: SupportedLocale | null
): string {
  if (!locale) return baseValue;

  const suffix = LOCALE_SUFFIX_MAP[locale];
  if (!suffix) return baseValue;

  const localized = tour[`${field}_${suffix}`];
  if (typeof localized === 'string' && localized.trim() !== '') {
    return localized;
  }

  // Fallback to English-specific column if available
  const english = tour[`${field}_en`];
  if (typeof english === 'string' && english.trim() !== '') {
    return english;
  }

  // Final fallback: original base value (usually English)
  return baseValue;
}

/**
 * GET /api/tours/[id]
 * Get a single tour by ID with all related data.
 * Optional ?locale= en|ko|zh|zh-TW|es|ja returns translated content from tours.translations when available.
 */
export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const logger = createServerLogger(req);
  const tourId = params.id;
  const { searchParams } = new URL(req.url);
  const localeParam = parseLocale(searchParams.get('locale'));

    if (!tourId) {
      throw new AppError('Tour ID is required', 400, 'VALIDATION_ERROR');
    }

    const supabase = createServerClient();
    logger.info('Fetching tour', { tourId, locale: localeParam ?? 'default' });

    // Check if tourId is a UUID (contains hyphens) or a slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourId);
    const decodedTourId = decodeURIComponent(tourId);

    const pickupPointsSelect = `id, name, address, lat, lng, pickup_time`;
    const pickupPointsSelectWithImage = `id, name, address, lat, lng, pickup_time, image_url`;

    let query = supabase
      .from('tours')
      .select(`*, pickup_points (${pickupPointsSelectWithImage})`)
      .eq('is_active', true);

    if (isUUID) {
      query = query.eq('id', tourId);
    } else {
      query = query.eq('slug', decodedTourId);
    }

    let { data: tour, error: tourError } = await query.single();

    if (tourError && /column.*does not exist|image_url/.test(tourError.message || '')) {
      query = supabase
        .from('tours')
        .select(`*, pickup_points (${pickupPointsSelect})`)
        .eq('is_active', true);
      if (isUUID) query = query.eq('id', tourId);
      else query = query.eq('slug', decodedTourId);
      const fallback = await query.single();
      tour = fallback.data;
      tourError = fallback.error;
    }

    if (tourError && !isUUID && tourError.code === 'PGRST116') {
      const { data: tourCaseInsensitive, error: errorCaseInsensitive } = await supabase
        .from('tours')
        .select(`*, pickup_points (${pickupPointsSelect})`)
        .eq('is_active', true)
        .ilike('slug', decodedTourId)
        .single();
      if (tourCaseInsensitive && !errorCaseInsensitive) {
        tour = tourCaseInsensitive;
        tourError = null;
      }
    }

    if (tourError || !tour) {
      if (tourError?.code === 'PGRST116') {
        throw new AppError('Tour not found', 404, 'NOT_FOUND');
      }
      logger.error('Error fetching tour', undefined, { 
        tourId, 
        error: tourError?.message,
        code: tourError?.code 
      });
      throw new AppError('Failed to fetch tour', 500, 'TOUR_FETCH_ERROR', tourError?.message);
    }

    logger.info('Tour found', { id: tour.id, title: tour.title });

    // Use translated content when locale is requested and translations exist
    const tr = (localeParam && tour.translations && typeof tour.translations === 'object' && (tour.translations as Record<string, unknown>)[localeParam] as Record<string, unknown> | undefined) || null;
    const baseTitle = tour.title || '';
    const baseDescription = tour.description || '';
    const baseSchedule = Array.isArray(tour.schedule) ? tour.schedule : [];
    const baseIncludes = Array.isArray(tour.includes) ? tour.includes : (Array.isArray(tour.highlights) ? tour.highlights : []);
    const baseExcludes = Array.isArray(tour.excludes) ? tour.excludes : [];
    const baseFaqs = Array.isArray(tour.faqs) ? tour.faqs : [];
    const baseHighlight = tour.highlight || '';
    const basePickupInfo = tour.pickup_info || '';
    const baseNotes = tour.notes || '';

    const trTitle = (tr?.title as string) || '';
    const trDescription = (tr?.description as string) || '';
    const trSubtitle = (tr?.subtitle as string) || '';
    const trPickupInfo = (tr?.pickup_info as string) || '';
    const trNotes = (tr?.notes as string) || '';

    const title = getLocalizedString(trTitle || baseTitle, tour, 'title', localeParam);
    const tagline = getLocalizedString(trSubtitle || trDescription || baseDescription, tour, 'subtitle', localeParam);
    const overview = getLocalizedString(trDescription || baseDescription, tour, 'description', localeParam);
    const schedule = Array.isArray(tr?.schedule) ? (tr.schedule as any[]) : baseSchedule;
    const includes = Array.isArray(tr?.includes) ? (tr.includes as string[]) : baseIncludes;
    const excludes = Array.isArray(tr?.excludes) ? (tr.excludes as string[]) : baseExcludes;
    const faqs = Array.isArray(tr?.faqs) ? (tr.faqs as Array<{ question: string; answer: string }>) : baseFaqs;
    const highlights = Array.isArray(tr?.highlights)
      ? (tr.highlights as string[])
      : (Array.isArray(tour.highlights) ? tour.highlights : []);
    const pickupInfo = getLocalizedString(trPickupInfo || basePickupInfo, tour, 'pickup_info', localeParam);
    const notes = getLocalizedString(trNotes || baseNotes, tour, 'notes', localeParam);

    // Transform data to match frontend expectations
    const transformedTour = {
      id: tour.id,
      title,
      tagline,
      location: tour.city,
      city: tour.city,
      rating: tour.rating ? parseFloat(tour.rating.toString()) : 0,
      reviewCount: tour.review_count || 0,
      badges: tour.badges || [],
      price: parseFloat(tour.price.toString()),
      originalPrice: tour.original_price ? parseFloat(tour.original_price.toString()) : null,
      priceType: tour.price_type,
      availableSpots: undefined,
      depositAmountUSD: 20,
      balanceAmountKRW: 50000,
      duration: tour.duration || '',
      difficulty: tour.difficulty || '',
      groupSize: tour.group_size || '',
      highlight: (tr?.highlight as string) ?? baseHighlight,
      images: tour.gallery_images && Array.isArray(tour.gallery_images) && tour.gallery_images.length > 0 
        ? tour.gallery_images.map((img: string, index: number) => ({
            url: img,
            title: `${title} - Image ${index + 1}`,
            description: '',
          }))
        : tour.image_url 
          ? [{
              url: tour.image_url,
              title,
              description: overview,
            }]
          : [],
      quickFacts: [
        tour.group_size ? `Group size: ${tour.group_size}` : '',
        tour.difficulty ? `Difficulty: ${tour.difficulty}` : '',
        tour.duration ? `Duration: ${tour.duration}` : '',
      ].filter(Boolean),
      itinerary: schedule.map((item: any) => ({
        time: item.time || '',
        title: item.title || '',
        description: item.description || '',
        icon: item.icon || '📍',
        images: Array.isArray(item.images) ? item.images : undefined,
      })),
      inclusions: includes.map((item: string) => ({
        icon: '✓',
        text: item,
      })),
      exclusions: excludes.map((item: string) => ({
        icon: '✗',
        text: item,
      })),
      overview,
      pickupInfo,
      notes,
      pickupPoints: (tour.pickup_points || []).map((point: any) => ({
        id: point.id,
        name: point.name,
        address: point.address,
        lat: point.lat ? parseFloat(point.lat.toString()) : 0,
        lng: point.lng ? parseFloat(point.lng.toString()) : 0,
        pickup_time: point.pickup_time || null,
        image_url: point.image_url || null,
      })),
      faqs,
      highlights: highlights.length > 0 ? highlights : (Array.isArray(tour.highlights) ? tour.highlights : []),
      itineraryDetails: (() => {
        const base = Array.isArray(tour.itinerary_details) ? (tour.itinerary_details as any[]) : [];
        const trList = Array.isArray(tr?.itinerary_details) ? (tr.itinerary_details as any[]) : [];
        if (base.length === 0) return undefined;
        return base.map((item: any, i: number) => {
          const t = trList[i];
          return {
            time: (t?.time ?? item.time) ?? '',
            activity: (t?.activity ?? item.activity ?? item.title) ?? '',
            description: (t?.description ?? item.description) ?? '',
            images: Array.isArray(item.images) ? item.images : undefined,
          };
        });
      })(),
      schedule_hero_image_url: tour.schedule_hero_image_url ?? null,
      seoTitle: tour.seo_title ?? null,
      metaDescription: tour.meta_description ?? null,
      childEligibility: Array.isArray(tour.child_eligibility) ? tour.child_eligibility : [],
      suggestedToBring: Array.isArray(tour.suggested_to_bring) ? tour.suggested_to_bring : [],
      accessibilityFacilities:
        tour.accessibility_facilities && typeof tour.accessibility_facilities === 'object'
          ? tour.accessibility_facilities
          : undefined,
    };

    return NextResponse.json({ tour: transformedTour });
});

/**
 * PATCH /api/tours/[id]
 * Update a tour (Admin only)
 */
export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { requireAdmin } = await import('@/lib/auth');
  await requireAdmin(req);
  
  const logger = createServerLogger(req);
  const supabase = createServerClient();
  const tourId = params.id;
  const body = await req.json();

  if (!tourId) {
    throw new AppError('Tour ID is required', 400, 'VALIDATION_ERROR');
  }

    // Prepare update data
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.original_price !== undefined) updateData.original_price = body.original_price ? parseFloat(body.original_price) : null;
    if (body.price_type !== undefined) updateData.price_type = body.price_type;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.pickup_info !== undefined) updateData.pickup_info = body.pickup_info;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
    if (body.gallery_images !== undefined) updateData.gallery_images = body.gallery_images;
    if (body.schedule_hero_image_url !== undefined) updateData.schedule_hero_image_url = body.schedule_hero_image_url;
    if (body.highlights !== undefined) updateData.highlights = body.highlights;
    if (body.includes !== undefined) updateData.includes = body.includes;
    if (body.excludes !== undefined) updateData.excludes = body.excludes;
    if (body.schedule !== undefined) updateData.schedule = body.schedule;
    if (body.faqs !== undefined) updateData.faqs = body.faqs;
    if (body.child_eligibility !== undefined) updateData.child_eligibility = body.child_eligibility;
    if (body.suggested_to_bring !== undefined) updateData.suggested_to_bring = body.suggested_to_bring;
    if (body.accessibility_facilities !== undefined) updateData.accessibility_facilities = body.accessibility_facilities;
    if (body.translations !== undefined) updateData.translations = body.translations;

    const { data: tour, error: updateError } = await supabase
      .from('tours')
      .update(updateData)
      .eq('id', tourId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating tour', undefined, { error: updateError.message });
      throw new AppError('Failed to update tour', 500, 'TOUR_UPDATE_ERROR', updateError.message);
    }

    logger.info('Tour updated successfully', { tourId });
    return NextResponse.json({
      success: true,
      data: tour,
      message: 'Tour updated successfully',
    });
});

/**
 * DELETE /api/tours/[id]
 * Delete a tour (Admin only)
 */
export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { requireAdmin } = await import('@/lib/auth');
  await requireAdmin(req);
  
  const logger = createServerLogger(req);
  const supabase = createServerClient();
  const tourId = params.id;

  if (!tourId) {
    throw new AppError('Tour ID is required', 400, 'VALIDATION_ERROR');
  }

  // Delete pickup points first
  await supabase
    .from('pickup_points')
    .delete()
    .eq('tour_id', tourId);

  // Delete the tour
  const { error: deleteError } = await supabase
    .from('tours')
    .delete()
    .eq('id', tourId);

  if (deleteError) {
    logger.error('Error deleting tour', undefined, { error: deleteError.message });
    throw new AppError('Failed to delete tour', 500, 'TOUR_DELETE_ERROR', deleteError.message);
  }

  logger.info('Tour deleted successfully', { tourId });
  return NextResponse.json({
    success: true,
    message: 'Tour deleted successfully',
  });
});

