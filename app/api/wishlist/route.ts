import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/wishlist
 * Get user's wishlist
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
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

    // Fallback: get from query params
    if (!userId) {
      const { searchParams } = new URL(req.url);
      userId = searchParams.get('userId');
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required or userId parameter required' },
        { status: 401 }
      );
    }

    const { data: wishlist, error } = await supabase
      .from('wishlist')
      .select(`
        *,
        tours (
          id,
          title,
          city,
          price,
          original_price,
          price_type,
          image_url,
          images,
          rating,
          review_count,
          duration
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wishlist:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wishlist', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ wishlist: wishlist || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wishlist
 * Add tour to wishlist
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { tourId } = body;

    if (!tourId) {
      return NextResponse.json(
        { error: 'tourId is required' },
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

    // Check if tour exists
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id')
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

    if (tourError || !tour) {
      return NextResponse.json(
        { error: 'Tour not found' },
        { status: 404 }
      );
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', userId)
      .eq('tour_id', tourId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Tour is already in wishlist', wishlistItem: existing },
        { status: 409 }
      );
    }

    // Add to wishlist
    const { data: wishlistItem, error } = await supabase
      .from('wishlist')
      .insert({
        user_id: userId,
        tour_id: tourId,
      })
      .select(`
        *,
        tours (
          id,
          title,
          city,
          price,
          original_price,
          price_type,
          image_url,
          images,
          rating,
          review_count,
          duration
        )
      `)
      .single();

    if (error) {
      console.error('Error adding to wishlist:', error);
      return NextResponse.json(
        { error: 'Failed to add to wishlist', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { wishlistItem, message: 'Added to wishlist successfully' },
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

/**
 * DELETE /api/wishlist
 * Remove tour from wishlist
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const tourId = searchParams.get('tourId');

    if (!tourId) {
      return NextResponse.json(
        { error: 'tourId is required' },
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

    // Remove from wishlist
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('tour_id', tourId);

    if (error) {
      console.error('Error removing from wishlist:', error);
      return NextResponse.json(
        { error: 'Failed to remove from wishlist', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Removed from wishlist successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}










