/**
 * X12 — the guide's money screen, which no test had ever named.
 *
 * §G-q counted 13 smart-app components that appear in no test at all and said
 * to start with the two where a mistake costs something: the ledger (cash) and
 * the plan panel (the confirmation path). This is the first.
 *
 * What the panel decides is not cosmetic. It shows the unsettled total the
 * end-of-day cash conversation runs on, and it decides which rows still offer
 * 수취 완료 / 취소. That last one is a SECOND copy of a rule the server already
 * owns (`allowedExtraTransition`), and a second copy of a rule is this repo's
 * most reliable way to grow a defect — so the drift is asserted here directly
 * rather than trusted.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GuideLedgerPanel from '@/components/tour-mode/guide/GuideLedgerPanel';
import { allowedExtraTransition, formatKrw } from '@/lib/tour-room/ledger';

interface Row {
  id: string;
  item: string;
  amount_krw: number;
  kind: string;
  status: string;
  created_at: string;
}

const row = (over: Partial<Row> = {}): Row => ({
  id: 'e-1',
  item: '입장권 4매',
  amount_krw: 48_000,
  kind: 'ticket',
  status: 'logged',
  created_at: '2026-08-03T01:00:00Z',
  ...over,
});

/** Every call the panel makes, in order, so the assertions can name one. */
let calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }>;

function mockApi(get: () => { extras: Row[]; unsettled_krw: number }, overrides?: {
  patch?: () => { ok: boolean; status?: number; body?: unknown };
  post?: () => { ok: boolean; status?: number; body?: unknown };
}) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ url: String(url), method, body });
    if (method === 'PATCH') {
      const r = overrides?.patch?.() ?? { ok: true };
      return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500), json: async () => r.body ?? {} };
    }
    if (method === 'POST') {
      const r = overrides?.post?.() ?? { ok: true };
      return { ok: r.ok, status: r.status ?? (r.ok ? 201 : 500), json: async () => r.body ?? {} };
    }
    return { ok: true, status: 200, json: async () => get() };
  }) as unknown as typeof fetch;
}

const mount = () => render(<GuideLedgerPanel bookingId="b-1" token="tok" />);

beforeEach(() => {
  calls = [];
});

describe('X12 — GuideLedgerPanel: the unsettled total', () => {
  it('shows the amount the guide has to collect, formatted', async () => {
    mockApi(() => ({ extras: [row()], unsettled_krw: 48_000 }));
    mount();
    expect(await screen.findByText(/입장권 4매/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`미수취 ${formatKrw(48_000)}`))).toBeInTheDocument();
  });

  it('🔴 says nothing rather than "미수취 ₩0" when there is nothing to collect', async () => {
    // A zero badge on a cash screen reads as a demand. Absence is the message.
    mockApi(() => ({ extras: [row({ status: 'settled' })], unsettled_krw: 0 }));
    mount();
    await screen.findByText(/입장권 4매/);
    expect(screen.queryByText(/미수취/)).toBeNull();
  });

  it('says so when the ledger cannot be read, instead of showing an empty one', async () => {
    // "기록된 지출이 없어요" on a failed load is a lie about money.
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    mount();
    expect(await screen.findByText('정산 내역을 불러오지 못했어요.')).toBeInTheDocument();
  });
});

describe('X12 — GuideLedgerPanel: which rows may still be acted on', () => {
  /**
   * 🔴 The panel's render condition and the server's transition table are two
   * copies of one rule. This walks every status through both and requires them
   * to agree, so a change to either side that forgets the other fails here
   * rather than as a double-settled expense.
   */
  it.each(['logged', 'confirmed', 'settled', 'voided'])(
    'a %s row offers 수취 완료 exactly when the server would allow it',
    async (status) => {
      mockApi(() => ({ extras: [row({ status })], unsettled_krw: 0 }));
      mount();
      await screen.findByText(/입장권 4매/);
      const serverAllows = allowedExtraTransition('settle', 'guide', status, 'guide') !== null;
      expect(screen.queryAllByTestId('extra-settle').length > 0).toBe(serverAllows);
    },
  );

  it('a settled row cannot be cancelled either — cash received is final', async () => {
    mockApi(() => ({ extras: [row({ status: 'settled' })], unsettled_krw: 0 }));
    mount();
    await screen.findByText(/입장권 4매/);
    expect(screen.queryByText('취소')).toBeNull();
    expect(allowedExtraTransition('void', 'guide', 'settled')).toBeNull();
  });

  it('sends the action the button promises, and re-reads afterwards', async () => {
    mockApi(() => ({ extras: [row()], unsettled_krw: 48_000 }));
    mount();
    await screen.findByText(/입장권 4매/);
    await act(async () => {
      fireEvent.click(screen.getByTestId('extra-settle'));
    });
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toMatchObject({ extraId: 'e-1', action: 'settle' });
    // A screen that does not re-read shows a settled row as still owing.
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(1));
  });
});

