import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/reviews/[id]
 * Get a single review by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;
    const supabase = createServerClient();

    const { data: review, error } = await supabase
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
      .eq('id', reviewId)
      .eq('is_visible', true)
      .single();

    if (error || !review) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Review not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch review', details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reviews/[id]
 * Update a review
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    // Editing reviews has been disabled for end-users
    return NextResponse.json(
      { error: 'Editing reviews is not allowed' },
      { status: 403 }
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
 * DELETE /api/reviews/[id]
 * Delete a review
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    // Deleting reviews has been disabled for end-users
    return NextResponse.json(
      { error: 'Deleting reviews is not allowed' },
      { status: 403 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}













