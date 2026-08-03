/**
 * qa-plan-concurrency — two people editing one day plan.
 *
 * `tour_day_plans` carries a `version` column. The route increments it on every
 * write and the guide console prints it ("손님 희망 일정 v3"). Nothing reads it
 * to decide anything: `PUT /plan` reads the row, builds the next one from what
 * it just read, and upserts blind. Two writers who both read v5 both write v6,
 * and the second one wins by arriving last. Both are told 200.
 *
 * The realistic pairing is not two guides racing. It is the one the product
 * invites: at D-1 the lead guest is still editing (status guest_draft, so no
 * lock applies), the guide opens the plan panel, the guest adds a stop, and the
 * guide taps 확정 — which posts the FULL stops array from the snapshot the panel
 * loaded before the guest's edit. The stop disappears and the plan is now
 * confirmed, so the guest is locked out of putting it back.
 *
 * This repo has lost data to exactly this shape before: parallel
 * read-modify-write dropped 70 paid translations, and the fix there was a merge
 * function. Here the field that would have prevented it was already in the
 * table, unread.
 *
 * ## Shape
 *
 * No timing luck is needed — the clobber is in the read, not the race:
 *
 *   1. read the plan → version N, stops S
 *   2. writer A (from N) writes S + [A]
 *   3. writer B, still holding N, writes S + [B]
 *   4. read back
 *
 * Before: stops are S + [B], A is gone, both writes returned 200.
 * After:  B is refused 409 plan_stale and A survives.
 *
 * Usage:
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   WALK_BASE=http://localhost:3185 npx tsx scripts/qa-plan-concurrency.ts
 *
 * Exit: 0 = passed · 1 = a check failed · 2 = preconditions absent.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3185';
const FIXTURES = path.join(__dirname, '.sim-fixtures.json');

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✅' : '  🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

interface PlanStop {
  title?: string;
  poi_key?: string | null;
  [key: string]: unknown;
}
interface PlanResponse {
  day_plan?: { version?: number; stops?: PlanStop[]; status?: string } | null;
  error?: string;
}

async function readPlan(token: string, bookingId: string): Promise<PlanResponse> {
  const res = await fetch(`${BASE}/api/tour-rooms/${encodeURIComponent(bookingId)}/plan`, {
    headers: { 'x-tour-room-token': token },
  });
  return (await res.json().catch(() => ({}))) as PlanResponse;
}

async function writePlan(
  token: string,
  bookingId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: PlanResponse }> {
  const res = await fetch(`${BASE}/api/tour-rooms/${encodeURIComponent(bookingId)}/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-tour-room-token': token },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as PlanResponse };
}

/**
 * A stop's title is stored as `name_i18n.en`, not `title` — `sanitizeStops`
 * moves it on the way in. Reading `title` back made the first run report both
 * stops missing, which would have been a fabricated second defect on top of the
 * real one.
 */
const titles = (stops: PlanStop[] | undefined) =>
  (stops ?? []).map((s) => {
    const names = s.name_i18n as Record<string, string> | null | undefined;
    return String(names?.en ?? s.title ?? s.poi_key ?? '?');
  });

async function main(): Promise<number> {
  loadEnvConfig(process.cwd());

  if (!existsSync(FIXTURES)) {
    console.error('🔴 no scripts/.sim-fixtures.json — run sim-tour-day.ts then sim-populate.ts');
    return 2;
  }
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8')) as { booking1?: string; guideUrl?: string };
  const token = fx.guideUrl ? new URL(fx.guideUrl, BASE).searchParams.get('rt') : null;
  if (!fx.booking1 || !token) {
    console.error('🔴 fixtures are missing booking1 / guide token');
    return 2;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('🔴 missing Supabase env — cannot verify the booking is simulated');
    return 2;
  }
  const service = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await service.from('bookings').select('sim_tag').eq('id', fx.booking1).maybeSingle();
  if (!(data as { sim_tag?: string | null } | null)?.sim_tag) {
    // This walk rewrites a day plan. On a real booking that is somebody's day.
    console.error('🔴 booking1 is not sim-tagged — refusing to rewrite a real day plan');
    return 2;
  }

  // ── 1. the snapshot both writers hold ─────────────────────────────────────
  const before = await readPlan(token, fx.booking1);
  const baseStops = before.day_plan?.stops ?? [];
  const baseVersion = before.day_plan?.version ?? 0;
  if (!check('① 일정을 읽었다', Boolean(before.day_plan) || baseStops.length >= 0, `v${baseVersion} · 스톱 ${baseStops.length}`)) {
    return 2;
  }

  const stopA: PlanStop = { title: 'CONCURRENCY-A', stay_minutes: 30 };
  const stopB: PlanStop = { title: 'CONCURRENCY-B', stay_minutes: 30 };

  // ── 2. writer A commits from that snapshot ────────────────────────────────
  const a = await writePlan(token, fx.booking1, { stops: [...baseStops, stopA], version: baseVersion });
  if (!check('② 먼저 저장한 쪽이 성공한다', a.status === 200, `HTTP ${a.status} · v${a.body.day_plan?.version ?? '?'}`)) {
    console.error(JSON.stringify(a.body).slice(0, 200));
    return 2;
  }

  // ── 3. writer B commits from the SAME snapshot, having never seen A ───────
  const b = await writePlan(token, fx.booking1, { stops: [...baseStops, stopB], version: baseVersion });
  const staleRefused = b.status === 409;
  check(
    '🔴 ③ 낡은 스냅샷으로 저장하면 거절된다',
    staleRefused,
    staleRefused
      ? `HTTP 409 ${b.body.error ?? ''}`
      : `HTTP ${b.status} — 서버가 받아 줬다. 앞 사람의 편집이 방금 사라졌다`,
  );

  // ── 4. what actually survived ─────────────────────────────────────────────
  const after = await readPlan(token, fx.booking1);
  const names = titles(after.day_plan?.stops);
  check(
    '🔴 ④ 먼저 저장한 편집이 살아 있다',
    names.includes('CONCURRENCY-A'),
    names.includes('CONCURRENCY-A') ? `v${after.day_plan?.version ?? '?'}` : `남은 스톱: ${names.join(', ') || '(없음)'}`,
  );
  check(
    '⑤ 거절된 편집은 반영되지 않았다',
    !names.includes('CONCURRENCY-B'),
    names.includes('CONCURRENCY-B') ? '늦게 온 쪽이 덮어썼다' : '',
  );
  check(
    '⑥ 거절 응답이 최신 일정을 함께 준다 (클라이언트가 되맞출 수 있다)',
    !staleRefused || (b.body.day_plan?.version ?? 0) > baseVersion,
    staleRefused ? `응답 v${b.body.day_plan?.version ?? '없음'}` : '거절 자체가 없었다',
  );

  // ── 5. put the sim plan back the way we found it ──────────────────────────
  const current = await readPlan(token, fx.booking1);
  await writePlan(token, fx.booking1, {
    stops: baseStops,
    version: current.day_plan?.version ?? 0,
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} 통과`);
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
