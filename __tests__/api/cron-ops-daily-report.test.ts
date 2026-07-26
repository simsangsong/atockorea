/**
 * @jest-environment node
 *
 * 관제 후속 §2-3 — 오토파일럿 점검을 일일 크론에 얹은 계약.
 *
 * 이 스위트가 고정하는 것은 둘이다:
 *   1. **점검이 보고서보다 먼저 돈다.** 오늘 만든 제안이 오늘 보고서의 요주의에
 *      실려야 의미가 있다. 순서가 뒤집히면 큐는 항상 하루 늦게 읽힌다.
 *   2. **점검이 실패해도 보고서는 나간다.** 이 저장소의 반복 실패모드가
 *      "부가 기능 하나가 본 기능을 죽이는 것"이다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/cron/ops-daily-report/route';
import { createServerClient } from '@/lib/supabase';
import { checkCronAuth } from '@/lib/cron-auth';
import { runDailyReport } from '@/lib/ops/report/send';
import { runAutopilot } from '@/lib/ops/autopilot/runner';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn(() => ({})) }));
jest.mock('@/lib/cron-auth', () => ({ checkCronAuth: jest.fn(() => 'authorized') }));
jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/ops/report/send', () => ({ runDailyReport: jest.fn() }));
jest.mock('@/lib/ops/autopilot/runner', () => ({ runAutopilot: jest.fn() }));

const checkCronAuthMock = checkCronAuth as jest.Mock;
const runDailyReportMock = runDailyReport as jest.Mock;
const runAutopilotMock = runAutopilot as jest.Mock;

function req(search = '') {
  return { nextUrl: { searchParams: new URLSearchParams(search) }, headers: new Headers() } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  checkCronAuthMock.mockReturnValue('authorized');
  runAutopilotMock.mockResolvedValue({
    checkedAt: '2026-07-26T09:00:00Z',
    horizonDays: 14,
    found: 3,
    created: 2,
    updated: 1,
    skippedResolved: 0,
  });
  runDailyReportMock.mockResolvedValue({ sent: true, skipped: false, reportDate: '2026-07-26' });
});

it('scans before sending, so today’s suggestions land in today’s report', async () => {
  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(runAutopilotMock).toHaveBeenCalledTimes(1);
  expect(runAutopilotMock.mock.invocationCallOrder[0]).toBeLessThan(
    runDailyReportMock.mock.invocationCallOrder[0],
  );
  expect((await res.json()).autopilot).toMatchObject({ found: 3, created: 2 });
});

it('still sends the report when the scan throws', async () => {
  runAutopilotMock.mockRejectedValue(new Error('suggestion upsert failed'));
  const res = await GET(req());
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(runDailyReportMock).toHaveBeenCalled();
  expect(json.sent).toBe(true);
  // 조용히 넘기지 않는다 — 응답에 실패가 남는다.
  expect(json.autopilot.error).toMatch(/upsert failed/);
});

it('does not scan for an unauthorized caller', async () => {
  checkCronAuthMock.mockReturnValue('unauthorized');
  expect((await GET(req())).status).toBe(401);
  expect(runAutopilotMock).not.toHaveBeenCalled();
});
