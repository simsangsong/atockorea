import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import {
  isReviewWriteWindowOpenForViewer,
  normalizeBookingTourDateYmd,
} from '@/lib/review-write-window';

const BOOKING_SUMMARY_SELECT = `
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
`;

type BookingSummaryRow = {
  id: string;
  tour_id: string;
  tour_date: string | null;
  booking_date: string | null;
  created_at: string;
  status: string | null;
  number_of_guests?: number | null;
  tours?: {
    id?: string | null;
    slug?: string | null;
    title?: string | null;
    city?: string | null;
    image_url?: string | null;
  } | null;
  pickup_points?: {
    name?: string | null;
    pickup_time?: string | null;
  } | null;
};

function getKstTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const todayYmd = getKstTodayYmd();

    const [
      profileRes,
      bookingsCountRes,
      upcomingCountRes,
      historyCountRes,
      upcomingRes,
      recentBookingsRes,
      completedCandidatesRes,
      reviewsRes,
      wishlistRes,
    ] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('full_name, phone, birth_year, nationality, language_preference, avatar_url')
        .eq('id', user.id)
        .single(),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .gte('tour_date', todayYmd),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['completed', 'cancelled']),
      supabase
        .from('bookings')
        .select(BOOKING_SUMMARY_SELECT)
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .gte('tour_date', todayYmd)
        .order('tour_date', { ascending: true })
        .limit(1),
      supabase
        .from('bookings')
        .select(BOOKING_SUMMARY_SELECT)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('bookings')
        .select(BOOKING_SUMMARY_SELECT)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('tour_date', { ascending: false })
        .limit(100),
      supabase
        .from('reviews')
        .select('id, booking_id', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('wishlist')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;
    if (bookingsCountRes.error) throw bookingsCountRes.error;
    if (upcomingCountRes.error) throw upcomingCountRes.error;
    if (historyCountRes.error) throw historyCountRes.error;
    if (upcomingRes.error) throw upcomingRes.error;
    if (recentBookingsRes.error) throw recentBookingsRes.error;
    if (completedCandidatesRes.error) throw completedCandidatesRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (wishlistRes.error) throw wishlistRes.error;

    const profile = profileRes.data ?? null;
    const upcomingData = (upcomingRes.data ?? []) as BookingSummaryRow[];
    const recentBookingsData = (recentBookingsRes.data ?? []) as BookingSummaryRow[];
    const completedCandidatesData = (completedCandidatesRes.data ?? []) as BookingSummaryRow[];
    const reviews = reviewsRes.data ?? [];
    const reviewedBookingIds = new Set(
      reviews.map((r: { booking_id?: string | null }) => r.booking_id).filter(Boolean),
    );

    const first = upcomingData[0];
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

    const pendingReviews = completedCandidatesData
      .filter((b) => {
        if (reviewedBookingIds.has(b.id)) return false;
        const ymd = normalizeBookingTourDateYmd(b.tour_date || null);
        return ymd ? isReviewWriteWindowOpenForViewer(ymd, user.email ?? null) : false;
      })
      .slice(0, 5)
      .map((b) => ({
        bookingId: b.id,
        tourId: b.tour_id,
        slug: b.tours?.slug ?? null,
        title: b.tours?.title || 'Tour',
        tourDate: b.tour_date || b.booking_date,
      }));

    const recentActivity = recentBookingsData.map((b) => ({
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
          bookings: bookingsCountRes.count ?? 0,
          upcoming: upcomingCountRes.count ?? 0,
          history: historyCountRes.count ?? 0,
          reviews: reviewsRes.count ?? reviews.length,
          wishlist: wishlistRes.count ?? 0,
        },
        nextTrip,
        pendingReviews,
        recentActivity,
        wishlistTotal: wishlistRes.count ?? 0,
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
