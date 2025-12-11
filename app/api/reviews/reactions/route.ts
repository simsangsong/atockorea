import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/reviews/reactions
 * 创建或更新评价反应（点赞/不推荐）
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const userId = user.id;

    const body = await req.json();
    const { reviewId, reactionType } = body;

    if (!reviewId || !reactionType) {
      return NextResponse.json(
        { error: 'Review ID and reaction type are required' },
        { status: 400 }
      );
    }

    if (!['like', 'dislike'].includes(reactionType)) {
      return NextResponse.json(
        { error: 'Invalid reaction type. Must be "like" or "dislike"' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 检查是否已有反应
    const { data: existingReaction } = await supabase
      .from('review_reactions')
      .select('id, reaction_type')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .single();

    if (existingReaction) {
      // 如果点击相同的反应，则删除（取消反应）
      if (existingReaction.reaction_type === reactionType) {
        const { error: deleteError } = await supabase
          .from('review_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (deleteError) {
          throw deleteError;
        }

        return NextResponse.json({ 
          action: 'removed',
          reactionType: null 
        });
      } else {
        // 如果点击不同的反应，则更新
        const { error: updateError } = await supabase
          .from('review_reactions')
          .update({ 
            reaction_type: reactionType,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingReaction.id);

        if (updateError) {
          throw updateError;
        }

        return NextResponse.json({ 
          action: 'updated',
          reactionType 
        });
      }
    } else {
      // 创建新反应
      const { data: reaction, error: insertError } = await supabase
        .from('review_reactions')
        .insert({
          review_id: reviewId,
          user_id: userId,
          reaction_type: reactionType,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({ 
        action: 'created',
        reactionType 
      });
    }
  } catch (error: any) {
    console.error('Error in reactions API:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews/reactions?reviewId=xxx&userId=xxx
 * 获取评价反应（可选：获取特定用户的反应）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get('reviewId');
    const userId = searchParams.get('userId');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 获取所有反应统计
    const { data: reactions } = await supabase
      .from('review_reactions')
      .select('reaction_type, user_id')
      .eq('review_id', reviewId);

    const likeCount = reactions?.filter(r => r.reaction_type === 'like').length || 0;
    const dislikeCount = reactions?.filter(r => r.reaction_type === 'dislike').length || 0;

    // 如果提供了 userId，获取该用户的反应
    let userReaction: 'like' | 'dislike' | null = null;
    if (userId) {
      const userReactionData = reactions?.find(r => r.user_id === userId);
      if (userReactionData) {
        userReaction = userReactionData.reaction_type as 'like' | 'dislike';
      }
    }

    return NextResponse.json({
      likeCount,
      dislikeCount,
      userReaction,
    });
  } catch (error: any) {
    console.error('Error fetching reactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

