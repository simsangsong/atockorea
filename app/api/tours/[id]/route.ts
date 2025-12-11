import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/tours/[id]
 * Get tour detail by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tourId = params.id;

    if (!tourId) {
      return NextResponse.json(
        { error: 'Tour ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get tour with merchant info
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select(`
        *,
        merchants:merchant_id (
          id,
          company_name,
          contact_email
        )
      `)
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

    if (tourError || !tour) {
      return NextResponse.json(
        { error: 'Tour not found' },
        { status: 404 }
      );
    }

    // Get reviews count and average rating
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('tour_id', tourId)
      .eq('is_visible', true);

    const reviewCount = reviews?.length || 0;
    const avgRating = reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Format tour data
    const formattedTour = {
      id: tour.id,
      title: tour.title,
      slug: tour.slug,
      tagline: tour.subtitle,
      location: tour.city,
      rating: Math.round(avgRating * 100) / 100,
      reviewCount,
      price: Number(tour.price),
      originalPrice: tour.original_price ? Number(tour.original_price) : null,
      priceType: tour.price_type || 'person',
      duration: tour.duration,
      difficulty: tour.difficulty,
      groupSize: tour.group_size,
      highlight: tour.highlight,
      description: tour.description,
      images: tour.gallery_images || [],
      bannerImage: tour.banner_image || tour.image_url,
      quickFacts: tour.tour_details?.quickFacts || [],
      itinerary: tour.schedule || [],
      inclusions: tour.includes || [],
      exclusions: tour.excludes || [],
      faqs: tour.faqs || [],
      pickupPoints: [], // Will be fetched separately if needed
      merchant: tour.merchants,
    };

    return NextResponse.json({ tour: formattedTour });
  } catch (error: any) {
    console.error('Error fetching tour:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

