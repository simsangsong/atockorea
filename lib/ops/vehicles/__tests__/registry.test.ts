/**
 * 차량 마스터 순수 로직 — 관제 W1.
 *
 * 여기서 지키는 불변식은 하나다: **같은 차는 하나의 문자열이 된다.** 정규화가
 * 갈라지면 UNIQUE(tenant_id, plate_number)가 무의미해지고, 중복 배차 감지는
 * 조용히 아무것도 잡지 못한다 — 실패했다는 신호도 없이.
 */

import {
  buildVehicleWrite,
  formatPlate,
  normalizePlate,
  readMasterVehicleRef,
  resolveDispatchVehicle,
  resolveSeatCapacity,
} from '../registry';

describe('normalizePlate', () => {
  it('folds the spacings a human would actually type into one string', () => {
    const variants = ['12가3456', '12가 3456', '12 가 3456', '12-가-3456', ' 12가3456 '];
    const normalized = variants.map(normalizePlate);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe('12가3456');
  });

  it('folds full-width digits from mobile IMEs', () => {
    expect(normalizePlate('１２가３４５６')).toBe('12가3456');
  });

  it('uppercases latin so 12ab3456 and 12AB3456 are one vehicle', () => {
    expect(normalizePlate('12ab3456')).toBe('12AB3456');
  });

  it('returns null for input with nothing left after stripping', () => {
    expect(normalizePlate('   ')).toBeNull();
    expect(normalizePlate('---')).toBeNull();
    expect(normalizePlate(42)).toBeNull();
    expect(normalizePlate(null)).toBeNull();
  });
});

describe('formatPlate', () => {
  it('re-inserts the reading space for korean plates', () => {
    expect(formatPlate('12가3456')).toBe('12가 3456');
    expect(formatPlate('123가4567')).toBe('123가 4567');
  });

  it('leaves anything that is not the standard shape alone', () => {
    expect(formatPlate('12AB3456')).toBe('12AB3456');
    expect(formatPlate('')).toBe('');
    expect(formatPlate(null)).toBe('');
  });
});

describe('resolveSeatCapacity', () => {
  it('prefers the vehicle override over the layout', () => {
    expect(resolveSeatCapacity({ seat_capacity: 18 }, 20)).toBe(18);
  });

  it('inherits the layout when the vehicle has no override', () => {
    expect(resolveSeatCapacity({ seat_capacity: null }, 20)).toBe(20);
  });

  it('is null — not 0 — when neither is known', () => {
    // 0을 돌려주면 정원 검증이 "모든 배차가 초과"라고 말한다. 미상은 미상이어야 한다.
    expect(resolveSeatCapacity({ seat_capacity: null }, null)).toBeNull();
    expect(resolveSeatCapacity(null, undefined)).toBeNull();
  });

  it('ignores nonsense values rather than trusting them', () => {
    expect(resolveSeatCapacity({ seat_capacity: 0 }, 20)).toBe(20);
    expect(resolveSeatCapacity({ seat_capacity: -3 }, null)).toBeNull();
  });
});

describe('buildVehicleWrite', () => {
  it('normalises the plate on the way in', () => {
    const built = buildVehicleWrite({ plateNumber: '12가 3456' }, 'create');
    expect(built).toMatchObject({ ok: true });
    if (built.ok) expect(built.fields.plate_number).toBe('12가3456');
  });

  it('requires a plate on create', () => {
    const built = buildVehicleWrite({}, 'create');
    expect(built).toMatchObject({ ok: false, code: 'plate_required' });
  });

  it('rejects a plate that normalises to nothing', () => {
    const built = buildVehicleWrite({ plateNumber: ' -- ' }, 'create');
    expect(built).toMatchObject({ ok: false, code: 'plate_invalid' });
  });

  it('leaves untouched fields out of the patch on update', () => {
    const built = buildVehicleWrite({ nickname: '2호차' }, 'update');
    expect(built).toMatchObject({ ok: true });
    if (built.ok) {
      expect(built.fields).not.toHaveProperty('plate_number');
      expect(built.fields).not.toHaveProperty('active');
      expect(built.fields.nickname).toBe('2호차');
      expect(built.fields).toHaveProperty('updated_at');
    }
  });

  it('treats an empty seat capacity as "inherit the layout", not zero', () => {
    const built = buildVehicleWrite({ seatCapacity: '' }, 'update');
    expect(built).toMatchObject({ ok: true });
    if (built.ok) expect(built.fields.seat_capacity).toBeNull();
  });

  it('rejects a zero or fractional seat capacity', () => {
    expect(buildVehicleWrite({ seatCapacity: 0 }, 'update')).toMatchObject({
      ok: false,
      code: 'seat_capacity_invalid',
    });
    expect(buildVehicleWrite({ seatCapacity: 12.5 }, 'update')).toMatchObject({
      ok: false,
      code: 'seat_capacity_invalid',
    });
  });

  it('clears the nickname when sent an empty string but not when omitted', () => {
    const cleared = buildVehicleWrite({ nickname: '  ' }, 'update');
    expect(cleared).toMatchObject({ ok: true });
    if (cleared.ok) expect(cleared.fields.nickname).toBeNull();

    const untouched = buildVehicleWrite({ driverName: '김기사' }, 'update');
    expect(untouched).toMatchObject({ ok: true });
    if (untouched.ok) expect(untouched.fields).not.toHaveProperty('nickname');
  });

  it('rejects a layout id that is not a uuid', () => {
    expect(buildVehicleWrite({ layoutId: 'county_20' }, 'update')).toMatchObject({
      ok: false,
      code: 'layout_id_invalid',
    });
  });
});

