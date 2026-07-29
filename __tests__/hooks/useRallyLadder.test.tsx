/**
 * SG-2a — the headless firer. Pinned: remind fires exactly once per notice
 * at the remind stage, departed fires exactly once inside the window that
 * OUTLIVES activeNotice, and a cancelled notice fires nothing. The server's
 * UNIQUE subjects are the real dedupe; these refs just spare the network.
 */
import { render } from '@testing-library/react';
import { RallyLadder } from '@/hooks/useRallyLadder';
import { RALLY_GRACE_MS } from '@/lib/tour-room/notices';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const TOUR_DATE = '2026-07-28';
const TARGET = Date.UTC(2026, 6, 28, 3, 0, 0); // 12:00 KST
const MIN = 60_000;

const timer = (createdAtMs: number, metadata: Record<string, unknown> = {}): RoomMessage =>
  ({
    id: 'n1',
    sender_role: 'system',
    created_at: new Date(createdAtMs).toISOString(),
    source_text: '',
    metadata: { kind: 'free_time_timer', until_time: '12:00', ...metadata },
  }) as unknown as RoomMessage;

const mountAt = (nowMs: number, messages: RoomMessage[]) => {
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);
  const view = render(
    <RallyLadder
      bookingId="b1"
      roomSession="s1"
      messages={messages}
      tourDate={TOUR_DATE}
      enabled
    />,
  );
  return { view, nowSpy };
};

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as unknown as typeof fetch;
});

const firedTypes = () =>
  fetchMock.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string).type);

describe('useRallyLadder', () => {
  it('fires the T-10 reminder at the remind stage, once', () => {
    const { nowSpy } = mountAt(TARGET - 8 * MIN, [timer(TARGET - 30 * MIN)]);
    try {
      expect(firedTypes()).toEqual(['rally_remind']);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('fires departed inside the window that OUTLIVES activeNotice', () => {
    const { nowSpy } = mountAt(TARGET + RALLY_GRACE_MS + MIN, [timer(TARGET - 30 * MIN)]);
    try {
      expect(firedTypes()).toEqual(['rally_departed']);
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.noticeId).toBe('n1');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('a cancelled notice fires nothing at all', () => {
    const { nowSpy } = mountAt(TARGET + RALLY_GRACE_MS + MIN, [
      timer(TARGET - 30 * MIN),
      { ...timer(TARGET - 5 * MIN, { cancelled: true, until_time: undefined }), id: 'n2' } as RoomMessage,
    ]);
    try {
      expect(firedTypes()).toEqual([]);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('quiet in between — no crossing, no network', () => {
    const { nowSpy } = mountAt(TARGET + 5 * MIN, [timer(TARGET - 30 * MIN)]); // 'due'
    try {
      expect(firedTypes()).toEqual([]);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
