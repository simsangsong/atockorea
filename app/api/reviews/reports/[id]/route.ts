import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

/**
 * PATCH /api/reviews/reports/[id]
 * 更新举报状态（仅管理员）
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: reportId } = await params;

    const body = await req.json();
    const { status, handlingNotes } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'reviewing', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'resolved' || status === 'dismissed') {
      updateData.handled_by = admin.id;
      updateData.handled_at = new Date().toISOString();
      if (handlingNotes) {
        updateData.handling_notes = handlingNotes;
      }
    }

    const { data: report, error } = await supabase
      .from('review_reports')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // 如果状态是 resolved 且原因是严重违规，可以隐藏评价
    if (status === 'resolved' && report.reason === 'inappropriate') {
      // 可选：自动隐藏被举报的评价
      // await supabase
      //   .from('reviews')
      //   .update({ is_visible: false })
      //   .eq('id', report.review_id);
    }

    return NextResponse.json({ report });
  } catch (error: any) {
    console.error('Error updating report:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

