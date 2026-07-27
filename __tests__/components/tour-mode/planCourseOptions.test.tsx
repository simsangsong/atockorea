/**
 * P0 (사용자 리포트 2026-07-27) — "제주 프라이빗 일정을 픽하니 동/서/남/커스텀
 * 코스 네 개가 관광지 네 곳으로 들어왔다."
 *
 * 전세 상품의 itineraryStops는 순차 정류지가 아니라 **하루에 하나 고르는 코스**다.
 * 플래너가 그 배열을 그대로 일정으로 가져오면 "코스 4개 선택"이 "관광지 4곳 방문"이
 * 된다. 여기서 잠그는 계약은 두 가지다:
 *   ① 코스 형태면 정류지 카드가 아니라 **코스 카드**를 그린다.
 *   ② 코스 하나를 고르면 그 코스의 **실제 장소들**이 정류지가 된다.
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

const DRAFT_PLAN = {
  source: 'tour_schedule',
  schedule: [],
  day_plan: {
    status: 'guest_draft',
    stops: [],
    needs: { adults: 2, children: 0, pace: 'standard' },
    feasibility: { warnings: [] },
    version: 1,
  },
  viewer: { role: 'customer', is_lead: true, can_edit: true },
  tour: { date: '2026-07-28', region: 'jeju', total_hours: 9, guide_curated: false, is_private: true },
};

/** 라이브 jeju-island-private-car-charter-tour 형태(time·duration 전무). */
const CHARTER_ITINERARY = {
  tourTitle: 'Jeju Private Car Charter',
  stops: [
    {
      number: 1,
      name: 'East Route: UNESCO & K-Drama Coast',
      _poi_meta: { constituent_pois: ['seongsan_ilchulbong', 'seopjikoji'] },
    },
    {
      number: 2,
      name: 'West Route: Beaches, Tea & Cafe Coast',
      _poi_meta: { constituent_pois: ['hyeopjae_beach'] },
    },
    {
      number: 3,
      name: 'Custom Route: Build Your Own Day',
      _poi_meta: { candidate_pois: ['sangumburi_crater'] },
    },
  ],
};

/** 정상 투어(시각·체류가 붙은 진짜 정류지 목록). */
const NORMAL_ITINERARY = {
  tourTitle: 'Jeju Southern UNESCO',
  stops: [
    { number: 1, name: 'Cheonjiyeon Falls', time: '09:30', duration: '60 min', _poi_meta: { poi_key: 'cheonjiyeon_falls' } },
    { number: 2, name: 'Jusangjeolli Cliff', time: '11:00', duration: '45 min', _poi_meta: { poi_key: 'jusangjeolli_cliff' } },
  ],
};

const POIS = [
  { poi_key: 'seongsan_ilchulbong', name_en: 'Seongsan Ilchulbong', lat: 33.45, lng: 126.94, default_stay_minutes: 90 },
  { poi_key: 'seopjikoji', name_en: 'Seopjikoji', lat: 33.42, lng: 126.93, default_stay_minutes: 60 },
  { poi_key: 'hyeopjae_beach', name_en: 'Hyeopjae Beach', lat: 33.39, lng: 126.24, default_stay_minutes: 60 },
  { poi_key: 'sangumburi_crater', name_en: 'Sangumburi Crater', lat: 33.43, lng: 126.68, default_stay_minutes: 60 },
];

function installFetch(itinerary: unknown) {
  const puts: Array<Record<string, unknown>> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/plan/templates')) return jsonResponse({ region: 'jeju', templates: [] });
    if (url.includes('/api/itinerary-builder/pois')) return jsonResponse({ pois: POIS });
    if (url.includes('/tour-itinerary')) return jsonResponse(itinerary);
    if (url.includes('/plan') && method === 'PUT') {
      puts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return jsonResponse({ day_plan: { ...DRAFT_PLAN.day_plan, version: 2 }, feasibility: { warnings: [] } });
    }
    if (url.includes('/plan')) return jsonResponse(DRAFT_PLAN);
    return jsonResponse({});
  }) as jest.Mock;
  return { puts };
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

describe('🔴 P0 — 전세 상품의 코스는 정류지가 아니다', () => {
  it('코스 선택지를 코스 카드로 그린다 — 정류지로 추가하는 화면이 아니다', async () => {
    installFetch(CHARTER_ITINERARY);
    await renderPlanner();

    await waitFor(() => expect(screen.getByTestId('plan-course-option-1')).toBeInTheDocument());
    expect(screen.getByTestId('plan-course-option-2')).toBeInTheDocument();
    expect(screen.getByTestId('plan-course-option-3')).toBeInTheDocument();
    expect(screen.getByText('Choose your route')).toBeInTheDocument();

    // 🔴 "이 일정으로 시작하기"(전체를 정류지로 붓는 버튼)가 있으면 안 된다 —
    //    그게 바로 코스 네 개를 관광지 네 곳으로 만들던 경로다.
    expect(screen.queryByText(/Start from this itinerary/i)).not.toBeInTheDocument();
  });

  it('코스를 고르면 그 코스의 실제 장소가 정류지가 된다', async () => {
    const { puts } = installFetch(CHARTER_ITINERARY);
    await renderPlanner();
    // 장소 목록이 도착해야 코스를 적용할 수 있다(그 전엔 버튼이 비활성이다).
    await waitFor(() => expect(screen.getByTestId('plan-course-apply-1')).toBeEnabled());

    // 자동저장은 디바운스된다(2.5초). 타이머는 클릭 **전에** 갈아끼워야 한다 —
    // 클릭 뒤에 바꾸면 실제 타이머로 예약된 저장은 영영 안 잡힌다.
    jest.useFakeTimers();
    fireEvent.click(screen.getByTestId('plan-course-apply-1'));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    jest.useRealTimers();

    // 코스 이름이 아니라 장소 이름이 일정에 들어간다. (이름은 피커 목록에도
    // 있으므로 복수 쿼리를 쓴다 — 단수 쿼리는 "여러 개 찾음"으로 실패한다.)
    expect(screen.getAllByText('Seongsan Ilchulbong').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Seopjikoji').length).toBeGreaterThan(0);
    expect(screen.queryByText(/East Route/)).not.toBeInTheDocument();

    expect(puts.length).toBeGreaterThan(0);
    const saved = puts.at(-1)!.stops as Array<{ poi_key?: string; title?: string }>;
    expect(saved.map((s) => s.poi_key)).toEqual(['seongsan_ilchulbong', 'seopjikoji']);
  });

  it('커스텀 코스는 정류지를 만들지 않고 고르는 화면으로 보낸다', async () => {
    const { puts } = installFetch(CHARTER_ITINERARY);
    await renderPlanner();
    await waitFor(() => expect(screen.getByTestId('plan-course-apply-3')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('plan-course-apply-3'));

    expect(await screen.findByPlaceholderText(/Search places/i)).toBeInTheDocument();
    expect(puts).toHaveLength(0); // 아무것도 저장하지 않는다
  });

  it('🔴 정상 투어는 예전 그대로 — 오분류하면 하루 일정이 통째로 사라진다', async () => {
    installFetch(NORMAL_ITINERARY);
    await renderPlanner();

    await waitFor(() => expect(screen.getByText(/Start from this itinerary/i)).toBeInTheDocument());
    expect(screen.queryByTestId('plan-course-option-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose your route')).not.toBeInTheDocument();
  });
});
