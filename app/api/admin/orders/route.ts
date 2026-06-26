import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import {
  isBulkOrderStatus,
  parseBulkOrderIds,
  partitionBulkTransitions,
} from '@/lib/admin/orders-bulk';

export const dynamic = 'force-dynamic';

const MAX_ORDERS = 50000;

/**
 * GET /api/admin/orders
 * List all orders (bookings). No time limit; optional sort and filter.
 * Query: status (optional), limit (optional, default all up to MAX_ORDERS), orderBy=created_at|tour_date|booking_date, order=asc|desc
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || MAX_ORDERS, MAX_ORDERS) : MAX_ORDERS;
    const orderByParam = searchParams.get('orderBy') || '';
    const orderBy = (['created_at', 'tour_date', 'booking_date'] as const).includes(orderByParam as any)
      ? (orderByParam as 'created_at' | 'tour_date' | 'booking_date')
      : 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    /** Phase 10.6 — accept source filter chip ('tour_product' / 'itinerary_builder'). */
    const source = searchParams.get('source') || '';

    let query = supabase
      .from('bookings')
      .select('*')
      .order(orderBy, { ascending: order === 'asc' })
      .range(0, limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (source) {
      query = query.eq('source', source);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error('Error fetching admin orders (bookings):', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: error.message, code: (error as any).code },
        { status: 500 }
      );
    }

    const bookings = rows || [];
    if (bookings.length === 0) {
      return NextResponse.json({ orders: [], count: 0 });
    }

    const tourIds = [...new Set(bookings.map((b: any) => b.tour_id).filter(Boolean))];
    const userIds = [...new Set(bookings.map((b: any) => b.user_id).filter(Boolean))];
    const pickupIds = [...new Set(bookings.map((b: any) => b.pickup_point_id).filter(Boolean))];

    let tourMap = new Map<string, { id: string; title: string }>();
    let profileMap = new Map<string, { id: string; full_name: string; email: string }>();
    let pickupMap = new Map<string, { id: string; name: string; address: string }>();

    try {
      const [toursRes, profilesRes, pickupsRes] = await Promise.all([
        tourIds.length
          ? supabase.from('tours').select('id, title').in('id', tourIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from('user_profiles').select('id, full_name').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        pickupIds.length
          ? supabase.from('pickup_points').select('id, name, address').in('id', pickupIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      (toursRes.data || []).forEach((t: any) => tourMap.set(t.id, { id: t.id, title: t.title || '' }));
      (profilesRes.data || []).forEach((p: any) =>
        profileMap.set(p.id, { id: p.id, full_name: p.full_name || '', email: (p as any).email || '' })
      );
      (pickupsRes.data || []).forEach((p: any) =>
        pickupMap.set(p.id, { id: p.id, name: p.name || '', address: p.address || '' })
      );
    } catch (e) {
      console.warn('Admin orders: optional relations fetch failed', e);
      // Keep empty maps so orders still return with null for relations
    }

    const orders = bookings.map((b: any) => ({
      id: b.id,
      created_at: b.created_at,
      booking_date: b.booking_date,
      tour_date: b.tour_date,
      number_of_guests: b.number_of_guests ?? b.number_of_people ?? 1,
      number_of_people: b.number_of_people ?? b.number_of_guests ?? 1,
      final_price: b.final_price,
      /** Phase 10.6 — currency + source + booking_reference + itinerary
       *  carried through so the admin list can render KRW/USD correctly,
       *  badge builder rows, and link to the bookings page. */
      currency: b.currency ?? 'usd',
      source: b.source ?? 'tour_product',
      booking_reference: b.booking_reference ?? null,
      itinerary: b.itinerary ?? null,
      status: b.status,
      payment_status: b.payment_status,
      payment_intent_status: b.payment_intent_status ?? null,
      pickup_point_id: b.pickup_point_id,
      contact_name: b.contact_name ?? null,
      contact_email: b.contact_email ?? null,
      contact_phone: b.contact_phone ?? null,
      tours: b.tour_id ? tourMap.get(b.tour_id) ?? null : null,
      user_profiles: b.user_id ? profileMap.get(b.user_id) ?? null : null,
      pickup_points: b.pickup_point_id ? pickupMap.get(b.pickup_point_id) ?? null : null,
    }));

    return NextResponse.json({ orders, count: orders.length });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/orders error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/orders — bulk status change (U-7). Body: { ids:string[], status }.
 * Restricted to the two side-effect-free targets (confirmed / completed) — cancel
 * (customer email + inventory) and no_show (settlement) are excluded. Each id is
 * gated by the B-3 state machine; illegal transitions are skipped, not written.
 * confirmed/completed have no money or outward side effects, so a single update
 * query is correct.
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const body = await req.json().catch(() => null);

    const status = body?.status;
    if (typeof status !== 'string' || !isBulkOrderStatus(status)) {
      return NextResponse.json(
        { error: "Bulk status must be 'confirmed' or 'completed'." },
        { status: 400 }
      );
    }

    const { ids, error: idError } = parseBulkOrderIds(body?.ids);
    if (idError) return NextResponse.json({ error: idError }, { status: 400 });

    const { data: rows, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status')
      .in('id', ids);
    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to load orders', details: fetchError.message },
        { status: 500 }
      );
    }

    const { valid, skipped } = partitionBulkTransitions(
      (rows ?? []) as { id: string; status: string }[],
      status
    );

    if (valid.length > 0) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status })
        .in('id', valid);
      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update orders', details: updateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ updated: valid.length, skipped: skipped.length });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('PATCH /api/admin/orders error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
