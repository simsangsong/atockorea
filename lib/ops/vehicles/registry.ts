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

/* ===========================================================================
 * 배차 인스턴스 ↔ 차량 마스터 연결 (관제 후속 §2-1)
 *
 * 🔴 이름 충돌 경고. 두 개의 `vehicle_id`가 존재한다:
 *   · 배차 라우트의 요청 파라미터 `vehicle_id` = `ops_room_vehicles.id` (배차 행)
 *   · 컬럼 `ops_room_vehicles.vehicle_id`      = `ops_vehicles.id`      (마스터)
 * 그래서 마스터 참조는 요청 본문에서 **`master_vehicle_id`**라는 다른 이름을 쓴다.
 * 같은 이름 두 뜻을 라우트 경계에 두면 오배차가 조용히 일어난다.
 * =========================================================================== */

/** 요청 본문의 마스터 참조 키. 라우트·화면·테스트가 같은 상수를 본다. */
export const MASTER_VEHICLE_KEY = 'master_vehicle_id';

export interface DispatchVehicleInput {
  /**
   * 운영자가 고른 마스터 차량 행. null = 마스터 미연결(용차·대차) —
   * 그 폴백은 의도된 설계다(마이그레이션 설계 결정 1).
   */
  master?: Pick<VehicleRow, 'id' | 'plate_number' | 'layout_id' | 'active'> | null;
  /** 화면이 고른 배치도. 마스터 연결 시 비어 있으면 마스터의 배치도를 상속한다. */
  requestedLayoutId?: string | null;
  /** 마스터 미연결일 때의 자유 입력 번호판. */
  requestedPlate?: string | null;
}

export type DispatchVehicleResult =
  | { ok: true; vehicleId: string | null; layoutId: string; plateNumber: string | null }
  | { ok: false; code: 'vehicle_inactive' | 'layout_required'; message: string };

/**
 * 배차 행에 저장할 (마스터 참조, 배치도, 표시 번호판)을 한 번에 푼다.
 *
 * 🔴 **이 운영은 차를 소유하지 않는다 — 매번 렌트하고 차량 정보가 매번 바뀐다.**
 * 그래서 배차 시점에 확정된 것은 **타입(배치도)뿐**이고, 번호판은 대개 당일에야
 * 나온다. 타입만으로 배차가 끝나야 하고, 번호판은 언제 넣어도 되는 옵션이다.
 *
 * 설계:
 *   1. **타입이 필수, 나머지는 옵션.** 좌석수·좌석판·정원 판정이 전부 타입에서
 *      나오므로 타입만 있으면 배차는 완결이다.
 *   2. **등록 차량(마스터)은 지름길일 뿐이다.** 연결하면 번호판을 채워 주지만,
 *      **다른 번호판이 들어오면 연결을 끊는다** — 다른 번호는 다른 차이고, 연결을
 *      유지한 채 번호만 다르면 그때부터 마스터가 거짓말을 한다.
 *   3. **배치도는 상속하되 덮어쓸 수 있다.** 같은 차가 좌석을 떼고 운행하는 날이
 *      있고, 그날은 화면이 고른 타입이 이긴다.
 *   4. **운행 중지 차량은 거절한다.** 소프트 삭제된 차를 새로 배차하는 것은 거의
 *      항상 실수다. 이미 붙어 있던 배차는 건드리지 않는다(그건 과거 사실이다).
 */
export function resolveDispatchVehicle(input: DispatchVehicleInput): DispatchVehicleResult {
  const requestedLayoutId =
    typeof input.requestedLayoutId === 'string' && input.requestedLayoutId.trim()
      ? input.requestedLayoutId.trim()
      : null;
  const requestedPlate = typeof input.requestedPlate === 'string' ? input.requestedPlate.trim() : '';

  const master = input.master ?? null;
  // 설계 2 — 들어온 번호판이 마스터의 것과 다르면 그건 다른 차다. 연결을 끊고
  // 입력값을 그대로 쓴다(빈 값은 "아직 모름"이라 연결을 끊지 않는다).
  const plateContradictsMaster =
    Boolean(master) &&
    requestedPlate.length > 0 &&
    normalizePlate(requestedPlate) !== normalizePlate(master!.plate_number);

  if (master && !plateContradictsMaster) {
    if (master.active === false) {
      return {
        ok: false,
        code: 'vehicle_inactive',
        message: '운행 중지된 차량이에요. 차량 목록에서 다시 운행 중으로 바꾼 뒤 배차해 주세요.',
      };
    }
    const layoutId = requestedLayoutId ?? master.layout_id ?? null;
    if (!layoutId) {
      return {
        ok: false,
        code: 'layout_required',
        message: '차량 타입을 골라 주세요.',
      };
    }
    return {
      ok: true,
      vehicleId: master.id,
      layoutId,
      // 표시용 컬럼이므로 사람이 읽는 형태로 넣는다(정본은 마스터 행이다).
      plateNumber: formatPlate(master.plate_number) || null,
    };
  }

  // 마스터 미연결(렌트·용차·대차)이 **기본 경로**다. 타입만 있으면 배차는 끝난다.
  const layoutId = requestedLayoutId ?? master?.layout_id ?? null;
  if (!layoutId) {
    return { ok: false, code: 'layout_required', message: '차량 타입을 골라 주세요.' };
  }
  return { ok: true, vehicleId: null, layoutId, plateNumber: requestedPlate.slice(0, 32) || null };
}

/**
 * 요청 본문에서 `master_vehicle_id`를 읽는다.
 *   · 키 없음        → `{ present: false }` (기존 연결을 건드리지 않는다)
 *   · null/빈 문자열 → `{ present: true, id: null }` (연결 해제 = 용차로 되돌림)
 */
export function readMasterVehicleRef(
  body: Record<string, unknown>,
): { present: false } | { present: true; id: string | null } | { error: string } {
  if (!(MASTER_VEHICLE_KEY in body)) return { present: false };
  const raw = body[MASTER_VEHICLE_KEY];
  if (raw === null || raw === '') return { present: true, id: null };
  if (typeof raw !== 'string' || !UUID_RE.test(raw.trim())) {
    return { error: '차량 선택 값이 올바르지 않아요.' };
  }
  return { present: true, id: raw.trim() };
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
