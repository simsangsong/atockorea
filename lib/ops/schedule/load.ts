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
 *
 * 🔴 **행의 단위는 등록 차량이 아니라 "차량 타입"이 기본이다.** 이 운영은 차를
 * 소유하지 않고 매번 렌트한다. 등록 차량만 행으로 세우면 이 달력은 영구히 비어
 * 있고, 배차는 전부 '미배정'으로 떨어져 아무 질문에도 답하지 못한다.
 *
 * 타입 행이면 답이 나온다: **"8월 3일에 카운티 2대, 쏠라티 1대"** — 렌트 예약을
 * 걸 때 필요한 바로 그 숫자다. 등록 차량이 있으면 그 행이 따로 서고(그 차는 한
 * 대이므로 중복 배차 감지가 계속 유효하다), 없으면 타입 행이 받는다.
 */
async function loadVehicleAxis(
  supabase: SupabaseClient,
  period: string,
  today?: string,
): Promise<LoadedSchedule & { undatedCount: number }> {
  const { first, last } = periodBounds(period);

  const [vehiclesRes, roomsRes, groupsRes, layoutsRes] = await Promise.all([
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
    // 타입 행의 라벨·좌석수. 렌트 운영에서 이게 달력의 주 축이다.
    supabase.from('ops_vehicle_layouts').select('id, model, display_name, total_seats').limit(200),
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
          layout_id: string | null;
        }>);

  const vehicles = (vehiclesRes.data ?? []) as Array<{
    id: string;
    plate_number: string;
    nickname: string | null;
    seat_capacity: number | null;
    active: boolean;
  }>;
  const layouts = (layoutsRes.data ?? []) as Array<{
    id: string;
    model: string;
    display_name: Record<string, string> | null;
    total_seats: number | null;
  }>;
  const layoutById = new Map(layouts.map((l) => [l.id, l]));

  // 등록 차량은 한 대짜리 행(중복 배차 감지 유효), 타입은 종류 행(2대는 정상).
  const subjects: ScheduleSubject[] = [
    ...vehicles.map((v) => ({
      id: v.id,
      label: formatPlate(v.plate_number),
      sublabel: v.nickname,
      active: v.active,
      kind: 'instance' as const,
    })),
    ...layouts.map((l) => ({
      id: l.id,
      label: l.display_name?.ko || l.display_name?.en || l.model,
      sublabel: l.total_seats ? `${l.total_seats}석` : null,
      active: true,
      kind: 'class' as const,
    })),
  ];

  let undatedCount = 0;
  const items: ScheduleItem[] = [];
  for (const d of dispatches) {
    const date = (d.room_id ? roomDates.get(d.room_id) : null) ?? (d.group_id ? groupDates.get(d.group_id) : null);
    if (!date) {
      undatedCount += 1;
      continue;
    }
    // 등록 차량에 연결됐으면 그 차 행, 아니면 **타입 행**. 번호판 텍스트로
    // 차 행에 억지로 붙이지는 않는다 — 문자열 매칭은 오배차를 만든다.
    const subjectId = d.vehicle_id ?? (d.layout_id && layoutById.has(d.layout_id) ? d.layout_id : null);
    const typeLabel = d.layout_id ? layoutById.get(d.layout_id) : undefined;
    items.push({
      id: d.id,
      date,
      subjectId,
      // 번호판을 모르는 배차(렌트 예약 전)는 타입 이름으로 보인다 — 빈 칸보다 낫다.
      label:
        (d.plate_number ? formatPlate(d.plate_number) : null) ??
        d.driver_name ??
        (typeLabel ? typeLabel.display_name?.ko || typeLabel.model : null) ??
        '배차',
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
