/**
 * qa-midnight-meeting — a meeting time past midnight, on a guest's screen.
 *
 * The edge was written down during the iOS sweep and never reproduced:
 * "자정 넘는 집합 시각은 당일 00:00 으로 해석되어 즉시 만료된다." `wallClockToMs`
 * anchors HH:MM to the START of the tour date, so a guide who announces 00:30
 * at 23:00 produces a target 22.5 hours in the PAST — `activeNotice` expires it
 * on arrival and the guests' countdown never appears. Nothing errors: the guide
 * sees a sent notice, the guests see nothing, and neither side is told.
 *
 * Live data says this is latent, not active (measured 2026-08-03: 62 timed
 * schedule stops, earliest 08:10, latest 17:50; 4 timed notices ever sent, all
 * daytime). It is reproduced here rather than argued about, because "we never
 * saw it" and "it does not happen" are different claims.
 *
 * ## Shape
 *
 * Two notices into the same sim room, control first. The room shows the LATEST
 * notice, so the second one replaces the first — meaning the banner's
 * disappearance is itself the reading, and phase A proves the banner can be
 * seen at all before phase B claims it cannot.
 *
 *   A · control — a meeting ~35 minutes out → banner + countdown.
 *   B · edge    — the same notice at 00:30 → banner must survive.
 *
 * 🔴 Fan-out safety: /broadcast reaches EVERY room of a (tourId, tourDate). The
 * walk narrows with `bookingIds` AND refuses unless the booking is sim-tagged.
 * A meeting notice delivered to a real guest is a person standing in a car park.
 *
 * Usage:
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   WALK_BASE=http://localhost:3185 npx tsx scripts/qa-midnight-meeting.ts
 *
 * Exit: 0 = passed · 1 = a check failed · 2 = preconditions absent.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { chromium, type Page } from 'playwright';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3185';
const OUT = process.env.WALK_OUT ?? 'scripts/.walk-midnight';
const FIXTURES = path.join(__dirname, '.sim-fixtures.json');

/** The wall clock the edge is about. */
const PAST_MIDNIGHT = '00:30';
/** How far ahead the control meeting sits. */
const CONTROL_MINUTES = 35;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✅' : '  🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function kstClock(msEpoch: number): { hour: number; hhmm: string; ymd: string } {
  const shifted = new Date(msEpoch + KST_OFFSET_MS);
  const hour = shifted.getUTCHours();
  return {
    hour,
    hhmm: `${String(hour).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`,
    ymd: shifted.toISOString().slice(0, 10),
  };
}

interface Notice {
  kind: 'meeting_notice';
  time: string;
  point: string;
}

