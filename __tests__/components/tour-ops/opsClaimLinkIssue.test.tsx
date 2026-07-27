/**
 * DE1 (진입점 감사 2026-07-27) — 조인투어 일괄 초대 링크에는 발급 버튼이 있어야 한다.
 *
 * 발급 라우트(`claim-link`, QR까지 생성) · 손님 합류 화면(`JoinFlow` 568줄) ·
 * 명단에서 본인 고르기(`/api/ops/rooms/[roomId]/claim`) · 서명/검증 라이브러리가
 * 전부 완성돼 있었는데 **어떤 UI도 발급 라우트를 부르지 않았다.** 라이브 원장에서
 * `tour_room_invites` 57건 중 `role='room_claim'`이 0건이었던 이유다.
 *
 * 관제가 뽑을 수 있는 링크는 `/api/admin/tour-ops/links`뿐이었고 그건 **예약
 * 1건당** 토큰이다. 20명짜리 조인투어면 20번 발급해서 20번 보내야 했다.
 *
 * 이 스위트가 고정하는 것: 버튼이 존재하고, 그 룸의 claim-link 라우트를 POST로
 * 부르고, 발급된 링크와 QR을 화면에 남긴다(버스 앞에서 QR을 띄우는 게 실사용).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpsRoomVehiclePanel from '@/components/tour-ops/OpsRoomVehiclePanel';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/components/tour-ops/opsShared', () => ({ getOpsToken: async () => 'admin-token' }));

const CLAIM_URL = 'https://atockorea.com/tour-mode/join/tok-abc';

function mockFetch() {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/claim-link')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          url: CLAIM_URL,
          expires_at: '2026-08-18T14:59:00.000Z',
          qr_data_url: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        room: { id: 'room-1', booking_id: 'bk-1', tour_id: 't1', tour_date: '2026-08-17' },
        capacity: null,
        vehicles: [],
        master_vehicles: [],
        layouts: [],
        drivers: [],
      }),
    } as unknown as Response;
  });
}

async function renderPanel() {
  global.fetch = mockFetch() as unknown as typeof fetch;
  render(<OpsRoomVehiclePanel roomId="room-1" />);
  await waitFor(() => expect(screen.getByTestId('claim-link-section')).toBeInTheDocument());
}

describe('🔴 DE1 — 조인투어 일괄 초대는 관제에서 발급할 수 있어야 한다', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => undefined) } });
  });

  it('발급 버튼이 있다', async () => {
    await renderPanel();
    expect(screen.getByTestId('mint-claim-link')).toHaveTextContent('초대 링크 발급');
  });

  it('그 룸의 claim-link 라우트를 POST로 부른다', async () => {
    await renderPanel();
    fireEvent.click(screen.getByTestId('mint-claim-link'));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([u]) => String(u).includes('/claim-link'));
      expect(call).toBeTruthy();
      expect(String(call![0])).toContain('/api/admin/tour-ops/rooms/room-1/claim-link');
      expect((call![1] as RequestInit).method).toBe('POST');
    });
  });

  it('발급 후 링크와 QR이 화면에 남는다 — 버스 앞에서 띄워야 하므로', async () => {
    await renderPanel();
    fireEvent.click(screen.getByTestId('mint-claim-link'));
    await waitFor(() => expect(screen.getByTestId('claim-link-url')).toHaveTextContent(CLAIM_URL));
    expect(screen.getByAltText('초대 QR')).toBeInTheDocument();
    // 재발급은 기존 링크를 폐기하지 않는다 — 라벨이 그 사실과 어긋나면 안 된다.
    expect(screen.getByTestId('mint-claim-link')).toHaveTextContent('다시 발급');
  });
});
