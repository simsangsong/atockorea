import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/auth';

/**
 * POST /api/reviews/reports
 * 创建评价举报
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const userId = user.id;

    const body = await req.json();
    const { reviewId, reason, description } = body;

    if (!reviewId || !reason) {
      return NextResponse.json(
        { error: 'Review ID and reason are required' },
        { status: 400 }
      );
    }

    const validReasons = ['spam', 'inappropriate', 'fake', 'harassment', 'other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid reason' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 检查是否已经举报过
    const { data: existingReport } = await supabase
      .from('review_reports')
      .select('id')
      .eq('review_id', reviewId)
      .eq('reporter_id', userId)
      .single();

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this review' },
        { status: 400 }
      );
    }

    // 创建举报
    const { data: report, error: insertError } = await supabase
      .from('review_reports')
      .insert({
        review_id: reviewId,
        reporter_id: userId,
        reason,
        description: description || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating report:', error);
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
 * GET /api/reviews/reports
 * 获取举报列表（仅管理员）
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    let query = supabase
      .from('review_reports')
      .select(`
        *,
        review:review_id (
          id,
          rating,
          title,
          comment,
          is_visible,
          user_profiles:user_id (
            id,
            full_name
          ),
          tours:tour_id (
            id,
            title
          )
        ),
        reporter:reporter_id (
          id,
          full_name,
          email
        ),
        handler:handled_by (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: reports, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // 获取统计信息
    const { data: summary } = await supabase
      .from('review_reports_summary')
      .select('*')
      .single();

    return NextResponse.json({
      reports: reports || [],
      summary: summary || {},
      pagination: {
        page,
        limit,
        hasMore: (reports?.length || 0) === limit,
      },
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