async function broadcast(
  guideToken: string,
  tourId: string,
  tourDate: string,
  bookingId: string,
  notice: Notice,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`${BASE}/api/tour-rooms/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tour-room-token': guideToken },
    body: JSON.stringify({ tourId, tourDate, bookingIds: [bookingId], notice }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 200) };
}

/**
 * What the guest's Home hero says about the meeting right now.
 *
 * ⚠ Not `notice-banner`. The first version of this walk looked there, found
 * nothing, and would have reported the CONTROL as broken — but the screenshot
 * showed the countdown alive and well, one card lower. On the guest's home tab
 * `heroOwnsCountdown` is true and NoticeBanner deliberately yields the clock to
 * the hero, so the banner's absence there means nothing at all. Third time in
 * this audit that a screenshot stopped a fabricated defect.
 */
async function readMeetingCountdown(page: Page): Promise<{ present: boolean; text: string }> {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .waitForSelector('[data-testid="home-status-live"], [data-testid="lifecycle-badge"]', { timeout: 180_000 })
    .catch(() => undefined);
  // Wait for the thing being measured, not for a number of seconds — the join
  // and first poll land after the shell does.
  await page.waitForSelector('[data-testid="home-now-numeral"]', { timeout: 20_000 }).catch(() => undefined);
  const numeral = page.locator('[data-testid="home-now-numeral"]');
  const card = page.locator('[data-testid="home-status-live"]');
  const text = ((await card.first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  return { present: (await numeral.count()) > 0, text };
}

async function main(): Promise<number> {
  loadEnvConfig(process.cwd());
  mkdirSync(OUT, { recursive: true });

  if (!existsSync(FIXTURES)) {
    console.error('🔴 no scripts/.sim-fixtures.json — run sim-tour-day.ts then sim-populate.ts');
    return 2;
  }
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8')) as {
    booking1?: string;
    room1Url?: string;
    guideUrl?: string;
  };
  const guideToken = fx.guideUrl ? new URL(fx.guideUrl, BASE).searchParams.get('rt') : null;
  if (!fx.booking1 || !fx.room1Url || !guideToken) {
    console.error('🔴 fixtures are missing booking1 / room1Url / guide token');
    return 2;
  }

  const now = Date.now();
  const { hour } = kstClock(now);
  if (hour < 6 || hour > 21) {
    // Outside this window the two times stop meaning what the walk needs them
    // to mean: after 22:00 the control crosses midnight itself, and before
    // 06:00 today's 00:30 is not in the past, so there is no edge to observe.
    console.error(`🔴 KST ${hour}시 — 이 창(06~21시) 밖에서는 두 시각이 각자 다른 뜻이 된다. 낮에 다시 돌려라.`);
    return 2;
  }
  const controlTime = kstClock(now + CONTROL_MINUTES * 60_000).hhmm;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('🔴 missing Supabase env — cannot verify the booking is simulated');
    return 2;
  }
  const service = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await service
    .from('bookings')
    .select('id, tour_id, tour_date, sim_tag')
    .eq('id', fx.booking1)
    .maybeSingle();
  const booking = data as { tour_id: string; tour_date: string; sim_tag: string | null } | null;
  if (!booking?.tour_id || !booking.tour_date) {
    console.error('🔴 seeded booking has no tour_id/tour_date');
    return 2;
  }
  if (!booking.sim_tag) {
    console.error('🔴 booking1 is not sim-tagged — refusing to broadcast a meeting time into a real room');
    return 2;
  }
  if (booking.tour_date !== kstClock(now).ymd) {
    console.error(`🔴 seeded tour_date ${booking.tour_date} is not today KST (${kstClock(now).ymd}) — reseed`);
    return 2;
  }

  const browser = await chromium.launch();
  const guestCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'en-US',
  });
  const guest = await guestCtx.newPage();
  await guest.goto(`${BASE}${fx.room1Url}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });

  try {
    // ── A · control ─────────────────────────────────────────────────────────
    const sentControl = await broadcast(guideToken, booking.tour_id, booking.tour_date, fx.booking1, {
      kind: 'meeting_notice',
      time: controlTime,
      point: 'Sim car park',
    });
    if (!check('① 가이드가 집합 공지를 보냈다 (대조군)', sentControl.ok, `${controlTime} · HTTP ${sentControl.status}`)) {
      console.error(sentControl.body);
      return 2;
    }
    const control = await readMeetingCountdown(guest);
    await guest.screenshot({ path: path.join(OUT, '01-control.png') }).catch(() => undefined);
    if (
      !check(
        '② 손님 화면에 집합 카운트다운이 뜬다 (계측기가 그걸 볼 수 있다)',
        control.present,
        control.present ? control.text.slice(0, 80) : '카운트다운 없음 — 이 뒤의 판정은 공허하다',
      )
    ) {
      return 2;
    }

    // ── B · the edge ────────────────────────────────────────────────────────
    const sentEdge = await broadcast(guideToken, booking.tour_id, booking.tour_date, fx.booking1, {
      kind: 'meeting_notice',
      time: PAST_MIDNIGHT,
      point: 'Sim car park',
    });
    check('③ 가이드가 자정 넘는 집합 시각을 보냈다', sentEdge.ok, `${PAST_MIDNIGHT} · HTTP ${sentEdge.status}`);

    const edge = await readMeetingCountdown(guest);
    await guest.screenshot({ path: path.join(OUT, '02-past-midnight.png') }).catch(() => undefined);
    check(
      `🔴 ④ ${PAST_MIDNIGHT} 집합 공지가 손님 화면에 살아 있다`,
      edge.present,
      edge.present
        ? edge.text.slice(0, 80)
        : '가이드는 보냈고 서버는 200 을 줬는데 손님 화면엔 카운트다운이 없다 (당일 00:30 = 이미 지난 시각)',
    );
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT}/`);
  if (results.length === 0) {
    console.error('\n🔴 아무것도 검사하지 않았다.');
    return 2;
  }
  return failed.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(2);
  });
