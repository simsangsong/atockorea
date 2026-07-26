/**
 * §2-7 — 왓츠앱 문구 저장 UI.
 *
 * `tour-templates` 라우트는 처음부터 channel=whatsapp 을 받았지만 저장 화면은
 * 이메일에만 있었다. API가 되는 것과 운영자가 할 수 있는 것은 다르고, 그 차이는
 * 라우트 테스트로는 절대 안 잡힌다 — 그래서 화면을 통과시켜 본다.
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
  {
    id: 'b1',
    contactName: 'Massimo',
    contactPhone: '+821012345678',
    contactEmail: 'm@example.com',
    partySize: 2,
    preferredLanguage: 'en',
    status: 'confirmed',
    source: 'atoc',
    externalBookingId: null,
    pickupName: 'Hotel A',
    pickupTime: '08:00',
    specialRequests: null,
  },
];

function mockFetch() {
  return jest.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/tour-templates')) {
      return {
        ok: true,
        json: async () => ({
          locales: {
            en: { body: 'Hi {guestName}, pickup at {pickupTime}.', subject: null, source: 'global' },
            ko: { body: '{guestName}님, {pickupTime}에 뵐게요.', subject: null, source: 'global' },
          },
        }),
      } as unknown as Response;
    }
    if (u.includes('/manifest')) {
      return { ok: true, json: async () => ({ bookings: BOOKINGS }) } as unknown as Response;
    }
    return { ok: true, json: async () => ({}) } as unknown as Response;
  });
}

const callsWith = (method: string) =>
  (global.fetch as jest.Mock).mock.calls.filter(([, init]) => (init as RequestInit)?.method === method);

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch() as unknown as typeof fetch;
});

async function openEditor() {
  render(<OpsManifestView tourId="t1" tourDate="2026-08-17" tourTitle="Busan" />);
  await waitFor(() => expect(screen.getByTestId('wa-template-edit')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('wa-template-edit'));
  await waitFor(() => expect(screen.getByTestId('wa-template-editor')).toBeInTheDocument());
}

describe('WhatsApp per-tour template editor', () => {
  it('starts from the message that actually goes out, not an empty box', async () => {
    await openEditor();
    expect((screen.getByTestId('wa-template-body') as HTMLTextAreaElement).value).toBe(
      'Hi {guestName}, pickup at {pickupTime}.',
    );
  });

  it('saves on the whatsapp channel, not email', async () => {
    await openEditor();
    fireEvent.change(screen.getByTestId('wa-template-body'), { target: { value: 'Edited body' } });
    fireEvent.click(screen.getByTestId('wa-template-save'));

    await waitFor(() => expect(callsWith('PUT')).toHaveLength(1));
    const body = JSON.parse((callsWith('PUT')[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ tourId: 't1', channel: 'whatsapp', locale: 'en', body: 'Edited body' });
  });

  it('refuses to save an unchanged or empty body — clearing is [기본으로 되돌리기]', async () => {
    await openEditor();
    // 손대지 않은 상태는 저장할 것이 없다.
    expect(screen.getByTestId('wa-template-save')).toBeDisabled();
    fireEvent.change(screen.getByTestId('wa-template-body'), { target: { value: '   ' } });
    expect(screen.getByTestId('wa-template-save')).toBeDisabled();
    expect(callsWith('PUT')).toHaveLength(0);
  });

  it('reverts through DELETE on the whatsapp channel', async () => {
    await openEditor();
    fireEvent.click(screen.getByTestId('wa-template-revert'));
    await waitFor(() => expect(callsWith('DELETE')).toHaveLength(1));
    expect(String(callsWith('DELETE')[0][0])).toContain('channel=whatsapp');
  });

  it('edits each locale separately', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'ko' }));
    await waitFor(() =>
      expect((screen.getByTestId('wa-template-body') as HTMLTextAreaElement).value).toBe(
        '{guestName}님, {pickupTime}에 뵐게요.',
      ),
    );
  });
});
