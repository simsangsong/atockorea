/**
 * OpsManifestView — 룸 초대 이메일 일괄 발송 확인 게이트 (D10 friction).
 * 트리거 클릭만으로는 요청이 나가지 않고, 명시적 2차 클릭(확인 발송)에서만 POST.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpsManifestView from '@/components/tour-ops/OpsManifestView';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }) },
  },
}));

const BOOKINGS = [
  { id: 'b1', contactName: 'Massimo', contactPhone: null, contactEmail: 'm@example.com', partySize: 2, preferredLanguage: 'en', status: 'confirmed', source: 'atoc', externalBookingId: null, pickupName: 'Hotel A', pickupTime: '08:00', specialRequests: null },
  { id: 'b2', contactName: 'NoEmail', contactPhone: null, contactEmail: null, partySize: 1, preferredLanguage: 'ko', status: 'confirmed', source: 'atoc', externalBookingId: null, pickupName: 'Hotel A', pickupTime: '08:10', specialRequests: null },
  { id: 'b3', contactName: 'Tanaka', contactPhone: null, contactEmail: 'tanaka@example.jp', partySize: 3, preferredLanguage: 'ja', status: 'confirmed', source: 'atoc', externalBookingId: null, pickupName: 'Hotel B', pickupTime: '09:00', specialRequests: null },
];

function mockFetch() {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/bulk-invite')) {
      return { ok: true, json: async () => ({ url: 'https://atockorea.com/tour-mode/join/tok', sent: 2, skippedNoEmail: 1, failed: 0 }) } as unknown as Response;
    }
    if (u.includes('/manifest')) {
      return { ok: true, json: async () => ({ bookings: BOOKINGS }) } as unknown as Response;
    }
    return { ok: true, json: async () => ({}) } as unknown as Response;
  });
}

const postCalls = () =>
  (global.fetch as jest.Mock).mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'POST');

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch() as unknown as typeof fetch;
});

describe('OpsManifestView bulk invite confirm gate', () => {
  it('requires an explicit second click before POSTing bulk-invite', async () => {
    render(<OpsManifestView tourId="t1" tourDate="2026-08-17" tourTitle="Busan" />);

    const trigger = await screen.findByLabelText('룸 초대 이메일 일괄 발송');
    await waitFor(() => expect(trigger).not.toBeDisabled());

    // 확인 게이트 전 — POST 없음, 확인 버튼도 없음.
    expect(screen.queryByRole('button', { name: '확인 발송' })).toBeNull();
    expect(postCalls()).toHaveLength(0);

    // 1차 클릭: 확인 바만 뜬다(요청 없음).
    fireEvent.click(trigger);
    const confirm = await screen.findByRole('button', { name: '확인 발송' });
    expect(postCalls()).toHaveLength(0);

    // 2차 클릭(명시적): 이제서야 bulk-invite POST 1회.
    fireEvent.click(confirm);
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(postCalls()[0][0]).toContain('/api/admin/tour-ops/manifest/bulk-invite');
  });

  it('cancel dismisses the gate without POSTing', async () => {
    render(<OpsManifestView tourId="t1" tourDate="2026-08-17" tourTitle="Busan" />);
    const trigger = await screen.findByLabelText('룸 초대 이메일 일괄 발송');
    await waitFor(() => expect(trigger).not.toBeDisabled());

    fireEvent.click(trigger);
    const cancel = await screen.findByRole('button', { name: '취소' });
    fireEvent.click(cancel);

    await waitFor(() => expect(screen.queryByRole('button', { name: '확인 발송' })).toBeNull());
    expect(postCalls()).toHaveLength(0);
  });
});
