/**
 * W3 — ops app shell: tab bar, tour-grouped dashboard, SOS tab actions, and
 * the room drawer (open → REST backlog → composer send).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OpsApp from '@/components/tour-ops/OpsApp';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('next/dynamic', () => () => {
  const Stub = () => <div data-testid="ops-map-canvas" />;
  return Stub;
});
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }) },
    channel: () => {
      const chain = {
        on: () => chain,
        subscribe: (callback?: (status: string) => void) => {
          callback?.('SUBSCRIBED');
          return chain;
        },
      };
      return chain;
    },
    removeChannel: jest.fn(),
  },
}));

const ROOMS = [
  {
    id: 'room-1',
    booking_id: 'booking-1',
    tour_id: 'tour-1',
    status: 'active',
    booking: { contact_name: 'Alex', contact_phone: '+1-555', number_of_guests: 2, preferred_language: 'en' },
    tour: { id: 'tour-1', title: 'Busan Top', city: 'Busan' },
    participants: [{ room_id: 'room-1', role: 'customer', display_name: 'Alex', last_seen_at: null }],
    message_count: 2,
    last_message: { source_text: 'hello', sender_role: 'customer', created_at: '2099-07-20T01:00:00Z' },
    sos: null,
    onboard_ack: true,
  },
  {
    id: 'room-2',
    booking_id: 'booking-2',
    tour_id: 'tour-1',
    status: 'active',
    booking: { contact_name: 'Mia', contact_phone: null, number_of_guests: 4, preferred_language: 'ja' },
    tour: { id: 'tour-1', title: 'Busan Top', city: 'Busan' },
    participants: [],
    message_count: 0,
    last_message: null,
    sos: { metadata: { note: 'lost', latitude: 35.1, longitude: 129.0, sender_name: 'Mia' }, created_at: '2099-07-20T02:00:00Z' },
    onboard_ack: false,
  },
];

const CHANNELS = [
  { room_id: 'room-1', booking_id: 'booking-1', status: 'active', topic: 'tour-room:room-1:aaaa1111' },
  { room_id: 'room-2', booking_id: 'booking-2', status: 'active', topic: 'tour-room:room-2:bbbb2222' },
];

const MANAGED_BOOKINGS = [
  {
    id: 'booking-1',
    tour_id: 'tour-1',
    tour_time: '09:00:00',
    contact_name: 'Alex',
    contact_email: 'alex@example.com',
    contact_phone: '+1-555',
    number_of_guests: 2,
    preferred_language: 'en',
    status: 'confirmed',
    tour: { id: 'tour-1', title: 'Busan Top', city: 'Busan' },
    room: { id: 'room-1', status: 'active' },
    invite: { customer_active: true, customer_last: null, guide_active: false, guide_last: null },
  },
];

function mockFetch() {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/admin/tour-ops/bookings')) {
      return { ok: true, json: async () => ({ bookings: MANAGED_BOOKINGS }) } as Response;
    }
    if (url.includes('/api/admin/tour-ops/links')) {
      return {
        ok: true,
        json: async () => ({ role: 'customer', url: 'https://example.com/tour-mode/room/booking-1?rt=tok', qr_data_url: 'data:image/png;base64,x' }),
      } as Response;
    }
    if (url.includes('/api/admin/tour-ops/rooms')) {
      return { ok: true, json: async () => ({ rooms: ROOMS, sos_count: 1 }) } as Response;
    }
    if (url.includes('/api/admin/tour-ops/channels')) {
      return { ok: true, json: async () => ({ channels: CHANNELS }) } as Response;
    }
    if (url.includes('/messages') && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          message: { id: 'srv-1', sender_role: 'admin', source_text: '확인했습니다', created_at: '2099-07-20T03:00:00Z' },
        }),
      } as Response;
    }
    if (url.includes('/messages')) {
      return {
        ok: true,
        json: async () => ({
          messages: [{ id: 'm1', sender_role: 'customer', source_text: 'hello', created_at: '2099-07-20T01:00:00Z' }],
        }),
      } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = mockFetch() as unknown as typeof fetch;
});

/** The hub is the default tab now — most cases start on the dashboard. */
async function renderOnDashboard() {
  render(<OpsApp />);
  fireEvent.click(screen.getByRole('button', { name: /대시보드/ }));
  await waitFor(() => expect(screen.getAllByTestId('ops-room-card')).toHaveLength(2));
}