describe('X12 — GuideLedgerPanel: when the row moved underneath', () => {
  it('🔴 re-reads on failure so the guide stops looking at a stale amount', async () => {
    // A2: the commonest failure here is `extra_stale` — somebody settled or
    // voided this row first. Showing an error and leaving the old list up means
    // the cash conversation runs on a number the server already disagrees with.
    let status = 'logged';
    mockApi(
      () => ({ extras: [row({ status })], unsettled_krw: status === 'logged' ? 48_000 : 0 }),
      {
        patch: () => {
          status = 'settled';
          return { ok: false, status: 409, body: { error: 'extra_stale' } };
        },
      },
    );
    mount();
    await screen.findByText(/입장권 4매/);
    await act(async () => {
      fireEvent.click(screen.getByTestId('extra-settle'));
    });
    expect(
      await screen.findByText('방금 다른 사람이 이 항목을 처리했어요. 최신 내역을 불러왔어요.'),
    ).toBeInTheDocument();
    // …and the refreshed list no longer offers the action.
    await waitFor(() => expect(screen.queryByTestId('extra-settle')).toBeNull());
  });

  it('a plain failure still says so', async () => {
    mockApi(() => ({ extras: [row()], unsettled_krw: 48_000 }), {
      patch: () => ({ ok: false, status: 500 }),
    });
    mount();
    await screen.findByText(/입장권 4매/);
    await act(async () => {
      fireEvent.click(screen.getByTestId('extra-settle'));
    });
    expect(await screen.findByText('처리에 실패했어요.')).toBeInTheDocument();
  });
});

describe('X12 — GuideLedgerPanel: logging an expense', () => {
  it('🔴 refuses an amount that is not money, without asking the server', async () => {
    mockApi(() => ({ extras: [], unsettled_krw: 0 }));
    mount();
    await screen.findByText('기록된 지출이 없어요.');
    fireEvent.change(screen.getByPlaceholderText(/항목/), { target: { value: '주차' } });
    fireEvent.change(screen.getByPlaceholderText('₩'), { target: { value: '0' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('extra-log'));
    });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('reads a typed amount the way a person types it', async () => {
    // "30,000" and "₩30000" are the same thirty thousand won.
    mockApi(() => ({ extras: [], unsettled_krw: 0 }));
    mount();
    await screen.findByText('기록된 지출이 없어요.');
    fireEvent.change(screen.getByPlaceholderText(/항목/), { target: { value: '주차' } });
    fireEvent.change(screen.getByPlaceholderText('₩'), { target: { value: '₩30,000' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('extra-log'));
    });
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({ item: '주차', amount_krw: 30_000 });
  });
});

describe('X12 — GuideLedgerPanel: the settlement summary', () => {
  it('is offered only when there is something to summarise', async () => {
    mockApi(() => ({ extras: [row({ status: 'voided' })], unsettled_krw: 0 }));
    mount();
    await screen.findByText(/입장권 4매/);
    // Every row cancelled — a summary of nothing sent to the guest's chat is
    // worse than no summary.
    expect(screen.queryByTestId('settlement-summary')).toBeNull();
  });

  it('appears once a live row exists, and says when it could not send', async () => {
    mockApi(() => ({ extras: [row()], unsettled_krw: 48_000 }), {
      post: () => ({ ok: false, status: 500 }),
    });
    mount();
    await screen.findByText(/입장권 4매/);
    await act(async () => {
      fireEvent.click(screen.getByTestId('settlement-summary'));
    });
    expect(await screen.findByText('요약 발송에 실패했어요.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ summary: true });
  });
});
