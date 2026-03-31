import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/reviews
 * Get reviews with optional filtering.
 * Filtering by userId is only allowed for the authenticated user (own reviews).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const tourId = searchParams.get('tourId');
    const requestedUserId = searchParams.get('userId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    // If client asks for a specific user's reviews, require auth and only allow own id
    let filterUserId: string | null = null;
    if (requestedUserId) {
      const user = await getAuthUser(req);
      if (!user || user.id !== requestedUserId) {
        return NextResponse.json(
          { error: 'Authentication required to filter by user' },
          { status: 401 }
        );
      }
      filterUserId = requestedUserId;
    }

    let query = supabase
      .from('reviews')
      .select(`
        *,
        tours (
          id,
          title
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Public / tour pages: only moderated-visible reviews. Own list: include hidden/moderated rows.
    if (!filterUserId) {
      query = query.eq('is_visible', true);
    }

    if (tourId) {
      query = query.eq('tour_id', tourId);
    }

    if (filterUserId) {
      query = query.eq('user_id', filterUserId);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews', details: error.message },
        { status: 500 }
      );
    }

    const list = reviews || [];
    const userIds = [...new Set(list.map((r: any) => r.user_id).filter(Boolean))] as string[];
    let profilesMap: Record<string, { id: string; full_name: string | null; avatar_url: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
      }
    }

    const sanitized = list.map((r: any) => {
      const userProfile = r.user_id ? profilesMap[r.user_id] : null;
      const attach = {
        user_profiles: r.is_anonymous
          ? { id: null, full_name: 'Anonymous', avatar_url: null }
          : (userProfile || { id: r.user_id, full_name: null, avatar_url: null }),
      };
      return { ...r, ...attach };
    });

    return NextResponse.json({ reviews: sanitized });
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

    const { tourId, bookingId, rating, title, comment, images, is_anonymous } = body;

    // Validate required fields
    if (!bookingId || !rating) {
      return NextResponse.json(
        { error: 'bookingId and rating are required' },
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

    // Fetch booking and ensure it belongs to user and is completed
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, status, tour_id')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed bookings can be reviewed' },
        { status: 400 }
      );
    }

    const finalTourId = booking.tour_id;

    // Check if this booking already has a review
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .single();

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this booking' },
        { status: 409 }
      );
    }

    // Create review
    const reviewData: any = {
      user_id: userId,
      tour_id: finalTourId,
      booking_id: bookingId,
      rating,
      comment: comment || null,
      title: title || null,
      images: Array.isArray(images) ? images : [],
      is_anonymous: !!is_anonymous,
      is_verified: true,
      is_visible: true,
    };

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













