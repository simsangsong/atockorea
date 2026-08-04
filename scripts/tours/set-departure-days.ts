/**
 * Publish a tour's departure weekdays into `product_inventory`.
 *
 *   npm run tour:days -- --tour=<uuid|slug> --days=mon,thu,sat --months=6
 *   npm run tour:days -- --tour=<uuid|slug> --days=mon,thu,sat --apply
 *
 * Dry-run by default; `--apply` writes. Every date in the horizon gets a row —
 * open days as `is_available: true`, everything else as `false`.
 *
 * 🔴 Both halves matter. `app/api/tours/[id]/availability/range` treats a date
 * with NO inventory row as open at the default capacity, so seeding only the
 * open days leaves the other four weekdays bookable. The closed rows are what
 * actually close them.
 *
 * Existing rows are updated in place rather than replaced, so an operator's
 * per-date capacity or price override survives a weekday change. Rows whose
 * date already carries bookings are never closed — the script reports them and
 * leaves them alone rather than stranding a booked guest.
 */
import { createClient } from '@supabase/supabase-js';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const argv = process.argv.slice(2);
const flag = (n: string): string | undefined => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : undefined;
};
const APPLY = argv.includes('--apply');

const tourRef = flag('tour');
const daysRaw = flag('days');
const months = Number(flag('months') ?? 6);
const capacity = flag('capacity') ? Number(flag('capacity')) : null;

if (!tourRef || !daysRaw) {
  console.error('usage: --tour=<uuid|slug> --days=mon,thu,sat [--months=6] [--capacity=N] [--apply]');
  process.exit(1);
}

const openDays = new Set(
  daysRaw.split(',').map((d) => d.trim().toLowerCase()).map((d) => {
    const i = WEEKDAYS.indexOf(d as (typeof WEEKDAYS)[number]);
    if (i < 0) { console.error(`알 수 없는 요일: ${d} (${WEEKDAYS.join(',')})`); process.exit(1); }
    return i;
  }),
);

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 — --env-file=.env.local 로 실행하라.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourRef);
const { data: tour, error: tourErr } = await sb
  .from('tours').select('id, slug, title').eq(isUuid ? 'id' : 'slug', tourRef).maybeSingle();
if (tourErr) { console.error(`tours 조회 실패: ${tourErr.message}`); process.exit(1); }
if (!tour) { console.error(`투어를 못 찾았다: ${tourRef}`); process.exit(1); }

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + months);

const dates: { date: string; open: boolean }[] = [];
for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
  dates.push({ date: ymd(d), open: openDays.has(d.getUTCDay()) });
}

const [{ data: existing }, { data: booked }] = await Promise.all([
  sb.from('product_inventory').select('id, tour_date, is_available, max_capacity')
    .eq('tour_id', tour.id).gte('tour_date', ymd(start)).lte('tour_date', ymd(end)),
  sb.from('bookings').select('booking_date')
    .eq('tour_id', tour.id).gte('booking_date', ymd(start)).lte('booking_date', ymd(end))
    .in('status', ['pending', 'confirmed', 'paid']),
]);

const byDate = new Map((existing ?? []).map((r) => [r.tour_date as string, r]));
const bookedDates = new Set((booked ?? []).map((b) => b.booking_date as string));

const toOpen: typeof dates = [], toClose: typeof dates = [], skipped: string[] = [];
for (const d of dates) {
  const cur = byDate.get(d.date);
  if (!d.open && bookedDates.has(d.date)) { skipped.push(d.date); continue; }
  if (cur && cur.is_available === d.open) continue;
  (d.open ? toOpen : toClose).push(d);
}

console.log(`${tour.title} (${tour.slug})`);
console.log(`  운행 요일: ${[...openDays].sort().map((i) => WEEKDAYS[i]).join(', ')} · 기간 ${ymd(start)} ~ ${ymd(end)}`);
console.log(`  열 날짜 ${toOpen.length} · 닫을 날짜 ${toClose.length} · 이미 맞음 ${dates.length - toOpen.length - toClose.length - skipped.length}`);
if (skipped.length) console.log(`  ⚠ 예약이 있어 닫지 않은 날 ${skipped.length}: ${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? ' …' : ''}`);

if (!APPLY) { console.log('\n드라이런이다. 실제로 쓰려면 --apply 를 붙여라.'); process.exit(0); }

let wrote = 0;
for (const d of [...toOpen, ...toClose]) {
  const cur = byDate.get(d.date);
  const { error } = cur
    ? await sb.from('product_inventory').update({ is_available: d.open }).eq('id', cur.id)
    : await sb.from('product_inventory').insert({
        tour_id: tour.id, tour_date: d.date, is_available: d.open,
        ...(capacity != null ? { max_capacity: capacity, available_spots: capacity } : {}),
      });
  if (error) { console.error(`  ✗ ${d.date}: ${error.message}`); continue; }
  wrote += 1;
}
console.log(`\n${wrote}/${toOpen.length + toClose.length} 행 반영 완료.`);
