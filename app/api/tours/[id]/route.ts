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

    // Fetch tour with pickup points
    const { data: tour, error: tourError } = await supabase
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
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

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
      images: tour.images && tour.images.length > 0 
        ? tour.images.map((img: string, index: number) => ({
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

