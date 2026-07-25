/**
 * 스케줄 매트릭스의 데이터 로더 — 관제 W4.
 *
 * 라우트 두 개(조회 / 내보내기)가 같은 데이터를 봐야 하므로 조회를 한 곳에 둔다.
 * 갈라지면 화면과 엑셀이 다른 숫자를 말하고, 그 순간 둘 다 못 믿게 된다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { formatPlate } from '@/lib/ops/vehicles/registry';
import {
  buildScheduleMatrix,
  periodBounds,
  type ScheduleAxis,
  type ScheduleItem,
  type ScheduleMatrix,
  type ScheduleSubject,
} from './matrix';

/** 한 달치 조회 상한. 닿으면 잘라내지 않고 보고한다. */
export const SCHEDULE_SCAN_LIMIT = 3000;

export interface LoadedSchedule {
  matrix: ScheduleMatrix;
  truncated: boolean;
}

/** 가이드 축 — 배정 원장 + 휴무. */
async function loadGuideAxis(
  supabase: SupabaseClient,
  period: string,
  today?: string,
): Promise<LoadedSchedule> {
  const { first, last } = periodBounds(period);

  const [guidesRes, assignmentsRes, restRes] = await Promise.all([
    supabase
      .from('ops_guides')
      .select('id, name, guide_type, active')
      .eq('tenant_id', OPS_TENANT_ID)
      .order('active', { ascending: false })
      .order('name', { ascending: true })
      .limit(500),
    supabase
      .from('ops_guide_assignments')
      .select('id, guide_id, tour_date, tour_type, status, start_time, end_time, conflict_override')
      .eq('tenant_id', OPS_TENANT_ID)
      .gte('tour_date', first)
      .lte('tour_date', last)
      .limit(SCHEDULE_SCAN_LIMIT),
    supabase
      .from('ops_guide_unavailable_dates')
      .select('guide_id, date')
      .eq('tenant_id', OPS_TENANT_ID)
      .gte('date', first)
      .lte('date', last)
      .limit(SCHEDULE_SCAN_LIMIT),
  ]);

  const guides = (guidesRes.data ?? []) as Array<{
    id: string;
    name: string;
    guide_type: string | null;
    active: boolean;
  }>;
  const assignments = (assignmentsRes.data ?? []) as Array<{
    id: string;
    guide_id: string;
    tour_date: string;
    tour_type: string;
    status: string;
    start_time: string | null;
    end_time: string | null;
  }>;
  const rest = (restRes.data ?? []) as Array<{ guide_id: string; date: string }>;

  const subjects: ScheduleSubject[] = guides.map((g) => ({
    id: g.id,
    label: g.name,
    sublabel: g.guide_type === 'driver' ? '기사' : g.guide_type === 'bus_guide' ? '안내' : g.guide_type ? '겸업' : null,
    active: g.active,
  }));

  const items: ScheduleItem[] = assignments.map((a) => ({
    id: a.id,
    date: a.tour_date,
    subjectId: a.guide_id,
    label: a.tour_type,
    startTime: a.start_time,
    endTime: a.end_time,
    status: a.status,
  }));

  return {
    matrix: buildScheduleMatrix({
      period,
      axis: 'guide',
      subjects,
      items,
      unavailable: rest.map((r) => ({ subjectId: r.guide_id, date: r.date })),
      today,
    }),
    truncated: assignments.length >= SCHEDULE_SCAN_LIMIT || rest.length >= SCHEDULE_SCAN_LIMIT,
  };
}

/**
 * 차량 축 — 배차 인스턴스.
 *
 * 날짜는 `ops_room_vehicles`에 없고 룸(`tour_rooms.tour_date`) 또는 그룹
 * (`ops_tour_groups.tour_date`)에서 온다. 둘 다 없는 배차 행은 달력에 놓을 자리가
 * 없으므로 제외하되, 몇 건이 그랬는지 보고한다 — 조용히 빠지면 "배차가 없다"로
 * 읽힌다.
 */
