/**
 * Ops Freedom — room manager: light default, date nav, manual-create entry
 * points, driver link action present.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import OpsRoomManager from '@/components/tour-ops/OpsRoomManager';

jest.mock('@/components/tour-ops/opsShared', () => ({ getOpsToken: jest.fn(async () => 'tok') }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function mockFetch(bookings: unknown[] = []) {
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const href = String(url);
    if (href.includes('/api/admin/tour-ops/bookings')) {
      return { ok: true, json: async () => ({ bookings }) } as Response;
    }
    if (href.includes('/api/admin/tour-ops/manual-booking')) {
      return { ok: true, json: async () => ({ tours: [{ id: 't1', title: 'Jeju Grand', city: 'Jeju' }] }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

const noop = () => undefined;

beforeEach(() => {
  window.localStorage.clear();
  mockFetch();
});

describe('OpsRoomManager (Ops Freedom)', () => {
  it('defaults to LIGHT theme and toggles to dark (persisted)', async () => {
    await act(async () => {
      render(<OpsRoomManager date="2026-07-18" onClose={noop} onOpenRoom={noop} onRoomsChanged={noop} />);
    });
    const root = screen.getByTestId('ops-room-manager');
    expect(root.className).toContain('bg-slate-50');
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(root.className).toContain('bg-slate-950');
    expect(window.localStorage.getItem('tour_ops_theme')).toBe('dark');
  });

  it('empty day still offers date nav + manual booking creation', async () => {
    await act(async () => {
      render(<OpsRoomManager date="2026-07-18" onClose={noop} onOpenRoom={noop} onRoomsChanged={noop} />);
    });
    expect(screen.getByTestId('date-input')).toBeInTheDocument();
    expect(screen.getByTestId('manual-booking-open')).toBeInTheDocument();
    // empty-state CTA opens the creation sheet with the tour picker
    await act(async () => {
      fireEvent.click(screen.getByTestId('manual-booking-open-empty'));
    });
    expect(screen.getByTestId('manual-booking-sheet')).toBeInTheDocument();
    expect(await screen.findByText(/Jeju Grand/)).toBeInTheDocument();
  });

  it('per-booking controls include the 기사(driver) link + channel badge', async () => {
    mockFetch([
      {
        id: 'b1',
        tour_id: 't1',
        tour_time: '08:00:00',
        contact_name: 'Caroline',
        contact_email: null,
        contact_phone: null,
        number_of_guests: 1,
        preferred_language: 'fr',
        status: 'confirmed',
        source: 'gyg',
        tour: { id: 't1', title: 'Jeju Grand' },
        room: null,
        invite: { customer_active: false, customer_last: null, guide_active: false, guide_last: null },
      },
    ]);
    await act(async () => {
      render(<OpsRoomManager date="2026-09-12" onClose={noop} onOpenRoom={noop} onRoomsChanged={noop} />);
    });
    expect(screen.getByText('기사 링크')).toBeInTheDocument();
    expect(screen.getByText('GYG')).toBeInTheDocument();
    expect(screen.getByText('룸 만들기 + 링크')).toBeInTheDocument();
  });
});
