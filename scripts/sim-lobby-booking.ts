/**
 * sim-lobby-booking — a future-date sim booking for the lobby / D-1 surfaces.
 *
 * The live seed (sim-tour-day.ts) puts both bookings on today, so the lobby
 * hero and D-1 onboarding can never be rendered from it. This adds one booking
 * N days out (default 3), same sim_tag contract, cleaned by
 * `sim-tour-day.ts --cleanup` (cleanup selects on sim_tag, not on this file).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { signCustomerRoomToken } from '../lib/tour-room/token';
import { kstToday } from '../lib/tour-room/time';
import { SESSION_SIM_TAG } from './simSessionTag';

const SIM_EMAIL = 'sim-tour-mode@atockorea.test';
/**
 * 세션(=워크트리)별 태그. `sim-tour-day.ts` 와 **같은 값이어야** 그 드레인이 이 행도 집는다.
 *
 * 🔴 이 파일을 빠뜨렸다가 실제로 걸렸다 — 시더 셋 중 둘만 새 태그를 쓰니, 드레인이 내가 시드한
 * 로비 예약을 "다른 세션 것"으로 보고 남겨 두었다. 오류도 경고도 없었고 드레인은 "완료"라고 했다.
 * 시더가 늘어나면 전부 여기서 태그를 가져와야 한다 — 강제는 `__tests__/audit/simSeederTag.test.ts`.
 * 이유와 사고 경위는 `simSessionTag.ts`.
 */
const SIM_TAG = SESSION_SIM_TAG;
const OUT = path.join(__dirname, '.sim-lobby-fixtures.json');

async function main() {
  loadEnvConfig(path.join(__dirname, '..'));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (process.env.ALLOW_SIM_SEED !== '1') {
    throw new Error('refusing to seed: set ALLOW_SIM_SEED=1 (live rows, sim_tag, removed by sim-tour-day --cleanup).');
  }

  const daysOut = Number(process.argv[2] ?? '3');
  const today = kstToday();
  const target = new Date(`${today}T00:00:00+09:00`);
  target.setDate(target.getDate() + daysOut);
  const tourDate = target.toISOString().slice(0, 10);

  const { data: tours } = await service.from('tours').select('id, title').limit(1);
  if (!tours || tours.length === 0) throw new Error('no tours');

  const { data, error } = await service
    .from('bookings')
    .insert({
      tour_id: tours[0].id,
      tour_date: tourDate,
      number_of_guests: 2,
      unit_price: 0,
      total_price: 0,
      final_price: 0,
      status: 'confirmed',
      contact_name: 'Sim Lobby',
      contact_email: SIM_EMAIL,
      contact_phone: '+82-10-0000-0000',
      preferred_language: 'en',
      sim_tag: SIM_TAG,
    })
    .select('id')
    .single();
  if (error) throw error;
  const bookingId = data.id as string;

  const token = signCustomerRoomToken({ bookingId, displayName: 'Sim Lobby', tourDate }).token;
  const fixtures = {
    tourDate,
    bookingId,
    roomUrl: `/tour-mode/room/${bookingId}?rt=${encodeURIComponent(token)}`,
    planUrl: `/tour-mode/plan/${bookingId}?rt=${encodeURIComponent(token)}`,
  };
  writeFileSync(OUT, JSON.stringify(fixtures, null, 2));
  console.log(JSON.stringify({ tourDate, bookingId }, null, 2));
  console.log('fixtures →', OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
