import { NextRequest, NextResponse } from 'next/server';

// Bookings API route (placeholder - to be implemented)
export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Bookings API - to be implemented', bookings: [] });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ message: 'Bookings API - to be implemented' }, { status: 501 });
}

