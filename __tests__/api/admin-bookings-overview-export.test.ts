/**
 * @jest-environment node
 *
 * §2-8 — 예약 내역 엑셀.
 *
 * 순수 AoA는 csv.test.ts가 지킨다. 여기서 확인하는 것은 라우트가 **같은 리졸버의
 * 결과로** 진짜 xlsx 바이트를 내보내는가다 — 내보내기가 자기 쿼리를 갖는 순간
 * 화면과 파일의 숫자가 어긋나고, 그때는 둘 다 못 믿는다(B1.6).
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/admin/tour-ops/bookings-overview/route';
import { createServerClient } from '@/lib/supabase';
import { loadUnifiedBookings } from '@/lib/ops/bookings/unified.server';
import { buildUnifiedRecords, summarize } from '@/lib/ops/bookings/unified';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn(async () => ({ id: 'admin-1' })) }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn(() => ({})) }));
jest.mock('@/lib/ops/bookings/unified.server', () => ({ loadUnifiedBookings: jest.fn() }));

const loadUnifiedBookingsMock = loadUnifiedBookings as jest.Mock;

const records = buildUnifiedRecords({
  bookings: [
    {
      id: 'b1',
      tour_id: 't1',
      tour_date: '2026-08-17',
      created_at: '2026-08-01T02:00:00Z',
      contact_name: 'Massimo Cassina',
      number_of_guests: 2,
      status: 'confirmed',
      source: 'gyg',
    },
  ],
  parseFailures: [{ id: 'f1', source_platform: 'klook', reason: '본문 없음', created_at: '2026-08-02T00:00:00Z' }],
});

const req = (search: string) => ({ nextUrl: { searchParams: new URLSearchParams(search) } }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  loadUnifiedBookingsMock.mockResolvedValue({
    records,
    summary: summarize(records),
    inbox: 'active',
    range: { from: '2026-08-01', to: '2026-08-31' },
  });
  (createServerClient as jest.Mock).mockReturnValue({});
});

it('returns a real xlsx workbook, not a renamed csv', async () => {
  const res = await GET(req('view=month&month=2026-08&format=xlsx'));
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toContain('spreadsheetml');
  expect(res.headers.get('Content-Disposition')).toContain('atockorea-bookings-2026-08-01_2026-08-31.xlsx');
  // xlsx는 zip이다 — 'PK'로 시작하지 않으면 엑셀이 열지 못한다.
  const bytes = Buffer.from(await res.arrayBuffer());
  expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
});

it('reads the same loader the screen reads', async () => {
  await GET(req('view=month&month=2026-08&format=xlsx'));
  expect(loadUnifiedBookingsMock).toHaveBeenCalledTimes(1);
});

it('still serves CSV and JSON', async () => {
  const csv = await GET(req('view=month&month=2026-08&format=csv'));
  expect(csv.headers.get('Content-Type')).toContain('text/csv');

  const json = await GET(req('view=month&month=2026-08'));
  expect((await json.json()).view).toBe('month');
});
