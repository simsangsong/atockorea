/**
 * Simulation seeder for the full-feature manual QA pass (ops-center audit).
 *
 * Audit plan A0.1 — every booking this writes carries `sim_tag`, so the rows
 * stay visible to rooms, seating, check-in and the manifest (that is the point
 * of a simulation) while staying out of the two places where they do damage:
 * aggregates (§11.E daily report, §K B1 stats, §K B2 capacity) and money
 * (Stripe capture cron, ops_entity_ledger). `lib/ops/sim/simScope.ts` is the
 * single place that decides what counts as simulated.
 *
 * The seeder refuses to run without ALLOW_SIM_SEED=1. It writes to the live
 * database, and "I did not mean to run that" should cost a typo, not a
 * cleanup.
 *
 * Seeds ONE clearly-labelled tour-day scenario in the live DB (same approach
 * as e2e/global-setup — everything labelled sim-tour-mode@atockorea.test and
 * removable with --cleanup):
 *   - 2 bookings on today's date (two rooms for the multi-room ops view)
 *   - customer + guide invite tokens (same secret ladder as the server)
 *   - a throwaway admin user (sim-tour-ops-admin@) + a signed-in session
 *     printed so the browser can adopt it via localStorage injection
 *
 * Run:   npx tsx scripts/sim-tour-day.ts            → writes scripts/.sim-fixtures.json
 *        npx tsx scripts/sim-tour-day.ts --cleanup  → removes everything it created
 */
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { signCustomerRoomToken, signGuideRoomToken } from '../lib/tour-room/token';
import { signCompanionInviteToken } from '../lib/tour-room/companionToken';
import { signRoomClaimToken } from '../lib/ops/seating/claimToken';
import { ensureRoom } from '../lib/tour-room/access';
import { kstToday } from '../lib/tour-room/time';
import { purgeRoomMedia, type PurgeStorageClient } from '../lib/tour-room/mediaPurge';
import { SESSION_SIM_TAG, LEGACY_SIM_TAG } from './simSessionTag';

const SIM_EMAIL = 'sim-tour-mode@atockorea.test';
const SIM_ADMIN_EMAIL = 'sim-tour-ops-admin@atockorea.test';
/**
 * 🔴 이제 세션(=워크트리)마다 다른 태그를 쓴다. 이유와 사고 경위는 `simSessionTag.ts`.
 * 요약: 전역 `'sim'` 하나였을 때 한쪽의 `--cleanup` 이 다른 세션 예약을 같이 지웠다.
 */
const SIM_TAG = SESSION_SIM_TAG;
const OUT = path.join(__dirname, '.sim-fixtures.json');
/**
 * K4v2 seeds its 20 rooms through `scripts/k4-seed.ts` with the SAME sim_tag,
 * so this cleanup already removes its rows. Its fixture file holds signed
 * tokens too, so it is removed here rather than in a second cleanup path —
 * one drain, or orphans survive a "cleanup done" message.
 */
const K4_OUT = path.join(__dirname, '.k4-fixtures.json');

/**
 * Children of `bookings` whose FK is ON DELETE SET NULL — deleting the booking
 * does NOT remove them, it orphans them. They have to go first, while
 * booking_id still says which rows were simulated.
 *
 * ops_entity_ledger is the one that matters: it is the corporate ledger behind
 * the three-way reconciliation in §6, and an orphaned simulated revenue row
 * there cannot be identified afterwards, let alone removed safely.
 */
