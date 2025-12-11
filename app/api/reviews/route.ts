import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/reviews?tourId=xxx
 * Get reviews for a tour
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tourId = searchParams.get('tourId');

    if (!tourId) {
      return NextResponse.json(
        { error: 'Tour ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get reviews with user info
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        comment,
        photos,
        is_verified,
        created_at,
        user_profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('tour_id', tourId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    // Format reviews for frontend
    const formattedReviews = reviews?.map((review: any) => ({
      id: review.id,
      author: review.is_anonymous ? '匿名用户' : (review.user_profiles?.full_name || 'Anonymous'),
      avatar: review.is_anonymous ? null : (review.user_profiles?.avatar_url || null),
      rating: review.rating,
      title: review.title || '',
      text: review.comment || '',
      photos: review.photos || [],
      isVerified: review.is_verified,
      isAnonymous: review.is_anonymous || false,
      date: review.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      likeCount: review.like_count || 0,
      dislikeCount: review.dislike_count || 0,
    })) || [];

    return NextResponse.json({ reviews: formattedReviews });
  } catch (error: any) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews
 * Create a new review with photos
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const userId = user.id;

    const body = await req.json();
    const { tourId, bookingId, rating, title, comment, photos, isAnonymous } = body;

    if (!tourId || !rating) {
      return NextResponse.json(
        { error: 'Tour ID and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check if user already reviewed this tour/booking
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('tour_id', tourId)
      .maybeSingle();

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this tour' },
        { status: 400 }
      );
    }

    // Check if booking exists and belongs to user (if bookingId provided)
    if (bookingId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, user_id, status')
        .eq('id', bookingId)
        .eq('user_id', userId)
        .single();

      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found or does not belong to you' },
          { status: 404 }
        );
      }
    }

    // Create review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        tour_id: tourId,
        booking_id: bookingId || null,
        rating,
        title: title || null,
        comment: comment || null,
        photos: photos || [],
        is_verified: !!bookingId, // Verified if has booking
        is_visible: true,
        is_anonymous: isAnonymous || false, // 匿名选项
      })
      .select(`
        id,
        rating,
        title,
        comment,
        photos,
        is_verified,
        is_anonymous,
        like_count,
        dislike_count,
        created_at,
        user_profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (reviewError) {
      console.error('Error creating review:', reviewError);
      return NextResponse.json(
        { error: 'Failed to create review' },
        { status: 500 }
      );
    }

    // Update tour rating and review count
    const { data: tourReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('tour_id', tourId)
      .eq('is_visible', true);

    if (tourReviews && tourReviews.length > 0) {
      const avgRating = tourReviews.reduce((sum, r) => sum + r.rating, 0) / tourReviews.length;
      const reviewCount = tourReviews.length;

      await supabase
        .from('tours')
        .update({
          rating: Math.round(avgRating * 100) / 100,
          review_count: reviewCount,
        })
        .eq('id', tourId);
    }

    // Format response
    const formattedReview = {
      id: review.id,
      author: review.is_anonymous ? '匿名用户' : (review.user_profiles?.full_name || 'Anonymous'),
      avatar: review.is_anonymous ? null : (review.user_profiles?.avatar_url || null),
      rating: review.rating,
      title: review.title || '',
      text: review.comment || '',
      photos: review.photos || [],
      isVerified: review.is_verified,
      isAnonymous: review.is_anonymous || false,
      date: review.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      likeCount: review.like_count || 0,
      dislikeCount: review.dislike_count || 0,
    };

    return NextResponse.json({ review: formattedReview }, { status: 201 });
  } catch (error: any) {
    console.error('Error in create review API:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

