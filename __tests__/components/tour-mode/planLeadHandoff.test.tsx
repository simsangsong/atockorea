/**
 * P1 (사용자 리포트 2026-07-27) — "저장하면 Couldn't save".
 *
 * 대표자가 아닌 기기의 저장은 **영구히** 403이다. 예전 화면은 그걸 일반 실패로
 * 떨어뜨려 "다음 수정 때 다시 시도해요"를 보여줬다 — 아무리 고쳐도 저장되지
 * 않으므로 거짓말이었다.
 *
 * 그리고 읽기전용으로 바꾸기만 하면 더 나쁜 상황이 된다: 혼자 여행하는 사람이
 * 브라우저로 참가한 뒤 PWA로 열면 스토리지가 달라 새 참가자가 되고, **자기
 * 예약에서 영구히 잠긴다**. 그래서 인계 버튼이 같이 있어야 한다(P-D19).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlanEditorClient from '@/components/tour-mode/plan/PlanEditorClient';
import { useTourRoomSession } from '@/hooks/useTourRoomSession';

jest.mock('@/hooks/useTourRoomSession', () => ({ useTourRoomSession: jest.fn() }));
jest.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: false, loadError: undefined }),
}));

const useTourRoomSessionMock = useTourRoomSession as jest.Mock;

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const BASE_PLAN = {
  source: 'tour_schedule',
  schedule: [],
  day_plan: {
    status: 'guest_draft',
    stops: [],
    needs: { adults: 2, children: 0, pace: 'standard' },
    feasibility: { warnings: [] },
    version: 1,
  },
  tour: { date: '2026-07-28', region: 'jeju', total_hours: 9, guide_curated: false, is_private: true },
};
const AS_LEAD = { ...BASE_PLAN, viewer: { role: 'customer', is_lead: true, can_edit: true } };
const AS_MEMBER = { ...BASE_PLAN, viewer: { role: 'customer', is_lead: false, can_edit: false } };

/**
 * 편집자로 열렸다가, 저장 시점에는 다른 기기가 편집자가 되어 있는 상태.
 * (같은 사람이 다른 브라우저/PWA로 다시 들어온 실제 경로다.)
 */
function installFetch(options: { claimSucceeds?: boolean } = {}) {
  const calls: string[] = [];
  let leadElsewhere = false;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url.includes('/plan/templates')) return jsonResponse({ region: 'jeju', templates: [] });
    if (url.includes('/api/itinerary-builder/pois')) return jsonResponse({ pois: [] });
    if (url.includes('/tour-itinerary')) return jsonResponse({ stops: [] });
    if (url.includes('/plan/claim-lead')) {
      if (!options.claimSucceeds) return jsonResponse({ error: 'companion_cannot_lead' }, 403);
      leadElsewhere = false;
      return jsonResponse({ ok: true, already_lead: false });
    }
    if (url.includes('/plan') && method === 'PUT') {
      leadElsewhere = true;
      return jsonResponse({ error: 'lead_guest_only' }, 403);
    }
    if (url.includes('/plan')) return jsonResponse(leadElsewhere ? AS_MEMBER : AS_LEAD);
    return jsonResponse({});
  }) as jest.Mock;
  return { calls };
}

async function renderPlanner() {
  render(<PlanEditorClient bookingId="booking-1" />);
  await screen.findByText('Plan your tour day');
}

beforeEach(() => {
  useTourRoomSessionMock.mockReturnValue({
    state: { status: 'joined' },
    join: jest.fn(async () => ({ participant: { locale: 'en' } })),
    roomSession: 'room-session',
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('🔴 P1 — 403은 "다시 시도"가 아니다', () => {
  it('저장이 403이면 서버 진실을 다시 읽고 읽기전용으로 바꾼다', async () => {
    installFetch();
    await renderPlanner();

    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Adults'), { target: { value: '3' } });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    jest.useRealTimers();

    // 🔴 영구 실패에 "다음 수정 때 다시 시도해요"를 보여주면 안 된다.
    await waitFor(() =>
      expect(screen.queryByText(/Couldn’t save|Couldn't save/i)).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/Only the lead traveller can edit/i)).toBeInTheDocument();
  });

  it('막다른 골목을 만들지 않는다 — 인계 버튼이 같이 있다', async () => {
    installFetch();
    await renderPlanner();

    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Adults'), { target: { value: '3' } });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    jest.useRealTimers();

    expect(await screen.findByTestId('plan-claim-lead')).toBeInTheDocument();
  });

  it('인계에 성공하면 다시 편집할 수 있다', async () => {
    const { calls } = installFetch({ claimSucceeds: true });
    await renderPlanner();

    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Adults'), { target: { value: '3' } });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    jest.useRealTimers();

    fireEvent.click(await screen.findByTestId('plan-claim-lead'));

    await waitFor(() =>
      expect(screen.queryByText(/Only the lead traveller can edit/i)).not.toBeInTheDocument(),
    );
    expect(calls.some((c) => c.startsWith('POST') && c.includes('/plan/claim-lead'))).toBe(true);
  });
});
