/**
 * P2 (사용자 리포트 2026-07-27) — "일정 플래너 UI가 너무 복잡하고 조잡한 것 같다."
 *
 * 실측이 그 말을 뒷받침했다: 스톱 카드 한 장이 시각 입력 + 체류 셀렉트 + 전폭
 * 요청 입력 + ↑/↓/🗑 타일 세 개를 **항상** 펼쳐 두어 세로 ~430px였고, 네 스톱이면
 * 두 화면이었다.
 *
 * 접힌 행은 한 줄이고, 편집은 탭해서 펼치며, 순서·삭제는 앱이 이미 쓰는 ⋯ 시트로
 * 간다. 여기서 잠그는 것은 **밀도가 의견이 아니라 계약**이라는 점이다 — 컨트롤이
 * 슬그머니 행으로 돌아오면 실패한다.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const STOPS = [
  { id: 'a', seq: 1, source: 'poi', poi_key: 'seongsan_ilchulbong', name_i18n: { en: 'Seongsan Ilchulbong' }, duration_min: 90, arrival_planned: '09:00' },
  { id: 'b', seq: 2, source: 'poi', poi_key: 'seopjikoji', name_i18n: { en: 'Seopjikoji' }, duration_min: 60, arrival_planned: null },
  { id: 'c', seq: 3, source: 'poi', poi_key: 'udo_island', name_i18n: { en: 'Udo Island' }, duration_min: 60, arrival_planned: null },
];

const PLAN = {
  source: 'tour_schedule',
  schedule: [],
  day_plan: {
    status: 'guest_draft',
    stops: STOPS,
    needs: { adults: 2, children: 0, pace: 'standard' },
    feasibility: { warnings: [] },
    version: 1,
  },
  viewer: { role: 'customer', is_lead: true, can_edit: true },
  tour: { date: '2026-07-28', region: 'jeju', total_hours: 9, guide_curated: false, is_private: true },
};

function installFetch() {
  const puts: Array<Record<string, unknown>> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/plan/templates')) return jsonResponse({ region: 'jeju', templates: [] });
    if (url.includes('/api/itinerary-builder/pois')) return jsonResponse({ pois: [] });
    if (url.includes('/tour-itinerary')) return jsonResponse({ stops: [] });
    if (url.includes('/plan') && method === 'PUT') {
      puts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return jsonResponse({ day_plan: { ...PLAN.day_plan, version: 2 }, feasibility: { warnings: [] } });
    }
    if (url.includes('/plan')) return jsonResponse(PLAN);
    return jsonResponse({});
  }) as jest.Mock;
  return { puts };
}

async function renderPlanner() {
  render(<PlanEditorClient bookingId="booking-1" />);
  await screen.findByText('Plan your tour day');
  await waitFor(() => expect(screen.getByTestId('plan-stop-row-1')).toBeInTheDocument());
}

beforeEach(() => {
  // jsdom에는 Element.scrollTo가 없다. TimeWheel은 선택 값으로 다이얼을 굴리므로
  // 폴리필이 없으면 컴포넌트가 아니라 환경 때문에 터진다.
  if (!('scrollTo' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollTo', { value: () => {}, writable: true });
  }
  useTourRoomSessionMock.mockReturnValue({
    state: { status: 'joined' },
    join: jest.fn(async () => ({ participant: { locale: 'en' } })),
    roomSession: 'room-session',
  });
});
afterEach(() => jest.restoreAllMocks());

describe('🔴 P2 — 접힌 행은 한 줄이다', () => {
  it('행에는 시각·체류·요청 컨트롤이 없다 — 탭해야 나온다', async () => {
    installFetch();
    await renderPlanner();

    // 어느 스톱도 펼쳐져 있지 않다.
    expect(screen.queryByTestId('plan-stop-detail-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('plan-stop-detail-2')).not.toBeInTheDocument();
    // 그러므로 편집 컨트롤도 화면에 없다.
    expect(screen.queryByPlaceholderText(/Request for this stop/i)).not.toBeInTheDocument();
  });

  it('요약 한 줄에 시각과 체류가 함께 보인다 — 펼치지 않아도 읽힌다', async () => {
    installFetch();
    await renderPlanner();

    const row = screen.getByTestId('plan-stop-row-1');
    expect(within(row).getByText('Seongsan Ilchulbong')).toBeInTheDocument();
    expect(within(row).getByText(/09:00/)).toBeInTheDocument();
    expect(within(row).getByText(/90/)).toBeInTheDocument();
  });

  it('탭하면 그 스톱만 펼쳐지고, 다른 스톱은 접힌 채다', async () => {
    installFetch();
    await renderPlanner();

    fireEvent.click(screen.getByTestId('plan-stop-row-2'));

    expect(await screen.findByTestId('plan-stop-detail-2')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-stop-detail-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('plan-stop-detail-3')).not.toBeInTheDocument();
    // 펼친 뒤에야 편집 컨트롤이 있다.
    expect(screen.getByPlaceholderText(/Request for this stop/i)).toBeInTheDocument();
  });

  it('한 번에 하나만 펼쳐진다 — 다시 접히지 않으면 밀도가 무너진다', async () => {
    installFetch();
    await renderPlanner();

    fireEvent.click(screen.getByTestId('plan-stop-row-1'));
    expect(await screen.findByTestId('plan-stop-detail-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('plan-stop-row-3'));
    expect(await screen.findByTestId('plan-stop-detail-3')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-stop-detail-1')).not.toBeInTheDocument();
  });
});

describe('P2 — 순서·삭제는 ⋯ 시트로', () => {
  it('행에는 ↑/↓/🗑 타일이 없다', async () => {
    installFetch();
    await renderPlanner();
    expect(screen.queryByLabelText('Remove stop')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Move up')).not.toBeInTheDocument();
  });

  it('⋯ 를 열면 위로·아래로·삭제가 있고, 첫 스톱은 위로가 잠긴다', async () => {
    installFetch();
    await renderPlanner();

    fireEvent.click(screen.getByTestId('plan-stop-actions-1'));

    expect(await screen.findByTestId('plan-stop-move-up')).toBeDisabled();
    expect(screen.getByTestId('plan-stop-move-down')).toBeEnabled();
    expect(screen.getByTestId('plan-stop-remove')).toBeInTheDocument();
  });

  it('시트에서 아래로 옮기면 순서가 바뀌고 시트가 닫힌다', async () => {
    installFetch();
    await renderPlanner();

    fireEvent.click(screen.getByTestId('plan-stop-actions-1'));
    fireEvent.click(await screen.findByTestId('plan-stop-move-down'));

    await waitFor(() => expect(screen.queryByTestId('plan-stop-move-down')).not.toBeInTheDocument());
    expect(within(screen.getByTestId('plan-stop-row-1')).getByText('Seopjikoji')).toBeInTheDocument();
    expect(within(screen.getByTestId('plan-stop-row-2')).getByText('Seongsan Ilchulbong')).toBeInTheDocument();
  });
});

/**
 * P3 — `<input type="time">` renders in the DEVICE locale, which is how an
 * English planner showed "오후 9:01" on the owner's Korean phone, and it draws
 * OS chrome inside an app that has its own. Times now go through the app's
 * TimeWheel, in a sheet.
 */
describe('P3 — 시간 입력은 앱의 다이얼로', () => {
  it('플래너에 네이티브 시간 입력이 없다', async () => {
    installFetch();
    await renderPlanner();
    fireEvent.click(screen.getByTestId('plan-stop-row-1'));
    await screen.findByTestId('plan-stop-detail-1');

    const natives = document.querySelectorAll('input[type="time"]');
    expect(natives).toHaveLength(0);
  });

  it('시각 칩을 누르면 다이얼 시트가 열리고, 고른 값이 행 요약에 반영된다', async () => {
    installFetch();
    await renderPlanner();
    fireEvent.click(screen.getByTestId('plan-stop-row-2'));
    fireEvent.click(await screen.findByTestId('plan-stop-time-2'));

    expect(await screen.findByTestId('plan-time-wheel')).toBeInTheDocument();
    expect(screen.getByTestId('plan-time-clear')).toBeInTheDocument();
  });

  it('출발 시각도 같은 다이얼을 쓴다 — 화면에 입력 문법이 두 벌이면 안 된다', async () => {
    installFetch();
    await renderPlanner();

    fireEvent.click(screen.getByTestId('plan-departure-time'));
    expect(await screen.findByTestId('plan-time-wheel')).toBeInTheDocument();
  });
});
