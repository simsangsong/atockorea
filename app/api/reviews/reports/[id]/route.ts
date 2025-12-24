import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * PUT /api/reviews/reports/[id]
 * Update report status (admin only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const reportId = params.id;
    const body = await req.json();

    const { status, adminNotes } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, reviewed, resolved, or dismissed' },
        { status: 400 }
      );
    }

    // Get user from auth and check if admin
    const authHeader = req.headers.get('authorization');
    let isAdmin = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin';
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const updateData: any = { status };
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;

    const { data: report, error } = await supabase
      .from('review_reports')
      .update(updateData)
      .eq('id', reportId)
      .select(`
        *,
        reviews (
          id,
          rating,
          comment
        )
      `)
      .single();

    if (error) {
      console.error('Error updating report:', error);
      return NextResponse.json(
        { error: 'Failed to update report', details: error.message },
        { status: 500 }
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ report, message: 'Report updated successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}





