/**
 * X12 — the confirmation path, which no test had ever named.
 *
 * §G-q's second priority after the ledger. 「일정 확정 (손님에게 발송)」 is the
 * button that turns a guest's draft into the day and locks the guest out of
 * editing it, and nothing had ever pressed it.
 *
 * It also carries A2, added by the feature audit: every write sends the plan
 * version it was composed from, and a 409 `plan_stale` means the guest changed
 * something after this panel loaded. That behaviour was asserted by reading the
 * source (`__tests__/audit/planConcurrency.test.ts`) because the component had
 * no test to assert it in. This is that test — a source rule proves the line is
 * present; only this proves it does anything.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GuidePlanPanel from '@/components/tour-mode/guide/GuidePlanPanel';
import type { DayPlanStop } from '@/lib/tour-room/dayPlan';

const stop = (over: Partial<DayPlanStop> = {}): DayPlanStop =>
  ({
    id: 's-1',
    seq: 1,
    source: 'poi',
    poi_key: 'osulloc_tea_museum',
    place_id: null,
    name_i18n: { en: 'Osulloc Tea Museum' },
    stop_type: 'sight',
    arrival_planned: '10:00',
    duration_min: 60,
    status: 'pending',
    ...over,
  }) as DayPlanStop;

interface PlanBody {
  source: string;
  schedule: Array<Record<string, unknown>>;
  day_plan: { status?: string; version?: number; stops?: DayPlanStop[]; needs?: unknown } | null;
  tour: { date: string | null; region: string | null; total_hours: number | null; guide_curated: boolean };
}

const plan = (over: Partial<PlanBody> = {}): PlanBody => ({
  source: 'day_plan',
  schedule: [],
  day_plan: { status: 'guest_draft', version: 5, stops: [stop()], needs: null },
  // region null keeps the POI-suggestion fetch out of the way; it is not what
  // this suite is about.
  tour: { date: '2026-08-04', region: null, total_hours: 8, guide_curated: false },
  ...over,
});

let calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }>;

function mockApi(get: () => PlanBody, put?: () => { ok: boolean; status?: number; body?: unknown }) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ url: String(url), method, body });
    if (method === 'PUT') {
      const r = put?.() ?? { ok: true, body: { day_plan: { ...get().day_plan, status: 'guide_confirmed', version: 6 } } };
      return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500), json: async () => r.body ?? {} };
    }
    return { ok: true, status: 200, json: async () => get() };
  }) as unknown as typeof fetch;
}

const mount = () => render(<GuidePlanPanel bookingId="b-1" token="tok" />);

beforeEach(() => {
  calls = [];
});

describe('X12 — GuidePlanPanel: the confirm button', () => {
  it('offers 확정 for a guest draft and 저장 once the day is live', async () => {
    mockApi(() => plan());
    mount();
    expect(await screen.findByTestId('plan-confirm')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-save')).toBeNull();
  });

  it('🔴 a confirmed plan cannot be confirmed again', async () => {
    // Confirming twice would re-send "your day is set" to a guest who already
    // got it, and the panel is the only thing standing between the two.
    mockApi(() => plan({ day_plan: { status: 'guide_confirmed', version: 7, stops: [stop()] } }));
    mount();
    expect(await screen.findByTestId('plan-save')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-confirm')).toBeNull();
  });

  it('will not confirm an empty plan — the same rule the server keeps', async () => {
    mockApi(() => plan({ day_plan: { status: 'guest_draft', version: 5, stops: [] } }));
    mount();
    expect(await screen.findByTestId('plan-confirm')).toBeDisabled();
  });

  it('sends confirm:true with the stops it is showing', async () => {
    mockApi(() => plan());
    mount();
    await screen.findByTestId('plan-confirm');
    await act(async () => {
      fireEvent.click(screen.getByTestId('plan-confirm'));
    });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toMatchObject({ confirm: true });
    expect((put?.body?.stops as unknown[])?.length).toBe(1);
  });

  it('🔴 sends the version it composed the edit from (A2)', async () => {
    // Without it, a 확정 tapped after the guest added a stop posts this panel's
    // older stops array over the guest's edit and then locks them out of
    // putting it back. Asserted here as a REQUEST, not as a line of source.
    mockApi(() => plan());
    mount();
    await screen.findByTestId('plan-confirm');
    await act(async () => {
      fireEvent.click(screen.getByTestId('plan-confirm'));
    });
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ version: 5 });
  });
});

describe('X12 — GuidePlanPanel: someone changed it first', () => {
  it('🔴 takes the server plan, says so, and does not re-send', async () => {
    let served = plan();
    mockApi(
      () => served,
      () => {
        served = plan({ day_plan: { status: 'guest_draft', version: 6, stops: [stop(), stop({ id: 's-2', seq: 2, poi_key: 'seongsan_ilchulbong', name_i18n: { en: 'Seongsan Ilchulbong' } })] } });
        return { ok: false, status: 409, body: { error: 'plan_stale', day_plan: served.day_plan } };
      },
    );
    mount();
    await screen.findByTestId('plan-confirm');
    await act(async () => {
      fireEvent.click(screen.getByTestId('plan-confirm'));
    });

    expect(
      await screen.findByText('손님이 방금 일정을 바꿨어요. 최신 내용을 불러왔으니 다시 확인해 주세요.'),
    ).toBeInTheDocument();
    // The guest's newly added stop is on screen now…
    expect(await screen.findByText(/Seongsan Ilchulbong/)).toBeInTheDocument();
    // …and exactly one write was attempted. A retry would confirm content the
    // guide has not seen, which is the opposite of what 확정 means.
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('a plain failure still reports itself', async () => {
    mockApi(() => plan(), () => ({ ok: false, status: 500, body: { error: 'boom' } }));
    mount();
    await screen.findByTestId('plan-confirm');
    await act(async () => {
      fireEvent.click(screen.getByTestId('plan-confirm'));
    });
    expect(await screen.findByText(/저장 실패|저장에 실패/)).toBeInTheDocument();
  });
});

describe('X12 — GuidePlanPanel: what the guide is asked to review', () => {
  it('🔴 badges the stops the guest added that the served day does not have', async () => {
    // §G's diff. Without it the guide re-reads a whole itinerary looking for
    // the change, every time, and stops looking.
    mockApi(() =>
      plan({
        schedule: [{ poi_key: 'osulloc_tea_museum', title: 'Osulloc Tea Museum' }],
        day_plan: {
          status: 'guest_draft',
          version: 5,
          stops: [stop(), stop({ id: 's-2', seq: 2, poi_key: 'manjanggul_cave', name_i18n: { en: 'Manjanggul Cave' } })],
        },
      }),
    );
    mount();
    await screen.findByText(/Manjanggul Cave/);
    // One new stop, not two: the one already in the served schedule is not new.
    await waitFor(() => expect(screen.getAllByText('신규')).toHaveLength(1));
  });

  it('does not badge anything once the plan is live — everything is known by then', async () => {
    mockApi(() =>
      plan({
        schedule: [],
        day_plan: { status: 'guide_confirmed', version: 7, stops: [stop()] },
      }),
    );
    mount();
    await screen.findByTestId('plan-save');
    expect(screen.queryByText('신규')).toBeNull();
  });

  it('says when the plan could not be read at all', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    mount();
    expect(await screen.findByText('일정을 불러오지 못했어요.')).toBeInTheDocument();
  });
});
