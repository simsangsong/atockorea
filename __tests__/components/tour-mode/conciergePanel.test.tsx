/**
 * V2.2 — ConciergePanel: quick chips answer Tier 0 locally (zero fetch),
 * free-text guardrails answer/route correctly, unmatched questions hit the
 * concierge endpoint, and the chrome renders in every room locale.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConciergePanel from '@/components/tour-mode/ConciergePanel';
import { CONCIERGE_COPY } from '@/lib/tour-room/concierge';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const ARRIVAL: RoomMessage = {
  id: 'm1',
  sender_role: 'system',
  source_text: 'arrived',
  created_at: '2099-07-20T01:00:00Z',
  metadata: {
    kind: 'spot_arrival',
    spot_title: 'Gamcheon Culture Village',
    content: { convenience: { restroom: 'At the Tourist Information Center' }, smartNotes: { photo: 'Top deck at golden hour' } },
  },
};

function renderPanel(overrides: Partial<Parameters<typeof ConciergePanel>[0]> = {}) {
  return render(
    <ConciergePanel
      bookingId="booking-1"
      roomSession="session"
      locale="en"
      schedule={[{ time: '23:50', title: 'Night view' }]}
      messages={[ARRIVAL]}
      tourDate="2099-07-20"
      {...overrides}
    />,
  );
}

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ kind: 'tier1', text: 'LLM says hi' }),
  })) as unknown as typeof fetch;
});

describe('ConciergePanel (V2.2)', () => {
  it.each(ROOM_LOCALES)('renders the four chips and copy (%s)', (locale) => {
    renderPanel({ locale });
    expect(screen.getByText(CONCIERGE_COPY[locale].intro)).toBeInTheDocument();
    for (const intent of ['restroom', 'photo_spot', 'next_stop', 'time_left']) {
      expect(screen.getByTestId(`concierge-chip-${intent}`)).toBeInTheDocument();
    }
  });

  it('restroom chip answers instantly from arrival content — no network', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('concierge-chip-restroom'));
    expect(screen.getByText(/Tourist Information Center/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('photo chip answers from smartNotes.photo', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('concierge-chip-photo_spot'));
    expect(screen.getByText(/golden hour/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('free-text restroom question is Tier 0 too (keyword match, no fetch)', () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: '화장실 어디에요?' } });
    fireEvent.click(screen.getByTestId('concierge-send'));
    expect(screen.getByText(/Tourist Information Center/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('emergency free text answers locally with the SOS pointer', () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: 'I need an ambulance now' } });
    fireEvent.click(screen.getByTestId('concierge-send'));
    expect(screen.getByText(/119/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // §5.7 R-2 ③ — food asks were promoted OUT of the blanket venue refusal: the
  // Kakao/Google picks live in the DB, so this one intent pays a round trip
  // (and the endpoint still falls back to the same refusal when it has none).
  it('food asks go to the dining endpoint and render the returned card', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        kind: 'tier0_dining',
        text: 'Lunch near Gamcheon',
        card: {
          kind: 'dining_card',
          poi_key: 'gamcheon',
          spot_title: 'Gamcheon Culture Village',
          cell: 'wydm9q1',
          meal: 'lunch',
          dietary: [],
          source: 'cache',
          places: [],
        },
      }),
    });
    renderPanel();
    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: 'recommend a restaurant' } });
    fireEvent.click(screen.getByTestId('concierge-send'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('dining-card')).toBeInTheDocument());
  });

  it('non-food venue asks are still declined locally', () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: 'any souvenir shop for shopping?' } });
    fireEvent.click(screen.getByTestId('concierge-send'));
    expect(screen.getByText(/guide knows/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ops requests go to the server (escalation posts there)', async () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: 'can I get a refund?' } });
    fireEvent.click(screen.getByTestId('concierge-send'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/tour-rooms/booking-1/concierge');
    expect(JSON.parse((init as RequestInit).body as string).question).toContain('refund');
  });

  it('unmatched questions hit the endpoint and render its answer', async () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: 'is tap water safe to drink?' } });
    fireEvent.keyDown(screen.getByTestId('concierge-input'), { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('LLM says hi')).toBeInTheDocument());
  });

  it('a failed endpoint call shows the localized error copy', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) });
    renderPanel({ locale: 'ko' });
    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: 'is tap water safe?' } });
    fireEvent.click(screen.getByTestId('concierge-send'));
    await waitFor(() => expect(screen.getByText(CONCIERGE_COPY.ko.error)).toBeInTheDocument());
  });
});

/**
 * R7 (owner device report 2026-07-27) — the manual promises "send a photo of a
 * sign or a dish" inside the Smart Guide, but the sheet had no camera button:
 * vision-ask lived only in the chat composer. The button is now here, wired to
 * the same route, and it is hidden when the room can't ask (read-only/ended).
 */
describe('Smart Guide photo question (R7)', () => {
  const base = {
    bookingId: 'b1',
    roomSession: 'sess-1',
    locale: 'en' as const,
    schedule: [],
    messages: [],
    tourDate: '2026-07-27',
  };

  it('hides the camera button when no vision handler is supplied', () => {
    render(<ConciergePanel {...base} />);
    expect(screen.queryByTestId('concierge-photo')).not.toBeInTheDocument();
  });

  it('sends the picked photo through the vision handler and shows the answer in the thread', async () => {
    const onVisionAsk = jest.fn(
      async (_file: File, _options: { question: string; share: boolean }) => ({
        answer: 'Grilled pork belly — not spicy.',
      }),
    );
    render(<ConciergePanel {...base} onVisionAsk={onVisionAsk} />);

    fireEvent.change(screen.getByTestId('concierge-input'), { target: { value: 'is this spicy?' } });
    const file = new File(['x'], 'dish.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('concierge-photo-input'), { target: { files: [file] } });

    await waitFor(() => expect(onVisionAsk).toHaveBeenCalledTimes(1));
    expect(onVisionAsk.mock.calls[0][1]).toEqual({ question: 'is this spicy?', share: false });
    expect(await screen.findByText('Grilled pork belly — not spicy.')).toBeInTheDocument();
    // the typed question rides along as the thread's user turn
    expect(screen.getByText('is this spicy?')).toBeInTheDocument();
  });
});
