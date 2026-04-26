import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/bookings/[id]/receipt
 * Returns a print-friendly HTML booking receipt/voucher. Owner-only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params;
    const supabase = createServerClient();

    const authHeader = req.headers.get('authorization');
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token');
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

    if (!rawToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(rawToken);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        tours ( id, slug, title, city, image_url, price, price_type ),
        pickup_points ( name, address, pickup_time )
      `)
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const tour = (booking as any).tours || {};
    const pickup = (booking as any).pickup_points || null;
    const tourDate = booking.tour_date || booking.booking_date || '';
    const formatted = tourDate ? new Date(tourDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const final = Number(booking.final_price ?? 0).toFixed(2);
    const guests = booking.number_of_guests || 1;
    const status = String(booking.status || '').toUpperCase();

    const escape = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Booking Receipt · ${escape(bookingId)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #f8fafc; }
  .page { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 24px; padding: 40px; box-shadow: 0 12px 40px -18px rgba(15,23,42,0.14); }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  h1 { font-size: 22px; margin: 0; letter-spacing: -0.02em; }
  .muted { color: #64748b; font-size: 13px; }
  .section { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .label { color: #475569; }
  .value { font-weight: 600; color: #0f172a; }
  .total { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 17px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; background: #dcfce7; color: #166534; }
  footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; background: #fff; } .page { box-shadow: none; border-radius: 0; } .no-print { display: none; } }
  .no-print-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; background: #0f172a; color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; }
</style>
</head>
<body>
  <div class="page">
    <header>
      <div>
        <h1>${escape(tour.title || 'Booking')}</h1>
        <p class="muted">Booking #${escape(bookingId)}</p>
      </div>
      <span class="badge">${escape(status)}</span>
    </header>
    <div class="section">
      <div class="row"><span class="label">Tour date</span><span class="value">${escape(formatted)}</span></div>
      <div class="row"><span class="label">Guests</span><span class="value">${escape(guests)}</span></div>
      ${tour.city ? `<div class="row"><span class="label">City</span><span class="value">${escape(tour.city)}</span></div>` : ''}
      ${pickup?.name ? `<div class="row"><span class="label">Pickup</span><span class="value">${escape(pickup.name)}</span></div>` : ''}
      ${pickup?.pickup_time ? `<div class="row"><span class="label">Pickup time</span><span class="value">${escape(pickup.pickup_time)}</span></div>` : ''}
    </div>
    <div class="section">
      <div class="row"><span class="label">Payment status</span><span class="value">${escape(booking.payment_status || '—')}</span></div>
      <div class="row"><span class="label">Payment method</span><span class="value">${escape(booking.payment_method || '—')}</span></div>
      <div class="row total"><span class="label">Total paid</span><span class="value">$${escape(final)}</span></div>
    </div>
    <div class="no-print" style="margin-top:28px; text-align:right;">
      <a href="#" class="no-print-btn" onclick="window.print();return false;">Print / Save PDF</a>
    </div>
    <footer>This is a self-service receipt generated from your account. For official tax invoices please contact support.</footer>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('receipt error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
