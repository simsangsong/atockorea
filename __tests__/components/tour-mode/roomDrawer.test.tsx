/**
 * U4-D5 — the room drawer (카톡 서랍): media roundup + shortcuts + members.
 * Network is mocked; each kind hits GET /media?kind= with the room session.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RoomDrawer from '@/components/tour-mode/RoomDrawer';

const IMG = {
  id: 'm1',
  created_at: '2026-07-27T01:00:00Z',
  sender_role: 'customer',
  url: 'https://cdn/x.webp',
  name: 'lunch.webp',
  mime: 'image/webp',
  size: 1234,
  caption: '점심!',
};
const FILE = { ...IMG, id: 'm2', url: 'https://cdn/doc.pdf', name: 'voucher.pdf', mime: 'application/pdf' };
const LINK = {
  id: 'm3',
  created_at: '2026-07-27T01:02:00Z',
  sender_role: 'guide',
  url: 'https://map.kakao.com/link/to/x',
  text: '여기예요 https://map.kakao.com/link/to/x',
};

function mockMedia() {
  const calls: string[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    calls.push(url);
    expect((init?.headers as Record<string, string>)['x-tour-room-auth']).toBe('sess-1');
    const items = url.includes('kind=image') ? [IMG] : url.includes('kind=file') ? [FILE] : [LINK];
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items, nextCursor: null }),
    } as Response);
  }) as unknown as typeof fetch;
  return calls;
}

function mount(over: Partial<React.ComponentProps<typeof RoomDrawer>> = {}) {
  return render(
    <RoomDrawer
      title="제주 하이라이트"
      locale="ko"
      bookingId="b1"
      roomSession="sess-1"
      participants={[
        { role: 'guide', display_name: '가이드 김' },
        { role: 'customer', display_name: 'Massimo' },
      ]}
      onClose={jest.fn()}
      onSelectTab={jest.fn()}
      onOpenEmergency={jest.fn()}
      {...over}
    />,
  );
}

describe('RoomDrawer (U4-D5)', () => {
  it('loads all three media kinds with room auth and renders them', async () => {
    const calls = mockMedia();
    mount();
    await waitFor(() => expect(screen.getByTestId('drawer-images')).toBeInTheDocument());
    expect(screen.getByTestId('drawer-files')).toHaveTextContent('voucher.pdf');
    expect(screen.getByTestId('drawer-links')).toHaveTextContent('map.kakao.com');
    expect(calls.filter((u) => u.includes('/api/tour-rooms/b1/media'))).toHaveLength(3);
  });

  it('drawer shortcuts close then act (tab switch / emergency)', async () => {
    mockMedia();
    const onClose = jest.fn();
    const onSelectTab = jest.fn();
    const onOpenEmergency = jest.fn();
    mount({ onClose, onSelectTab, onOpenEmergency });
    fireEvent.click(screen.getByTestId('drawer-shortcut-schedule'));
    expect(onClose).toHaveBeenCalled();
    expect(onSelectTab).toHaveBeenCalledWith('schedule');
    fireEvent.click(screen.getByTestId('drawer-shortcut-emergency'));
    expect(onOpenEmergency).toHaveBeenCalled();
  });

  it('hides the Smart Guide shortcut without the callback (staff view)', async () => {
    mockMedia();
    mount({ onOpenConcierge: undefined });
    expect(screen.queryByTestId('drawer-shortcut-concierge')).not.toBeInTheDocument();
  });

  it('lists members with role badges', async () => {
    mockMedia();
    mount();
    const members = screen.getByTestId('drawer-members');
    expect(members).toHaveTextContent('가이드 김');
    expect(members).toHaveTextContent('Massimo');
    expect(members).toHaveTextContent('여행자');
  });

  it('Escape closes the drawer', async () => {
    mockMedia();
    const onClose = jest.fn();
    mount({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
