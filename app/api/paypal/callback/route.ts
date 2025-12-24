// app/api/paypal/callback/route.ts
// Handle PayPal callback after payment approval/cancellation
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const bookingId = searchParams.get('bookingId');
  const token = searchParams.get('token'); // PayPal order ID

  if (canceled === 'true') {
    // User canceled the payment
    return NextResponse.redirect(
      new URL(`/tour/${bookingId ? `?booking=canceled&id=${bookingId}` : '?payment=canceled'}`, req.nextUrl.origin)
    );
  }

  if (success === 'true' && token) {
    // User approved the payment, redirect to confirmation page
    // The frontend should handle capturing the order
    return NextResponse.redirect(
      new URL(`/tour/${bookingId}/confirmation?payment=processing&orderId=${token}`, req.nextUrl.origin)
    );
  }

  // Default redirect
  return NextResponse.redirect(new URL('/', req.nextUrl.origin));
}





