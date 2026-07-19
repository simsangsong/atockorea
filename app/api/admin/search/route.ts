import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Small result cap per group — the ⌘K palette shows a handful, not a full list. */
const LIMIT = 6;

/**
 * Strip characters that carry meaning in PostgREST's `.or()` filter grammar
 * (`,` separates conditions, `()` group, `*`/`%` are wildcards, `\` escapes) so
 * an admin typing them can neither break the query nor inject extra filter
 * terms. The raw value is also length-capped to keep the ilike bounded.
 */
function sanitize(raw: string): string {
  return raw.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * GET /api/admin/search?q=<query>
 * Lightweight cross-entity lookup for the admin ⌘K palette (W4.4 / spec §3.1).
 * Matches orders (bookings) by reference / contact name / email / phone and
 * merchants by company name / contact email / contact person. Read-only; returns
 * up to {@link LIMIT} of each with just the fields the palette renders + links.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { searchParams } = new URL(req.url);
    const q = sanitize(searchParams.get('q') || '');

    // Need at least a little signal before a round-trip; the client debounces too.
    if (q.length < 2) {
      return NextResponse.json({ orders: [], merchants: [] });
    }

    const [ordersRes, merchantsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_reference, contact_name, contact_email, tour_date, status')
        .or(
          `booking_reference.ilike.%${q}%,contact_name.ilike.%${q}%,contact_email.ilike.%${q}%,contact_phone.ilike.%${q}%`,
        )
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase
        .from('merchants')
        .select('id, company_name, contact_person, status')
        .is('deleted_at', null) // U-6: keep soft-deleted merchants out of results
        .or(
          `company_name.ilike.%${q}%,contact_email.ilike.%${q}%,contact_person.ilike.%${q}%`,
        )
        .order('created_at', { ascending: false })
        .limit(LIMIT),
    ]);

    if (ordersRes.error) console.error('admin/search bookings:', ordersRes.error);
    if (merchantsRes.error) console.error('admin/search merchants:', merchantsRes.error);

    return NextResponse.json({
      orders: (ordersRes.data ?? []).map((o) => ({
        id: o.id,
        booking_reference: o.booking_reference ?? null,
        contact_name: o.contact_name ?? null,
        tour_date: o.tour_date ?? null,
        status: o.status ?? null,
      })),
      merchants: (merchantsRes.data ?? []).map((m) => ({
        id: m.id,
        company_name: m.company_name ?? null,
        contact_person: m.contact_person ?? null,
        status: m.status ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(err);
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/search error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 },
    );
  }
}
