/**
 * @jest-environment node
 *
 * §2-6 — 명단이 읽는 발송 이력.
 *
 * 이 스위트가 고정하는 계약은 하나다: **채널이 섞이지 않는다.**
 * `ops_whatsapp_send_logs`에는 왓츠앱과 이메일이 함께 살고 `opened_at`은
 * NOT NULL DEFAULT now()다. 채널을 안 거르면 메일 한 통이 "왓츠앱을 열었다"로
 * 표시되고, 운영자는 안 연 사람을 연 사람으로 보고 넘어간다 — 그러면 아무도
 * 왓츠앱을 못 받는다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/admin/tour-ops/manifest/route';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn(async () => ({ id: 'admin-1' })) }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/ops/weather/forecast', () => ({ getForecastCached: jest.fn(async () => null) }));

const createServerClientMock = createServerClient as jest.Mock;

const BOOKING = {
  id: 'bk-1',
  contact_name: 'Massimo C.',
  contact_phone: '+821012345678',
  contact_email: 'massimo@example.com',
  number_of_guests: 2,
  preferred_language: 'en',
  status: 'confirmed',
  source: 'gyg',
  external_booking_id: 'GYG-1',
  special_requests: null,
  ota_raw_meta: null,
  pickup_points: { name: 'Lotte Hotel', pickup_time: '08:00' },
};

function makeDb(logs: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      for (const name of ['select', 'eq', 'in', 'neq', 'order', 'limit', 'gte', 'lte']) {
        chain[name] = () => chain;
      }
      const resolve = async () => {
        if (table === 'bookings') return { data: [BOOKING], error: null };
        if (table === 'ops_whatsapp_send_logs') return { data: logs, error: null };
        if (table === 'tours') return { data: [{ id: 'tour-1', title: 'Jeju', city: 'Jeju' }], error: null };
        return { data: [], error: null };
      };
      chain.maybeSingle = async () => {
        const res = await resolve();
        return { data: Array.isArray(res.data) ? res.data[0] ?? null : res.data, error: res.error };
      };
      chain.single = chain.maybeSingle;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain.then = (ok: any, err: any) => resolve().then(ok, err);
      return chain;
    },
  };
}

const req = () =>
  ({
    nextUrl: { searchParams: new URLSearchParams('tourId=tour-1&date=2026-08-17') },
  }) as never;

const log = (over: Record<string, unknown>) => ({
  booking_id: 'bk-1',
  channel: 'whatsapp',
  status: 'opened',
  subject: null,
  error: null,
  opened_at: '2026-08-16T09:00:00Z',
  marked_sent_at: null,
  created_at: '2026-08-16T09:00:00Z',
  ...over,
});

beforeEach(() => jest.clearAllMocks());

it('does not let an email log masquerade as an opened WhatsApp chat', async () => {
  createServerClientMock.mockReturnValue(
    makeDb([
      log({
        channel: 'email',
        status: 'sent',
        subject: '내일 픽업 안내',
        marked_sent_at: '2026-08-16T09:00:00Z',
      }),
    ]),
  );
  const json = await (await GET(req())).json();
  const booking = json.bookings[0];
  expect(booking.waOpenedAt).toBeNull();
  expect(booking.waMarkedSentAt).toBeNull();
  expect(booking).toMatchObject({ emailStatus: 'sent', emailSubject: '내일 픽업 안내' });
});

it('keeps the reason a mail did not go out', async () => {
  createServerClientMock.mockReturnValue(
    makeDb([log({ channel: 'email', status: 'skipped', error: '이메일 주소 없음' })]),
  );
  const booking = (await (await GET(req())).json()).bookings[0];
  expect(booking).toMatchObject({ emailStatus: 'skipped', emailError: '이메일 주소 없음' });
});

it('still reports WhatsApp state from WhatsApp rows', async () => {
  createServerClientMock.mockReturnValue(
    makeDb([log({ marked_sent_at: '2026-08-16T10:00:00Z' }), log({ channel: 'email', status: 'sent' })]),
  );
  const booking = (await (await GET(req())).json()).bookings[0];
  expect(booking.waMarkedSentAt).toBe('2026-08-16T10:00:00Z');
  expect(booking.emailStatus).toBe('sent');
});

it('leaves a booking with no logs blank on both channels', async () => {
  createServerClientMock.mockReturnValue(makeDb([]));
  const booking = (await (await GET(req())).json()).bookings[0];
  expect(booking.waOpenedAt).toBeNull();
  expect(booking.emailStatus).toBeNull();
});
