/**
 * T0.7 — server-side HTTP Broadcast helper (§O-7) and secret channel naming (R-23).
 */
import {
  broadcastToRoom,
  broadcastToRooms,
  roomChannelSecret,
  roomChannelTopic,
} from '@/lib/tour-room/realtime';

describe('lib/tour-room/realtime', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  describe('channel naming (R-23)', () => {
    it('embeds an 8-char derived secret so a bare roomId cannot subscribe', () => {
      const topic = roomChannelTopic('room-1', 'active');
      expect(topic).toMatch(/^tour-room:room-1:[0-9a-f]{8}$/);
    });

    it('is deterministic per (room, status) and rotates when the room closes', () => {
      expect(roomChannelSecret('room-1', 'active')).toBe(roomChannelSecret('room-1', 'active'));
      expect(roomChannelSecret('room-1', 'active')).not.toBe(roomChannelSecret('room-1', 'closed'));
      expect(roomChannelSecret('room-1', 'active')).not.toBe(roomChannelSecret('room-2', 'active'));
    });
  });

  describe('broadcastToRoom', () => {
    it('POSTs to the Realtime HTTP broadcast endpoint with the service key', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await broadcastToRoom({ id: 'room-1', status: 'active' }, 'message', { id: 'm1' });
      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://example.supabase.co/realtime/v1/api/broadcast');
      expect(init.headers.apikey).toBe('service-key');
      const body = JSON.parse(init.body);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].topic).toBe(roomChannelTopic('room-1', 'active'));
      expect(body.messages[0].event).toBe('message');
      expect(body.messages[0].payload).toEqual({ id: 'm1' });
    });

    it('never throws on transport failure — the committed write must not be rolled back by a push failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
      const result = await broadcastToRoom({ id: 'room-1' }, 'message', {});
      expect(result.ok).toBe(false);
      expect(result.error).toContain('network down');
    });

    it('reports (not throws) on non-2xx responses and missing env', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 403, text: async () => 'denied' }) as unknown as typeof fetch;
      const denied = await broadcastToRoom({ id: 'room-1' }, 'message', {});
      expect(denied).toMatchObject({ ok: false, status: 403 });

      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const noEnv = await broadcastToRoom({ id: 'room-1' }, 'message', {});
      expect(noEnv.ok).toBe(false);
    });
  });

  describe('broadcastToRooms (fan-out, D-3)', () => {
    it('sends one HTTP call with one topic per room', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const rooms = [
        { id: 'room-1', status: 'active' },
        { id: 'room-2', status: 'active' },
      ];
      const result = await broadcastToRooms(rooms, 'message', { text: 'meet at 3pm' });
      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages.map((m: { topic: string }) => m.topic)).toEqual([
        roomChannelTopic('room-1', 'active'),
        roomChannelTopic('room-2', 'active'),
      ]);
    });

    it('short-circuits on an empty room list', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;
      const result = await broadcastToRooms([], 'message', {});
      expect(result.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
