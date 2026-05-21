import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import {
  isReviewWriteWindowOpenForViewer,
  normalizeBookingTourDateYmd,
} from '@/lib/review-write-window';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();

    const [profileRes, bookingsRes, reviewsRes, wishlistRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('full_name, phone, birth_year, nationality, language_preference, avatar_url')
        .eq('id', user.id)
        .single(),
      supabase
        .from('bookings')
        .select(`
          id,
          tour_id,
          tour_date,
          booking_date,
          created_at,
          status,
          number_of_guests,
          tours (
            id,
            slug,
            title,
            city,
            image_url
          ),
          pickup_points (
            name,
            pickup_time
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('id, booking_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('wishlist')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id),
    ]);

    if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;
    if (bookingsRes.error) throw bookingsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (wishlistRes.error) throw wishlistRes.error;

    const profile = profileRes.data ?? null;
    const bookingsData = bookingsRes.data ?? [];
    const reviews = reviewsRes.data ?? [];
    const reviewedBookingIds = new Set(
      reviews.map((r: { booking_id?: string | null }) => r.booking_id).filter(Boolean),
    );

    const now = new Date();
    const upcomingList = bookingsData
      .filter((b: any) => {
        const tourDate = new Date(b.tour_date || b.booking_date || b.created_at);
        return (b.status === 'confirmed' || b.status === 'pending') && tourDate >= now;
      })
      .sort((a: any, b: any) => {
        const da = new Date(a.tour_date || a.booking_date).getTime();
        const db = new Date(b.tour_date || b.booking_date).getTime();
        return da - db;
      });

    const completedOrCancelled = bookingsData.filter(
      (b: any) => b.status === 'completed' || b.status === 'cancelled',
    );

    const first = upcomingList[0] as any | undefined;
    const nextTrip = first
      ? {
          bookingId: first.id,
          tourId: first.tour_id,
          slug: first.tours?.slug ?? null,
          title: first.tours?.title || 'Tour',
          tourDate: first.tour_date || first.booking_date,
          status: first.status,
          guests: first.number_of_guests ?? null,
          imageUrl: first.tours?.image_url ?? null,
          city: first.tours?.city ?? null,
          pickupName: first.pickup_points?.name ?? null,
          pickupTime: first.pickup_points?.pickup_time ?? null,
        }
      : null;

    const pendingReviews = bookingsData
      .filter((b: any) => {
        if (b.status !== 'completed') return false;
        if (reviewedBookingIds.has(b.id)) return false;
        const ymd = normalizeBookingTourDateYmd(b.tour_date || null);
        return ymd ? isReviewWriteWindowOpenForViewer(ymd, user.email ?? null) : false;
      })
      .slice(0, 5)
      .map((b: any) => ({
        bookingId: b.id,
        tourId: b.tour_id,
        slug: b.tours?.slug ?? null,
        title: b.tours?.title || 'Tour',
        tourDate: b.tour_date || b.booking_date,
      }));

    const recentActivity = bookingsData.slice(0, 5).map((b: any) => ({
      action:
        b.status === 'completed'
          ? 'completed'
          : b.status === 'cancelled'
            ? 'cancelled'
            : 'booked',
      tour: b.tours?.title || 'Tour',
      createdAt: b.created_at,
      tourId: b.tour_id,
      slug: b.tours?.slug ?? null,
    }));

    return NextResponse.json(
      {
        profile,
        userName: profile?.full_name?.trim()
          ? profile.full_name.trim().split(/\s+/)[0]
          : user.email?.split('@')[0] ?? 'User',
        counts: {
          bookings: bookingsData.length,
          upcoming: upcomingList.length,
          history: completedOrCancelled.length,
          reviews: reviews.length,
          wishlist: wishlistRes.count ?? wishlistRes.data?.length ?? 0,
        },
        nextTrip,
        pendingReviews,
        recentActivity,
        wishlistTotal: wishlistRes.count ?? wishlistRes.data?.length ?? 0,
        wishlistItems: [],
        recommendations: [],
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[api/mypage/summary] failed', error);
    return NextResponse.json({ error: 'Failed to load mypage summary' }, { status: 500 });
  }
}