async function loadVehicleAxis(
  supabase: SupabaseClient,
  period: string,
  today?: string,
): Promise<LoadedSchedule & { undatedCount: number }> {
  const { first, last } = periodBounds(period);

  const [vehiclesRes, roomsRes, groupsRes] = await Promise.all([
    supabase
      .from('ops_vehicles')
      .select('id, plate_number, nickname, seat_capacity, active')
      .eq('tenant_id', OPS_TENANT_ID)
      .order('active', { ascending: false })
      .order('plate_number', { ascending: true })
      .limit(500),
    supabase
      .from('tour_rooms')
      .select('id, tour_date')
      .gte('tour_date', first)
      .lte('tour_date', last)
      .limit(SCHEDULE_SCAN_LIMIT),
    supabase
      .from('ops_tour_groups')
      .select('id, tour_date')
      .eq('tenant_id', OPS_TENANT_ID)
      .gte('tour_date', first)
      .lte('tour_date', last)
      .limit(SCHEDULE_SCAN_LIMIT),
  ]);

  const roomDates = new Map((((roomsRes.data ?? []) as Array<{ id: string; tour_date: string | null }>) ?? []).map((r) => [r.id, r.tour_date]));
  const groupDates = new Map((((groupsRes.data ?? []) as Array<{ id: string; tour_date: string | null }>) ?? []).map((g) => [g.id, g.tour_date]));

  const roomIds = [...roomDates.keys()];
  const groupIds = [...groupDates.keys()];

  // 룸·그룹 어느 쪽으로도 이 달에 속하는 배차만 가져온다. `or`는 두 in() 을
  // 한 번에 묻기 위한 것이고, 어느 쪽도 비면 그 절을 빼야 문법이 깨지지 않는다.
  const filters: string[] = [];
  if (roomIds.length) filters.push(`room_id.in.(${roomIds.join(',')})`);
  if (groupIds.length) filters.push(`group_id.in.(${groupIds.join(',')})`);

  const dispatches =
    filters.length === 0
      ? []
      : (((
          await supabase
            .from('ops_room_vehicles')
            .select('id, vehicle_id, room_id, group_id, plate_number, driver_name, layout_id')
            .eq('tenant_id', OPS_TENANT_ID)
            .or(filters.join(','))
            .limit(SCHEDULE_SCAN_LIMIT)
        ).data ?? []) as Array<{
          id: string;
          vehicle_id: string | null;
          room_id: string | null;
          group_id: string | null;
          plate_number: string | null;
          driver_name: string | null;
        }>);

  const vehicles = (vehiclesRes.data ?? []) as Array<{
    id: string;
    plate_number: string;
    nickname: string | null;
    seat_capacity: number | null;
    active: boolean;
  }>;

  const subjects: ScheduleSubject[] = vehicles.map((v) => ({
    id: v.id,
    label: formatPlate(v.plate_number),
    sublabel: v.nickname,
    active: v.active,
  }));

  let undatedCount = 0;
  const items: ScheduleItem[] = [];
  for (const d of dispatches) {
    const date = (d.room_id ? roomDates.get(d.room_id) : null) ?? (d.group_id ? groupDates.get(d.group_id) : null);
    if (!date) {
      undatedCount += 1;
      continue;
    }
    items.push({
      id: d.id,
      date,
      // 마스터 미등록(용차·대차)은 미배정 행으로 모인다 — 번호판 텍스트만 있는
      // 배차를 차량 행에 억지로 붙이면 문자열 매칭으로 오배차를 만들게 된다.
      subjectId: d.vehicle_id,
      label: d.plate_number ? formatPlate(d.plate_number) : (d.driver_name ?? '배차'),
      status: null,
    });
  }

  return {
    matrix: buildScheduleMatrix({ period, axis: 'vehicle', subjects, items, today }),
    truncated: dispatches.length >= SCHEDULE_SCAN_LIMIT,
    undatedCount,
  };
}

export async function loadSchedule(
  supabase: SupabaseClient,
  axis: ScheduleAxis,
  period: string,
  today?: string,
): Promise<LoadedSchedule & { undatedCount?: number }> {
  return axis === 'guide' ? loadGuideAxis(supabase, period, today) : loadVehicleAxis(supabase, period, today);
}

/** 매트릭스를 JSON 직렬화 가능한 모양으로. Map은 그대로 보내면 `{}`가 된다. */
export function serializeMatrix(matrix: ScheduleMatrix) {
  return {
    period: matrix.period,
    axis: matrix.axis,
    days: matrix.days,
    dayTotals: Object.fromEntries(matrix.dayTotals),
    rows: [...matrix.rows, ...(matrix.unassigned ? [matrix.unassigned] : [])].map((row) => ({
      subject: row.subject,
      total: row.total,
      issueCount: row.issueCount,
      cells: Object.fromEntries(row.cells),
    })),
  };
}
