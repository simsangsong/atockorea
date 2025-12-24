import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';

/**
 * GET /api/tours/[id]
 * Get a single tour by ID with all related data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const tourId = params.id;

    if (!tourId) {
      return ErrorResponses.validationError('Tour ID is required');
    }

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
    
    if (isUUID) {
      query = query.eq('id', tourId);
    } else {
      query = query.eq('slug', tourId);
    }

    const { data: tour, error: tourError } = await query.single();

    if (tourError || !tour) {
      if (tourError?.code === 'PGRST116') {
        return ErrorResponses.notFound('Tour');
      }
      throw tourError || new Error('Tour not found');
    }

    // Transform data to match frontend expectations
    const transformedTour = {
      id: tour.id,
      title: tour.title,
      tagline: tour.description || '',
      location: tour.city,
      city: tour.city,
      rating: tour.rating ? parseFloat(tour.rating.toString()) : 0,
      reviewCount: tour.review_count || 0,
      badges: tour.badges || [],
      price: parseFloat(tour.price.toString()),
      originalPrice: tour.original_price ? parseFloat(tour.original_price.toString()) : null,
      priceType: tour.price_type,
      availableSpots: undefined, // Will be checked per date in frontend
      depositAmountUSD: 20, // TODO: Get from tour settings or merchant settings
      balanceAmountKRW: 50000, // TODO: Get from tour settings or merchant settings
      duration: tour.duration || '',
      difficulty: tour.difficulty || '',
      groupSize: tour.group_size || '',
      highlight: tour.highlight || '',
      images: tour.gallery_images && Array.isArray(tour.gallery_images) && tour.gallery_images.length > 0 
        ? tour.gallery_images.map((img: string, index: number) => ({
            url: img,
            title: `${tour.title} - Image ${index + 1}`,
            description: '',
          }))
        : tour.image_url 
          ? [{
              url: tour.image_url,
              title: tour.title,
              description: tour.description || '',
            }]
          : [],
      quickFacts: [
        tour.group_size ? `Group size: ${tour.group_size}` : '',
        tour.difficulty ? `Difficulty: ${tour.difficulty}` : '',
        tour.duration ? `Duration: ${tour.duration}` : '',
      ].filter(Boolean),
      itinerary: Array.isArray(tour.schedule) 
        ? tour.schedule.map((item: any) => ({
            time: item.time || '',
            title: item.title || '',
            description: item.description || '',
            icon: item.icon || '📍',
          }))
        : [],
      inclusions: Array.isArray(tour.includes)
        ? tour.includes.map((item: string) => ({
            icon: '✓',
            text: item,
          }))
        : Array.isArray(tour.highlights)
        ? tour.highlights.map((item: string) => ({
            icon: '✓',
            text: item,
          }))
        : [],
      exclusions: Array.isArray(tour.excludes)
        ? tour.excludes.map((item: string) => ({
            icon: '✗',
            text: item,
          }))
        : [],
      overview: tour.description || '',
      pickupPoints: (tour.pickup_points || []).map((point: any) => ({
        id: point.id,
        name: point.name,
        address: point.address,
        lat: point.lat ? parseFloat(point.lat.toString()) : 0,
        lng: point.lng ? parseFloat(point.lng.toString()) : 0,
        pickup_time: point.pickup_time || null,
      })),
    };

    return NextResponse.json({ tour: transformedTour });
  } catch (error: any) {
    return handleApiError(error, req);
  }
}

/**
 * PATCH /api/tours/[id]
 * Update a tour (Admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { requireAdmin } = await import('@/lib/auth');
    await requireAdmin(req);
    
    const supabase = createServerClient();
    const tourId = params.id;
    const body = await req.json();

    if (!tourId) {
      return ErrorResponses.validationError('Tour ID is required');
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

    const { data: tour, error: updateError } = await supabase
      .from('tours')
      .update(updateData)
      .eq('id', tourId)
      .select()
      .single();

    if (updateError) {
      return handleApiError(updateError);
    }

    return NextResponse.json({
      success: true,
      data: tour,
      message: 'Tour updated successfully',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return ErrorResponses.forbidden('Admin access required');
    }
    return handleApiError(error, req);
  }
}

/**
 * DELETE /api/tours/[id]
 * Delete a tour (Admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { requireAdmin } = await import('@/lib/auth');
    await requireAdmin(req);
    
    const supabase = createServerClient();
    const tourId = params.id;

    if (!tourId) {
      return ErrorResponses.validationError('Tour ID is required');
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
      return handleApiError(deleteError);
    }

    return NextResponse.json({
      success: true,
      message: 'Tour deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return ErrorResponses.forbidden('Admin access required');
    }
    return handleApiError(error, req);
  }
}

