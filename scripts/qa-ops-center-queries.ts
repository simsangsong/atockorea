/**
 * 관제 W1~W4 쿼리 스모크 — 라우트가 쓰는 **Supabase 질의를 그대로** 실행한다.
 *
 * 왜 필요한가: tsc 는 PostgREST 문법을 검사하지 않는다. 존재하지 않는 컬럼,
 * 잘못된 `.or()` 절, 관계 이름 오타는 전부 **런타임에 500** 으로만 드러나고,
 * 이 저장소의 기록된 실패 양식이 바로 그것("성공한 척하는 실패")이다.
 *
 * 이 스크립트는 **읽기만 한다.** 쓰기·삭제 없음. 서비스 롤로 붙으므로 admin
 * 세션이 필요 없고, 검사 대상은 "질의가 도는가 + 집계기가 그 행을 먹는가"다.
 *
 *   npx tsx scripts/qa-ops-center-queries.ts [YYYY-MM]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { buildRoomMonth, MONTHLY_ROOM_SCAN_LIMIT, type RoomMonthInputs } from '../lib/ops/rooms/monthly';
import { loadSchedule } from '../lib/ops/schedule/load';
import { resolveSeatCapacity } from '../lib/ops/vehicles/registry';
import { detectAssignmentConflicts } from '../lib/ops/guides/conflicts';
import { loadConflictContext } from '../lib/ops/guides/conflictContext';
import { kstToday } from '../lib/ops/guides/availability';
import { runAutopilot } from '../lib/ops/autopilot/runner';
import { getForecastCached, loadTemplate } from '../lib/ops/messaging/guestMessageLoad';
import { composeForRecipient } from '../lib/ops/messaging/guestMessage';
import { clothingAdvice, weatherLine } from '../lib/ops/weather/forecast';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local).');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const period = process.argv[2] && /^\d{4}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : kstToday().slice(0, 7);

let pass = 0;
let fail = 0;

function ok(name: string, detail = '') {
  pass += 1;
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function bad(name: string, error: unknown) {
  fail += 1;
  console.error(`  FAIL  ${name} — ${error instanceof Error ? error.message : String(error)}`);
}

async function checkVehicles() {
  const { data, error } = await supabase
    .from('ops_vehicles')
    .select(
      'id, tenant_id, plate_number, layout_id, nickname, seat_capacity, driver_name, driver_phone, active, note, created_at, updated_at, layout:ops_vehicle_layouts(id, model, display_name, total_seats)',
    )
    .eq('tenant_id', 'atockorea')
    .limit(20);
  if (error) return bad('W1 ops_vehicles + layout join', error);
  const rows = (data ?? []) as Array<{ seat_capacity: number | null; layout: { total_seats: number } | null }>;
  for (const row of rows) resolveSeatCapacity(row, row.layout?.total_seats ?? null);
  ok('W1 ops_vehicles + layout join', `${rows.length}대`);
}

async function checkVehicleIdColumn() {
  const { error } = await supabase.from('ops_room_vehicles').select('id, vehicle_id').limit(1);
  if (error) return bad('W1 ops_room_vehicles.vehicle_id', error);
  ok('W1 ops_room_vehicles.vehicle_id');
}

async function checkAssignmentColumns() {
  const { error } = await supabase
    .from('ops_guide_assignments')
    .select('id, start_time, end_time, assigned_by, assigned_at, conflict_override, conflict_override_reason')
    .limit(1);
  if (error) return bad('W2 배정 신규 컬럼', error);
  ok('W2 배정 신규 컬럼');
}

async function checkConflictContext() {
  const { data: guides } = await supabase.from('ops_guides').select('id').limit(1);
  const guideId = (guides ?? [])[0]?.id as string | undefined;
  if (!guideId) return ok('W2 충돌 컨텍스트', '가이드 0명 — 건너뜀');
  try {
    const { context, resolvedTimes } = await loadConflictContext(supabase, {
      guideId,
      tourDate: `${period}-15`,
      tourType: 'private',
    });
    const verdict = detectAssignmentConflicts(
      { guideId, tourDate: `${period}-15`, tourType: 'private', ...resolvedTimes },
      context,
    );
    ok('W2 충돌 컨텍스트', `블록 ${verdict.blocked.length} · 경고 ${verdict.warnings.length}`);
  } catch (e) {
    bad('W2 충돌 컨텍스트', e);
  }
}

async function checkRoomMonthly() {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 0)).getUTCDate();
  const first = `${period}-01`;
  const last = `${period}-${String(lastDay).padStart(2, '0')}`;

  const { data: rooms, error } = await supabase
    .from('tour_rooms')
    .select('id, booking_id, tour_id, tour_date, status, created_at, updated_at')
    .gte('tour_date', first)
    .lte('tour_date', last)
    .limit(2000);
  if (error) return bad('W3 tour_rooms 월 조회', error);

  const roomRows = (rooms ?? []) as RoomMonthInputs['rooms'];
  const roomIds = roomRows.map((r) => r.id);
  const bookingIds = [...new Set(roomRows.map((r) => r.booking_id).filter(Boolean))] as string[];
  const tourIds = [...new Set(roomRows.map((r) => r.tour_id).filter(Boolean))] as string[];
  const empty = { data: [] as never[], error: null };

  const [bookingsRes, toursRes, participantsRes, messagesRes, invitesRes] = await Promise.all([
    bookingIds.length
      ? supabase
          .from('bookings')
          .select('id, contact_name, number_of_guests, preferred_language, status, booking_reference, source')
          .in('id', bookingIds)
      : Promise.resolve(empty),
    tourIds.length ? supabase.from('tours').select('id, title, city').in('id', tourIds) : Promise.resolve(empty),
    roomIds.length
      ? supabase
          .from('tour_room_participants')
          .select('room_id, role, last_seen_at')
          .in('room_id', roomIds)
          .limit(MONTHLY_ROOM_SCAN_LIMIT)
      : Promise.resolve(empty),
    roomIds.length
      ? supabase
          .from('tour_room_messages')
          .select('room_id, sender_role, created_at')
          .in('room_id', roomIds)
          .order('created_at', { ascending: false })
          .limit(MONTHLY_ROOM_SCAN_LIMIT)
      : Promise.resolve(empty),
    bookingIds.length
      ? supabase
          .from('tour_room_invites')
          .select('booking_id, revoked_at, expires_at')
          .in('booking_id', bookingIds)
          .limit(MONTHLY_ROOM_SCAN_LIMIT)
      : Promise.resolve(empty),
  ]);

  for (const [label, res] of [
    ['bookings', bookingsRes],
    ['tours', toursRes],
    ['participants', participantsRes],
    ['messages', messagesRes],
    ['invites', invitesRes],
  ] as const) {
    if (res.error) return bad(`W3 ${label} 조회`, res.error);
  }

  const result = buildRoomMonth({
    period,
    rooms: roomRows,
    bookings: (bookingsRes.data ?? []) as RoomMonthInputs['bookings'],
    tours: (toursRes.data ?? []) as RoomMonthInputs['tours'],
    participants: (participantsRes.data ?? []) as RoomMonthInputs['participants'],
    messages: (messagesRes.data ?? []) as RoomMonthInputs['messages'],
    invites: (invitesRes.data ?? []) as RoomMonthInputs['invites'],
  });
  ok(
    'W3 투어룸 월간 집계',
    `방 ${result.summary.roomCount} · 미입장 ${result.summary.deadCount} · 잘림 ${result.truncated}`,
  );
}

async function checkSchedule() {
  for (const axis of ['guide', 'vehicle'] as const) {
    try {
      const loaded = await loadSchedule(supabase, axis, period, kstToday());
      const issues = loaded.matrix.rows.reduce((n, r) => n + r.issueCount, 0);
      ok(`W4 ${axis} 축 매트릭스`, `행 ${loaded.matrix.rows.length} · 문제칸 ${issues}`);
    } catch (e) {
      bad(`W4 ${axis} 축 매트릭스`, e);
    }
  }
}

/**
 * W5 오토파일럿 — 유일하게 **쓰는** 검사다(제안 큐 upsert). `--cleanup` 을 주면
 * 이 스크립트가 만든 제안 행을 지우고 잔여 0을 확인한다. 시뮬 데이터를 라이브에
 * 남기지 않는 것이 이 저장소의 규칙이다.
 */
