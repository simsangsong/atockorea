import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export interface ProposedTourItem {
  id: string;
  title: string;
  summary: string | null;
  schedule: Array<{ day: number; places: Array<{ name: string; address: string }> }>;
  participants: number;
  vehicle_type: 'van' | 'large_van';
  total_price_krw: number;
  status: string;
  created_at: string;
}

/** GET: 목록 (실시간 갱신용) */
export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('proposed_tours')
      .select('id, title, summary, schedule, participants, vehicle_type, total_price_krw, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ proposedTours: [] });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const proposedTours: ProposedTourItem[] = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      title: String(row.title ?? ''),
      summary: row.summary != null ? String(row.summary) : null,
      schedule: Array.isArray(row.schedule) ? row.schedule as ProposedTourItem['schedule'] : [],
      participants: Number(row.participants ?? 0),
      vehicle_type: (row.vehicle_type as 'van' | 'large_van') || 'van',
      total_price_krw: Number(row.total_price_krw ?? 0),
      status: String(row.status ?? 'open'),
      created_at: String(row.created_at ?? ''),
    }));

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

    if (!title || participants < 3 || participants > 13 || total_price_krw <= 0) {
      return NextResponse.json(
        { error: 'title, participants (3-13), and total_price_krw are required.' },
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
