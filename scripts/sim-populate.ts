/**
 * Populate the two sim rooms with realistic content (messages incl. a JA→ko
 * translation, an SOS, a boarding ack, and a live location) so the ops console
 * screens have something to show. Service-role writes; sim-labelled only.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const fx = JSON.parse(readFileSync(path.join(__dirname, '.sim-fixtures.json'), 'utf8'));

  const ensureRoom = async (bookingId: string) => {
    const { data: existing } = await service.from('tour_rooms').select('id').eq('booking_id', bookingId).maybeSingle();
    if (existing) return existing.id as string;
    const { data: booking } = await service
      .from('bookings')
      .select('id, tour_id, tour_date')
      .eq('id', bookingId)
      .single();
    const { data: room } = await service
      .from('tour_rooms')
      .insert({ booking_id: bookingId, tour_id: booking!.tour_id, tour_date: booking!.tour_date, status: 'active' })
      .select('id')
      .single();
    return room!.id as string;
  };

  const t = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
  const insertMsg = (roomId: string, bookingId: string, m: Record<string, unknown>) =>
    service.from('tour_room_messages').insert({ room_id: roomId, booking_id: bookingId, ...m });

  const room1 = await ensureRoom(fx.booking1); // Sim Alex (en)
  const room2 = await ensureRoom(fx.booking2); // Sim Yuki (ja)

  // Room 1: normal chat + boarding ack + a guide reply
  await insertMsg(room1, fx.booking1, { sender_role: 'customer', input_kind: 'text', source_text: 'Hi! We are at the hotel lobby.', source_locale: 'en', translations: { ko: '안녕하세요! 저희 호텔 로비에 있어요.' }, created_at: t(22) });
  await insertMsg(room1, fx.booking1, { sender_role: 'guide', input_kind: 'text', source_text: '곧 도착합니다. 5분만 기다려 주세요.', source_locale: 'ko', translations: { en: "Arriving soon. Please wait 5 minutes." }, created_at: t(20) });
  await insertMsg(room1, fx.booking1, { sender_role: 'customer', input_kind: 'text', source_text: "We're on board, thank you!", source_locale: 'en', translations: { ko: '탑승했어요, 감사합니다!' }, metadata: { kind: 'onboard_ack' }, created_at: t(8) });

  // Room 2 (JA): a help request keyword + an SOS with location + note
  await insertMsg(room2, fx.booking2, { sender_role: 'customer', input_kind: 'text', source_text: 'すみません、道に迷いました。助けてください。', source_locale: 'ja', translations: { ko: '죄송해요, 길을 잃었어요. 도와주세요.' }, metadata: { kind: 'quick_reply', preset_key: 'need_help' }, created_at: t(6) });
  await insertMsg(room2, fx.booking2, { sender_role: 'customer', input_kind: 'text', source_text: '緊急 — 今すぐ助けが必要です。', source_locale: 'ja', translations: { ko: '긴급 — 지금 도움이 필요해요.' }, metadata: { kind: 'sos', sender_name: 'Sim Yuki', note: 'temple gate, feeling unwell', latitude: 35.1795, longitude: 129.0756, location_one_shot: true }, created_at: t(3) });

  // Live location + a participant for room 2 (shows on the map tab)
  await service.from('tour_room_participants').upsert(
    { room_id: room2, role: 'customer', display_name: 'Sim Yuki', locale: 'ja', last_seen_at: t(1) },
    { onConflict: 'room_id,display_name' },
  ).select();

  console.log(JSON.stringify({ room1, room2, populated: true }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