describe('OpsApp (W3)', () => {
  it('renders the tab bar and a tour-grouped dashboard with SOS pinned', async () => {
    await renderOnDashboard();

    // Shell: 5 tabs + header.
    expect(screen.getByText('투어 관제센터')).toBeInTheDocument();
    for (const label of ['홈', '대시보드', '지도', 'SOS', '설정']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }

    // Tour group header with boarding tally (1 of 2 rooms acked).
    expect(screen.getByText(/룸 2 · 탑승 1\/2 · 6명/)).toBeInTheDocument();

    // SOS room pinned first inside the group.
    const cards = screen.getAllByTestId('ops-room-card');
    expect(cards[0].textContent).toContain('Mia');
    expect(cards[0].textContent).toContain('lost');
  });

  it('opens the room drawer with the REST backlog and sends an admin message', async () => {
    await renderOnDashboard();

    fireEvent.click(screen.getAllByTestId('ops-room-card')[1]); // Alex's room
    await waitFor(() => expect(screen.getByPlaceholderText(/관제 메시지/)).toBeInTheDocument());
    const drawer = screen.getByRole('dialog', { name: '룸 대화' });
    await waitFor(() => expect(within(drawer).getByText('hello')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/관제 메시지/), { target: { value: '확인했습니다' } });
    fireEvent.click(screen.getByRole('button', { name: '발신' }));
    await waitFor(() => expect(screen.getByText('확인했습니다')).toBeInTheDocument());

    const postCall = (global.fetch as jest.Mock).mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    expect(String(postCall![0])).toContain('/api/tour-rooms/booking-1/messages');
  });

  it('lists SOS cards with one-tap actions on the SOS tab', async () => {
    await renderOnDashboard();

    fireEvent.click(screen.getByRole('button', { name: /SOS/ }));
    const card = await screen.findByTestId('ops-sos-card');
    expect(card.textContent).toContain('Mia');
    expect(screen.getByRole('link', { name: /위치/ })).toHaveAttribute('href', 'https://maps.google.com/?q=35.1,129');
    expect(screen.getByRole('button', { name: /룸 열기/ })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /룸 열기/ }));
    });
    await waitFor(() => expect(screen.getByPlaceholderText(/관제 메시지/)).toBeInTheDocument());
    // Drawer surfaces the SOS strip for the room.
    expect(screen.getAllByText(/lost/).length).toBeGreaterThan(0);
  });

  it('persists the sound toggle from the settings tab', async () => {
    await renderOnDashboard();

    fireEvent.click(screen.getByRole('button', { name: /설정/ }));
    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(window.localStorage.getItem('tour_ops_sound')).toBe('0');
  });
});

describe('OpsApp home hub', () => {
  it('boots on the hub with vitals, tiles, and an SOS shortcut', async () => {
    render(<OpsApp />);
    await waitFor(() => expect(screen.getByTestId('ops-home-stats')).toBeInTheDocument());

    // Vitals reflect the aggregate (2 rooms, 1 SOS).
    expect(screen.getByText('오늘 룸')).toBeInTheDocument();
    expect(screen.getByText(/활성 SOS 1건/)).toBeInTheDocument();

    // Task tiles.
    const tiles = screen.getByTestId('ops-home-tiles');
    for (const title of ['룸 · 링크 만들기', '실시간 모니터링', '메시지 모아보기', '위치 보기', '문답 학습', '챗봇 분석']) {
      expect(within(tiles).getByText(title)).toBeInTheDocument();
    }
    // Learning tiles deep-link into the admin tools.
    expect(within(tiles).getByText('문답 학습').closest('a')).toHaveAttribute('href', '/admin/qa-review');

    // 모니터링 tile navigates to the dashboard tab.
    fireEvent.click(within(tiles).getByText('실시간 모니터링'));
    await waitFor(() => expect(screen.getAllByTestId('ops-room-card')).toHaveLength(2));
  });

  it('opens the 룸·링크 관리 sheet, lists bookings, and mints a copyable link', async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => undefined) } });
    render(<OpsApp />);
    await waitFor(() => expect(screen.getByTestId('ops-home-tiles')).toBeInTheDocument());

    fireEvent.click(screen.getByText('룸 · 링크 만들기'));
    const manager = await screen.findByTestId('ops-room-manager');
    await waitFor(() => expect(within(manager).getByText(/Alex/)).toBeInTheDocument());
    expect(within(manager).getByText('룸 활성')).toBeInTheDocument();
    expect(within(manager).getByText('손님 링크 발급됨')).toBeInTheDocument();

    fireEvent.click(within(manager).getByRole('button', { name: /^손님 링크$/ }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/tour-mode/room/booking-1?rt=tok'),
    );
    const linksCall = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      String(url).includes('/api/admin/tour-ops/links'),
    );
    expect(JSON.parse((linksCall![1] as RequestInit).body as string)).toEqual({ bookingId: 'booking-1', role: 'customer' });
  });

  it('merges room messages into the 모아보기 inbox and opens the room from a row', async () => {
    render(<OpsApp />);
    await waitFor(() => expect(screen.getByTestId('ops-home-tiles')).toBeInTheDocument());

    fireEvent.click(screen.getByText('메시지 모아보기'));
    const inbox = await screen.findByTestId('ops-inbox');
    // Default filter is 손님 메시지 — Alex's customer last_message shows.
    await waitFor(() => expect(within(inbox).getByText('hello')).toBeInTheDocument());
    expect(within(inbox).getByText(/Alex/)).toBeInTheDocument();

    fireEvent.click(within(inbox).getByText('hello'));
    await waitFor(() => expect(screen.getByPlaceholderText(/관제 메시지/)).toBeInTheDocument());
  });
});
