import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

/**
 * POST /api/admin/tours/[id]/bus-detail
 * Set bus detail for a tour date (sent to guests the day before).
 * Body: { tour_date: "YYYY-MM-DD", payload: { bus_number?, driver_phone?, departure_time?, ... } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const adminUser = await requireAdmin(req);
    const resolvedParams = params instanceof Promise ? await params : params;
    const tourId = resolvedParams.id;
    const supabase = createServerClient();
    const body = await req.json();

    const tourDate = body.tour_date; // YYYY-MM-DD
    const payload = body.payload ?? {};

    if (!tourDate || typeof tourDate !== 'string') {
      return NextResponse.json(
        { error: 'tour_date is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const { data: tour } = await supabase
      .from('tours')
      .select('id')
      .eq('id', tourId)
      .single();

    if (!tour) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
    }

    const { data: busDetail, error } = await supabase
      .from('tour_bus_details')
      .upsert(
        {
          tour_id: tourId,
          tour_date: tourDate,
          payload,
          sent_at: new Date().toISOString(),
          created_by: adminUser.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tour_id,tour_date' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save bus detail', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: busDetail,
      message: 'Bus detail saved. Guests with bookings for this date will see it in Tour Mode.',
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

/**
 * GET /api/admin/tours/[id]/bus-detail?tour_date=YYYY-MM-DD
 * Get bus detail for a tour date.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await requireAdmin(req);
    const resolvedParams = params instanceof Promise ? await params : params;
    const tourId = resolvedParams.id;
    const { searchParams } = new URL(req.url);
    const tourDate = searchParams.get('tour_date');

    if (!tourDate) {
      return NextResponse.json(
        { error: 'tour_date query param required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('tour_bus_details')
      .select('*')
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch bus detail', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
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
