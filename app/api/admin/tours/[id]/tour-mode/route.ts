import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/admin/tours/[id]/tour-mode
 * Returns tour_guide_spots and tour_facilities for a tour (admin edit form).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await requireAdmin(req);
    const resolvedParams = params instanceof Promise ? await params : params;
    const tourId = resolvedParams.id;
    const supabase = createServerClient();

    const { data: tour } = await supabase
      .from('tours')
      .select('id')
      .eq('id', tourId)
      .single();

    if (!tour) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
    }

    const [spotsRes, facilitiesRes] = await Promise.all([
      supabase
        .from('tour_guide_spots')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tour_facilities')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true }),
    ]);

    if (spotsRes.error) throw spotsRes.error;
    if (facilitiesRes.error) throw facilitiesRes.error;

    return NextResponse.json({
      tour_guide_spots: spotsRes.data ?? [],
      tour_facilities: facilitiesRes.data ?? [],
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
