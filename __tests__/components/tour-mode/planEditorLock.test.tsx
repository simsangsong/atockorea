/**
 * §D A1.5 P1 — the plan was confirmed underneath an open editor.
 *
 * 🔴 The guide confirms in the console while the guest is still editing on the
 * phone. Every autosave then gets 409 `plan_locked`. Before this fix the guest
 * saw a generic "Couldn't save" line under a screen that still looked fully
 * editable, and kept adding stops that could never be stored — the editor was
 * lying about being an editor.
 *
 * Re-reading the plan on 409 is what makes the screen honest: it flips to the
 * read-only view and shows `confirmedNote`, which already exists in 5 locales
 * for exactly this case.
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
  tour: { date: '2026-07-14', region: 'jeju', total_hours: 9, guide_curated: false, is_private: true },
};

/** What the server returns once the guide has confirmed. */
const CONFIRMED_PLAN = {
  ...DRAFT_PLAN,
  day_plan: { ...DRAFT_PLAN.day_plan, status: 'guide_confirmed', version: 2 },
  viewer: { role: 'customer', is_lead: true, can_edit: false },
};

/**
 * The plan is a draft on load and confirmed from the first PUT onwards — the
 * race this test exists for.
 */
function installFetch(options?: { lock?: boolean }) {
  const puts: Array<Record<string, unknown>> = [];
  const gets: string[] = [];
  let locked = false;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/plan/templates')) return jsonResponse({ region: 'jeju', templates: [] });
    if (url.includes('/api/itinerary-builder/pois')) return jsonResponse({ pois: [] });
    if (url.includes('/plan') && method === 'PUT') {
      puts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      if (options?.lock) {
        locked = true;
        return jsonResponse({ error: 'plan_locked' }, 409);
      }
      return jsonResponse({
        day_plan: { ...DRAFT_PLAN.day_plan, version: 2 },
        feasibility: { warnings: [] },
      });
    }
    if (url.includes('/plan')) {
      gets.push(url);
      return jsonResponse(locked ? CONFIRMED_PLAN : DRAFT_PLAN);
    }
    return jsonResponse({});
  }) as jest.Mock;
  return { puts, gets };
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

describe('🔴 409 plan_locked — the screen must stop pretending to be an editor', () => {
  it('adopts the confirmed plan and tells the guest to use the chat', async () => {
    installFetch({ lock: true });
    await renderPlanner();
    jest.useFakeTimers();

    fireEvent.change(screen.getByLabelText('Adults'), { target: { value: '3' } });
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    jest.useRealTimers();

    expect(await screen.findByText(/Your guide confirmed this itinerary/i)).toBeInTheDocument();
    // The edit surface is gone — not merely disabled.
    await waitFor(() => expect(screen.queryByRole('tab', { name: /Courses/i })).not.toBeInTheDocument());
    // 🔴 And no generic failure line, which would read as "try again".
    expect(screen.queryByText(/Couldn’t save|Couldn't save/i)).not.toBeInTheDocument();
  });
});

describe('낭비 제거 — 이미 저장된 초안을 탭 전환마다 다시 보내지 않는다', () => {
  it('does not re-PUT on tab hide once the debounced save has run', async () => {
    const { puts } = installFetch();
    await renderPlanner();
    jest.useFakeTimers();

    fireEvent.change(screen.getByLabelText('Adults'), { target: { value: '3' } });
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    await waitFor(() => expect(puts).toHaveLength(1));

    // Backgrounding the tab (a guest checking the map, taking a call…) used to
    // flush the already-saved draft again — every single time, forever.
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(puts).toHaveLength(1);
  });

  it('still flushes a draft that has not been saved yet', async () => {
    const { puts } = installFetch();
    await renderPlanner();
    jest.useFakeTimers();

    fireEvent.change(screen.getByLabelText('Adults'), { target: { value: '4' } });
    // No timer advance — the 2.5s debounce is still pending.
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(puts).toHaveLength(1);
    expect(puts[0].needs).toMatchObject({ adults: 4 });
  });
});