/* ===========================================================================
 * 배차 인스턴스 ↔ 마스터 연결 (§2-1)
 * =========================================================================== */

const MASTER = {
  id: '11111111-1111-4111-8111-111111111111',
  plate_number: '12가3456',
  layout_id: '22222222-2222-4222-8222-222222222222',
  active: true,
};

describe('readMasterVehicleRef', () => {
  it('leaves the existing link alone when the key is absent', () => {
    expect(readMasterVehicleRef({ layout_id: 'x' })).toEqual({ present: false });
  });

  it('reads null and empty string as "unlink" (용차로 되돌림)', () => {
    expect(readMasterVehicleRef({ master_vehicle_id: null })).toEqual({ present: true, id: null });
    expect(readMasterVehicleRef({ master_vehicle_id: '' })).toEqual({ present: true, id: null });
  });

  it('rejects a value that is not a uuid instead of silently unlinking', () => {
    expect(readMasterVehicleRef({ master_vehicle_id: '12가3456' })).toMatchObject({
      error: expect.any(String),
    });
  });
});

describe('resolveDispatchVehicle', () => {
  /**
   * 🔴 이 운영은 차를 소유하지 않는다 — 매번 렌트하고 정보가 매번 바뀐다.
   * 그래서 **타입만으로 배차가 끝나야** 하고, 번호판·등록차량은 옵션이다.
   */
  it('dispatches on the type alone — plate and master are optional', () => {
    expect(resolveDispatchVehicle({ requestedLayoutId: 'layout-county' })).toEqual({
      ok: true,
      vehicleId: null,
      layoutId: 'layout-county',
      plateNumber: null,
    });
  });

  it('fills the plate from the master when it is left as-is', () => {
    expect(resolveDispatchVehicle({ master: MASTER })).toMatchObject({
      ok: true,
      vehicleId: MASTER.id,
      plateNumber: '12가 3456',
    });
    // 같은 번호를 다르게 띄어 쓴 것은 같은 차다 — 표기만 정규화하고 연결은 유지.
    expect(resolveDispatchVehicle({ master: MASTER, requestedPlate: '12가3456' })).toMatchObject({
      vehicleId: MASTER.id,
      plateNumber: '12가 3456',
    });
  });

  /**
   * 등록 차량은 지름길일 뿐이다. 번호가 다르면 그건 **다른 차**이고, 연결을 유지한
   * 채 번호만 다르게 두면 그때부터 마스터가 거짓말을 시작한다.
   */
  it('drops the master link when a different plate is given', () => {
    expect(resolveDispatchVehicle({ master: MASTER, requestedPlate: '99하 1111' })).toMatchObject({
      ok: true,
      vehicleId: null,
      plateNumber: '99하 1111',
    });
  });

  it('treats an empty plate as "not known yet", not as a contradiction', () => {
    expect(resolveDispatchVehicle({ master: MASTER, requestedPlate: '   ' })).toMatchObject({
      vehicleId: MASTER.id,
    });
  });

  it('inherits the master layout but lets an explicit choice win (좌석 뗀 날)', () => {
    const inherited = resolveDispatchVehicle({ master: MASTER });
    expect(inherited).toMatchObject({ ok: true, layoutId: MASTER.layout_id });

    const explicit = resolveDispatchVehicle({ master: MASTER, requestedLayoutId: 'layout-other' });
    expect(explicit).toMatchObject({ ok: true, layoutId: 'layout-other' });
  });

  it('refuses to dispatch a retired vehicle', () => {
    expect(resolveDispatchVehicle({ master: { ...MASTER, active: false } })).toMatchObject({
      ok: false,
      code: 'vehicle_inactive',
    });
  });

  it('asks for a layout when the master has none', () => {
    expect(resolveDispatchVehicle({ master: { ...MASTER, layout_id: null } })).toMatchObject({
      ok: false,
      code: 'layout_required',
    });
  });

  it('keeps the free-text plate path for 용차 (마스터 미등록은 의도된 폴백)', () => {
    const out = resolveDispatchVehicle({ requestedLayoutId: 'layout-a', requestedPlate: ' 99하 1111 ' });
    expect(out).toEqual({ ok: true, vehicleId: null, layoutId: 'layout-a', plateNumber: '99하 1111' });
  });

  it('requires a layout when there is no master to inherit one from', () => {
    expect(resolveDispatchVehicle({ requestedPlate: '99하1111' })).toMatchObject({
      ok: false,
      code: 'layout_required',
    });
  });
});
