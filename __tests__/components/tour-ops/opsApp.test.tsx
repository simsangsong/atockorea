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

function mockFetch() {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
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

describe('OpsApp (W3)', () => {
  it('renders the tab bar and a tour-grouped dashboard with SOS pinned', async () => {
    render(<OpsApp />);
    await waitFor(() => expect(screen.getAllByTestId('ops-room-card')).toHaveLength(2));

    // Shell: 4 tabs + header.
    expect(screen.getByText('투어 관제센터')).toBeInTheDocument();
    for (const label of ['대시보드', '지도', 'SOS', '설정']) {
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
    render(<OpsApp />);
    await waitFor(() => expect(screen.getAllByTestId('ops-room-card')).toHaveLength(2));

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
    render(<OpsApp />);
    await waitFor(() => expect(screen.getAllByTestId('ops-room-card')).toHaveLength(2));

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
    render(<OpsApp />);
    await waitFor(() => expect(screen.getAllByTestId('ops-room-card')).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: /설정/ }));
    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(window.localStorage.getItem('tour_ops_sound')).toBe('0');
  });
});
