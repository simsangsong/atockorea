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

  /**
   * §5-3 (2026-08-04) — in-room chat search: filters the loaded feed,
   * excludes tombstones, and a tapped hit jumps the chat (focusMessageId
   * engine) — the drawer only reports the id.
   */
  it('searches the loaded feed and jumps to the tapped hit', async () => {
    mockMedia();
    const onJump = jest.fn();
    mount({
      messages: [
        { id: 'k1', created_at: '2026-07-27T01:00:00Z', source_text: '성산일출봉 도착', translations: { en: 'Arrived at Seongsan' } },
        { id: 'k2', created_at: '2026-07-27T01:05:00Z', source_text: '점심은 해녀의집', translations: {} },
        { id: 'k3', created_at: '2026-07-27T01:06:00Z', source_text: '성산 사진', translations: {}, metadata: { deleted: true } },
      ],
      onJumpToMessage: onJump,
    } as never);
    fireEvent.change(screen.getByTestId('drawer-search-input'), { target: { value: '성산' } });
    const hits = screen.getAllByTestId('drawer-search-hit');
    expect(hits).toHaveLength(1); // the tombstone stays out
    expect(hits[0]).toHaveTextContent('성산일출봉');
    fireEvent.click(hits[0]);
    expect(onJump).toHaveBeenCalledWith('k1');
    // Translations are searched too — the guest types in THEIR language.
    fireEvent.change(screen.getByTestId('drawer-search-input'), { target: { value: 'seongsan' } });
    expect(screen.getAllByTestId('drawer-search-hit')).toHaveLength(1);
  });

  it('Escape closes the drawer', async () => {
    mockMedia();
    const onClose = jest.fn();
    mount({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * T3 (§O ⑥) — one Esc used to close BOTH layers: the lightbox listens on
   * document, the drawer on window, and the key reached them in that order.
   * The topmost layer must consume the key; the layer beneath waits its turn.
   * (Dispatched on body so the event actually travels document → window, the
   * same path a real keypress takes from a focused element.)
   */
  it('Escape peels layers one at a time: lightbox first, drawer second', async () => {
    mockMedia();
    const onClose = jest.fn();
    mount({ onClose });
    await waitFor(() => expect(screen.getByTestId('drawer-images')).toBeInTheDocument());
    fireEvent.click(screen.getByAltText('lunch.webp'));
    expect(screen.getByTestId('lightbox')).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled(); // the drawer stayed

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * T3 — the media route has been keyset-paginated since U4-D5 and the drawer
   * never sent the cursor: the 31st photo was unreachable. The engine existed
   * with no caller — this pins the caller.
   */
  it('pages a media kind through nextCursor and stops when the server says done', async () => {
    const calls: string[] = [];
    const IMG2 = { ...IMG, id: 'm9', url: 'https://cdn/y.webp', name: 'sunset.webp' };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      const paged = url.includes('cursor=');
      const items = url.includes('kind=image') ? (paged ? [IMG2] : [IMG]) : [];
      const nextCursor = url.includes('kind=image') && !paged ? '2026-07-27T00:00:00Z' : null;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items, nextCursor }),
      } as Response);
    }) as unknown as typeof fetch;

    mount();
    await waitFor(() => expect(screen.getByTestId('drawer-images-more')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('drawer-images-more'));

    await waitFor(() => expect(screen.getByAltText('sunset.webp')).toBeInTheDocument());
    expect(screen.getByAltText('lunch.webp')).toBeInTheDocument(); // appended, not replaced
    expect(calls.some((u) => u.includes('kind=image') && u.includes('cursor=2026-07-27T00%3A00%3A00Z'))).toBe(true);
    // The server said done (nextCursor null) — the affordance withdraws.
    expect(screen.queryByTestId('drawer-images-more')).not.toBeInTheDocument();
    // Kinds whose first page had no cursor never grew a button.
    expect(screen.queryByTestId('drawer-files-more')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drawer-links-more')).not.toBeInTheDocument();
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
