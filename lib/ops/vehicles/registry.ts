/**
 * 차량 마스터 헬퍼 — 관제 W1 (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §2).
 *
 * 이 파일이 존재하는 이유는 **번호판 정규화가 한 곳에만 있어야 하기 때문**이다.
 * '12가3456', '12가 3456', '12 가 3456'은 사람에게는 같은 차지만 문자열로는 세 대다.
 * 정규화 지점이 두 곳이 되는 순간 "같은 차가 같은 날 두 번 배차됐는가"라는 질문의
 * 답이 호출 경로마다 달라진다 — 그것이 이 트랙이 막으려는 사고다.
 *
 * 여기 있는 함수는 전부 순수하다. 조회·저장은 라우트가 한다.
 */

export const VEHICLES_TENANT_ID = 'atockorea';

export const VEHICLE_SELECT_COLUMNS =
  'id, tenant_id, plate_number, layout_id, nickname, seat_capacity, driver_name, driver_phone, active, note, created_at, updated_at';

export interface VehicleRow {
  id: string;
  tenant_id: string;
  plate_number: string;
  layout_id: string | null;
  nickname: string | null;
  seat_capacity: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 번호판 정규화 — 공백·하이픈·점을 제거하고 대문자로. 한글은 그대로 둔다.
 *
 * 전각 숫자/영문(１２ＡＢ)은 반각으로 접는다. 모바일 IME에서 실제로 들어오고,
 * 접지 않으면 같은 차가 두 행이 된다.
 */
export function normalizePlate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const folded = input.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  const stripped = folded.replace(/[\s\-.]/g, '').toUpperCase();
  return stripped ? stripped : null;
}

/**
 * 표시용 번호판. 저장은 정규화된 값이지만 화면에는 마지막 4자리 앞에 공백을 넣어
 * 읽기 쉽게 보여준다 ('12가3456' → '12가 3456'). 규칙에 맞지 않으면 원본 그대로.
 */
export function formatPlate(plate: string | null | undefined): string {
  if (!plate) return '';
  const m = plate.match(/^(\d{2,3}[가-힣])(\d{4})$/);
  return m ? `${m[1]} ${m[2]}` : plate;
}

/**
 * 이 차량의 정원. 설계 결정 2 — `seat_capacity`가 있으면 그것이 이기고, 없으면
 * 배치도의 `total_seats`를 상속한다. 둘 다 없으면 **0이 아니라 null**이다:
 * "정원 미상"을 0으로 표현하면 정원 검증이 모든 배차를 초과로 판정한다.
 */
export function resolveSeatCapacity(
  vehicle: Pick<VehicleRow, 'seat_capacity'> | null | undefined,
  layoutTotalSeats: number | null | undefined,
): number | null {
  const own = vehicle?.seat_capacity;
  if (typeof own === 'number' && Number.isFinite(own) && own > 0) return Math.floor(own);
  if (typeof layoutTotalSeats === 'number' && Number.isFinite(layoutTotalSeats) && layoutTotalSeats > 0) {
    return Math.floor(layoutTotalSeats);
  }
  return null;
}

export interface VehicleWriteInput {
  plateNumber?: unknown;
  layoutId?: unknown;
  nickname?: unknown;
  seatCapacity?: unknown;
  driverName?: unknown;
  driverPhone?: unknown;
  active?: unknown;
  note?: unknown;
}

export type VehicleWriteError =
  | 'plate_required'
  | 'plate_invalid'
  | 'seat_capacity_invalid'
  | 'layout_id_invalid';

export type VehicleWriteResult =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; code: VehicleWriteError; message: string };

const MESSAGES: Record<VehicleWriteError, string> = {
  plate_required: '차량 번호를 입력해 주세요.',
  plate_invalid: '차량 번호에 사용할 수 있는 문자가 없어요. (예: 12가3456)',
  seat_capacity_invalid: '좌석수는 1 이상의 정수여야 해요. 비워두면 배치도 좌석수를 따릅니다.',
  layout_id_invalid: '배치도 값이 올바르지 않아요.',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function boolOrUndefined(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * 저장 필드 조립. `mode: 'create'`는 번호판을 요구하고, `'update'`는 준 것만 패치한다.
 *
 * `seatCapacity`를 빈 문자열/null로 보내면 **NULL로 되돌린다**(= 배치도 상속). 0은
 * 거부한다 — "정원 0인 차"는 존재하지 않고, 대개 빈 칸을 0으로 보낸 실수다.
 */
export function buildVehicleWrite(input: VehicleWriteInput, mode: 'create' | 'update'): VehicleWriteResult {
  const fields: Record<string, unknown> = {};

  if (mode === 'create' || input.plateNumber !== undefined) {
    const raw = typeof input.plateNumber === 'string' ? input.plateNumber.trim() : '';
    if (!raw) return { ok: false, code: 'plate_required', message: MESSAGES.plate_required };
    const plate = normalizePlate(raw);
    if (!plate) return { ok: false, code: 'plate_invalid', message: MESSAGES.plate_invalid };
    fields.plate_number = plate;
  }

  if (input.layoutId !== undefined) {
    const layoutId = nullableText(input.layoutId);
    if (layoutId && !UUID_RE.test(layoutId)) {
      return { ok: false, code: 'layout_id_invalid', message: MESSAGES.layout_id_invalid };
    }
    fields.layout_id = layoutId ?? null;
  }

  const nickname = nullableText(input.nickname);
  if (nickname !== undefined) fields.nickname = nickname;
  const driverName = nullableText(input.driverName);
  if (driverName !== undefined) fields.driver_name = driverName;
  const driverPhone = nullableText(input.driverPhone);
  if (driverPhone !== undefined) fields.driver_phone = driverPhone;
  const note = nullableText(input.note);
  if (note !== undefined) fields.note = note;

  if (input.seatCapacity !== undefined) {
    const raw = input.seatCapacity;
    if (raw === null || raw === '') {
      fields.seat_capacity = null;
    } else {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        return { ok: false, code: 'seat_capacity_invalid', message: MESSAGES.seat_capacity_invalid };
      }
      fields.seat_capacity = n;
    }
  }

  const active = boolOrUndefined(input.active);
  if (active !== undefined) fields.active = active;

  if (mode === 'update') fields.updated_at = new Date().toISOString();
  return { ok: true, fields };
}
