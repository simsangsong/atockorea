import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export type ProposedTourHotelLocation = 'jeju_city' | 'jeju_outside' | 'seogwipo_city' | 'seogwipo_outside';

export interface ProposedTourItem {
  id: string;
  title: string;
  summary: string | null;
  schedule: Array<{
    day: number;
    places: Array<{ name: string; address: string; image_url?: string | null; overview?: string | null }>;
  }>;
  participants: number;
  vehicle_type: 'van' | 'large_van';
  total_price_krw: number;
  hotel_location?: ProposedTourHotelLocation | null;
  /** 발의자 호텔 주소 (카드 표시·참가 10km 체크용) */
  hotel_address?: string | null;
  hotel_lat?: number | null;
  hotel_lng?: number | null;
  status: string;
  created_at: string;
}

function rowToItem(row: Record<string, unknown>): ProposedTourItem {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    summary: row.summary != null ? String(row.summary) : null,
    schedule: Array.isArray(row.schedule) ? row.schedule as ProposedTourItem['schedule'] : [],
    participants: Number(row.participants ?? 0),
    vehicle_type: (row.vehicle_type as 'van' | 'large_van') || 'van',
    total_price_krw: Number(row.total_price_krw ?? 0),
    hotel_location: ['jeju_city', 'jeju_outside', 'seogwipo_city', 'seogwipo_outside'].includes(String(row.hotel_location ?? ''))
      ? (row.hotel_location as ProposedTourHotelLocation)
      : null,
    hotel_address: row.hotel_address != null ? String(row.hotel_address) : null,
    hotel_lat: typeof row.hotel_lat === 'number' ? row.hotel_lat : null,
    hotel_lng: typeof row.hotel_lng === 'number' ? row.hotel_lng : null,
    status: String(row.status ?? 'open'),
    created_at: String(row.created_at ?? ''),
  };
}

/** GET: 목록 (실시간 갱신용). ?id=xxx 이면 해당 투어 1건만 반환 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const { data, error } = await supabase
        .from('proposed_tours')
        .select('id, title, summary, schedule, participants, vehicle_type, total_price_krw, hotel_location, hotel_address, hotel_lat, hotel_lng, status, created_at')
        .eq('id', id)
        .eq('status', 'open')
        .single();
      if (error || !data) {
        return NextResponse.json({ proposedTour: null }, { status: 404 });
      }
      return NextResponse.json({ proposedTour: rowToItem(data as Record<string, unknown>) });
    }
    const { data, error } = await supabase
      .from('proposed_tours')
      .select('id, title, summary, schedule, participants, vehicle_type, total_price_krw, hotel_location, hotel_address, hotel_lat, hotel_lng, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === '42P01' || error.message?.includes("schema cache") || error.message?.includes("proposed_tours")) {
        return NextResponse.json({ proposedTours: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const proposedTours: ProposedTourItem[] = (data || []).map((row: Record<string, unknown>) => rowToItem(row));

    return NextResponse.json({ proposedTours });
  } catch {
    return NextResponse.json({ proposedTours: [] });
  }
}

/** POST: 발의 투어 등록 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : null;
    const schedule = Array.isArray(body.schedule) ? body.schedule : [];
    const participants = Number(body.participants) || 0;
    const vehicle_type = body.vehicle_type === 'large_van' ? 'large_van' : 'van';
    const total_price_krw = Number(body.total_price_krw) || 0;
    const hotel_location = ['jeju_city', 'jeju_outside', 'seogwipo_city', 'seogwipo_outside'].includes(String(body.hotel_location ?? ''))
      ? body.hotel_location
      : null;
    const hotel_address = typeof body.hotel_address === 'string' ? body.hotel_address.trim() || null : null;
    const hotel_lat = typeof body.hotel_lat === 'number' && Number.isFinite(body.hotel_lat) ? body.hotel_lat : null;
    const hotel_lng = typeof body.hotel_lng === 'number' && Number.isFinite(body.hotel_lng) ? body.hotel_lng : null;

    if (!title || participants < 1 || participants > 13 || total_price_krw <= 0) {
      return NextResponse.json(
        { error: 'title, participants (1-13), and total_price_krw are required.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('proposed_tours')
      .insert({
        title,
        summary: summary || null,
        schedule,
        participants,
        vehicle_type,
        total_price_krw,
        hotel_location: hotel_location ?? null,
        hotel_address: hotel_address ?? null,
        hotel_lat: hotel_lat ?? null,
        hotel_lng: hotel_lng ?? null,
        status: 'open',
      })
      .select('id, title, created_at')
      .single();

    if (error) {
      console.error('[proposed POST]', error);
      const msg = error.code === '42P01' ? 'proposed_tours table not found. Run migration: supabase/migrations/add_proposed_tours.sql' : error.message;
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: data?.id });
  } catch (e) {
    console.error('[proposed POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create proposed tour.' },
      { status: 500 }
    );
  }
}