const SET_NULL_CHILDREN: Array<{ table: string; column: string }> = [
  { table: 'ops_entity_ledger', column: 'booking_id' },
  { table: 'ops_email_parse_logs', column: 'booking_id' },
  { table: 'ops_guide_assignments', column: 'booking_id' },
  { table: 'emails', column: 'booking_id' },
  { table: 'reviews', column: 'booking_id' },
  { table: 'promo_code_usage', column: 'booking_id' },
  { table: 'received_emails', column: 'related_booking_id' },
  { table: 'coupon_grants', column: 'locked_booking_id' },
  // NO ACTION — this one blocks the delete outright rather than orphaning.
  { table: 'coupon_redemptions', column: 'booking_id' },
];

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !serviceKey || !anonKey) throw new Error('missing supabase env');
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (process.argv.includes('--cleanup')) {
    const fixtures = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;

    /**
     * 🔴 기본값은 **내 세션이 시드한 것만** 지운다. 전체 드레인은 `--all` 로 명시해야 한다.
     *
     * 예전 기본값은 `sim_tag='sim'` **또는** 시더 이메일이었고, 두 조건 다 세션을 구분하지
     * 않는다. 그래서 2026-08-03 에 한쪽의 드레인이 **다른 세션 예약 5건을 같이 지웠다**
     * (상대는 렌더 계측 중이었고, 예약이 사라진 뒤에도 하니스가 "위반 0"을 보고했다).
     *
     * ⚠ **이메일 폴백이 태그보다 더 위험하다** — 두 세션의 시더가 같은 주소를 쓰므로,
     * 태그만 갈라도 이메일 조건이 남의 행을 그대로 집는다. 그래서 폴백은 `--all` 전용이다.
     * 그 폴백의 원래 목적(컬럼 도입 이전 행 회수)은 일회성이라 명시 플래그가 맞는 자리다.
     *
     * 내 것 판정 = 내 세션 태그 + **로컬 픽스처에 적힌 id**. 후자가 있어야 태그 규약이
     * 바뀌기 전에 시드한 내 행도 회수된다.
     */
    const drainAll = process.argv.includes('--all');
    const idSet = new Set<string>();

    const { data: mine } = await service.from('bookings').select('id').eq('sim_tag', SIM_TAG);
    for (const b of mine ?? []) idSet.add(b.id as string);
    for (const key of ['booking1', 'booking2', 'bookingId']) {
      const v = fixtures?.[key];
      if (typeof v === 'string' && v) idSet.add(v);
    }

    if (drainAll) {
      const { data: legacy } = await service.from('bookings').select('id').eq('sim_tag', LEGACY_SIM_TAG);
      const { data: prefixed } = await service.from('bookings').select('id').like('sim_tag', `${LEGACY_SIM_TAG}:%`);
      const { data: byEmail } = await service
        .from('bookings')
        .select('id')
        .in('contact_email', [SIM_EMAIL, SIM_ADMIN_EMAIL]);
      for (const b of [...(legacy ?? []), ...(prefixed ?? []), ...(byEmail ?? [])]) idSet.add(b.id as string);
    } else {
      // 남의 것이 남아 있으면 조용히 두지 말고 **보이게** 한다 — 안 그러면 "정리 완료"가
      // 실제 상태와 어긋난 채로 다음 세션에 넘어간다.
      const { data: others } = await service
        .from('bookings')
        .select('id, sim_tag')
        .like('sim_tag', `${LEGACY_SIM_TAG}%`)
        .neq('sim_tag', SIM_TAG);
      if ((others ?? []).length > 0) {
        const tags = [...new Set((others ?? []).map((b) => String(b.sim_tag)))];
        console.log(
          `sim cleanup: 다른 세션/레거시 시뮬 예약 ${others!.length}건은 남겨 둔다 (태그 ${tags.join(', ')}). ` +
            `전부 지우려면 --all.`,
        );
      }
    }

    const ids = [...idSet];
    console.log(`sim cleanup: 내 태그 ${SIM_TAG} · 대상 ${ids.length}건${drainAll ? ' (--all)' : ''}`);

    // 1. SET NULL / NO ACTION children, while booking_id still identifies them.
    if (ids.length > 0) {
      for (const { table, column } of SET_NULL_CHILDREN) {
        const { error } = await service.from(table).delete().in(column, ids);
        // A table missing from this environment is not a failure — the parse
        // stack and the finance tables ship in separate deployments.
        if (error && !/does not exist|schema cache/i.test(error.message)) {
          console.warn('cleanup: ' + table + '.' + column + ' -> ' + error.message);
        }
      }
    }

    /**
     * 1b. Storage objects — BEFORE the cascade, because after it nothing says
     *     which paths belonged to these rooms.
     *
     * 🔴 This step did not exist, and its absence was invisible: cleanup
     * printed `leftover: 0` (true, of rows) while twelve objects stayed in
     * `tour-room-photos` under rooms that no longer existed. SQL cannot delete
     * them — `storage.protect_delete()` refuses — so it has to be the Storage
     * API, here, while the room ids are still knowable.
     */
    if (ids.length > 0) {
      const { data: rooms } = await service.from('tour_rooms').select('id').in('booking_id', ids);
      const roomIds = (rooms ?? []).map((r) => String(r.id));
      if (roomIds.length > 0) {
        const purged = await purgeRoomMedia(service as unknown as PurgeStorageClient, roomIds);
        if (purged.total > 0) console.log('sim cleanup: storage objects removed:', purged.total);
      }
    }

    // 2. The booking itself. Everything else hangs off ON DELETE CASCADE
    //    (tour_rooms -> messages/participants/locations/events/extras/pins,
    //    ops_seat_assignments, ops_room_vehicles, ops_no_show_evidence,
    //    tour_room_invites, push_subscriptions, tour_day_plans).
    if (ids.length > 0) {
      const { error } = await service.from('bookings').delete().in('id', ids);
      if (error) throw error;
    }

    if (fixtures?.adminUserId) {
      await service.from('push_subscriptions').delete().eq('user_id', fixtures.adminUserId);
      await service.from('user_profiles').delete().eq('id', fixtures.adminUserId);
      await service.auth.admin.deleteUser(fixtures.adminUserId).catch(() => undefined);
    }

    /**
     * 3. Prove it. A cleanup that reports success while leaving orphans behind
     *    is exactly the failure this rewrite exists to end.
     *
     * 🔴 The booking count alone was not proof, and said so for months:
     * `leftover: 0` was true of rows while 14 storage objects sat under rooms
     * that no longer existed. The drain gate now asserts four things, and a
     * non-zero on any of them exits 1 — K4v2 Phase 0 depends on this being a
     * gate rather than a log line.
     */
    const { count: leftover } = await service
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('sim_tag', SIM_TAG);

    const referenced = new Set<string>();
    for (const [bucket, prefixes] of [
      ['tour-room-photos', ['att', 'vision']],
      ['tour-audio', ['tour-room-tts']],
    ] as const) {
      for (const prefix of prefixes) {
        const { data } = await service.storage.from(bucket).list(prefix, { limit: 1000 });
        for (const entry of data ?? []) if (entry.name) referenced.add(entry.name);
      }
    }
    let orphanMedia = 0;
    if (referenced.size > 0) {
      const { data: liveRooms } = await service
        .from('tour_rooms')
        .select('id')
        .in('id', [...referenced]);
      const live = new Set((liveRooms ?? []).map((r) => String(r.id)));
      orphanMedia = [...referenced].filter((id) => !live.has(id)).length;
    }

    const { count: orphanRooms } = await service
      .from('tour_rooms')
      .select('id', { count: 'exact', head: true })
      .is('booking_id', null);

    console.log(
      'sim cleanup done:',
      ids.length,
      'bookings removed · leftover bookings:',
      leftover ?? 0,
      '· orphan rooms:',
      orphanRooms ?? 0,
      '· orphan media rooms:',
      orphanMedia,
    );
    if ((leftover ?? 0) > 0 || (orphanRooms ?? 0) > 0 || orphanMedia > 0) {
      console.error('🔴 drain gate FAILED — the simulation did not fully drain.');
      process.exitCode = 1;
    }
    if (existsSync(K4_OUT)) {
      try {
        unlinkSync(K4_OUT);
        console.log('k4 fixtures file removed (it holds signed tokens)');
      } catch {
        /* best effort */
      }
    }
    if (existsSync(OUT)) {
      try {
        unlinkSync(OUT);
        console.log('fixtures file removed (it holds signed tokens)');
      } catch {
        /* best effort */
      }
    }
    return;
  }

  // Seeding (unlike cleanup) writes to the live database. Make that a decision.
  if (process.env.ALLOW_SIM_SEED !== '1') {
    throw new Error(
      [
        'refusing to seed: set ALLOW_SIM_SEED=1.',
        'This writes bookings into the live database. They carry sim_tag and stay out of',
        'aggregates and money, but they are still real rows — remove them with --cleanup.',
      ].join('\n'),
    );
  }

  /**
   * 🔴 Prefer tours that actually have geofenced stops.
   *
   * This used to be `select('id, title').limit(2)` — whichever two rows came
   * back first. Only two tours in the whole catalogue carry `tour_guide_spots`
   * with coordinates and a radius, so the sim room almost always had NONE, and
   * every walk of the guest room quietly skipped the arrival-commentary path:
   * no geofence, no arrival card, no 1 km preview, nothing to see. That is how
   * the location-sharing door stayed missing long enough to be found by reading
   * the source instead of by running the app.
   *
   * Falls back to the old behaviour so a catalogue with no spots still seeds.
   */
  const { data: spotRows } = await service.from('tour_guide_spots').select('tour_id');
  const geofencedTourIds = [...new Set((spotRows ?? []).map((r) => r.tour_id as string))];
  const { data: preferred } = geofencedTourIds.length
    ? await service.from('tours').select('id, title').in('id', geofencedTourIds).limit(2)
    : { data: null };
  const { data: fallback } = await service.from('tours').select('id, title').limit(2);
  const tours = preferred && preferred.length > 0 ? preferred : fallback;
  if (!tours || tours.length === 0) throw new Error('no tours');
  const tourDate = kstToday();

  const mk = async (name: string, lang: string, guests: number, tourId: string) => {
    const { data, error } = await service
      .from('bookings')
      .insert({
        tour_id: tourId,
        tour_date: tourDate,
        number_of_guests: guests,
        unit_price: 0,
        total_price: 0,
        final_price: 0,
        status: 'confirmed',
        contact_name: name,
        contact_email: SIM_EMAIL,
        contact_phone: '+82-10-0000-0000',
        preferred_language: lang,
        // A0.1 — the whole isolation contract rides on this one field.
        sim_tag: SIM_TAG,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const tourA = tours[0].id;
  const tourB = (tours[1] ?? tours[0]).id;
  const booking1 = await mk('Sim Alex', 'en', 2, tourA);
  const booking2 = await mk('Sim Yuki', 'ja', 4, tourB);

  const token1 = signCustomerRoomToken({ bookingId: booking1, displayName: 'Sim Alex', tourDate }).token;
  const token2 = signCustomerRoomToken({ bookingId: booking2, displayName: 'Sim Yuki', tourDate }).token;
  const guideToken = signGuideRoomToken({ tourId: tourA, tourDate, displayName: 'Sim Guide' }).token;

  // throwaway admin + session
  const password = `Sim!${Math.random().toString(36).slice(2, 12)}Aa1`;
  let adminUserId: string;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: SIM_ADMIN_EMAIL,
    password,
    email_confirm: true,
  });
  if (createError) {
    // already exists from a previous run — reset password
    const { data: list } = await service.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === SIM_ADMIN_EMAIL);
    if (!existing) throw createError;
    adminUserId = existing.id;
    await service.auth.admin.updateUserById(adminUserId, { password });
  } else {
    adminUserId = created.user!.id;
  }
  await service.from('user_profiles').upsert({ id: adminUserId, full_name: 'Sim Ops Admin', role: 'admin' });

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: SIM_ADMIN_EMAIL,
    password,
  });
  if (signInError || !signIn.session) throw signInError ?? new Error('sign-in failed');

  const projectRef = new URL(url).hostname.split('.')[0];

  /**
   * 🔴 초대 랜딩 두 개는 이 파일이 URL 을 안 써 줘서 오랫동안 측정되지 않았다.
   *
   * `qa-uiux-render.mjs` 는 `fx.joinUrl` · `fx.companionUrl` 을 읽는데 여기가 그 키를
   * 만든 적이 없다. 그래서 `undefined` 가 그대로 주소에 붙어 `…:3181undefined` 로
   * 나갔고, 9개 표면 중 2개가 매 실행 「unreachable」로 빠졌다. 하니스가 그걸 초록으로
   * 세지 않고 도달 실패로 보고한 덕에 조용한 통과는 아니었지만, **측정은 계속 0이었다.**
   *
   * join 은 `tour_rooms.id` 로 서명하므로 룸이 실제로 있어야 하는데, 룸은 손님이 처음
   * 열 때 만들어진다 — 시드 시점엔 없다. 그래서 앱이 쓰는 `ensureRoom` 을 그대로 부른다.
   * 여기서 행을 손으로 넣으면 시드가 만든 룸과 앱이 만든 룸이 달라질 수 있고, 그 차이는
   * 하니스가 아니라 손님에게서 처음 드러난다.
   */
  const room1 = await ensureRoom(service as never, {
    id: booking1,
    tour_id: tourA,
    tour_date: tourDate,
  });

  const joinUrl = `/tour-mode/join/${encodeURIComponent(
    signRoomClaimToken({ roomId: String(room1.id), tourId: tourA, tourDate }).token,
  )}`;
  const companionUrl = `/tour-mode/companion/${encodeURIComponent(
    signCompanionInviteToken({ bookingId: booking1, tourDate }).token,
  )}`;

  const fixtures = {
    tourDate,
    booking1,
    booking2,
    room1Url: `/tour-mode/room/${booking1}?rt=${encodeURIComponent(token1)}`,
    room2Url: `/tour-mode/room/${booking2}?rt=${encodeURIComponent(token2)}`,
    guideUrl: `/tour-mode/guide?rt=${encodeURIComponent(guideToken)}`,
    joinUrl,
    companionUrl,
    adminUserId,
    supabaseStorageKey: `sb-${projectRef}-auth-token`,
    adminSession: signIn.session,
  };
  writeFileSync(OUT, JSON.stringify(fixtures, null, 2));
  console.log(JSON.stringify({ tourDate, booking1, booking2, adminUserId, storageKey: fixtures.supabaseStorageKey }, null, 2));
  console.log('fixtures →', OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
