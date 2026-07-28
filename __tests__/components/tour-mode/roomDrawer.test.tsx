/**
 * U4-D5 — the room drawer (카톡 서랍): media roundup + shortcuts + members.
 * Network is mocked; each kind hits GET /media?kind= with the room session.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RoomDrawer from '@/components/tour-mode/RoomDrawer';
import { __setInstallPromptStateForTests, type BeforeInstallPromptEvent } from '@/hooks/useInstallPrompt';

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
        { id: 'p-guide', role: 'guide', display_name: '가이드 김' },
        { id: 'p-me', role: 'customer', display_name: 'Massimo' },
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

  /**
   * 🔴 These two guarded the navigation shortcuts (Today / Map / Settings /
   * Smart Guide) that were removed on 2026-07-28: every one of them was
   * already ONE tap away on the tab bar or header, so reaching them through a
   * drawer was two taps to the same place. What must stay guarded now is the
   * inverse — that they are GONE, and that the one shortcut kept for safety
   * still works.
   */
  it('no longer duplicates the tab bar', async () => {
    mockMedia();
    mount();
    for (const key of ['schedule', 'map', 'settings', 'concierge']) {
      expect(screen.queryByTestId(`drawer-shortcut-${key}`)).not.toBeInTheDocument();
    }
  });

  it('keeps the emergency shortcut and it closes then acts', async () => {
    mockMedia();
    const onClose = jest.fn();
    const onOpenEmergency = jest.fn();
    mount({ onClose, onOpenEmergency });
    fireEvent.click(screen.getByTestId('drawer-shortcut-emergency'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenEmergency).toHaveBeenCalled();
  });

  it('marks the viewer in the member list', async () => {
    mockMedia();
    mount({ myParticipantId: 'p-me' });
    expect(screen.getByTestId('drawer-member-me')).toBeInTheDocument();
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

  describe('install tile (T-D2)', () => {
    afterEach(() => __setInstallPromptStateForTests({ deferred: null, installed: false }));

    it('is absent when no install path exists', () => {
      mockMedia();
      mount();
      expect(screen.queryByTestId('drawer-install-tile')).not.toBeInTheDocument();
    });

    it('native mode: tapping the tile fires the captured prompt in place', async () => {
      mockMedia();
      const prompt = jest.fn().mockResolvedValue(undefined);
      __setInstallPromptStateForTests({
        deferred: Object.assign(new Event('beforeinstallprompt'), {
          prompt,
          userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
        }) as BeforeInstallPromptEvent,
      });
      const onClose = jest.fn();
      const onSelectTab = jest.fn();
      mount({ onClose, onSelectTab });
      fireEvent.click(screen.getByTestId('drawer-install-tile'));
      await waitFor(() => expect(prompt).toHaveBeenCalled());
      // native prompt overlays the drawer — no close, no tab switch
      expect(onSelectTab).not.toHaveBeenCalled();
    });

    it('iOS mode: the tile routes to Settings, where the install card sits on top', () => {
      mockMedia();
      const realUa = window.navigator.userAgent;
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Safari/604.1',
        configurable: true,
      });
      __setInstallPromptStateForTests({ deferred: null });
      const onClose = jest.fn();
      const onSelectTab = jest.fn();
      mount({ onClose, onSelectTab });
      fireEvent.click(screen.getByTestId('drawer-install-tile'));
      expect(onClose).toHaveBeenCalled();
      expect(onSelectTab).toHaveBeenCalledWith('settings');
      Object.defineProperty(window.navigator, 'userAgent', { value: realUa, configurable: true });
    });
  });
});
