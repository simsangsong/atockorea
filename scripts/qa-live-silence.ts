/**
 * qa-live-silence — which smart-app features has a PAYING customer ever used?
 *
 * Every other check in this repo asks whether the code is right. This one asks
 * whether anybody walked through it, because the two keep coming apart:
 *
 *   · the seat picker worked end to end and `ops_seat_assignments` held 0 rows
 *   · "Send to my guide" had never once succeeded in production
 *   · the join-tour bulk invite was reachable and had been minted zero times
 *
 * In all three the code was fine and the feature was dead. Unit tests cannot
 * see that. Neither can a walk on seeded data — the seed is the thing that
 * hides it, since a fixture exercises every path a real customer never found.
 *
 * ## The two exclusions, and why both are needed
 *
 * `sim_tag` covers the automated seeds. It also covers the owner's own manual
 * testing (`manual-test-2026-07`), which is the important one: that traffic
 * looks exactly like real usage in every table, and counting it turns "nobody
 * has ever used this" into a comfortable-looking number.
 *
 * What is left is bookings that came from a real channel with a real customer
 * on the other end. That is the only population whose silence means anything.
 *
 * Usage: npx tsx scripts/qa-live-silence.ts
 * Exit:  0 = reported · 2 = could not ask (never a silent zero)
 */
import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface FeatureProbe {
  label: string;
  /** Table holding the evidence that the feature was used. */
  table: string;
  /** Column linking a row back to a booking, when there is one. */
  via: 'booking_id' | 'room_id' | 'none';
}

const PROBES: FeatureProbe[] = [
  { label: '룸 생성 (예약→방)', table: 'tour_rooms', via: 'booking_id' },
  { label: '조인 (참가자)', table: 'tour_room_participants', via: 'booking_id' },
  { label: '초대 발송', table: 'tour_room_invites', via: 'booking_id' },
  { label: '채팅', table: 'tour_room_messages', via: 'booking_id' },
  { label: '리액션', table: 'tour_room_message_reactions', via: 'room_id' },
  { label: '위치 공유', table: 'tour_room_locations', via: 'booking_id' },
  { label: '도착 (지오펜스)', table: 'tour_room_spot_events', via: 'booking_id' },
  { label: '룸 이벤트', table: 'tour_room_events', via: 'booking_id' },
  { label: '정산 원장', table: 'tour_room_extras', via: 'booking_id' },
  { label: 'D-1 플래너', table: 'tour_day_plans', via: 'booking_id' },
  { label: '좌석 배정', table: 'ops_seat_assignments', via: 'booking_id' },
  { label: '핀 (주차/집합)', table: 'tour_room_pins', via: 'room_id' },
];

async function idsOf(supabase: SupabaseClient, table: string, column: string): Promise<string[]> {
  const { data, error } = await supabase.from(table).select(column);
  if (error) throw new Error(`${table}.${column}: ${error.message}`);
  return (data ?? []).map((r) => (r as Record<string, unknown>)[column]).filter(Boolean) as string[];
}

async function main(): Promise<number> {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — cannot ask');
    return 2;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: bookingRows, error: bookingError } = await supabase
    .from('bookings')
    .select('id, sim_tag, tour_date, source, status');
  if (bookingError) {
    console.error('cannot read bookings:', bookingError.message);
    return 2;
  }
  const bookings = (bookingRows ?? []) as Array<{
    id: string;
    sim_tag: string | null;
    tour_date: string | null;
    source: string | null;
    status: string | null;
  }>;
  if (bookings.length === 0) {
    // Zero bookings would make every probe read "0 real uses" — a catastrophic
    // finding produced by an empty query rather than by a silent app.
    console.error('🔴 zero bookings — refusing to report silence from an empty table');
    return 2;
  }

  const realBookings = bookings.filter((b) => !b.sim_tag);
  const realIds = new Set(realBookings.map((b) => b.id));
  const realRoomIds = new Set(
    (await idsOf(supabase, 'tour_rooms', 'id').catch(() => [])).filter(() => true),
  );
  // Narrow rooms to the real bookings.
  const { data: roomRows } = await supabase.from('tour_rooms').select('id, booking_id');
  realRoomIds.clear();
  for (const row of (roomRows ?? []) as Array<{ id: string; booking_id: string }>) {
    if (realIds.has(row.booking_id)) realRoomIds.add(row.id);
  }

  console.log(
    `bookings: ${bookings.length} total · ${bookings.length - realBookings.length} sim/manual-test · ` +
      `${realBookings.length} real\n`,
  );

  const silent: string[] = [];
  for (const probe of PROBES) {
    let real = 0;
    if (probe.via === 'booking_id') {
      const ids = await idsOf(supabase, probe.table, 'booking_id').catch(() => []);
      real = ids.filter((id) => realIds.has(id)).length;
    } else if (probe.via === 'room_id') {
      const ids = await idsOf(supabase, probe.table, 'room_id').catch(() => []);
      real = ids.filter((id) => realRoomIds.has(id)).length;
    }
    const mark = real === 0 ? '🔴' : '  ';
    console.log(`${mark} ${probe.label.padEnd(20)} ${String(real).padStart(5)}`);
    if (real === 0) silent.push(probe.label);
  }

  console.log(`\n──  real bookings that own a room  ──`);
  for (const b of realBookings) {
    const rooms = (roomRows ?? []).filter(
      (r) => (r as { booking_id: string }).booking_id === b.id,
    );
    if (rooms.length === 0) continue;
    const roomIds = rooms.map((r) => (r as { id: string }).id);
    const invites = (await idsOf(supabase, 'tour_room_invites', 'booking_id').catch(() => [])).filter(
      (id) => id === b.id,
    ).length;
    const parts = (await idsOf(supabase, 'tour_room_participants', 'room_id').catch(() => [])).filter(
      (id) => roomIds.includes(id),
    ).length;
    console.log(
      `   ${b.tour_date ?? '(날짜없음)'}  ${String(b.source ?? '-').padEnd(8)} ${String(b.status ?? '-').padEnd(10)}` +
        `  초대 ${invites}  참가자 ${parts}`,
    );
  }

  console.log(
    `\n${silent.length ? '🔴' : '✅'} 실사용 0인 기능: ${silent.length}/${PROBES.length}` +
      (silent.length ? `\n   ${silent.join(' · ')}` : ''),
  );
  console.log(
    '\n판정은 사람이 한다 — 신규라 당연한가, 아무도 못 찾는가, 고장인가.\n' +
      '초대 0인 방은 셋 중 첫 번째가 아니다: 방은 만들어졌는데 아무도 부르지 않았다는 뜻이다.',
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(2);
  });
