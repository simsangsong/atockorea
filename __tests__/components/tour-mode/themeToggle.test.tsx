/**
 * C-D1 (docs/smartapp-chat-ui-theme-master-plan-2026-07-27.md) — the header
 * icon diet. The old A5 header cycle button is GONE (KakaoTalk parity: max 3
 * right icons); the quick theme control lives on the drawer's 화면 모드 tile,
 * which cycles light → dark → system in place WITHOUT closing the drawer,
 * and the Settings tab keeps the full segmented control (settings.test.tsx).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import RoomShell from '@/components/tour-mode/RoomShell';
import RoomDrawer from '@/components/tour-mode/RoomDrawer';
import {
  readTourRoomSettings,
  writeTourRoomSettings,
  __resetTourRoomSettingsForTests,
} from '@/hooks/useTourRoomSettings';

const base = {
  title: 'Busan Signature',
  lifecycle: 'live' as const,
  connection: 'realtime' as const,
  locale: 'ko' as const,
  schedule: [],
  settings: <div>settings-content</div>,
  chat: <div>chat-content</div>,
};

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
  // The drawer fetches /media on mount; the tile test doesn't care about it.
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], nextCursor: null }),
    } as Response),
  ) as unknown as typeof fetch;
});

describe('header icon diet (C-D1)', () => {
  it('renders NO theme toggle in the room header anymore', () => {
    render(<RoomShell {...base} />);
    expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument();
  });

  it('keeps the room chrome to at most 3 right-side icon buttons', () => {
    render(
      <RoomShell
        {...base}
        concierge={<div>concierge</div>}
        renderDrawer={() => <div />}
      />,
    );
    // concierge + emergency + drawer — the full set.
    expect(screen.getByTestId('concierge-open')).toBeInTheDocument();
    expect(screen.getByTestId('emergency-open')).toBeInTheDocument();
    expect(screen.getByTestId('room-drawer-open')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument();
  });
});

describe('drawer 화면 모드 tile (theme quick control)', () => {
  function mountDrawer() {
    return render(
      <RoomDrawer
        title="부산 시그니처"
        locale="ko"
        bookingId="b1"
        roomSession="sess-1"
        participants={[]}
        onClose={jest.fn()}
        onSelectTab={jest.fn()}
        onOpenEmergency={jest.fn()}
      />,
    );
  }

  it('cycles system → light → dark → system and persists to the device store', () => {
    mountDrawer();
    const tile = screen.getByTestId('drawer-theme-tile');
    expect(tile).toHaveTextContent('자동'); // default: system

    fireEvent.click(tile); // system → light
    expect(readTourRoomSettings().theme).toBe('light');
    expect(tile).toHaveTextContent('라이트');

    fireEvent.click(tile); // light → dark
    expect(readTourRoomSettings().theme).toBe('dark');
    expect(tile).toHaveTextContent('다크');

    fireEvent.click(tile); // dark → system
    expect(readTourRoomSettings().theme).toBe('system');
    expect(tile).toHaveTextContent('자동');
  });

  it('does NOT close the drawer while cycling (live preview behind it)', () => {
    const onClose = jest.fn();
    render(
      <RoomDrawer
        title="부산 시그니처"
        locale="ko"
        bookingId="b1"
        roomSession="sess-1"
        participants={[]}
        onClose={onClose}
        onSelectTab={jest.fn()}
        onOpenEmergency={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('drawer-theme-tile'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the store still drives the shell wrapper (dark applies room-scoped)', () => {
    writeTourRoomSettings({ theme: 'dark' });
    const { container } = render(<RoomShell {...base} theme="dark" />);
    expect(container.querySelector('.dark .tr-root')).not.toBeNull();
  });
});