async function checkAutopilot(cleanup: boolean) {
  const before = await supabase
    .from('ops_autopilot_suggestions')
    .select('id', { count: 'exact', head: true });
  const beforeCount = before.count ?? 0;

  try {
    const result = await runAutopilot(supabase, { today: kstToday(), horizonDays: 14 });
    ok(
      'W5 오토파일럿 점검',
      `발견 ${result.found} · 신규 ${result.created} · 갱신 ${result.updated} · 처리된 항목 유지 ${result.skippedResolved}`,
    );
  } catch (e) {
    return bad('W5 오토파일럿 점검', e);
  }

  const after = await supabase.from('ops_autopilot_suggestions').select('id', { count: 'exact', head: true });
  const afterCount = after.count ?? 0;

  if (cleanup) {
    if (afterCount > beforeCount) {
      // 이 실행이 만든 행만 지운다 — 사람이 이미 쌓아둔 큐를 날리면 안 된다.
      const { data: rows } = await supabase
        .from('ops_autopilot_suggestions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(afterCount - beforeCount);
      const ids = (rows ?? []).map((r: { id: string }) => r.id);
      if (ids.length) await supabase.from('ops_autopilot_suggestions').delete().in('id', ids);
    }
    const final = await supabase.from('ops_autopilot_suggestions').select('id', { count: 'exact', head: true });
    if ((final.count ?? 0) === beforeCount) ok('W5 정리', `잔여 ${final.count} (실행 전과 동일)`);
    else bad('W5 정리', `잔여 ${final.count} ≠ 실행 전 ${beforeCount}`);
  } else {
    ok('W5 큐 상태', `${afterCount}건 (정리하려면 --cleanup)`);
  }
}

/**
 * M1~M3 — 날씨 예보(실제 Open-Meteo 호출) + 템플릿 해석 + 조립.
 * 예보는 외부 API라 tsc·jest가 검증할 수 없다. 실제로 도는지 여기서 본다.
 */
async function checkGuestMessaging() {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  // 예보 — 라이브 도시 3개 전부.
  for (const city of ['Seoul', 'Busan', 'Jeju']) {
    try {
      const forecast = await getForecastCached(supabase, city, tomorrow);
      if (!forecast) {
        bad(`M1 ${city} 예보`, '예보 없음 (Open-Meteo 응답 실패 또는 날짜 범위 밖)');
        continue;
      }
      ok(
        `M1 ${city} 예보`,
        `${weatherLine(forecast, 'ko')} · ${clothingAdvice(forecast, 'ko').slice(0, 24)}…`,
      );
    } catch (e) {
      bad(`M1 ${city} 예보`, e);
    }
  }

  // 템플릿 해석 — 투어 오버라이드가 없으면 전역/코드로 떨어져야 한다.
  const { data: tours } = await supabase.from('tours').select('id, title, city').limit(1);
  const tour = (tours ?? [])[0] as { id: string; title: string | null; city: string | null } | undefined;
  if (!tour) return ok('M2 템플릿 해석', '투어 0건 — 건너뜀');

  try {
    const tpl = await loadTemplate(supabase, {
      tourId: tour.id,
      presetKey: 'pickup_d1',
      locale: 'ko',
      channel: 'email',
    });
    ok('M2 템플릿 해석', `출처=${tpl.source} · ${tpl.body.length}자`);

    // 조립 — 예보가 있으면 날씨 줄이 들어가고, 없으면 그 줄이 사라져야 한다.
    const forecast = await getForecastCached(supabase, tour.city, tomorrow);
    const composed = composeForRecipient(
      { body: tpl.body, subject: '테스트' },
      {
        bookingId: 'probe',
        guestName: '홍길동',
        email: 'probe@example.com',
        locale: 'ko',
        pickupPoint: '명동역',
        pickupTime: '08:30',
        roomLink: 'https://example.com/r/probe',
      },
      { tourName: tour.title, tourDate: tomorrow, operatorName: 'AtoC Korea', forecast },
    );
    const hasWeatherLine = composed.body.includes('날씨');
    if (forecast && !hasWeatherLine) bad('M3 조립', '예보가 있는데 날씨 줄이 없다');
    else if (!forecast && hasWeatherLine) bad('M3 조립', '예보가 없는데 날씨 줄이 남았다');
    else ok('M3 조립', `누락 변수 ${composed.missing.length}개 · 날씨줄 ${hasWeatherLine ? '있음' : '없음(정상)'}`);
  } catch (e) {
    bad('M2/M3 템플릿·조립', e);
  }

  // 캐시가 실제로 쌓였는가.
  const { count } = await supabase.from('ops_weather_cache').select('id', { count: 'exact', head: true });
  ok('M1 예보 캐시', `${count ?? 0}행`);
}

async function main() {
  const cleanup = process.argv.includes('--cleanup');
  console.log(`\n관제 쿼리 스모크 — 대상 월 ${period}${cleanup ? ' (--cleanup)' : ''}\n`);
  await checkVehicles();
  await checkVehicleIdColumn();
  await checkAssignmentColumns();
  await checkConflictContext();
  await checkRoomMonthly();
  await checkSchedule();
  await checkGuestMessaging();
  await checkAutopilot(cleanup);
  console.log(`\n${pass} PASS / ${fail} FAIL\n`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
