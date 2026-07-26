/**
 * 배차 폼 — **렌트 운영이 기본 동선**이다.
 *
 * 이 운영은 차를 소유하지 않는다. 매번 렌트하고 차량 정보가 매번 바뀌므로, 배차
 * 시점에 확정된 것은 차종·좌석수뿐이고 번호판은 대개 당일에야 나온다.
 *
 * 이 스위트가 고정하는 계약:
 *   1. 타입만 골라도 배차가 완결된다(번호판·등록차량 없이).
 *   2. 번호판 칸은 **항상** 열려 있다 — 등록 차량을 골랐을 때도.
 *   3. 등록 차량이 0대면 그 피커를 아예 보여주지 않는다. 렌트 운영에서
 *      "등록된 차량이 없어요"는 고칠 것이 아니라 정상이고, 잔소리는 영구히 남는다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpsRoomVehiclePanel from '@/components/tour-ops/OpsRoomVehiclePanel';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/components/tour-ops/opsShared', () => ({ getOpsToken: async () => 'admin-token' }));

const LAYOUTS = [
  { id: 'lay-county', model: 'county_20', display_name: { ko: '카운티 20인승' }, total_seats: 20, is_verified: true },
  { id: 'lay-solati', model: 'solati_16', display_name: { ko: '쏠라티 15인승' }, total_seats: 13, is_verified: true },
];

const MASTER = {
  id: 'veh-1',
  plate_number: '12가3456',
  display_plate: '12가 3456',
  nickname: '자주 쓰는 렌트',
  layout_id: 'lay-county',
  capacity: 20,
  active: true,
};

function mockFetch(masterVehicles: unknown[]) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if ((init as RequestInit)?.method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ ok: true, id: 'rv-new' }) } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        room: { id: 'room-1', booking_id: 'bk-1', tour_id: 't1', tour_date: '2026-08-17' },
        capacity: null,
        vehicles: [],
        master_vehicles: masterVehicles,
        layouts: LAYOUTS,
        drivers: [],
      }),
    } as unknown as Response;
  });
}

const postBody = () => {
  const call = (global.fetch as jest.Mock).mock.calls.find(([, i]) => (i as RequestInit)?.method === 'POST');
  return JSON.parse((call![1] as RequestInit).body as string);
};

async function openForm(masterVehicles: unknown[] = []) {
  global.fetch = mockFetch(masterVehicles) as unknown as typeof fetch;
  render(<OpsRoomVehiclePanel roomId="room-1" />);
  await waitFor(() => expect(screen.getByText('차량 배정')).toBeInTheDocument());
  fireEvent.click(screen.getByText('차량 배정'));
  await waitFor(() => expect(screen.getByTestId('new-vehicle-type-select')).toBeInTheDocument());
}

beforeEach(() => jest.clearAllMocks());

it('dispatches on the type alone — no plate, no registered vehicle', async () => {
  await openForm();
  fireEvent.change(screen.getByTestId('new-vehicle-type-select'), { target: { value: 'lay-solati' } });
  fireEvent.click(screen.getByText('배정하기'));

  await waitFor(() => expect(postBody().layout_id).toBe('lay-solati'));
  expect(postBody().plate_number).toBe('');
  expect(postBody().master_vehicle_id).toBeNull();
});

it('never nags about registering a vehicle when none exist', async () => {
  await openForm();
  expect(screen.queryByTestId('master-vehicle-select')).not.toBeInTheDocument();
  expect(screen.queryByText(/차량을 먼저 등록/)).not.toBeInTheDocument();
});

it('keeps the plate field open even while a registered vehicle is picked', async () => {
  await openForm([MASTER]);
  fireEvent.change(screen.getByTestId('master-vehicle-select'), { target: { value: 'veh-1' } });
  // 번호판이 자동으로 채워지되 잠기지 않는다 — 당일 다른 차가 와도 고칠 수 있어야 한다.
  const plate = screen.getByTestId('vehicle-plate-input') as HTMLInputElement;
  await waitFor(() => expect(plate.value).toBe('12가 3456'));
  expect(plate).not.toBeDisabled();
});

it('unlinks the registered vehicle once the plate is edited to a different one', async () => {
  await openForm([MASTER]);
  fireEvent.change(screen.getByTestId('master-vehicle-select'), { target: { value: 'veh-1' } });
  fireEvent.change(screen.getByTestId('vehicle-plate-input'), { target: { value: '99하 1111' } });
  fireEvent.click(screen.getByText('배정하기'));

  await waitFor(() => expect(postBody().plate_number).toBe('99하 1111'));
  expect(postBody().master_vehicle_id).toBeNull();
});
