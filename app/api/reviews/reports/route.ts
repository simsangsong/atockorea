import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/reviews/reports
 * Report a review
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { reviewId, reason, description } = body;

    if (!reviewId || !reason) {
      return NextResponse.json(
        { error: 'reviewId and reason are required' },
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

    // Check if user already reported this review
    const { data: existing } = await supabase
      .from('review_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('review_id', reviewId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already reported this review' },
        { status: 409 }
      );
    }

    // Create report
    const { data: report, error } = await supabase
      .from('review_reports')
      .insert({
        user_id: userId,
        review_id: reviewId,
        reason,
        description: description || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      return NextResponse.json(
        { error: 'Failed to create report', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { report, message: 'Review reported successfully' },
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
 * GET /api/reviews/reports
 * Get review reports (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const reviewId = searchParams.get('reviewId');

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

    let query = supabase
      .from('review_reports')
      .select(`
        *,
        reviews (
          id,
          rating,
          comment
        ),
        user_profiles!review_reports_user_id_fkey (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (reviewId) {
      query = query.eq('review_id', reviewId);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('Error fetching reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}








