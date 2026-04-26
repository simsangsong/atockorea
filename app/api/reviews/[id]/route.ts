import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

async function getAuthedUserId(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

/**
 * GET /api/reviews/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
          slug,
          title
        )
      `)
      .eq('id', reviewId)
      .single();

    if (error || !review) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch review', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/reviews/[id] — owner only, edits rating/title/comment/images.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reviewId } = await params;
    const userId = await getAuthedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: existing, error: fetchError } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.rating !== undefined) {
      const rating = Number(body.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
      }
      updates.rating = rating;
    }
    if (body.title !== undefined) {
      updates.title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
    }
    if (body.comment !== undefined) {
      updates.comment = typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : null;
    }
    if (body.images !== undefined) {
      updates.images = Array.isArray(body.images) ? body.images : [];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: 'Nothing to update' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', reviewId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Review update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update review', details: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/reviews/[id] — owner only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reviewId } = await params;
    const userId = await getAuthedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: existing, error: fetchError } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Review delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete review', details: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    );
  }
}
