// app/api/paypal/callback/route.ts
// Handle PayPal callback after payment approval/cancellation
import { NextRequest, NextResponse } from "next/server";

/** Allow only safe bookingId for redirect path (UUID or numeric) to avoid path traversal. */
function isValidBookingId(value: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  if (/^\d+$/.test(value)) return value.length <= 20;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const rawBookingId = searchParams.get('bookingId');
  const bookingId = isValidBookingId(rawBookingId) ? rawBookingId : null;
  const token = searchParams.get('token'); // PayPal order ID

  if (canceled === 'true') {
    return NextResponse.redirect(
      new URL(bookingId ? `/tour?booking=canceled&id=${bookingId}` : '/?payment=canceled', req.nextUrl.origin)
    );
  }

  if (success === 'true' && token) {
    const path = bookingId
      ? `/tour/${bookingId}/confirmation?payment=processing&orderId=${encodeURIComponent(token)}`
      : `/?payment=processing&orderId=${encodeURIComponent(token)}`;
    return NextResponse.redirect(new URL(path, req.nextUrl.origin));
  }

  return NextResponse.redirect(new URL('/', req.nextUrl.origin));
}













