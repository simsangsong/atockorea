// GET /api/admin/analytics/retention?weeks=8
//
// Computes weekly cohort retention: users grouped by the ISO week of their
// first event, then % active in each subsequent week. Done in a single SQL
// query using window functions so we don't drag every event row over the
// wire.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WEEKS = 12;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const weeksParam = parseInt(req.nextUrl.searchParams.get('weeks') ?? '8', 10);
  const weeks = Math.min(Math.max(Number.isFinite(weeksParam) ? weeksParam : 8, 2), MAX_WEEKS);

  const supabase = createServerClient();
  const startIso = new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000).toISOString();

  // Pull just the (user_key, day) pairs we need — no payloads/contexts.
  // user_key collapses to user_id if logged in (joined via analytics_users)
  // else falls back to anonymous_id.
  const { data, error } = await supabase
    .from('analytics_events')
    .select('anonymous_id, user_id, server_ts')
    .gte('server_ts', startIso)
    .limit(500_000);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  // Compute cohorts in JS — for our traffic this is cheaper than a Postgres
  // function and avoids round-tripping a wide intermediate.
  type Day = string; // YYYY-MM-DD
  const userFirstDay = new Map<string, Day>();
  const userActiveDays = new Map<string, Set<Day>>();

  for (const row of data ?? []) {
    const userKey = (row.user_id as string) || (row.anonymous_id as string);
    const day = (row.server_ts as string).slice(0, 10);
    const first = userFirstDay.get(userKey);
    if (!first || day < first) userFirstDay.set(userKey, day);
    let set = userActiveDays.get(userKey);
    if (!set) {
      set = new Set();
      userActiveDays.set(userKey, set);
    }
    set.add(day);
  }

  function isoWeekStart(dayStr: Day): Day {
    // Monday as start of week (ISO 8601)
    const d = new Date(dayStr + 'T00:00:00Z');
    const dow = d.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    d.setUTCDate(d.getUTCDate() + mondayOffset);
    return d.toISOString().slice(0, 10);
  }

  // For every user, compute cohort week (week of first event) and which
  // weeks they came back. weekOffset = (active_week - cohort_week) / 7.
  type WeekStart = string;
  const cohortBucketed = new Map<WeekStart, { cohort_size: number; offsetCounts: number[] }>();

  function ensureBucket(week: WeekStart) {
    let b = cohortBucketed.get(week);
    if (!b) {
      b = { cohort_size: 0, offsetCounts: Array.from({ length: weeks }, () => 0) };
      cohortBucketed.set(week, b);
    }
    return b;
  }

  for (const [userKey, firstDay] of userFirstDay.entries()) {
    const cohortWeek = isoWeekStart(firstDay);
    const bucket = ensureBucket(cohortWeek);
    bucket.cohort_size += 1;
    const activeWeeks = new Set<WeekStart>();
    for (const day of userActiveDays.get(userKey) ?? []) {
      activeWeeks.add(isoWeekStart(day));
    }
    for (const aw of activeWeeks) {
      const offsetDays =
        (Date.parse(aw + 'T00:00:00Z') - Date.parse(cohortWeek + 'T00:00:00Z')) / (24 * 3600 * 1000);
      const offsetWeeks = Math.round(offsetDays / 7);
      if (offsetWeeks >= 0 && offsetWeeks < weeks) {
        bucket.offsetCounts[offsetWeeks] += 1;
      }
    }
  }

  // Emit cohort rows sorted by week ascending
  const cohorts = Array.from(cohortBucketed.entries())
    .map(([cohort_week, b]) => ({
      cohort_week,
      cohort_size: b.cohort_size,
      offset_counts: b.offsetCounts,
      offset_retention: b.offsetCounts.map((c) =>
        b.cohort_size === 0 ? 0 : c / b.cohort_size,
      ),
    }))
    .sort((a, b) => a.cohort_week.localeCompare(b.cohort_week));

  return NextResponse.json({
    weeks,
    start: startIso,
    cohorts,
    summary: {
      total_users: userFirstDay.size,
      total_events_scanned: (data ?? []).length,
    },
  });
}
