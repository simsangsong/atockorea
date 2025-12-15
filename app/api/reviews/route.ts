import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/reviews
 * Get reviews with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const tourId = searchParams.get('tourId');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('reviews')
      .select(`
        *,
        user_profiles (
          id,
          full_name,
          avatar_url
        ),
        tours (
          id,
          title
        )
      `)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tourId) {
      query = query.eq('tour_id', tourId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ reviews: reviews || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews
 * Create a new review
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { tourId, bookingId, rating, title, comment, images } = body;

    // Validate required fields
    if (!tourId || !rating) {
      return NextResponse.json(
        { error: 'tourId and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user already reviewed this tour/booking
    let existingReviewQuery = supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('tour_id', tourId);

    if (bookingId) {
      existingReviewQuery = existingReviewQuery.eq('booking_id', bookingId);
    }

    const { data: existingReview } = await existingReviewQuery.single();

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this tour' },
        { status: 409 }
      );
    }

    // Check if booking exists and belongs to user (for verification)
    let isVerified = false;
    if (bookingId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, user_id, status')
        .eq('id', bookingId)
        .eq('user_id', userId)
        .single();

      if (booking && booking.status === 'completed') {
        isVerified = true;
      }
    }

    // Create review
    const reviewData: any = {
      user_id: userId,
      tour_id: tourId,
      rating,
      comment: comment || null,
      title: title || null,
      images: images || [],
      is_verified: isVerified,
      is_visible: true,
    };

    if (bookingId) {
      reviewData.booking_id = bookingId;
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert(reviewData)
      .select(`
        *,
        user_profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('Error creating review:', error);
      return NextResponse.json(
        { error: 'Failed to create review', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { review, message: 'Review created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}



