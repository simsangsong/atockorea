/**
 * Ops Freedom — room manager: light default, date nav, manual-create entry
 * points, driver link action present.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import OpsRoomManager from '@/components/tour-ops/OpsRoomManager';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';

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
  it('toggles to dark and persists to the SHARED device store (U-D9)', async () => {
    await act(async () => {
      render(<OpsRoomManager date="2026-07-18" onClose={noop} onOpenRoom={noop} onRoomsChanged={noop} />);
    });
    // W1.2 — the palette is theme-independent tr-* vars; the theme is
    // expressed by toggling `.dark` on the tr-root (which flips the vars).
    const root = screen.getByTestId('ops-room-manager');
    expect(root.classList.contains('tr-root')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(root.classList.contains('dark')).toBe(true);
    // 🔴 U-D9: this used to write `tour_ops_theme`, an ops-only key, so the
    // same person got two different answers about their own taste depending on
    // which console they were in. It writes the shared device store now.
    expect(JSON.parse(window.localStorage.getItem('tour_mode_settings') ?? '{}').theme).toBe('dark');
    expect(window.localStorage.getItem('tour_ops_theme')).toBeNull();
  });

  it('wears the device skin so the guide console and 관제 look like one app', async () => {
    window.localStorage.setItem('tour_mode_settings', JSON.stringify({ skin: 'forest' }));
    // The settings store memoises its snapshot at module scope; without this
    // the component reads the default that an earlier test already cached.
    __resetTourRoomSettingsForTests();
    await act(async () => {
      render(<OpsRoomManager date="2026-07-18" onClose={noop} onOpenRoom={noop} onRoomsChanged={noop} />);
    });
    expect(screen.getByTestId('ops-room-manager').getAttribute('data-tr-skin')).toBe('forest');
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

  it('운영자·기사 링크는 그룹 헤더에 1개씩 — 예약 행에는 손님 링크만 (entry-code §C-4)', async () => {
    // 예약 행마다 [별도 기사] 버튼이 있던 시절, "기사도 손님별로 매칭해 복사해야
    // 하나"는 오해가 실제로 나왔다(사장님 2026-08-08). 링크의 실제 스코프는
    // (투어,날짜)라 하루 1개다 — 버튼 위치가 그 사실을 말해야 한다.
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
      {
        id: 'b2',
        tour_id: 't1',
        tour_time: '08:00:00',
        contact_name: 'Marco',
        contact_email: null,
        contact_phone: null,
        number_of_guests: 2,
        preferred_language: 'it',
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
    // 그룹(투어) 레벨에 각 1개 — 예약이 2건이어도 버튼은 1쌍이다.
    expect(screen.getAllByText('운영자 링크')).toHaveLength(1);
    expect(screen.getAllByText('기사 (PIN)')).toHaveLength(1);
    // 예약 행에는 더 이상 없다(옛 라벨이 되살아나면 오해도 되살아난다).
    expect(screen.queryByText('별도 기사 (PIN)')).toBeNull();
    expect(screen.queryByText('운영자 링크 (가이드·운전)')).toBeNull();
    // 예약 행의 손님 링크·채널 뱃지는 그대로 예약 단위다.
    expect(screen.getAllByText('손님 링크')).toHaveLength(2);
    expect(screen.getAllByText('GYG')).toHaveLength(2);
    expect(screen.getAllByText('룸 만들기 + 링크')).toHaveLength(2);
  });
});
