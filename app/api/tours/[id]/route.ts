import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withErrorHandler, AppError, ErrorResponses } from '@/lib/error-handler';
import { createServerLogger } from '@/lib/logger';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPPORTED_LOCALES = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

function parseLocale(value: string | null): SupportedLocale | null {
  if (!value) return null;
  const normalized = value.trim();
  if (SUPPORTED_LOCALES.includes(normalized as SupportedLocale)) return normalized as SupportedLocale;
  return null;
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

    // Try to fetch by ID first (UUID), then by slug if not found
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
      .eq('is_active', true);

    // Check if tourId is a UUID (contains hyphens) or a slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourId);
    
    // Decode URL-encoded slug
    const decodedTourId = decodeURIComponent(tourId);
    
    if (isUUID) {
      query = query.eq('id', tourId);
    } else {
      // Use exact match first (case-sensitive for slug)
      query = query.eq('slug', decodedTourId);
    }

    let { data: tour, error: tourError } = await query.single();
    
    // If exact match fails and it's a slug, try case-insensitive search
    if (tourError && !isUUID && tourError.code === 'PGRST116') {
      const { data: tourCaseInsensitive, error: errorCaseInsensitive } = await supabase
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
    const baseTitle = tour.title;
    const baseDescription = tour.description || '';
    const baseSchedule = Array.isArray(tour.schedule) ? tour.schedule : [];
    const baseIncludes = Array.isArray(tour.includes) ? tour.includes : (Array.isArray(tour.highlights) ? tour.highlights : []);
    const baseExcludes = Array.isArray(tour.excludes) ? tour.excludes : [];
    const baseFaqs = Array.isArray(tour.faqs) ? tour.faqs : [];
    const baseHighlight = tour.highlight || '';
    const basePickupInfo = tour.pickup_info || '';
    const baseNotes = tour.notes || '';

    const title = (tr?.title as string) ?? baseTitle;
    const tagline = (tr?.description as string) ?? (tr?.subtitle as string) ?? baseDescription;
    const overview = (tr?.description as string) ?? baseDescription;
    const schedule = Array.isArray(tr?.schedule) ? (tr.schedule as any[]) : baseSchedule;
    const includes = Array.isArray(tr?.includes) ? (tr.includes as string[]) : baseIncludes;
    const excludes = Array.isArray(tr?.excludes) ? (tr.excludes as string[]) : baseExcludes;
    const faqs = Array.isArray(tr?.faqs) ? (tr.faqs as Array<{ question: string; answer: string }>) : baseFaqs;
    const highlights = Array.isArray(tr?.highlights) ? (tr.highlights as string[]) : (Array.isArray(tour.highlights) ? tour.highlights : []);
    const pickupInfo = (tr?.pickup_info as string) ?? basePickupInfo;
    const notes = (tr?.notes as string) ?? baseNotes;

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
      })),
      faqs,
      highlights: highlights.length > 0 ? highlights : (Array.isArray(tour.highlights) ? tour.highlights : []),
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
    if (body.highlights !== undefined) updateData.highlights = body.highlights;
    if (body.includes !== undefined) updateData.includes = body.includes;
    if (body.excludes !== undefined) updateData.excludes = body.excludes;
    if (body.schedule !== undefined) updateData.schedule = body.schedule;
    if (body.faqs !== undefined) updateData.faqs = body.faqs;
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

