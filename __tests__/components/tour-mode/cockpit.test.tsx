/**
 * Phase 2 (unified cockpit) — the shared dark <Cockpit/>.
 *
 * One surface serves the pure driver and the guide who is driving today; the
 * only difference is `onExit` (the guide's way back to dispatch). This locks
 * the shared render contract: the core driving controls always mount, and the
 * exit affordance appears only when a way back is provided.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Cockpit, { type CockpitRoom } from '@/components/tour-mode/cockpit/Cockpit';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import {
  readTourRoomSettings,
  __resetTourRoomSettingsForTests,
} from '@/hooks/useTourRoomSettings';

// Controllable channel state so tests can seed the feed with guest messages
// and assert against the optimistic send/queue surface (T0-4).
const sendTextMock = jest.fn().mockResolvedValue(true);
const sendPresetMock = jest.fn().mockResolvedValue(true);
const retryFailedMock = jest.fn();
const mockChannelState: {
  messages: RoomMessage[];
  connection: string;
  sendText: jest.Mock;
  sendPreset: jest.Mock;
  retryFailed: jest.Mock;
  failedCount: number;
} = {
  messages: [],
  connection: 'realtime',
  sendText: sendTextMock,
  sendPreset: sendPresetMock,
  retryFailed: retryFailedMock,
  failedCount: 0,
};
jest.mock('@/hooks/useTourRoomChannel', () => ({
  useTourRoomChannel: () => mockChannelState,
}));
jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => true),
  startVoiceRecording: jest.fn(),
}));
// Force the audio fallback path (no device STT) deterministically.
jest.mock('@/lib/tour-room/deviceStt', () => ({
  isDeviceSttSupported: jest.fn(() => false),
  startDeviceStt: jest.fn(),
}));

beforeAll(() => {
  // jsdom doesn't implement media playback; make it a resolved no-op so audio
  // priming (T0-5) exercises its promise path without console noise.
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = jest.fn();
});

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
  sendTextMock.mockClear().mockResolvedValue(true);
  sendPresetMock.mockClear().mockResolvedValue(true);
  retryFailedMock.mockClear();
  mockChannelState.messages = [];
  mockChannelState.connection = 'realtime';
  mockChannelState.failedCount = 0;
});

function guestMsg(extra: Partial<RoomMessage>): RoomMessage {
  return {
    id: 'm1',
    sender_role: 'customer',
    source_text: '',
    created_at: '2099-07-20T01:00:00Z',
    ...extra,
  };
}

const room: CockpitRoom = {
  booking_id: 'b1',
  number_of_guests: 2,
  pickup: { name: '제주공항', lat: 33.5, lng: 126.5, pickup_time: '09:00' },
  schedule_source: 'plan',
  schedule: [{ time: '10:00', title: '성산일출봉', poi_key: 'seongsan', lat: 33.45, lng: 126.94 }],
};

const base = {
  tourTitle: '제주 동부 투어',
  lifecycle: 'live' as const,
  room,
  bookingId: 'b1',
  session: 'sess',
  channelTopic: 'topic',
  initialMessages: [],
};

describe('shared Cockpit', () => {
  it('mounts the core driving controls (mic, typed send, one-tap actions)', () => {
    render(<Cockpit {...base} />);
    expect(screen.getByTestId('driver-console')).toBeInTheDocument();
    expect(screen.getByTestId('driver-mic')).toBeInTheDocument();
    expect(screen.getByTestId('driver-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-타세요')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-expense')).toBeInTheDocument();
    expect(screen.getByText('제주 동부 투어 · 연결됨')).toBeInTheDocument();
  });

  // A6 (plan §11.A) — the cockpit carries the DRIVER preset strip: one-tap
  // driving announcements, zero guest phrases.
  it('renders the driver quick-message strip and sends the 5-locale capsule on tap', async () => {
    render(<Cockpit {...base} />);
    const strip = screen.getByTestId('driver-quick-replies');
    expect(strip).toBeInTheDocument();
    expect(screen.getByTestId('driver-quick-departing_soon')).toBeInTheDocument();
    expect(screen.getByTestId('driver-quick-seatbelt_check')).toBeInTheDocument();
    expect(screen.queryByText(/화장실이 급해요/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('driver-quick-departing_soon'));
    await waitFor(() => expect(sendPresetMock).toHaveBeenCalledTimes(1));
    expect(sendPresetMock.mock.calls[0][0]).toMatchObject({ key: 'departing_soon' });
    expect(sendPresetMock.mock.calls[0][1]).toBe('ko');
  });

  // A5 — cockpit theme: default (system) renders DARK for night driving; the
  // header chip flips an explicit light/dark override in the device store.
  it('defaults to dark and flips to light via the header theme chip', () => {
    render(<Cockpit {...base} />);
    const console = screen.getByTestId('driver-console');
    expect(console.parentElement).toHaveClass('dark');

    fireEvent.click(screen.getByTestId('cockpit-theme-toggle'));
    expect(readTourRoomSettings().theme).toBe('light');
    expect(console.parentElement).not.toHaveClass('dark');

    fireEvent.click(screen.getByTestId('cockpit-theme-toggle'));
    expect(readTourRoomSettings().theme).toBe('dark');
    expect(console.parentElement).toHaveClass('dark');
  });

  it('omits the exit affordance for the pure driver (no onExit)', () => {
    render(<Cockpit {...base} />);
    expect(screen.queryByTestId('cockpit-exit')).not.toBeInTheDocument();
  });

  it('shows an exit-to-dispatch control for the guide and fires onExit', () => {
    const onExit = jest.fn();
    render(<Cockpit {...base} onExit={onExit} />);
    const exit = screen.getByTestId('cockpit-exit');
    expect(exit).toBeInTheDocument();
    fireEvent.click(exit);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('shows the pickup as the destination while in the lobby phase', () => {
    render(<Cockpit {...base} lifecycle="lobby" />);
    expect(screen.getByText('픽업')).toBeInTheDocument();
    expect(screen.getByText('09:00 제주공항')).toBeInTheDocument();
  });

  // TIER 0 P0 — a guest photo/file must be visible to the Korean-only driver,
  // not collapsed into an empty grey bubble.
  it('renders a caption-less guest photo (not an empty bubble)', () => {
    mockChannelState.messages = [
      guestMsg({
        input_kind: 'image',
        metadata: { attachment: { url: 'https://x/att/a.jpg', name: 'address.jpg' } },
      }),
    ];
    render(<Cockpit {...base} />);
    const img = screen.getByTestId('cockpit-image').querySelector('img');
    expect(img).toHaveAttribute('src', 'https://x/att/a.jpg');
  });

  it('renders a guest file attachment as a download chip with its name', () => {
    mockChannelState.messages = [
      guestMsg({
        id: 'm2',
        input_kind: 'file',
        metadata: { attachment: { url: 'https://x/att/t.pdf', name: 'ticket.pdf', size: 1024 } },
      }),
    ];
    render(<Cockpit {...base} />);
    const chip = screen.getByTestId('cockpit-file');
    expect(chip).toHaveAttribute('href', 'https://x/att/t.pdf');
    expect(screen.getByText('ticket.pdf')).toBeInTheDocument();
  });

  // TIER 0 P1 — sends go through the channel's optimistic queue (instant echo,
  // failure held for retry), not a bare fetch that can silently drop.
  it('routes a typed send through the optimistic channel', async () => {
    render(<Cockpit {...base} />);
    fireEvent.change(screen.getByTestId('driver-text-input'), { target: { value: '조금만 기다려 주세요' } });
    fireEvent.click(screen.getByTestId('driver-text-send'));
    await waitFor(() => expect(sendTextMock).toHaveBeenCalledWith('조금만 기다려 주세요'));
  });

  it('shows the retry banner and re-sends the queue when a send has failed', () => {
    mockChannelState.failedCount = 2;
    render(<Cockpit {...base} />);
    const retry = screen.getByTestId('cockpit-retry-failed');
    expect(retry).toHaveTextContent('전송 실패 2건');
    fireEvent.click(retry);
    expect(retryFailedMock).toHaveBeenCalled();
  });

  it('hides the retry banner when nothing is queued', () => {
    render(<Cockpit {...base} />);
    expect(screen.queryByTestId('cockpit-retry-failed')).not.toBeInTheDocument();
  });

  // TIER 1 T1-2 — the driver settles their own advanced expense from the cockpit
  // (guide-less private tour), not only from the guide panel.
  it('lists the driver own unsettled expenses and settles on tap', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string, opts?: { method?: string }) => {
      if (String(url).includes('/extras') && !opts?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            extras: [{ id: 'e-1', item: '입장권 4매', amount_krw: 48000, payer: 'driver', kind: 'ticket', status: 'confirmed' }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    const origFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      render(<Cockpit {...base} />);
      fireEvent.click(screen.getByTestId('driver-action-expense'));
      const settle = await screen.findByTestId('cockpit-settle-extra');
      expect(screen.getByTestId('cockpit-settle-list')).toHaveTextContent('입장권');
      fireEvent.click(settle);
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/extras'),
          expect.objectContaining({ method: 'PATCH' }),
        ),
      );
    } finally {
      global.fetch = origFetch;
    }
  });

  // TIER 1 T1-1 — the driver computes overtime (Jeju base 9h, ₩30,000/h) and
  // logs it as an 'overtime' expense. Jeju 9h base; 10h worked → 60 min raw OT,
  // of which the first 20 min are the free grace → 40 billable min → 0.5h →
  // ₩15,000 (grace-applied per D5).
  it('computes and logs driver overtime', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const origFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      render(<Cockpit {...base} city="Jeju" />);
      fireEvent.click(screen.getByTestId('driver-action-overtime'));
      fireEvent.change(screen.getByTestId('overtime-start'), { target: { value: '09:00' } });
      fireEvent.change(screen.getByTestId('overtime-end'), { target: { value: '19:00' } });
      fireEvent.click(screen.getByTestId('overtime-recompute'));
      expect(screen.getByTestId('overtime-hours')).toHaveTextContent('초과 0.5시간');
      expect(screen.getByTestId('overtime-amount')).toHaveTextContent('₩15,000');
      fireEvent.click(screen.getByTestId('overtime-log'));
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/extras'),
          expect.objectContaining({ method: 'POST', body: expect.stringContaining('"kind":"overtime"') }),
        ),
      );
    } finally {
      global.fetch = origFetch;
    }
  });

  // D5 — the overtime rate is per-city. Busan bills ₩40,000/h. Busan 8h base;
  // 9h10m worked → 70 min raw OT → 20 min grace → 50 billable min → 1h → ₩40,000.
  it('uses the Busan per-city overtime rate (₩40,000/h)', () => {
    render(<Cockpit {...base} city="Busan" />);
    fireEvent.click(screen.getByTestId('driver-action-overtime'));
    expect(screen.getByText(/₩40,000\/시간/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('overtime-start'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByTestId('overtime-end'), { target: { value: '18:10' } });
    fireEvent.click(screen.getByTestId('overtime-recompute'));
    expect(screen.getByTestId('overtime-hours')).toHaveTextContent('초과 1시간');
    expect(screen.getByTestId('overtime-amount')).toHaveTextContent('₩40,000');
  });

  // §11.D D7 — the private-only cash/overtime/settlement tools stay visible for
  // a PRIVATE tour and for the default (prop omitted ⇒ private), so every
  // current mount behaves identically.
  it('renders the private-only settlement tools for a private tour (and by default)', () => {
    const { unmount } = render(<Cockpit {...base} tourKind="private" />);
    expect(screen.getByTestId('driver-action-expense')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-overtime')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-summary')).toBeInTheDocument();
    unmount();

    // prop omitted ⇒ defaults to private ⇒ same controls render.
    render(<Cockpit {...base} />);
    expect(screen.getByTestId('driver-action-expense')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-overtime')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-summary')).toBeInTheDocument();
  });

  // §11.D D7 — on a JOIN tour the private-charter cash/overtime/settlement tools
  // are HIDDEN (prevent function confusion), while the neutral driving controls
  // (mic, typed send, one-tap actions) stay visible for both kinds.
  it('hides the private-only settlement tools on a join tour', () => {
    render(<Cockpit {...base} tourKind="join" />);
    expect(screen.queryByTestId('driver-action-expense')).not.toBeInTheDocument();
    expect(screen.queryByTestId('driver-action-overtime')).not.toBeInTheDocument();
    expect(screen.queryByTestId('driver-action-summary')).not.toBeInTheDocument();
    // neutral controls unaffected
    expect(screen.getByTestId('driver-mic')).toBeInTheDocument();
    expect(screen.getByTestId('driver-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('driver-action-타세요')).toBeInTheDocument();
  });

  // §11.D D7 — even if a stale `sheet` state points at a private sheet, the
  // join gate keeps the expense/overtime sheets from surfacing. Opening them
  // requires the (now hidden) buttons, so the sheets are simply unreachable.
  it('does not surface the expense sheet on a join tour', () => {
    render(<Cockpit {...base} tourKind="join" />);
    // The only entry point (지출·정산 button) is gone, so the settle list and
    // overtime inputs never mount.
    expect(screen.queryByTestId('cockpit-settle-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overtime-start')).not.toBeInTheDocument();
  });

  // TIER 0 P1 — the audio fallback (webview / no device STT) transcribes via
  // /stt and shows the text BEFORE sending; a flagged transcript needs an
  // explicit send so a mistranscription never fans out unseen.
  it('transcribes the audio fallback and requires explicit send when flagged', async () => {
    const recorder = jest.requireMock('@/lib/tour-room/recorder');
    let onFinish: ((c: { blob: Blob; mimeType: string }) => void) | null = null;
    recorder.startVoiceRecording.mockImplementation(
      (opts: { onFinish: (c: { blob: Blob; mimeType: string }) => void }) => {
        onFinish = opts.onFinish;
        return Promise.resolve({ stop: () => undefined, cancel: () => undefined });
      },
    );
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '천천히 오세요', needsConfirmation: true }),
    });
    const origFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      render(<Cockpit {...base} />);
      fireEvent.click(screen.getByTestId('driver-mic')); // start (audio path)
      expect(onFinish).toBeTruthy();
      await act(async () => {
        onFinish!({ blob: new Blob(['x']), mimeType: 'audio/webm' });
      });
      await screen.findByTestId('cockpit-confirm-send');
      expect(screen.getByText(/천천히 오세요/)).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/stt'), expect.anything());
      expect(sendTextMock).not.toHaveBeenCalled(); // flagged → no auto-send
      fireEvent.click(screen.getByTestId('cockpit-confirm-send'));
      await waitFor(() => expect(sendTextMock).toHaveBeenCalledWith('천천히 오세요'));
    } finally {
      global.fetch = origFetch;
      recorder.startVoiceRecording.mockReset();
    }
  });
});
