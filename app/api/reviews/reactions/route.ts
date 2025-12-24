import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/reviews/reactions
 * Add reaction to a review (like/dislike)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { reviewId, reactionType } = body; // 'like' or 'dislike'

    if (!reviewId || !reactionType) {
      return NextResponse.json(
        { error: 'reviewId and reactionType are required' },
        { status: 400 }
      );
    }

    if (reactionType !== 'like' && reactionType !== 'dislike') {
      return NextResponse.json(
        { error: 'reactionType must be "like" or "dislike"' },
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

    // Check if review exists
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Check if reaction already exists
    const { data: existing } = await supabase
      .from('review_reactions')
      .select('id, reaction_type')
      .eq('user_id', userId)
      .eq('review_id', reviewId)
      .single();

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Remove reaction if same type
        const { error } = await supabase
          .from('review_reactions')
          .delete()
          .eq('id', existing.id);

        if (error) {
          throw error;
        }

        return NextResponse.json({ message: 'Reaction removed successfully' });
      } else {
        // Update reaction type
        const { data: reaction, error } = await supabase
          .from('review_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return NextResponse.json({ reaction, message: 'Reaction updated successfully' });
      }
    }

    // Create new reaction
    const { data: reaction, error } = await supabase
      .from('review_reactions')
      .insert({
        user_id: userId,
        review_id: reviewId,
        reaction_type: reactionType,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reaction:', error);
      return NextResponse.json(
        { error: 'Failed to create reaction', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { reaction, message: 'Reaction added successfully' },
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
 * DELETE /api/reviews/reactions
 * Remove reaction from a review
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get('reviewId');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'reviewId is required' },
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

    // Delete reaction
    const { error } = await supabase
      .from('review_reactions')
      .delete()
      .eq('user_id', userId)
      .eq('review_id', reviewId);

    if (error) {
      console.error('Error deleting reaction:', error);
      return NextResponse.json(
        { error: 'Failed to delete reaction', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Reaction removed successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews/reactions
 * Get reactions for a review
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get('reviewId');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'reviewId is required' },
        { status: 400 }
      );
    }

    const { data: reactions, error } = await supabase
      .from('review_reactions')
      .select('*')
      .eq('review_id', reviewId);

    if (error) {
      console.error('Error fetching reactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reactions', details: error.message },
        { status: 500 }
      );
    }

    // Count likes and dislikes
    const likes = reactions?.filter(r => r.reaction_type === 'like').length || 0;
    const dislikes = reactions?.filter(r => r.reaction_type === 'dislike').length || 0;

    return NextResponse.json({
      reactions: reactions || [],
      counts: {
        likes,
        dislikes,
        total: reactions?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}





