/**
 * 🔴 A RE-join must not tear the room down (2026-08-07).
 *
 * Changing the app or chat language re-joins so the participant row follows.
 * `doJoin` announced that with an unconditional `status: 'joining'`, and
 * `TourRoomClient` renders a full-screen skeleton for that status — so the live
 * room unmounted and came back as a fresh shell on every language switch. The
 * guest was standing in Settings and landed on a rebuilt Chat tab, which is why
 * the reported "the dashboard disappeared" screenshot is of the chat screen.
 *
 * This is the same shape as the I7v4 fold defect (PR #739): the state that
 * mattered lived in a component that quietly unmounted, and no test measured a
 * round trip. So the first case here IS the round trip.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useTourRoomSession, type TourRoomSessionState } from '@/hooks/useTourRoomSession';

const BOOKING = 'booking-1';
const joinResult = (locale: string) => ({
  room: { id: 'room-1', status: 'active' },
  lifecycle: 'live',
  participant: { id: 'p-1', role: 'customer', display_name: 'Alex', locale },
  session: `session-${locale}`,
  channel: { topic: 'tour-room:room-1:deadbeef' },
  snapshot: {},
});

/** Renders what the room shows for each status, so "did it unmount?" is observable. */
function Harness({ onState }: { onState: (s: TourRoomSessionState) => void }) {
  const { state, join } = useTourRoomSession(BOOKING);
  onState(state);
  return (
    <div>
      <button type="button" onClick={() => void join({ locale: 'ja' })}>
        switch language
      </button>
      {state.status === 'joining' && <div data-testid="skeleton" />}
      {state.status === 'joined' && <div data-testid="room">{String(state.data.participant.locale)}</div>}
    </div>
  );
}

describe('useTourRoomSession — re-join keeps the room on screen', () => {
  let seen: TourRoomSessionState[];

  beforeEach(() => {
    seen = [];
    window.localStorage.clear();
    window.localStorage.setItem('tour_mode_device_key', '5a7f0f6e-1111-4222-8333-944445555666');
    let call = 0;
    global.fetch = jest.fn(async () => {
      call += 1;
      return {
        ok: true,
        status: call === 1 ? 201 : 200,
        json: async () => joinResult(call === 1 ? 'en' : 'ja'),
      } as Response;
    }) as unknown as typeof fetch;
  });

  async function mountAndJoin() {
    render(<Harness onState={(s) => seen.push(s)} />);
    await act(async () => {
      screen.getByText('switch language').click();
    });
    await waitFor(() => expect(screen.getByTestId('room')).toBeInTheDocument());
    seen = [];
  }

  it('🔴 a language switch never passes through the skeleton — the reported defect', async () => {
    await mountAndJoin();
    expect(screen.getByTestId('room')).toHaveTextContent('en');

    await act(async () => {
      screen.getByText('switch language').click();
    });
    await waitFor(() => expect(screen.getByTestId('room')).toHaveTextContent('ja'));

    // The room element must never have left the DOM: no 'joining' in between.
    expect(seen.map((s) => s.status)).not.toContain('joining');
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('the FIRST join still shows the skeleton — it has nothing to keep', async () => {
    render(<Harness onState={(s) => seen.push(s)} />);
    await act(async () => {
      screen.getByText('switch language').click();
    });
    await waitFor(() => expect(screen.getByTestId('room')).toBeInTheDocument());
    expect(seen.map((s) => s.status)).toContain('joining');
  });

  it('a failed re-join still surfaces as an error rather than a stale room', async () => {
    await mountAndJoin();
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    })) as unknown as typeof fetch;

    await act(async () => {
      screen.getByText('switch language').click();
    });
    await waitFor(() => expect(screen.queryByTestId('room')).not.toBeInTheDocument());
    expect(seen.at(-1)).toMatchObject({ status: 'error', httpStatus: 500 });
  });
});
