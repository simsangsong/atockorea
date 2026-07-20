import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlanEditorClient from '@/components/tour-mode/plan/PlanEditorClient';
import { useTourRoomSession } from '@/hooks/useTourRoomSession';

jest.mock('@/hooks/useTourRoomSession', () => ({ useTourRoomSession: jest.fn() }));
jest.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: false, loadError: undefined }),
}));

const useTourRoomSessionMock = useTourRoomSession as jest.Mock;

const TEMPLATE_STOP = {
  id: 'tpl-1',
  source: 'poi',
  poi_key: 'seongsan_ilchulbong',
  name_i18n: { en: 'Seongsan Ilchulbong' },
  stop_type: 'sight',
  duration_min: 90,
  lat: 33.458,
  lng: 126.942,
};

const EXISTING_STOP = {
  id: 'stop-1',
  source: 'poi',
  poi_key: 'seongsan_ilchulbong',
  name_i18n: { en: 'Seongsan Ilchulbong' },
  stop_type: 'sight',
  duration_min: 90,
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function planResponse(input?: {
  stops?: Array<Record<string, unknown>>;
  needs?: Record<string, unknown>;
  guideCurated?: boolean;
  status?: string;
  isPrivate?: boolean;
}) {
  return {
    source: 'tour_schedule',
    schedule: [],
    day_plan: {
      status: input?.status ?? 'guest_draft',
      stops: input?.stops ?? [],
      needs: input?.needs ?? { adults: 2, children: 0, pace: 'standard' },
      feasibility: { warnings: [] },
      version: 1,
    },
    viewer: { role: 'customer', is_lead: true, can_edit: true },
    // is_private true → the editable planner renders (fixed tours get a view-only
    // screen instead). Autosave tests exercise the editable path.
    tour: {
      date: '2026-07-14',
      region: 'jeju',
      total_hours: 9,
      guide_curated: input?.guideCurated ?? false,
      is_private: input?.isPrivate ?? true,
    },
  };
}

function installFetch(options?: {
  plan?: ReturnType<typeof planResponse>;
  putStatus?: number;
}) {
  const putBodies: Array<Record<string, unknown>> = [];
  const plan = options?.plan ?? planResponse();
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/plan/templates')) {
      return jsonResponse({
        region: 'jeju',
        templates: [{ id: 'course-1', title_i18n: { en: 'Jeju East Highlights' }, total_hours: 8, stops: [TEMPLATE_STOP] }],
      });
    }
    if (url.includes('/api/itinerary-builder/pois')) {
      return jsonResponse({ pois: [] });
    }
    if (url.includes('/plan') && method === 'PUT') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      putBodies.push(body);
      if (options?.putStatus === 429) return jsonResponse({ error: 'rate_limited', retry_after_ms: 30_000 }, 429);
      return jsonResponse({
        day_plan: {
          status: body.submit ? 'guest_submitted' : 'guest_draft',
          stops: body.stops,
          needs: body.needs,
          feasibility: { warnings: [] },
          version: 2,
        },
        feasibility: { warnings: [] },
      });
    }
    if (url.includes('/plan')) return jsonResponse(plan);
    return jsonResponse({});
  }) as jest.Mock;
  return putBodies;
}

async function renderPlanner() {
  render(<PlanEditorClient bookingId="booking-1" />);
  await screen.findByText('Plan your tour day');
}

async function flushAutosave() {
  await act(async () => {
    jest.advanceTimersByTime(2500);
  });
}

beforeEach(() => {
  useTourRoomSessionMock.mockReturnValue({
    state: { status: 'joined' },
    join: jest.fn(async () => ({ participant: { locale: 'en' } })),
    roomSession: 'room-session',
  });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('autosaves the latest needs snapshot, not the previous closure value', async () => {
  const putBodies = installFetch();
  await renderPlanner();
  jest.useFakeTimers();

  const adults = screen.getByLabelText('Adults');
  fireEvent.change(adults, { target: { value: '3' } });
  fireEvent.change(adults, { target: { value: '4' } });
  await flushAutosave();

  await waitFor(() => expect(putBodies).toHaveLength(1));
  expect(putBodies[0].needs).toMatchObject({ adults: 4 });
  expect(putBodies[0].stops).toEqual([]);
  expect(putBodies[0].stops_changed).toBeUndefined();
});

it('autosaves stops: [] when the last stop is removed', async () => {
  const putBodies = installFetch({ plan: planResponse({ stops: [EXISTING_STOP] }) });
  await renderPlanner();
  jest.useFakeTimers();

  fireEvent.click(screen.getByLabelText('Remove stop'));
  await flushAutosave();

  await waitFor(() => expect(putBodies).toHaveLength(1));
  expect(putBodies[0].stops).toEqual([]);
  expect(putBodies[0].stops_changed).toBe(true);
});

it('shows the 429 save retry state', async () => {
  installFetch({ putStatus: 429 });
  await renderPlanner();
  jest.useFakeTimers();

  fireEvent.change(screen.getByLabelText('Adults'), { target: { value: '5' } });
  await flushAutosave();

  expect(await screen.findByText(/Too many quick saves/i)).toBeInTheDocument();
});

it('prevents duplicate submits and refreshes into submitted state', async () => {
  const putBodies = installFetch({ plan: planResponse({ stops: [EXISTING_STOP] }) });
  await renderPlanner();

  const submit = screen.getByRole('button', { name: /Send to my guide/i });
  fireEvent.click(submit);
  fireEvent.click(submit);

  await waitFor(() => expect(putBodies).toHaveLength(1));
  expect(putBodies[0].submit).toBe(true);
  expect(await screen.findByText(/Sent to your guide/i)).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /Courses/i })).not.toBeInTheDocument();
});

it('clears delegated outcome when switching back to a direct course', async () => {
  const putBodies = installFetch({ plan: planResponse({ guideCurated: true }) });
  await renderPlanner();
  expect(screen.getByText(/left the course to your guide/i)).toBeInTheDocument();
  jest.useFakeTimers();

  fireEvent.click(screen.getByRole('button', { name: /Preview course/i }));
  fireEvent.click(screen.getByRole('button', { name: /Start with this course/i }));
  await flushAutosave();

  await waitFor(() => expect(putBodies).toHaveLength(1));
  expect(screen.queryByText(/left the course to your guide/i)).not.toBeInTheDocument();
  expect(putBodies[0]).toMatchObject({ stops: [expect.objectContaining({ poi_key: 'seongsan_ilchulbong' })] });
  expect(putBodies[0].stops_changed).toBe(true);
  expect(putBodies[0].delegate).toBeUndefined();
});

it('renders a view-only fixed itinerary (no edit tabs) for a non-private tour', async () => {
  installFetch({ plan: planResponse({ isPrivate: false }) });
  render(<PlanEditorClient bookingId="booking-1" />);

  await screen.findByText(/set route planned by our team/i);
  // Editable tabs are gone — the fixed tour's itinerary is view-only.
  expect(screen.queryByText('Pick places')).not.toBeInTheDocument();
});
